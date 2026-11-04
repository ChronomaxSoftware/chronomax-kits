import { NextRequest, NextResponse } from "next/server";
import { dbRun, dbGet, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { listarKits } from "@/lib/kits-foto-db";
import { DESCRICAO_KIT_MAX, FOTO_KIT_MAX_BYTES, NOME_KIT_MAX, ehTipoFotoKit } from "@/lib/kits-foto";

export const maxDuration = 60;

async function admin() {
  const s = await getSession();
  return s.isLoggedIn && s.role === "admin";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  if (!(await admin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json(await listarKits([Number(id)], "escritorio"));
}

/** POST (multipart): nome, descricao?, imagem? — uma foto por pedido (limite de corpo da Vercel). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  if (!(await admin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const evento = await dbGet("SELECT id FROM eventos WHERE id = ?", id);
  if (!evento) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });

  const form = await req.formData();
  const nome = String(form.get("nome") ?? "").trim().slice(0, NOME_KIT_MAX);
  const descricao = String(form.get("descricao") ?? "").trim().slice(0, DESCRICAO_KIT_MAX) || null;
  const file = form.get("imagem");

  if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  let dados: Uint8Array | null = null;
  let tipo: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (!ehTipoFotoKit(file.type)) return NextResponse.json({ error: "A foto precisa ser JPG, PNG ou WEBP" }, { status: 400 });
    if (file.size > FOTO_KIT_MAX_BYTES) return NextResponse.json({ error: "Foto grande demais (máx. 2 MB)" }, { status: 400 });
    dados = new Uint8Array(await file.arrayBuffer());
    tipo = file.type;
  }

  const prox = await dbGet<{ n: number }>("SELECT COALESCE(MAX(ordem), 0) + 1 AS n FROM evento_kits WHERE evento_id = ?", id);
  const r = await dbRun(
    "INSERT INTO evento_kits (evento_id, nome, descricao, imagem_dados, imagem_tipo, ordem) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    nome,
    descricao,
    dados,
    tipo,
    Number(prox?.n ?? 1)
  );

  return NextResponse.json({ id: r.lastInsertRowid });
}
