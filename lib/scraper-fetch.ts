/**
 * Substituto do scraper.ts (Playwright) usando chamadas diretas à API REST do Gestão.
 * Mantém a mesma interface (ScrapeResult, ScrapeOptions) para compatibilidade
 * com o sync/route.ts.
 *
 * Total de HTTP requests: 3 (login + proposals + bulk allocations)
 */

import { GestaoAPI, GestaoProposal } from "./gestao-api";
import type { EventoExtraido } from "./parser";

export type ScrapeResult = {
  ok: boolean;
  erro?: string;
  eventosEncontrados: number;
  eventosKit: number;
  eventos: (EventoExtraido & { url: string })[];
  diagnostico?: string[];
};

export type ScrapeOptions = {
  baseUrl: string;
  usuario: string;
  senha: string;
  semanas: number;
  visivel?: boolean;
  debug?: boolean;
  onProgress?: (fase: string, porcentagem: number, atual?: number, total?: number) => void;
};

// ── Tipos do bulk ─────────────────────────────────────────────────────

type BulkTechnician = { id: string; name: string; status: string; funcao: string | null };
type BulkEventData = {
  totalAllocated: number;
  allTechnicians: BulkTechnician[];
};

// ── Helpers de mapeamento ─────────────────────────────────────────────

function parseCidadeUf(raw: string | null): { cidade: string | null; uf: string | null } {
  if (!raw) return { cidade: null, uf: null };
  const m = raw.match(/^(.+?)\s*-\s*([A-Z]{2})\s*$/);
  if (m) return { cidade: m[1].trim(), uf: m[2] };
  return { cidade: raw.trim(), uf: null };
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return null;
  }
}

function extrairDadosKit(items: GestaoProposal["items"]): {
  qtd_celulares: number;
  dias_entrega: number;
  qtd_totens: number;
  qtd_notebooks: number;
} {
  let qtd_celulares = 0;
  let dias_entrega = 0;
  let qtd_totens = 0;
  let qtd_notebooks = 0;

  for (const item of items || []) {
    const name = (item.name || item.description || "").toLowerCase();
    const qty = item.quantity || 0;
    const unit = (item.unit || "").toLowerCase();

    if (
      (name.includes("estação de entrega") || name.includes("estacao de entrega")) &&
      name.includes("gorunking")
    ) {
      qtd_celulares += qty;
      continue;
    }
    if (name.includes("sistema") && name.includes("entrega") && name.includes("gorunking")) {
      qtd_celulares += qty;
      continue;
    }
    if (
      (name.includes("técnico") || name.includes("tecnico")) &&
      name.includes("entrega") &&
      name.includes("kit")
    ) {
      if (unit.includes("dia")) dias_entrega += qty;
      continue;
    }
    if (name.includes("totem") && (name.includes("kit") || name.includes("entrega"))) {
      qtd_totens += qty;
      continue;
    }
    if (
      (name.includes("notebook") || name.includes("locação de notebook") || name.includes("locacao de notebook")) &&
      (name.includes("kit") || name.includes("entrega"))
    ) {
      qtd_notebooks += qty;
      continue;
    }
  }

  return { qtd_celulares, dias_entrega, qtd_totens, qtd_notebooks };
}

function temItemSistema(items: GestaoProposal["items"]): boolean {
  return (items || []).some((it) => {
    const name = (it.name || it.description || "").toLowerCase();
    return (
      (name.includes("estação de entrega") || name.includes("estacao de entrega")) &&
      name.includes("gorunking")
    );
  });
}

/**
 * Mapeia Proposal + dados do bulk para EventoExtraido.
 * Usa apenas os dados do bulk (nome, funcao) — sem CPF ou cache_ek detalhado.
 * CPF e telefone vêm do sync-equipe separado.
 */
