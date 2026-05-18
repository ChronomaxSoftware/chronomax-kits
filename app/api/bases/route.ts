import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

type BaseRow = { id: number; nome: string; uf: string; ordem: number };
type EstoqueRow = { base_id: number; produto_id: number; quantidade: number; produto_nome: string };

export async function GET() {
  const bases = db.prepare("SELECT id, nome, uf, ordem FROM bases ORDER BY ordem, nome").all() as BaseRow[];
  const estoque = db
    .prepare(
      `SELECT eb.base_id, eb.produto_id, eb.quantidade, p.nome as produto_nome
       FROM estoque_base eb JOIN produtos p ON p.id = eb.produto_id`
    )
    .all() as EstoqueRow[];

  const out = bases.map((b) => ({
    ...b,
    estoque: estoque
      .filter((e) => e.base_id === b.id)
      .map(({ produto_id, produto_nome, quantidade }) => ({ produto_id, produto_nome, quantidade })),
  }));
  return NextResponse.json(out);
}

export async function POST(req: NextRequest) {
  const { nome, uf, ordem } = await req.json();
  if (!nome?.trim() || !uf?.trim()) {
    return NextResponse.json({ error: "Nome e UF obrigatórios" }, { status: 400 });
  }
  try {
    const r = db
      .prepare("INSERT INTO bases (nome, uf, ordem) VALUES (?, ?, ?)")
      .run(nome.trim(), uf.trim().toUpperCase().slice(0, 2), ordem || 99);
    return NextResponse.json({ id: r.lastInsertRowid });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 400 });
  }
}
