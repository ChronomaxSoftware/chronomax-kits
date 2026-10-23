import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbGet, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { candidatosLogin } from "@/lib/login-tecnico";
import { SENHA_INICIAL_ADMIN } from "@/lib/senha-admin";

export async function POST(req: NextRequest) {
  await initDB();
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: "Usuário e senha obrigatórios" }, { status: 400 });
  }

  // 1. Tenta admin (tabela users)
  const user = await dbGet<{ id: number; username: string; password_hash: string; name: string }>(
    "SELECT id, username, password_hash, name FROM users WHERE username = ? AND COALESCE(ativo, 1) = 1",
    String(username).trim().toLowerCase()
  );
  if (user && bcrypt.compareSync(password, user.password_hash)) {
    const session = await getSession();
    session.userId = user.id;
    session.username = user.username;
    session.name = user.name;
    session.role = "admin";
    session.tecnicoId = undefined;
    session.senhaPadrao = password === SENHA_INICIAL_ADMIN;
    session.isLoggedIn = true;
    await session.save();
    return NextResponse.json({ ok: true, name: user.name, role: "admin" });
  }

  // 2. Tenta técnico (tabela tecnicos, colunas login/senha_hash). Aceita o telefone
  // em qualquer formato — "(51) 99999-0000" casa com o login "51999990000".
  const candidatos = candidatosLogin(String(username));
  const tec = await dbGet<{ id: number; login: string; senha_hash: string | null; nome: string }>(
    `SELECT id, login, senha_hash, nome FROM tecnicos
     WHERE login IN (${candidatos.map(() => "?").join(",")}) AND ativo = 1
     ORDER BY CASE WHEN login = ? THEN 0 ELSE 1 END LIMIT 1`,
    ...candidatos,
    candidatos[0]
  );
  if (tec && tec.senha_hash && bcrypt.compareSync(password, tec.senha_hash)) {
    const session = await getSession();
    session.userId = undefined;
    session.username = tec.login;
    session.name = tec.nome;
    session.role = "tecnico";
    session.tecnicoId = tec.id;
    session.senhaPadrao = false;
    session.isLoggedIn = true;
    await session.save();
    return NextResponse.json({ ok: true, name: tec.nome, role: "tecnico" });
  }

  return NextResponse.json({ error: "Usuário ou senha incorretos" }, { status: 401 });
}
