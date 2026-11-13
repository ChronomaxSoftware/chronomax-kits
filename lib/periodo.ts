/** Datas de período (puro, serve no navegador e no servidor). */
import { parseDataBR } from "./semana";
/** "2026-11-23" → Date local (meia-noite); inválido → null. */
export function lerDiaIso(s: string | null | undefined): Date | null {
  const m = (s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) || d.getDate() !== Number(m[3]) ? null : d;
}

/** Filtra pela data da prova ("dd/mm/yyyy" ou ISO), de `inicio` até `fim` inclusive. */
export function noPeriodo<T extends { data: string | null }>(eventos: T[], inicio: Date, fim: Date): T[] {
  const ini = inicio.getTime();
  const fimExcl = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate() + 1).getTime();
  return eventos.filter((e) => {
    const d = parseDataBR(e.data)?.getTime();
    return d !== undefined && d >= ini && d < fimExcl;
  });
}

/** Date local → "2026-11-23" (para montar o link no painel). */
export function diaIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
