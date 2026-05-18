import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbRun, initDB } from "@/lib/db";

export async function GET() {
  await initDB();
  const rows = await dbAll("SELECT id, nome, ativo, quantidade_estoque FROM produtos ORDER BY nome");
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  await initDB();
  const { nome, quantidade_estoque } = await req.json();
  if (!nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  try {
    const r = await dbRun(
      "INSERT INTO produtos (nome, quantidade_estoque) VALUES (?, ?)",
      nome.trim(),
      quantidade_estoque || 0
    );
    return NextResponse.json({ id: r.lastInsertRowid });
  } catch {
    return NextResponse.json({ error: "Produto já existe" }, { status: 409 });
  }
}
