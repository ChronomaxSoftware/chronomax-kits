import { NextRequest, NextResponse } from "next/server";
import { dbBatch, dbGet, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { loginDeTelefone } from "@/lib/login-tecnico";
import { expiracaoConvite, gerarTokenConvite, hashTokenConvite } from "@/lib/convite";

// POST /api/tecnicos/[id]/convite — gera o link de acesso (cancela os anteriores não usados)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const id = Number((await params).id);
  const tec = await dbGet<{ id: number; nome: string; telefone: string | null; login: string | null; ativo: number }>(
    "SELECT id, nome, telefone, login, ativo FROM tecnicos WHERE id = ?",
    id
  );
  if (!tec) return NextResponse.json({ error: "Técnico não encontrado" }, { status: 404 });
  if (!tec.ativo) return NextResponse.json({ error: "Técnico inativo — reative antes de gerar o link" }, { status: 400 });
  if (!tec.login && !loginDeTelefone(tec.telefone)) {
    return NextResponse.json(
      { error: "Cadastre o telefone do técnico (DDD + número) — ele é o login do portal" },
      { status: 400 }
    );
  }

  const token = gerarTokenConvite();
  const expira_em = expiracaoConvite();
  await dbBatch([
    { sql: "DELETE FROM convites_tecnico WHERE tecnico_id = ? AND usado_em IS NULL", args: [id] },
    {
      sql: "INSERT INTO convites_tecnico (tecnico_id, token_hash, expira_em, criado_por) VALUES (?, ?, ?, ?)",
      args: [id, hashTokenConvite(token), expira_em, session.name || null],
    },
  ]);
  return NextResponse.json({ token, expira_em, nome: tec.nome, telefone: tec.telefone });
}
