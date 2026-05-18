/**
 * Substituto do scraper.ts (Playwright) usando chamadas diretas à API REST do Gestão.
 * Mantém a mesma interface (ScrapeResult, ScrapeOptions) para compatibilidade
 * com o sync/route.ts.
 */

import { GestaoAPI, GestaoProposal, GestaoAllocation } from "./gestao-api";
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

// ── Helpers de mapeamento ─────────────────────────────────────────────

/** Extrai UF de "Cidade - UF" ou retorna null */
function parseCidadeUf(raw: string | null): { cidade: string | null; uf: string | null } {
  if (!raw) return { cidade: null, uf: null };
  const m = raw.match(/^(.+?)\s*-\s*([A-Z]{2})\s*$/);
  if (m) return { cidade: m[1].trim(), uf: m[2] };
  return { cidade: raw.trim(), uf: null };
}

/** Formata data ISO para DD/MM/YYYY */
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

/**
 * Categoriza item pelo nome/category (mesma lógica do frontend categorization.js)
 */
function categorizeItem(item: { name?: string; category?: string; assignedCategory?: string }): string {
  const cat = (item.assignedCategory || item.category || "").toLowerCase();
  if (cat.includes("entrega_kits") || cat.includes("entrega de kits") || cat.includes("entrega kits")) return "entrega_kits";
  if (cat.includes("servicos_gorunking") || cat.includes("serviços_gorunking")) return "servicos_gorunking";
  if (cat.includes("locacao_equipamentos") || cat.includes("locação de equipamentos")) return "locacao_equipamentos";

  const name = (item.name || "").toLowerCase();
  if ((name.includes("estação de entrega") || name.includes("estacao de entrega")) && name.includes("gorunking")) return "entrega_kits";
  if (name.includes("entrega de kits via app gorunking") || name.includes("servico de entrega de kits via app gorunking")) return "entrega_kits";
  if (name.includes("entrega") && (name.includes("kit") || name.includes("chip"))) return "entrega_kits";
  if (name.includes("totem") && name.includes("kit")) return "locacao_equipamentos";
  if (name.includes("totem") && name.includes("entrega")) return "locacao_equipamentos";
  if (name.includes("notebook") && name.includes("entrega")) return "locacao_equipamentos";
  if (name.includes("técnico") && name.includes("entrega")) return "entrega_kits";
  if (name.includes("tecnico") && name.includes("entrega")) return "entrega_kits";
  return "outros";
}

/**
 * Extrai quantidades de kit dos items da proposta.
 * Replica a lógica de buscarQuantidadeApos() do parser.ts, mas a partir do JSON.
 */
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

    // Estação de Entrega de Kits via App GoRunKing → celulares (unidades)
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

    // Técnico Especializado para Entrega de Kits → dias
    if (
      (name.includes("técnico") || name.includes("tecnico")) &&
      name.includes("entrega") &&
      name.includes("kit")
    ) {
      if (unit.includes("dia")) {
        dias_entrega += qty;
      }
      continue;
    }

    // Totem touchscreen para Entrega de Kits → totens
    if (name.includes("totem") && (name.includes("kit") || name.includes("entrega"))) {
      qtd_totens += qty;
      continue;
    }

    // Locação de Notebook para Entrega de Kits → notebooks
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

/**
 * Verifica se algum item é "Estação de Entrega de Kits via App GoRunKing"
 * (indica que a Chronomax fornece o sistema)
 */
function temItemSistema(items: GestaoProposal["items"]): boolean {
  return (items || []).some((it) => {
    const name = (it.name || it.description || "").toLowerCase();
    return (
      name.includes("estação de entrega") && name.includes("gorunking") ||
      name.includes("estacao de entrega") && name.includes("gorunking")
    );
  });
}

/**
 * Mapeia uma Proposal + suas Allocations para EventoExtraido
 */
