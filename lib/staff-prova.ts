/**
 * Controle de Staff por prova: os celulares alocados à prova (Inventário, por patrimônio)
 * aparecem prontos para vincular ao colaborador, sem bipar QR.
 */

import { parseDataBR } from "./semana";

/** Janela de provas mostradas no Staff: de 7 dias atrás até 30 dias à frente. */
export const STAFF_DIAS_ANTES = 7;
export const STAFF_DIAS_DEPOIS = 30;

export function provaNaJanelaStaff(data: string | null | undefined, agora: Date = new Date()): boolean {
  const d = parseDataBR(data);
  if (!d) return false;
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const ini = new Date(hoje);
  ini.setDate(ini.getDate() - STAFF_DIAS_ANTES);
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + STAFF_DIAS_DEPOIS);
  return d >= ini && d <= fim;
}

/** Prova mais próxima de hoje (a de hoje ou a próxima; senão a mais recente) para abrir já selecionada. */
export function provaPadrao<T extends { data: string }>(provas: T[], agora: Date = new Date()): T | null {
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const comData = provas
    .map((p) => ({ p, d: parseDataBR(p.data) }))
    .filter((x): x is { p: T; d: Date } => !!x.d)
    .sort((a, b) => a.d.getTime() - b.d.getTime());
  return comData.find((x) => x.d >= hoje)?.p ?? comData[comData.length - 1]?.p ?? null;
}

/** Nome do aparelho criado automaticamente no cadastro do Staff a partir do patrimônio. */
export function nomeAparelhoStaff(tipo: string, patrimonio: string): string {
  return `${tipo} ${patrimonio}`.trim();
}
