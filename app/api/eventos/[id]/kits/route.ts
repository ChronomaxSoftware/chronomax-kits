import { NextRequest, NextResponse } from "next/server";
import { dbRun, dbGet, dbAll, initDB } from "@/lib/db";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";

export const maxDuration = 60;

function uploadDir(eventoId: string | number): string {
  const dir = path.join(process.cwd(), "data", "uploads", "eventos", String(eventoId));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  const rows = await dbAll("SELECT id, evento_id, nome, descricao, imagem_path, ordem FROM evento_kits WHERE evento_id = ? ORDER BY ordem, id", id);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  const evento = await dbGet("SELECT id FROM eventos WHERE id = ?", id);
  if (!evento) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });

  const form = await req.formData();
  const nome = (form.get("nome") as string | null)?.trim();
  const descricao = (form.get("descricao") as string | null)?.trim() || null;
  const file = form.get("imagem") as File | null;

  if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  let imagemPath: string | null = null;
  if (file && file.size > 0) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(uploadDir(id), filename), buf);
    imagemPath = `eventos/${id}/${filename}`;
  }

  const r = await dbRun("INSERT INTO evento_kits (evento_id, nome, descricao, imagem_path, ordem) VALUES (?, ?, ?, ?, ?)",
    id, nome, descricao, imagemPath, 0);

  return NextResponse.json({ id: r.lastInsertRowid });
}
