import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const rows = db.prepare("SELECT id, nome, telefone, ativo FROM tecnicos ORDER BY nome").all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { nome, telefone } = await req.json();
  if (!nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  const r = db.prepare("INSERT INTO tecnicos (nome, telefone) VALUES (?, ?)").run(nome.trim(), telefone || null);
  return NextResponse.json({ id: r.lastInsertRowid });
}
