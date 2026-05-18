import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import path from "path";
import fs from "fs/promises";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; kitId: string }> }) {
  const { kitId } = await params;
  const body = await req.json();
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const c of ["nome", "descricao", "ordem"]) {
    if (c in body) {
      updates.push(`${c} = ?`);
      values.push(body[c]);
    }
  }
  if (updates.length === 0) return NextResponse.json({ ok: true });
  values.push(kitId);
  db.prepare(`UPDATE evento_kits SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; kitId: string }> }) {
  const { kitId } = await params;
  const row = db.prepare("SELECT imagem_path FROM evento_kits WHERE id = ?").get(kitId) as
    | { imagem_path: string | null }
    | undefined;
  if (row?.imagem_path) {
    const full = path.join(process.cwd(), "data", "uploads", row.imagem_path);
    fs.unlink(full).catch(() => {});
  }
  db.prepare("DELETE FROM evento_kits WHERE id = ?").run(kitId);
  return NextResponse.json({ ok: true });
}
