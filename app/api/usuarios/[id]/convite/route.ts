import { NextRequest, NextResponse } from "next/server";
import { dbBatch, dbGet, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { expiraConviteUsuario, gerarTokenConvite, hashTokenConvite } from "@/lib/convite-usuario";

// POST /api/usuarios/[id]/convite — gera o link de senha (uso único, 24h) e cancela os anteriores. Só admin.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "admin" || !session.userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const id = Number((await params).id);
  const u = await dbGet<{ id: number; username: string; name: string; ativo: number }>(
    "SELECT id, username, name, COALESCE(ativo, 1) AS ativo FROM users WHERE id = ?",
    id
  );
  if (!u) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  if (!u.ativo) return NextResponse.json({ error: "Usuário desativado — reative antes de gerar o link" }, { status: 400 });

  const token = gerarTokenConvite();
  const expira = expiraConviteUsuario();
  await dbBatch([
    { sql: "DELETE FROM convites_usuario WHERE user_id = ?", args: [id] },
    {
      sql: "INSERT INTO convites_usuario (user_id, token_hash, expira_em, criado_por) VALUES (?, ?, ?, ?)",
      args: [id, hashTokenConvite(token), expira, session.name || session.username || null],
    },
  ]);
  return NextResponse.json({ token, expira_em: expira, nome: u.name, username: u.username });
}
