import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbGet, dbRun, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { validarNovaSenhaAdmin } from "@/lib/senha-admin";

// POST /api/auth/senha { senhaAtual, novaSenha } — admin troca a própria senha
export async function POST(req: NextRequest) {
  await initDB();
  const session = await getSession();
  if (!session.isLoggedIn || session.role === "tecnico" || !session.userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { senhaAtual, novaSenha } = await req.json().catch(() => ({}));

  const user = await dbGet<{ username: string; password_hash: string }>(
    "SELECT username, password_hash FROM users WHERE id = ?",
    session.userId
  );
  if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  if (!senhaAtual || !bcrypt.compareSync(String(senhaAtual), user.password_hash)) {
    return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
  }
  const erro = validarNovaSenhaAdmin(novaSenha, senhaAtual, user.username);
  if (erro) return NextResponse.json({ error: erro }, { status: 400 });

  await dbRun("UPDATE users SET password_hash = ? WHERE id = ?", bcrypt.hashSync(String(novaSenha), 10), session.userId);
  session.senhaPadrao = false;
  await session.save();
  return NextResponse.json({ ok: true });
}
