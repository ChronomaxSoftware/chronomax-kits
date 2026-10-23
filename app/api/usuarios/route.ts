import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbAll, dbRun, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { validarNomeUsuario, validarUsername } from "@/lib/usuarios";
import { validarNovaSenhaAdmin } from "@/lib/senha-admin";

async function exigirAdmin() {
  const s = await getSession();
  return s.isLoggedIn && s.role === "admin" && s.userId ? s : null;
}

// GET /api/usuarios — usuários do escritório (acesso total)
export async function GET() {
  await initDB();
  if (!(await exigirAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const rows = await dbAll(
    "SELECT id, username, name, COALESCE(ativo, 1) AS ativo, created_at FROM users ORDER BY COALESCE(ativo, 1) DESC, name"
  );
  return NextResponse.json(rows);
}

// POST /api/usuarios { name, username, password }
export async function POST(req: NextRequest) {
  await initDB();
  if (!(await exigirAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const nome = validarNomeUsuario(body.name);
  if (!nome) return NextResponse.json({ error: "Informe o nome (2 a 80 caracteres)" }, { status: 400 });
  const u = validarUsername(body.username);
  if (!u.ok) return NextResponse.json({ error: u.erro }, { status: 400 });
  const erroSenha = validarNovaSenhaAdmin(body.password, null, u.username);
  if (erroSenha) return NextResponse.json({ error: erroSenha.replace("A nova senha", "A senha") }, { status: 400 });

  try {
    const r = await dbRun(
      "INSERT INTO users (username, password_hash, name, ativo) VALUES (?, ?, ?, 1)",
      u.username,
      bcrypt.hashSync(String(body.password), 10),
      nome
    );
    return NextResponse.json({ id: r.lastInsertRowid }, { status: 201 });
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return NextResponse.json({ error: `O login ${u.username} já existe` }, { status: 409 });
    }
    console.error("[usuarios] erro ao criar", err);
    return NextResponse.json({ error: "Não foi possível criar o usuário" }, { status: 500 });
  }
}
