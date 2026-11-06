import { NextRequest, NextResponse } from "next/server";
import { dbRun, initDB } from "@/lib/db";
import { estoqueDasBases } from "@/lib/estoque-bases";

export async function GET() {
  await initDB();
  return NextResponse.json(await estoqueDasBases());
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
