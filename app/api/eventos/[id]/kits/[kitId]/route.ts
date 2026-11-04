import { NextRequest, NextResponse } from "next/server";
import { dbRun, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { DESCRICAO_KIT_MAX, NOME_KIT_MAX } from "@/lib/kits-foto";

async function admin() {
  const s = await getSession();
  return s.isLoggedIn && s.role === "admin";
}

// PUT { nome?, descricao?, ordem? } — corrige o kit (a foto não muda aqui)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; kitId: string }> }) {
  await initDB();
  if (!(await admin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id, kitId } = await params;
  const body = await req.json().catch(() => ({}));
  const updates: string[] = [];
  const values: unknown[] = [];
  if ("nome" in body) {
    const nome = String(body.nome ?? "").trim().slice(0, NOME_KIT_MAX);
    if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
    updates.push("nome = ?");
    values.push(nome);
  }
  if ("descricao" in body) {
    updates.push("descricao = ?");
    values.push(String(body.descricao ?? "").trim().slice(0, DESCRICAO_KIT_MAX) || null);
  }
  if ("ordem" in body) {
    updates.push("ordem = ?");
    values.push(Number(body.ordem) || 0);
  }
  if (updates.length === 0) return NextResponse.json({ ok: true });
  await dbRun(`UPDATE evento_kits SET ${updates.join(", ")} WHERE id = ? AND evento_id = ?`, ...values, kitId, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; kitId: string }> }) {
  await initDB();
  if (!(await admin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id, kitId } = await params;
  await dbRun("DELETE FROM evento_kits WHERE id = ? AND evento_id = ?", kitId, id);
  return NextResponse.json({ ok: true });
}
