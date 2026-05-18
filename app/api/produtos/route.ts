import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const rows = db
    .prepare("SELECT id, nome, ativo, quantidade_estoque FROM produtos ORDER BY nome")
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { nome, quantidade_estoque } = await req.json();
  if (!nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  try {
    const r = db
      .prepare("INSERT INTO produtos (nome, quantidade_estoque) VALUES (?, ?)")
      .run(nome.trim(), quantidade_estoque || 0);
    return NextResponse.json({ id: r.lastInsertRowid });
  } catch {
    return NextResponse.json({ error: "Produto já existe" }, { status: 409 });
  }
}