function mapProposalToEvento(
  proposal: GestaoProposal,
  bulkData: BulkEventData | null,
): EventoExtraido & { url: string } {
  const { cidade, uf } = parseCidadeUf(proposal.eventCity);
  const kitData = extrairDadosKit(proposal.items);

  // Técnicos do bulk (sem CPF/cache detalhado — vem do sync-equipe)
  const tecnicos_gestao = (bulkData?.allTechnicians || [])
    .filter((t) => t.status !== "cancelled")
    .map((t) => ({
      nome: t.name || "Desconhecido",
      funcao: t.funcao ? t.funcao.toLowerCase() : null,
      cpf_prefixo: null as string | null,
      cache_ek: 0,
      is_entrega_kit: false, // Determinado pelos items, não pelo técnico individual
    }));

  const itens_brutos = (proposal.items || []).map((it) => ({
    nome: (it.name || it.description || "Item").slice(0, 200),
    quantidade: it.quantity || 0,
    unidade: (it.unit || "unidade").toLowerCase(),
  }));

  // tipo_kit baseado nos items (mais confiável que cache_ek individual)
  let tipo_kit: "entrega" | "sistema" | null = null;
  if (kitData.dias_entrega > 0) {
    tipo_kit = "entrega";
    // Marca todos técnicos como entrega de kit se o evento tem dias_entrega
    tecnicos_gestao.forEach((t) => { t.is_entrega_kit = true; });
  } else if (temItemSistema(proposal.items)) {
    tipo_kit = "sistema";
  }

  const tem_entrega_kit =
    kitData.qtd_celulares > 0 ||
    kitData.dias_entrega > 0 ||
    kitData.qtd_totens > 0 ||
    kitData.qtd_notebooks > 0 ||
    tipo_kit !== null;

  return {
    numero: proposal.number || null,
    nome: proposal.eventName || proposal.title || null,
    data: formatDate(proposal.eventDate),
    cidade,
    uf,
    qtd_atletas: proposal.athleteCount || 0,
    nivel: proposal.level ? String(proposal.level) : null,
    qtd_celulares: kitData.qtd_celulares,
    dias_entrega: kitData.dias_entrega,
    qtd_totens: kitData.qtd_totens,
    qtd_notebooks: kitData.qtd_notebooks,
    local_prova: null,
    url_site_oficial: null,
    tipo_kit,
    tecnicos_gestao,
    itens_brutos,
    tem_entrega_kit,
    texto_extraido: `[via API] ${proposal.eventName || ""} - ${proposal.number || ""}`,
    url: `${proposal.id}`,
  };
}

// ── Função principal ──────────────────────────────────────────────────

export async function scrapeGestao(opts: ScrapeOptions): Promise<ScrapeResult> {
  const log: string[] = [];
  const progress = opts.onProgress ?? (() => {});

  try {
    log.push("Iniciando sync via API REST (sem Playwright)");

    // 1. Login (1 request)
    progress("Fazendo login na API do Gestão", 5);
    const api = new GestaoAPI(opts.baseUrl);
    const loginRes = await api.login(opts.usuario, opts.senha);
    log.push(`Login OK: ${loginRes.user.name} (${loginRes.user.email})`);

    // 2. Buscar propostas (1 request)
    progress("Buscando propostas", 15);
    const proposalsRes = await api.getProposals();
    const allProposals = proposalsRes.proposals || [];
    log.push(`Total de propostas: ${allProposals.length}`);

    const proposals = allProposals.filter(
      (p) => p.status === "aprovada" || p.status === "em_negociacao"
    );
    log.push(`Propostas aprovadas/em_negociacao: ${proposals.length}`);

    // 3. Buscar alocações em bulk (1 request)
    progress("Buscando alocações de técnicos", 40);
    const eventIds = proposals.map((p) => p.id);
    let bulkData: Record<string, BulkEventData> = {};

    if (eventIds.length > 0) {
      try {
        const bulkRes = await api.getBulkAllocations(eventIds, "proposal");
        bulkData = (bulkRes.data || {}) as Record<string, BulkEventData>;
        const withTech = Object.values(bulkData).filter((v) => v.totalAllocated > 0).length;
        log.push(`Bulk OK: ${withTech} eventos com técnicos de ${eventIds.length} total`);
      } catch (e) {
        log.push(`⚠️ Bulk falhou (técnicos não carregados): ${e instanceof Error ? e.message : e}`);
      }
    }

    // 4. Mapear para EventoExtraido (CPU only, sem I/O)
    progress("Processando eventos", 70);
    const eventos: (EventoExtraido & { url: string })[] = [];

    for (const p of proposals) {
      try {
        const ev = mapProposalToEvento(p, bulkData[p.id] || null);
        eventos.push(ev);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log.push(`❌ Erro ao mapear proposta ${p.number}: ${msg}`);
      }
    }

    const eventosKit = eventos.filter((e) => e.tem_entrega_kit);
    log.push(`Total: ${eventos.length} eventos, ${eventosKit.length} com kit`);
    progress("Sync concluído", 90);

    return {
      ok: true,
      eventosEncontrados: eventos.length,
      eventosKit: eventosKit.length,
      eventos,
      diagnostico: log,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`❌ ERRO: ${msg}`);
    return {
      ok: false,
      erro: msg,
      eventosEncontrados: 0,
      eventosKit: 0,
      eventos: [],
      diagnostico: log,
    };
  }
}
