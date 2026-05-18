import { NextRequest, NextResponse } from "next/server";
import { dbRun, initDB } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  const { nome, telefone, ativo } = await req.json();
  await dbRun(
    "UPDATE tecnicos SET nome = ?, telefone = ?, ativo = ? WHERE id = ?",
    nome,
    telefone || null,
    ativo ? 1 : 0,
    id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  await dbRun("DELETE FROM tecnicos WHERE id = ?", id);
  return NextResponse.json({ ok: true });
}
