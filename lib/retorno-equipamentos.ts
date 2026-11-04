/**
 * Patrimônio separado para a prova ("alocado") conta como em campo a partir da entrega
 * (ou do dia da prova, sem data de entrega), mesmo que ninguém tenha registrado a 📦 Saída:
 * assim entra na conferência de retorno e não some da vista.
 */

import { parseDataBR } from "./semana";

/** O material já saiu para a prova? (data da entrega ou da prova até hoje) */
export function jaSaiuParaProva(
  dataProva: string | null | undefined,
  dataEntrega: string | null | undefined,
  agora: Date = new Date()
): boolean {
  const hoje = new Date(agora);
  hoje.setHours(23, 59, 59, 999);
  const datas = [parseDataBR(dataEntrega), parseDataBR(dataProva)].filter((d): d is Date => d !== null);
  if (datas.length === 0) return false;
  return Math.min(...datas.map((d) => d.getTime())) <= hoje.getTime();
}

/** Entra na conferência de retorno: em campo, ou separado para prova que já saiu. */
export function pendenteDeRetorno(
  e: { status: string; evento_id: number | null },
  prova: { data?: string | null; data_entrega?: string | null } | null | undefined,
  agora: Date = new Date()
): boolean {
  if (e.status === "em_campo") return true;
  return e.status === "alocado" && !!e.evento_id && !!prova && jaSaiuParaProva(prova.data, prova.data_entrega, agora);
}
