import { NextRequest, NextResponse } from "next/server";
import { get, set, setSenha } from "@/lib/config";
import { initDB } from "@/lib/db";

export async function GET() {
  await initDB();
  return NextResponse.json({
    gestao_usuario: (await get("gestao_usuario")) || "",
    gestao_senha_definida: !!(await get("gestao_senha")),
    gestao_base_url: (await get("gestao_base_url")) || "https://gestao.chronomax.com.br",
    gestao_semanas_a_buscar: parseInt((await get("gestao_semanas_a_buscar")) || "100"),
  });
}

export async function POST(req: NextRequest) {
  await initDB();
  const body = await req.json();

  if ("gestao_usuario" in body) await set("gestao_usuario", body.gestao_usuario || "");
  if ("gestao_base_url" in body) await set("gestao_base_url", body.gestao_base_url || "https://gestao.chronomax.com.br");
  if ("gestao_semanas_a_buscar" in body) await set("gestao_semanas_a_buscar", String(body.gestao_semanas_a_buscar || 100));
  if ("gestao_senha" in body && body.gestao_senha) await setSenha(body.gestao_senha);

  return NextResponse.json({ ok: true });
}
