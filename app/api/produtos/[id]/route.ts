import { NextRequest, NextResponse } from "next/server";
import { dbRun, initDB } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  const { nome, ativo, quantidade_estoque } = await req.json();
  await dbRun(
    "UPDATE produtos SET nome = ?, ativo = ?, quantidade_estoque = ? WHERE id = ?",
    nome,
    ativo ? 1 : 0,
    quantidade_estoque ?? 0,
    id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  await dbRun("DELETE FROM produtos WHERE id = ?", id);
  return NextResponse.json({ ok: true });
}
