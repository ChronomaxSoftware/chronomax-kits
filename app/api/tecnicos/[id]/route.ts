import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbRun, initDB } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  const body = await req.json();

  const updates: string[] = [];
  const vals: unknown[] = [];
  if ("nome" in body) {
    updates.push("nome = ?");
    vals.push(body.nome);
  }
  if ("telefone" in body) {
    updates.push("telefone = ?");
    vals.push(body.telefone || null);
  }
  if ("ativo" in body) {
    updates.push("ativo = ?");
    vals.push(body.ativo ? 1 : 0);
  }
  if ("login" in body) {
    updates.push("login = ?");
    vals.push(body.login?.trim() || null);
  }
  // Só troca a senha quando vier preenchida (em branco mantém a atual)
  if (body.senha) {
    updates.push("senha_hash = ?");
    vals.push(bcrypt.hashSync(body.senha, 10));
  }

  if (updates.length === 0) return NextResponse.json({ ok: true });
  vals.push(id);
  try {
    await dbRun(`UPDATE tecnicos SET ${updates.join(", ")} WHERE id = ?`, ...vals);
  } catch {
    return NextResponse.json({ error: "Esse login já está em uso por outro técnico" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  await dbRun("DELETE FROM tecnicos WHERE id = ?", id);
  return NextResponse.json({ ok: true });
}
