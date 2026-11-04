/**
 * "📘 Book — Equipamentos" calculado do card Produtos da prova (não se digita duas vezes).
 * Só "Celular grupo online" e "Celulares produtos online" são digitados no book;
 * "Celulares número" = total de celulares do Produtos − esses dois.
 */

import { tipoDeProduto } from "./equipamentos";

export type ProdutoQtd = { nome: string; quantidade: number | null | undefined };

export type EquipamentosBook = {
  roteadores: number;
  celulares_total: number;
  celulares_numero: number;
  celulares_grupo_online: number;
  celulares_produtos_online: number;
  totens: number;
  notebooks: number;
  /** Os online somam mais que os celulares do Produtos. */
  online_excede: boolean;
};

const n = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));

export function equipamentosBook(
  produtos: ProdutoQtd[],
  online: { qtd_celulares_grupo_online?: number | null; qtd_celulares_produtos_online?: number | null }
): EquipamentosBook {
  const soma = { Celular: 0, Roteador: 0, Totem: 0, Notebook: 0 } as Record<string, number>;
  for (const p of produtos) {
    const t = tipoDeProduto(p.nome);
    if (t && t in soma) soma[t] += n(p.quantidade);
  }
  const grupo = n(online.qtd_celulares_grupo_online);
  const prodOnline = n(online.qtd_celulares_produtos_online);
  return {
    roteadores: soma.Roteador,
    celulares_total: soma.Celular,
    celulares_numero: Math.max(0, soma.Celular - grupo - prodOnline),
    celulares_grupo_online: grupo,
    celulares_produtos_online: prodOnline,
    totens: soma.Totem,
    notebooks: soma.Notebook,
    online_excede: grupo + prodOnline > soma.Celular,
  };
}

/** Itens com quantidade > 0, na ordem e com os rótulos do book. */
export function itensEquipamentosBook(e: EquipamentosBook): { nome: string; quantidade: number }[] {
  return (
    [
      ["Roteadores", e.roteadores],
      ["Celulares número", e.celulares_numero],
      ["Celular grupo online", e.celulares_grupo_online],
      ["Celulares produtos online", e.celulares_produtos_online],
      ["Totens", e.totens],
      ["Notebooks", e.notebooks],
    ] as [string, number][]
  )
    .filter(([, q]) => q > 0)
    .map(([nome, quantidade]) => ({ nome, quantidade }));
}

/** Endereço da retirada no book: o preenchido ou, vazio, o Local de entrega. */
export function enderecoRetiradaBook(enderecoRetirada: string | null | undefined, localEntrega: string | null | undefined): string {
  return String(enderecoRetirada || "").trim() || String(localEntrega || "").trim();
}
