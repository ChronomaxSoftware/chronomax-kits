import { NextRequest, NextResponse } from "next/server";
import { dbRun, dbAll, initDB } from "@/lib/db";
import { tipoDeProduto } from "@/lib/equipamentos";
import { contagemPorBase } from "@/lib/inventario-resumo";

type BaseRow = { id: number; nome: string; uf: string; ordem: number };
type EstoqueRow = { base_id: number; produto_id: number; quantidade: number; produto_nome: string };

export async function GET() {
  await initDB();
  const bases = await dbAll<BaseRow>("SELECT id, nome, uf, ordem FROM bases ORDER BY ordem, nome");
  const estoque = await dbAll<EstoqueRow>(
    `SELECT eb.base_id, eb.produto_id, eb.quantidade, p.nome as produto_nome
     FROM estoque_base eb JOIN produtos p ON p.id = eb.produto_id`
  );

  // Produtos que são equipamento (Celular, Roteador, ...): a quantidade por base vem do
  // inventário de patrimônios (fora de manutenção), não do número digitado em estoque_base.
  const produtos = await dbAll<{ id: number; nome: string }>("SELECT id, nome FROM produtos");
  const equipamentos = await dbAll<{ tipo: string; status: string; base_id: number | null }>(
    "SELECT tipo, status, base_id FROM equipamentos"
  );
  const contagem = contagemPorBase(equipamentos);

  const out = bases.map((b) => {
    const manuais = estoque
      .filter((e) => e.base_id === b.id && !tipoDeProduto(e.produto_nome))
      .map(({ produto_id, produto_nome, quantidade }) => ({ produto_id, produto_nome, quantidade, origem: "manual" }));
    const doInventario = produtos.flatMap((p) => {
      const t = tipoDeProduto(p.nome);
      const quantidade = t ? contagem.get(`${b.id}:${t}`) || 0 : 0;
      return quantidade > 0 ? [{ produto_id: p.id, produto_nome: p.nome, quantidade, origem: "inventario" }] : [];
    });
    return { ...b, estoque: [...doInventario, ...manuais] };
  });
  return NextResponse.json(out);
}

export async function POST(req: NextRequest) {
  await initDB();
  const { nome, uf, ordem } = await req.json();
  if (!nome?.trim() || !uf?.trim()) {
    return NextResponse.json({ error: "Nome e UF obrigatórios" }, { status: 400 });
  }
  try {
    const r = await dbRun("INSERT INTO bases (nome, uf, ordem) VALUES (?, ?, ?)",
      nome.trim(), uf.trim().toUpperCase().slice(0, 2), ordem || 99);
    return NextResponse.json({ id: r.lastInsertRowid });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 400 });
  }
}
