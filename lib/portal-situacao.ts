/**
 * Situação da prova no portal do técnico:
 * - finalizada: a data já passou (só leitura);
 * - liberada: prova desta semana (ou sem data) — pode confirmar o material e escrever observações;
 * - em breve: semanas seguintes — só consulta (logins, material e aparelhos alocados).
 */

import { fimSemana, inicioSemana } from "./semana";

export type SituacaoProva = "finalizada" | "liberada" | "em_breve";

export function situacaoProva(data: Date | null, agora: Date = new Date()): SituacaoProva {
  if (!data) return "liberada";
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  if (data < hoje) return "finalizada";
  return data > fimSemana(hoje) ? "em_breve" : "liberada";
}

/** Dia em que a prova "em breve" libera: segunda-feira da semana dela. */
export function liberaEm(data: Date): Date {
  return inicioSemana(data);
}
