/**
 * Aba "Subir base": ordem de prioridade para subir a Base 1 e a Base final,
 * pela data da entrega de kit (1º dia dos Datas e horários = eventos.data_entrega).
 * Sem data de entrega, usa a data da prova.
 */

import { parseDataBR } from "./semana";

export const DIAS_A_FRENTE = 21;

export type EventoBase = {
  id: number;
  numero: string;
  nome: string;
  data: string;
  cidade: string | null;
  uf: string | null;
  qtd_atletas: number | null;
  data_entrega: string | null;
  hora_entrega: string | null;
  tem_kit: number;
  base1_ok: number;
  base_final_ok: number;
  base1_ok_em: string | null;
  base_final_ok_em: string | null;
};

export type Urgencia = "feito" | "vermelho" | "amarelo" | "normal";
export type FiltroBase = "pendentes" | "todas" | "falta_final";

export type ItemFila<T extends EventoBase = EventoBase> = {
  evento: T;
  /** AAAA-MM-DD da entrega (ou da prova, quando não tem entrega) */
  entrega: string;
  /** true = não tem data de entrega, usou a data da prova */
  semEntrega: boolean;
  /** dias de hoje até a entrega (negativo = já passou) */
  dias: number;
  urgencia: Urgencia;
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Diferença em dias entre duas datas AAAA-MM-DD. */
export function diasEntre(deIso: string, ateIso: string): number {
  const [a, b] = [deIso, ateIso].map((s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86400000);
}

export function dataEntrega(e: Pick<EventoBase, "data_entrega" | "data">): { entrega: string; semEntrega: boolean } | null {
  const de = parseDataBR(e.data_entrega);
  if (de) return { entrega: iso(de), semEntrega: false };
  const dp = parseDataBR(e.data);
  return dp ? { entrega: iso(dp), semEntrega: true } : null;
}

export function urgenciaBase(e: Pick<EventoBase, "base1_ok" | "base_final_ok">, dias: number): Urgencia {
  if (e.base1_ok && e.base_final_ok) return "feito";
  if (dias <= 1) return "vermelho";
  if (dias <= 3) return "amarelo";
  return "normal";
}

/**
 * Provas com kit, que ainda não aconteceram, com entrega até `diasAFrente` dias,
 * em ordem: entrega mais próxima primeiro (depois hora da entrega e número da prova).
 */
export function filaBase<T extends EventoBase>(eventos: T[], hojeIso: string, diasAFrente = DIAS_A_FRENTE): ItemFila<T>[] {
  const out: ItemFila<T>[] = [];
  for (const e of eventos) {
    if (Number(e.tem_kit) !== 1) continue;
    const dProva = parseDataBR(e.data);
    if (dProva && iso(dProva) < hojeIso) continue; // prova já passou
    const de = dataEntrega(e);
    if (!de) continue;
    const dias = diasEntre(hojeIso, de.entrega);
    if (dias > diasAFrente) continue;
    out.push({ evento: e, ...de, dias, urgencia: urgenciaBase(e, dias) });
  }
  return out.sort(
    (a, b) =>
      a.entrega.localeCompare(b.entrega) ||
      (a.evento.hora_entrega || "99").localeCompare(b.evento.hora_entrega || "99") ||
      String(a.evento.numero).localeCompare(String(b.evento.numero), undefined, { numeric: true })
  );
}

export function filtrarFila<T extends EventoBase>(fila: ItemFila<T>[], filtro: FiltroBase): ItemFila<T>[] {
  if (filtro === "pendentes") return fila.filter((i) => !(i.evento.base1_ok && i.evento.base_final_ok));
  if (filtro === "falta_final") return fila.filter((i) => i.evento.base1_ok && !i.evento.base_final_ok);
  return fila;
}

/** "Hoje", "Amanhã", "em 5 dias", "passou há 2 dias" */
export function textoDias(dias: number): string {
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  if (dias === -1) return "Foi ontem";
  if (dias < 0) return `Foi há ${-dias} dias`;
  return `Faltam ${dias} dias`;
}