function mapProposalToEvento(
  proposal: GestaoProposal,
  allocations: GestaoAllocation[],
): EventoExtraido & { url: string } {
  const { cidade, uf } = parseCidadeUf(proposal.eventCity);
  const kitData = extrairDadosKit(proposal.items);

  // Mapeia técnicos a partir das alocações
  const tecnicos_gestao = allocations
    .filter((a) => a.status !== "cancelled")
    .map((a) => {
      // CPF prefixo: documento do supplier (ex: "123.456.789-00" → "123.456.789")
      let cpf_prefixo: string | null = null;
      if (a.technician?.document && a.technician.documentType === "cpf") {
        const digits = a.technician.document.replace(/\D/g, "");
        if (digits.length >= 9) {
          cpf_prefixo = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}`;
        }
      }

      const cache_ek = Number(a.kitDeliveryAmount) || 0;

      return {
        nome: a.technicianName || a.technician?.companyName || "Desconhecido",
        funcao: a.funcao ? a.funcao.toLowerCase() : null,
        cpf_prefixo,
        cache_ek,
        is_entrega_kit: (a.entregaKitsQty || 0) > 0 || cache_ek > 0,
      };
    });

  // Itens brutos para o book
  const itens_brutos = (proposal.items || []).map((it) => ({
    nome: (it.name || it.description || "Item").slice(0, 200),
    quantidade: it.quantity || 0,
    unidade: (it.unit || "unidade").toLowerCase(),
  }));

  // Classifica tipo de kit
  let tipo_kit: "entrega" | "sistema" | null = null;
  if (tecnicos_gestao.some((t) => t.is_entrega_kit)) {
    tipo_kit = "entrega";
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
    local_prova: null, // Não disponível via API (campo de formulário do frontend antigo)
    url_site_oficial: null, // Idem
    tipo_kit,
    tecnicos_gestao,
    itens_brutos,
    tem_entrega_kit,
    texto_extraido: `[via API] ${proposal.eventName || ""} - ${proposal.number || ""}`,
    url: `${proposal.id}`, // ID da proposta como referência
  };
}

// ── Função principal ──────────────────────────────────────────────────

export async function scrapeGestao(opts: ScrapeOptions): Promise<ScrapeResult> {
  const log: string[] = [];
  const progress = opts.onProgress ?? (() => {});

  try {
    log.push("Iniciando sync via API REST (sem Playwright)");

    // 1. Login
    progress("Fazendo login na API do Gestão", 5);
    const api = new GestaoAPI(opts.baseUrl);
    const loginRes = await api.login(opts.usuario, opts.senha);
    log.push(`Login OK: ${loginRes.user.name} (${loginRes.user.email})`);

    // 2. Buscar propostas aprovadas/em negociação
    progress("Buscando propostas", 10);
    const proposalsRes = await api.getProposals();
    const allProposals = proposalsRes.proposals || [];
    log.push(`Total de propostas retornadas pela API: ${allProposals.length}`);

    // Filtrar apenas aprovadas e em_negociacao (mesmo filtro do frontend Squads)
    const proposals = allProposals.filter(
      (p) => p.status === "aprovada" || p.status === "em_negociacao"
    );
    log.push(`Propostas aprovadas/em_negociacao: ${proposals.length}`);
    progress(`Encontradas ${proposals.length} propostas ativas`, 15, 0, proposals.length);

    // 3. Buscar alocações — 2 passos: bulk resumo → detalhado só dos que têm técnicos
    progress("Buscando alocações de técnicos", 20);
    const eventIds = proposals.map((p) => p.id);
    let allAllocations: Record<string, GestaoAllocation[]> = {};

    if (eventIds.length > 0) {
      // Passo 1: bulk request pra saber quais eventos têm técnicos alocados (1 request)
      let eventsWithAllocations: string[] = [];
      try {
        const bulkRes = await api.getBulkAllocations(eventIds, "proposal");
        eventsWithAllocations = Object.entries(bulkRes.data || {})
          .filter(([, v]) => v.totalAllocated > 0)
          .map(([eid]) => eid);
        log.push(`Bulk: ${eventsWithAllocations.length} eventos com técnicos alocados de ${eventIds.length} total`);
      } catch (e) {
        log.push(`⚠️ Bulk falhou, buscando detalhado de todos: ${e instanceof Error ? e.message : e}`);
        eventsWithAllocations = eventIds;
      }

      // Passo 2: buscar detalhado só dos que têm alocações (inclui cachê E.K)
      if (eventsWithAllocations.length > 0) {
        progress(`Buscando detalhes de ${eventsWithAllocations.length} eventos com técnicos`, 30);
        const results = await Promise.all(
          eventsWithAllocations.map(async (eid) => {
            try {
              const res = await api.getEventAllocations(eid, "proposal");
              return { eid, allocations: res.data?.allocations || [] };
            } catch {
              return { eid, allocations: [] as GestaoAllocation[] };
            }
          })
        );
        for (const r of results) {
          allAllocations[r.eid] = r.allocations;
        }
        log.push(`Alocações detalhadas carregadas: ${results.length} eventos`);
      }
    }

    // 4. Mapear para EventoExtraido
    progress("Processando eventos", 75);
    const eventos: (EventoExtraido & { url: string })[] = [];

    for (let i = 0; i < proposals.length; i++) {
      const p = proposals[i];
      const allocations = allAllocations[p.id] || [];
      try {
        const ev = mapProposalToEvento(p, allocations);
        eventos.push(ev);
        log.push(
          `✓ #${ev.numero || "?"} ${(ev.nome || "?").slice(0, 50)} | cel:${ev.qtd_celulares} dias:${ev.dias_entrega} tot:${ev.qtd_totens} | KIT:${ev.tem_entrega_kit ? "✓" : "✗"}`
        );
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
