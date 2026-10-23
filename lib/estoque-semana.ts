/**
 * Estoque × uso da semana: quanto tenho de cada produto (produtos.quantidade_estoque),
 * quanto está alocado nas provas da semana (card "Produtos") e quanto sobra.
 */

import { chaveSemana, parseDataBR } from "./semana";

export type ProdutoEstoque = { id: number; nome: string; quantidade_estoque: number | null };
export type EventoUso = { data: string; uf?: string | null; produtos: { id: number; quantidade: number }[] };

export type LinhaEstoque = {
  id: number;
  nome: string;
  total: number;
  alocado: number;
  disponivel: number; // nunca negativo
  falta: number; // alocado acima do total
};

/** `daBase` restringe as provas (ex.: pela UF da base escolhida); sem ele, conta todas. */
export function estoqueDaSemana(
  produtos: ProdutoEstoque[],
  eventos: EventoUso[],
  inicioSemana: Date,
  daBase: (ev: EventoUso) => boolean = () => true
): LinhaEstoque[] {
  const chave = chaveSemana(inicioSemana);
  const uso = new Map<number, number>();
  for (const ev of eventos) {
    const d = parseDataBR(ev.data);
    if (!d || chaveSemana(d) !== chave || !daBase(ev)) continue;
    for (const p of ev.produtos) uso.set(p.id, (uso.get(p.id) || 0) + (Number(p.quantidade) || 0));
  }
  return produtos
    .map((p) => {
      const total = Number(p.quantidade_estoque) || 0;
      const alocado = uso.get(p.id) || 0;
      return {
        id: p.id,
        nome: p.nome,
        total,
        alocado,
        disponivel: Math.max(0, total - alocado),
        falta: Math.max(0, alocado - total),
      };
    })
    .filter((l) => l.total > 0 || l.alocado > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
