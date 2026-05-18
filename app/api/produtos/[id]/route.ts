import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { nome, ativo, quantidade_estoque } = await req.json();
  db.prepare("UPDATE produtos SET nome = ?, ativo = ?, quantidade_estoque = ? WHERE id = ?").run(
    nome,
    ativo ? 1 : 0,
    quantidade_estoque ?? 0,
    id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.prepare("DELETE FROM produtos WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
