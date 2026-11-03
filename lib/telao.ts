/**
 * Aba Telão: provas cujo pedido no Gestão (evento_itens_gestao) tem item de telão —
 * a arte vem do cliente, então alguém do escritório cobra a arte e dá o ok quando o
 * telão fica pronto. As marcações ficam em telao_status (o sync não mexe nela).
 */

import { chaveSemana, inicioDoDia, inicioSemana, parseDataBR } from "./semana";

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export type TipoTelao = "foto_resultados" | "foto_certificado" | "output_ao_vivo";

export const ROTULO_TELAO: Record<TipoTelao, string> = {
  foto_resultados: "Foto Resultados (Arena)",
  foto_certificado: "Foto Certificado (Arena)",
  output_ao_vivo: "Output ao vivo (painel)",
};

/** Qual item de telão é este nome do Gestão (null = não é telão). */
export function tipoItemTelao(nome: string): TipoTelao | null {
  const n = sem(String(nome || ""));
  if (n.includes("arena") && n.includes("foto") && n.includes("resultado")) return "foto_resultados";
  if (n.includes("arena") && n.includes("foto") && n.includes("certificado")) return "foto_certificado";
  if (n.includes("output") && n.includes("resultado")) return "output_ao_vivo";
  return null;
}

/** Tipos de telão (sem repetir, na ordem do ROTULO_TELAO) de uma lista de itens. */
export function tiposTelao(nomes: string[]): TipoTelao[] {
  const achados = new Set(nomes.map(tipoItemTelao).filter((t): t is TipoTelao => !!t));
  return (Object.keys(ROTULO_TELAO) as TipoTelao[]).filter((t) => achados.has(t));
}

/** Os dois "ok" da aba. */
export type EtapaTelao = "arte" | "pronto";

export function ehEtapaTelao(x: unknown): x is EtapaTelao {
  return x === "arte" || x === "pronto";
}

export type SituacaoTelao = "cobrar_arte" | "aguardando_pronto" | "pronto";

/** Em que pé está: falta cobrar a arte, cobrada mas telão não pronto, ou pronto. */
export function situacaoTelao(s: { arte_cobrada_em: string | null; pronto_em: string | null }): SituacaoTelao {
  if (s.pronto_em) return "pronto";
  if (s.arte_cobrada_em) return "aguardando_pronto";
  return "cobrar_arte";
}

export const OBS_TELAO_MAX = 500;

// ── Agrupamento da aba (por semana da prova) ──

export type ProvaTelaoBase = {
  id: number;
  nome: string;
  numero: string;
  data: string | null;
  arte_cobrada_em: string | null;
  pronto_em: string | null;
};

export type GruposTelao<T> = {
  /** Provas de hoje em diante, por semana (mais perto primeiro). */
  semanas: { chave: string; inicio: Date; provas: T[] }[];
  /** Provas sem data válida (não somem da lista). */
  semData: T[];
  /** Provas que já passaram (mais recente primeiro). */
  passadas: T[];
};

/** Filtra (pendentes = telão ainda não pronto; busca no nome/número) e agrupa. */
export function agruparTelao<T extends ProvaTelaoBase>(
  provas: T[],
  opts: { hoje: Date; soPendentes: boolean; busca: string }
): GruposTelao<T> {
  const q = sem(opts.busca.trim());
  const hoje = inicioDoDia(opts.hoje).getTime();
  const filtradas = provas.filter(
    (p) =>
      (!opts.soPendentes || !p.pronto_em) &&
      (!q || sem(p.nome || "").includes(q) || String(p.numero || "").includes(q))
  );

  const comData = filtradas.map((p) => ({ p, d: parseDataBR(p.data) }));
  const futuras = comData.filter((x) => x.d && x.d.getTime() >= hoje).sort((a, b) => a.d!.getTime() - b.d!.getTime());
  const passadas = comData
    .filter((x) => x.d && x.d.getTime() < hoje)
    .sort((a, b) => b.d!.getTime() - a.d!.getTime())
    .map((x) => x.p);
  const semData = comData.filter((x) => !x.d).map((x) => x.p);

  const semanas: GruposTelao<T>["semanas"] = [];
  for (const { p, d } of futuras) {
    const chave = chaveSemana(d!);
    let g = semanas.find((s) => s.chave === chave);
    if (!g) semanas.push((g = { chave, inicio: inicioSemana(d!), provas: [] }));
    g.provas.push(p);
  }
  return { semanas, semData, passadas };
}
