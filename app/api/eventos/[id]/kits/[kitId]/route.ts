import { NextRequest, NextResponse } from "next/server";
import { dbRun, dbGet, initDB } from "@/lib/db";
import path from "path";
import fs from "fs/promises";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; kitId: string }> }) {
  await initDB();
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
  await dbRun(`UPDATE evento_kits SET ${updates.join(", ")} WHERE id = ?`, ...values);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; kitId: string }> }) {
  await initDB();
  const { kitId } = await params;
  const row = await dbGet<{ imagem_path: string | null }>("SELECT imagem_path FROM evento_kits WHERE id = ?", kitId);
  if (row?.imagem_path) {
    const full = path.join(process.cwd(), "data", "uploads", row.imagem_path);
    fs.unlink(full).catch(() => {});
  }
  await dbRun("DELETE FROM evento_kits WHERE id = ?", kitId);
  return NextResponse.json({ ok: true });
}
