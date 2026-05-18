import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const campos = ["nome", "uf", "ordem"];
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const c of campos) {
    if (c in body) {
      updates.push(`${c} = ?`);
      values.push(c === "uf" ? String(body[c]).toUpperCase().slice(0, 2) : body[c]);
    }
  }
  if (Array.isArray(body.estoque)) {
    const stmt = db.prepare(
      `INSERT INTO estoque_base (base_id, produto_id, quantidade) VALUES (?, ?, ?)
       ON CONFLICT(base_id, produto_id) DO UPDATE SET quantidade = excluded.quantidade`
    );
    for (const e of body.estoque) {
      const qtd = Math.max(0, parseInt(e.quantidade) || 0);
      if (qtd === 0) {
        db.prepare("DELETE FROM estoque_base WHERE base_id = ? AND produto_id = ?").run(id, e.produto_id);
      } else {
        stmt.run(id, e.produto_id, qtd);
      }
    }
  }
  if (updates.length > 0) {
    values.push(id);
    db.prepare(`UPDATE bases SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.prepare("DELETE FROM bases WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
