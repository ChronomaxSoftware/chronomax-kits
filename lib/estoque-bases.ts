import { dbAll } from "./db";
import { tipoDeProduto } from "./equipamentos";
import { contagemPorBase } from "./inventario-resumo";

type BaseRow = { id: number; nome: string; uf: string; ordem: number };
type EstoqueRow = { base_id: number; produto_id: number; quantidade: number; produto_nome: string };

export type ItemEstoqueBase = { produto_id: number; produto_nome: string; quantidade: number; origem: "inventario" | "manual" };
export type BaseComEstoque = BaseRow & { estoque: ItemEstoqueBase[] };

/**
 * Estoque de cada base. Produtos que são equipamento (Celular, Roteador, ...): a quantidade
 * vem do inventário de patrimônios (fora de manutenção), não do número digitado em estoque_base.
 */
export async function estoqueDasBases(): Promise<BaseComEstoque[]> {
  const [bases, estoque, produtos, equipamentos] = await Promise.all([
    dbAll<BaseRow>("SELECT id, nome, uf, ordem FROM bases ORDER BY ordem, nome"),
    dbAll<EstoqueRow>(
      `SELECT eb.base_id, eb.produto_id, eb.quantidade, p.nome as produto_nome
       FROM estoque_base eb JOIN produtos p ON p.id = eb.produto_id`
    ),
    dbAll<{ id: number; nome: string }>("SELECT id, nome FROM produtos"),
    dbAll<{ tipo: string; status: string; base_id: number | null }>("SELECT tipo, status, base_id FROM equipamentos"),
  ]);
  const contagem = contagemPorBase(equipamentos);

  return bases.map((b) => {
    const manuais = estoque
      .filter((e) => e.base_id === b.id && !tipoDeProduto(e.produto_nome))
      .map(({ produto_id, produto_nome, quantidade }) => ({ produto_id, produto_nome, quantidade, origem: "manual" as const }));
    const doInventario = produtos.flatMap((p) => {
      const t = tipoDeProduto(p.nome);
      const quantidade = t ? contagem.get(`${b.id}:${t}`) || 0 : 0;
      return quantidade > 0 ? [{ produto_id: p.id, produto_nome: p.nome, quantidade, origem: "inventario" as const }] : [];
    });
    return { ...b, estoque: [...doInventario, ...manuais] };
  });
}
