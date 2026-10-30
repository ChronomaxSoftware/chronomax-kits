/**
 * Conferência diária dos celulares (ativada pelo escritório em provas específicas):
 * no fim de cada dia o técnico dá ✅ "está comigo" ou ⚠ "problema" em cada celular dele.
 */

export type StatusConferencia = "ok" | "problema";

/** Data de hoje em Brasília (YYYY-MM-DD) — o servidor roda em UTC. */
export function hojeBR(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/** "2026-10-30" → "30/10" */
export function diaCurto(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Celulares que o técnico confere: os que ele pegou + os que ninguém pegou. */
export function celularesDoTecnico<T extends { com_tecnico_id: number | null }>(celulares: T[], tecnicoId: number): T[] {
  return celulares.filter((c) => c.com_tecnico_id === null || c.com_tecnico_id === tecnicoId);
}

export function textoAlertaConferencia(
  tecnico: string,
  prova: string,
  dia: string,
  itens: { patrimonio: string; status: StatusConferencia; obs?: string | null }[]
): string {
  const ok = itens.filter((i) => i.status === "ok").length;
  const prob = itens.filter((i) => i.status === "problema");
  const detalhes = prob.map((p) => `${p.patrimonio}${p.obs?.trim() ? `: ${p.obs.trim().slice(0, 80)}` : ""}`).join("; ");
  return (
    `${tecnico || "Técnico"} enviou a conferência do dia ${diaCurto(dia)} — ${prova}: ✅ ${ok}` +
    (prob.length ? ` · ⚠ ${prob.length} com problema (${detalhes})` : " · tudo certo")
  );
}
