import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const campos = ["apelido", "numero", "operadora", "identificador", "base_id", "evento_id", "observacao"];
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const c of campos) {
    if (c in body) {
      updates.push(`${c} = ?`);
      values.push(body[c] === "" ? null : body[c]);
    }
  }
  if ("quantidade" in body) {
    updates.push("quantidade = ?");
    values.push(Math.max(1, parseInt(body.quantidade) || 1));
  }
  if (updates.length === 0) return NextResponse.json({ ok: true });
  values.push(id);
  db.prepare(`UPDATE celulares_chip SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.prepare("DELETE FROM celulares_chip WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
