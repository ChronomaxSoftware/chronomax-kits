/**
 * "Locação de Notebook para Eventos - Atendimento": item contratado no Gestão
 * (vem no sync, em evento_itens_gestao). É diferente do notebook da entrega de kits.
 */

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ehNotebookAtendimento(nome: string): boolean {
  const n = sem(String(nome || ""));
  return n.includes("notebook") && n.includes("atendimento");
}

/** Soma das unidades de notebook para atendimento contratadas (0 = não tem). */
export function qtdNotebookAtendimento(itens: { nome: string; quantidade: number }[]): number {
  return itens.reduce((s, it) => s + (ehNotebookAtendimento(it.nome) ? Number(it.quantidade) || 0 : 0), 0);
}
