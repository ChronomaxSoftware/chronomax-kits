/**
 * Correção de quantidade recebida: o técnico não muda "quantos vieram" de cada item direto —
 * pede uma correção com explicação e o escritório aprova ou recusa.
 */

export type StatusCorrecao = "pendente" | "aprovado" | "recusado";

export type Correcao = {
  id: number;
  evento_id: number;
  tecnico_id: number;
  produto_id: number;
  produto?: string;
  tecnico?: string;
  qtd_antes: number;
  qtd_pedida: number;
  explicacao: string;
  status: StatusCorrecao;
  motivo: string | null;
  criado_em: string;
  decidido_em: string | null;
};

export const EXPLICACAO_MIN = 10;
export const EXPLICACAO_MAX = 1000;
export const QTD_MAX = 10000;

/** Quantidade que vale hoje para o item: a corrigida (aprovada) ou a esperada. */
export function qtdAtual(p: { quantidade: number; qtd_recebida: number | null }): number {
  return p.qtd_recebida ?? Number(p.quantidade);
}

export type ItemPedido = { produto_id: number; qtd: number; qtd_antes: number };

/**
 * Valida o pedido do técnico. `atuais` = produto_id → quantidade que vale hoje (só itens da prova).
 * Só entram os itens com quantidade diferente da atual.
 */
export function validarPedido(
  itens: unknown,
  explicacao: unknown,
  atuais: Map<number, number>
): { erro: string } | { itens: ItemPedido[]; explicacao: string } {
  const exp = typeof explicacao === "string" ? explicacao.trim() : "";
  if (exp.length < EXPLICACAO_MIN) return { erro: `Escreva a explicação (mínimo ${EXPLICACAO_MIN} letras).` };
  if (exp.length > EXPLICACAO_MAX) return { erro: "Explicação grande demais." };
  if (!Array.isArray(itens)) return { erro: "Itens inválidos." };

  const out: ItemPedido[] = [];
  for (const it of itens) {
    const pid = Number(it?.produto_id);
    const qtd = Number(it?.qtd);
    if (!atuais.has(pid)) return { erro: "Item que não é desta prova." };
    if (!Number.isInteger(qtd) || qtd < 0 || qtd > QTD_MAX) return { erro: "Quantidade inválida." };
    const antes = atuais.get(pid)!;
    if (qtd !== antes && !out.some((o) => o.produto_id === pid)) out.push({ produto_id: pid, qtd, qtd_antes: antes });
  }
  if (out.length === 0) return { erro: "Nenhuma quantidade diferente da atual." };
  return { itens: out, explicacao: exp };
}

/** Último pedido de cada item (lista vinda em qualquer ordem). */
export function ultimaPorProduto<T extends { id: number; produto_id: number }>(lista: T[]): Map<number, T> {
  const m = new Map<number, T>();
  for (const c of lista) {
    const atual = m.get(Number(c.produto_id));
    if (!atual || Number(c.id) > Number(atual.id)) m.set(Number(c.produto_id), c);
  }
  return m;
}

export function textoAlertaCorrecao(
  tecnico: string,
  prova: string,
  itens: { nome: string; antes: number; pedida: number }[],
  explicacao: string
): string {
  const quem = tecnico.trim() || "Técnico";
  const lista = itens.map((i) => `${i.nome} ${i.antes} → ${i.pedida}`).join("; ");
  return `${quem} pediu CORREÇÃO de quantidade — ${prova} — ${lista} — explicação: ${explicacao.trim().slice(0, 200)}`;
}
