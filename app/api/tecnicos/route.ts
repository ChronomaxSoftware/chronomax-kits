import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbRun, initDB } from "@/lib/db";

export async function GET() {
  await initDB();
  const rows = await dbAll("SELECT id, nome, telefone, ativo FROM tecnicos ORDER BY nome");
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  await initDB();
  const { nome, telefone } = await req.json();
  if (!nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  const r = await dbRun(
    "INSERT INTO tecnicos (nome, telefone) VALUES (?, ?)",
    nome.trim(),
    telefone || null
  );
  return NextResponse.json({ id: r.lastInsertRowid });
}
