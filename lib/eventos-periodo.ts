/**
 * Provas de um período (para os Excel da semana): TODAS as provas sincronizadas do Gestão
 * entre `inicio` e `fim` (inclusive), com ou sem kit e sem os filtros da tela.
 */
import { dbAll } from "./db";
import { lerDiaIso, noPeriodo } from "./periodo";

export { diaIso, lerDiaIso, noPeriodo } from "./periodo";

/** IDs de todas as provas do período (máx. 62 dias). */
export async function idsDoPeriodo(inicioIso: string | null, fimIso: string | null): Promise<number[] | { erro: string }> {
  const inicio = lerDiaIso(inicioIso);
  const fim = lerDiaIso(fimIso);
  if (!inicio || !fim || fim < inicio) return { erro: "Período inválido" };
  if ((fim.getTime() - inicio.getTime()) / 86_400_000 > 62) return { erro: "Período grande demais" };
  const todos = await dbAll<{ id: number; data: string | null }>("SELECT id, data FROM eventos");
  return noPeriodo(todos, inicio, fim).map((e) => Number(e.id));
}
