/**
 * Substituto do scraper.ts (Playwright) usando chamadas diretas à API REST do Gestão.
 *
 * Estratégia (pra caber no limite de 60s da Vercel):
 *   1 login + 1 proposals + 1 bulk (equipe de TODOS os eventos, nome+função)
 *   + N alocações detalhadas SÓ dos eventos OPERATION com equipe (poucas) — pra
 *   obter E.K/CPF dos técnicos de entrega de kit. Eventos SYSTEM_ONLY / prova não
 *   pagam o custo do detalhado.
 */

import { GestaoAPI, GestaoProposal, GestaoAllocation } from "./gestao-api";
import type { EventoExtraido } from "./parser";
import { classificarKit, tipoKitDeModo, DeliveryKitMode } from "./kit-mode";

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

type BulkTech = { id: string; name: string; status: string; funcao: string | null };
type TecnicoGestao = EventoExtraido["tecnicos_gestao"][number];

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

/** Técnico a partir de uma alocação detalhada (eventos OPERATION): tem E.K e CPF. */
function tecnicoDeAllocation(a: GestaoAllocation, modo: DeliveryKitMode): TecnicoGestao {
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
    // Só é técnico de entrega de kit em eventos OPERATION (a Chronomax opera).
    is_entrega_kit: modo === "OPERATION" && ((a.entregaKitsQty || 0) > 0 || cache_ek > 0),
  };
}

/** Técnico a partir do bulk (snapshot da equipe; nunca conta como entrega de kit). */
function tecnicoDeBulk(t: BulkTech): TecnicoGestao {
  return {
    nome: t.name || "Desconhecido",
    funcao: t.funcao ? t.funcao.toLowerCase() : null,
    cpf_prefixo: null,
    cache_ek: 0,
    is_entrega_kit: false,
  };
}

function mapProposalToEvento(
  proposal: GestaoProposal,
  modo: DeliveryKitMode,
  tecnicos_gestao: TecnicoGestao[],
): EventoExtraido & { url: string } {
  const { cidade, uf } = parseCidadeUf(proposal.eventCity);
  const kitData = extrairDadosKit(proposal.items);

  const itens_brutos = (proposal.items || []).map((it) => ({
    nome: (it.name || it.description || "Item").slice(0, 200),
    quantidade: it.quantity || 0,
    unidade: (it.unit || "unidade").toLowerCase(),
  }));

  const tipo_kit = tipoKitDeModo(modo);

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

    // 1. Login
    progress("Fazendo login na API do Gestão", 5);
    const api = new GestaoAPI(opts.baseUrl);
    const loginRes = await api.login(opts.usuario, opts.senha);
    log.push(`Login OK: ${loginRes.user.name} (${loginRes.user.email})`);

    // 2. Propostas
    progress("Buscando propostas", 15);
    const proposalsRes = await api.getProposals();
    const allProposals = proposalsRes.proposals || [];
    const proposals = allProposals.filter((p) => p.status === "aprovada" || p.status === "em_negociacao");
    log.push(`Propostas: ${allProposals.length} total, ${proposals.length} aprovadas/em_negociacao`);

    // 3. Classificar modo por evento (a partir dos itens — sem requisição)
    const modoPorId = new Map<string, DeliveryKitMode>();
    for (const p of proposals) {
      modoPorId.set(p.id, classificarKit((p.items || []).map((it) => it.name || it.description)));
    }
    const totalOperation = [...modoPorId.values()].filter((m) => m === "OPERATION").length;
    log.push(`Modo: ${totalOperation} OPERATION (entrega de kit) de ${proposals.length}`);

    // 4. Bulk (1 request): equipe de todos os eventos
    progress("Buscando equipe (bulk)", 30);
    const eventIds = proposals.map((p) => p.id);
    let bulkData: Record<string, { totalAllocated: number; allTechnicians: BulkTech[] }> = {};
    if (eventIds.length > 0) {
      try {
        const bulkRes = await api.getBulkAllocations(eventIds, "proposal");
        bulkData = (bulkRes.data || {}) as typeof bulkData;
        const comEquipe = Object.values(bulkData).filter((v) => (v.totalAllocated || 0) > 0).length;
        log.push(`Bulk OK: ${comEquipe} eventos com equipe`);
      } catch (e) {
        log.push(`⚠️ Bulk falhou: ${e instanceof Error ? e.message : e}`);
      }
    }

    // 5. Detalhado SÓ para eventos OPERATION com equipe (poucos → cabe em 60s)
    const idsDetalhe = eventIds.filter(
      (id) => modoPorId.get(id) === "OPERATION" && (bulkData[id]?.totalAllocated || 0) > 0
    );
    log.push(`Alocações detalhadas para ${idsDetalhe.length} eventos OPERATION com equipe`);
    const allAllocations: Record<string, GestaoAllocation[]> = {};
    const batchSize = 15;
    for (let i = 0; i < idsDetalhe.length; i += batchSize) {
      const batch = idsDetalhe.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (eid) => {
          try {
            const res = await api.getEventAllocations(eid, "proposal");
            return { eid, allocations: res.data?.allocations || [] };
          } catch {
            log.push(`⚠️ Falha nas alocações do evento ${eid}`);
            return { eid, allocations: [] as GestaoAllocation[] };
          }
        })
      );
      for (const r of results) allAllocations[r.eid] = r.allocations;
      const feito = Math.min(i + batchSize, idsDetalhe.length);
      const pct = 40 + Math.round((feito / Math.max(idsDetalhe.length, 1)) * 40);
      progress(`Alocações ${feito}/${idsDetalhe.length}`, pct, feito, idsDetalhe.length);
    }

    // 6. Mapear
    progress("Processando eventos", 85);
    const eventos: (EventoExtraido & { url: string })[] = [];
    let logEventos = 0;
    for (const p of proposals) {
      try {
        const modo = modoPorId.get(p.id) ?? null;
        let tecnicos_gestao: TecnicoGestao[];
        if (modo === "OPERATION") {
          const allocs = allAllocations[p.id] || [];
          tecnicos_gestao = allocs.filter((a) => a.status !== "cancelled").map((a) => tecnicoDeAllocation(a, modo));
        } else {
          const equipe = bulkData[p.id]?.allTechnicians || [];
          tecnicos_gestao = equipe.filter((t) => t.status !== "cancelled").map(tecnicoDeBulk);
        }
        const ev = mapProposalToEvento(p, modo, tecnicos_gestao);
        eventos.push(ev);

        // Diagnóstico TEMPORÁRIO: por evento OPERATION, quem entra como técnico de kit
        if (modo === "OPERATION" && logEventos < 25) {
          logEventos++;
          const kit = ev.tecnicos_gestao.filter((t) => t.is_entrega_kit);
          log.push(
            `🔎 #${ev.numero} [${modo}] ${ev.tecnicos_gestao.length} na equipe, ${kit.length} de kit: ${kit
              .map((t) => `${t.nome}${t.cpf_prefixo ? ` [${t.cpf_prefixo}]` : ""}`)
              .join(", ") || "(nenhum)"}`
          );
        }
      } catch (e) {
        log.push(`❌ Erro ao mapear proposta ${p.number}: ${e instanceof Error ? e.message : e}`);
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
    return { ok: false, erro: msg, eventosEncontrados: 0, eventosKit: 0, eventos: [], diagnostico: log };
  }
}
