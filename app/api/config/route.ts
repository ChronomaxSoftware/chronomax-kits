import { NextRequest, NextResponse } from "next/server";
import { get, set, setSenha } from "@/lib/config";

export async function GET() {
  return NextResponse.json({
    gestao_usuario: get("gestao_usuario") || "",
    gestao_senha_definida: !!get("gestao_senha"),
    gestao_base_url: get("gestao_base_url") || "https://gestao.chronomax.com.br",
    gestao_semanas_a_buscar: parseInt(get("gestao_semanas_a_buscar") || "100"),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if ("gestao_usuario" in body) set("gestao_usuario", body.gestao_usuario || "");
  if ("gestao_base_url" in body) set("gestao_base_url", body.gestao_base_url || "https://gestao.chronomax.com.br");
  if ("gestao_semanas_a_buscar" in body) set("gestao_semanas_a_buscar", String(body.gestao_semanas_a_buscar || 100));
  if ("gestao_senha" in body && body.gestao_senha) setSenha(body.gestao_senha);

  return NextResponse.json({ ok: true });
}
