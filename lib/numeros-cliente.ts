/**
 * Números de peito que vão para o cliente (organizador) e quem leva.
 * Campos da prova: eventos.numeros_vai_cliente (1/0) e eventos.numeros_quem_leva (texto).
 */

export const QUEM_LEVA_MAX = 200;

/** Texto curto para Envios e book; null quando não vai para o cliente. */
export function textoNumerosCliente(vai: number | boolean | null | undefined, quemLeva: string | null | undefined): string | null {
  if (!vai) return null;
  const quem = (quemLeva || "").trim();
  return `Números de peito vão para o cliente — leva: ${quem || "a definir"}`;
}

/** Normaliza o que veio do formulário para gravar. */
export function normalizarNumerosCliente(vai: unknown, quemLeva: unknown): { vai: 0 | 1; quem: string | null } {
  const v = vai === true || vai === 1 || vai === "1" ? 1 : 0;
  const q = typeof quemLeva === "string" ? quemLeva.trim().slice(0, QUEM_LEVA_MAX) : "";
  return { vai: v, quem: v && q ? q : null };
}
