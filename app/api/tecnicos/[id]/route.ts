import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { nome, telefone, ativo } = await req.json();
  db.prepare("UPDATE tecnicos SET nome = ?, telefone = ?, ativo = ? WHERE id = ?").run(
    nome,
    telefone || null,
    ativo ? 1 : 0,
    id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.prepare("DELETE FROM tecnicos WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
