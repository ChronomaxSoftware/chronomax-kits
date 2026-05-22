// Funções disponíveis ao vincular um colaborador a um aparelho.
export const FUNCOES_STAFF = [
  "Entrega de Kit",
  "Conferência",
  "Coordenação",
  "Organização",
  "Atendimento",
  "Suporte",
  "Logística",
  "Staff",
  "Outra",
] as const;

export type StatusDevice = "disponivel" | "em_uso" | "inativo";

export function labelStatusDevice(s: string): string {
  if (s === "disponivel") return "Disponível";
  if (s === "em_uso") return "Em uso";
  if (s === "inativo") return "Inativo";
  return s;
}

/** Formata segundos em "Xh Ymin" / "Ymin" / "Zs". */
export function formatDuracao(segundos: number | null | undefined): string {
  if (segundos == null) return "—";
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min`;
  return `${s}s`;
}
