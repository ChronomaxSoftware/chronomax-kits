/**
 * Substituto do scraper.ts (Playwright) usando chamadas diretas à API REST do Gestão.
 * Mantém a mesma interface (ScrapeResult, ScrapeOptions) para compatibilidade
 * com o sync/route.ts.
 *
 * Fluxo de requests:
 *   1 login + 1 proposals + 1 bulk (filtra eventos com equipe)
 *   + N alocações detalhadas (só pros eventos com equipe, em paralelo por lotes).
 * As alocações detalhadas trazem entregaKitsQty/CPF/cachê por técnico — necessário
 * pra marcar is_entrega_kit individualmente (só técnico de entrega de kit, não toda a equipe).
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
 * Mapeia Proposal + alocações detalhadas para EventoExtraido.
 * is_entrega_kit é decidido POR TÉCNICO (entregaKitsQty > 0 ou cachê de kit > 0),
 * não pelo evento — assim só os técnicos da entrega de kit entram em evento_tecnicos.
 */
function mapProposalToEvento(
  proposal: GestaoProposal,
  allocations: GestaoAllocation[],
): EventoExtraido & { url: string } {
  const { cidade, uf } = parseCidadeUf(proposal.eventCity);
  const kitData = extrairDadosKit(proposal.items);

  // Técnicos a partir das alocações detalhadas (inclui E.K, CPF e cachê)
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

  const itens_brutos = (proposal.items || []).map((it) => ({
    nome: (it.name || it.description || "Item").slice(0, 200),
    quantidade: it.quantity || 0,
    unidade: (it.unit || "unidade").toLowerCase(),
  }));

  // tipo_kit: 'entrega' se algum técnico tem E.K, senão 'sistema' se tem item GoRunKing
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

    // 3. Buscar alocações: bulk (1 request) pra saber quais eventos têm equipe,
    //    depois alocações detalhadas só pra esses (em paralelo, por lotes).
    progress("Buscando alocações de técnicos", 25);
    const eventIds = proposals.map((p) => p.id);
    const allAllocations: Record<string, GestaoAllocation[]> = {};

    if (eventIds.length > 0) {
      // 3a. Bulk → filtra eventos com técnico alocado (evita N requests desnecessários)
      let eventosComEquipe: string[] = eventIds;
      try {
        const bulkRes = await api.getBulkAllocations(eventIds, "proposal");
        const bulkData = bulkRes.data || {};
        eventosComEquipe = eventIds.filter((id) => (bulkData[id]?.totalAllocated || 0) > 0);
        log.push(`Bulk OK: ${eventosComEquipe.length} eventos com equipe de ${eventIds.length} total`);
      } catch (e) {
        log.push(`⚠️ Bulk falhou, buscando alocações de todos os eventos: ${e instanceof Error ? e.message : e}`);
      }

      // 3b. Alocações detalhadas (com entregaKitsQty/CPF/cachê) só pros eventos com equipe
      const batchSize = 15;
      const total = eventosComEquipe.length;
      for (let i = 0; i < total; i += batchSize) {
        const batch = eventosComEquipe.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (eid) => {
            try {
              const res = await api.getEventAllocations(eid, "proposal");
              return { eid, allocations: res.data?.allocations || [] };
            } catch {
              log.push(`⚠️ Falha ao buscar alocações do evento ${eid}`);
              return { eid, allocations: [] as GestaoAllocation[] };
            }
          })
        );
        for (const r of results) allAllocations[r.eid] = r.allocations;
        const feito = Math.min(i + batchSize, total);
        const pct = 25 + Math.round((feito / Math.max(total, 1)) * 50);
        progress(`Buscando alocações ${feito}/${total}`, pct, feito, total);
      }
      log.push(`Alocações detalhadas carregadas para ${Object.keys(allAllocations).length} eventos`);
    }

    // 4. Mapear para EventoExtraido (CPU only, sem I/O)
    progress("Processando eventos", 80);
    const eventos: (EventoExtraido & { url: string })[] = [];
    let logouChaves = false;
    let eventosDetalhados = 0;

    for (const p of proposals) {
      try {
        const allocs = allAllocations[p.id] || [];
        const ev = mapProposalToEvento(p, allocs);
        eventos.push(ev);

        // ── Diagnóstico TEMPORÁRIO: conferir E.K por técnico (remover após validar) ──
        if (allocs.length > 0) {
          if (!logouChaves) {
            log.push(`🔎 Campos da alocação: ${Object.keys(allocs[0]).join(", ")}`);
            logouChaves = true;
          }
          if (ev.tem_entrega_kit && eventosDetalhados < 15) {
            eventosDetalhados++;
            const kitCount = ev.tecnicos_gestao.filter((t) => t.is_entrega_kit).length;
            log.push(`🔎 #${ev.numero || "?"} ${(ev.nome || "").slice(0, 40)} — ${allocs.length} alocações, ${kitCount} de kit:`);
            for (const a of allocs) {
              log.push(
                `      - ${a.technicianName || a.technician?.companyName || "?"} | funcao:${a.funcao ?? "-"} | entregaKitsQty:${a.entregaKitsQty} | kitDeliveryAmount:${a.kitDeliveryAmount} | status:${a.status}`
              );
            }
          }
        }
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
