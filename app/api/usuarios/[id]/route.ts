import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbGet, dbRun, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { podeDesativar, validarNomeUsuario } from "@/lib/usuarios";
import { validarNovaSenhaAdmin } from "@/lib/senha-admin";
import { ehPerfilValido, podeMudarPerfil } from "@/lib/perfil-usuario";

// PUT /api/usuarios/[id] { name?, password?, ativo?, perfil? } — só admin
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "admin" || !session.userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const id = Number((await params).id);
  const body = await req.json().catch(() => ({}));

  const alvo = await dbGet<{ id: number; username: string; ativo: number; perfil: string }>(
    "SELECT id, username, COALESCE(ativo, 1) AS ativo, COALESCE(perfil, 'total') AS perfil FROM users WHERE id = ?",
    id
  );
  if (!alvo) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const updates: string[] = [];
  const vals: unknown[] = [];

  if ("name" in body) {
    const nome = validarNomeUsuario(body.name);
    if (!nome) return NextResponse.json({ error: "Informe o nome (2 a 80 caracteres)" }, { status: 400 });
    updates.push("name = ?");
    vals.push(nome);
  }
  if (body.password) {
    const erro = validarNovaSenhaAdmin(body.password, null, alvo.username);
    if (erro) return NextResponse.json({ error: erro }, { status: 400 });
    updates.push("password_hash = ?");
    vals.push(bcrypt.hashSync(String(body.password), 10));
  }
  if ("perfil" in body) {
    if (!ehPerfilValido(body.perfil)) return NextResponse.json({ error: "Perfil inválido" }, { status: 400 });
    if (body.perfil !== alvo.perfil) {
      const r = await dbGet<{ n: number }>(
        "SELECT COUNT(*) AS n FROM users WHERE COALESCE(ativo, 1) = 1 AND COALESCE(perfil, 'total') = 'total'"
      );
      const erro = podeMudarPerfil(id, session.userId, body.perfil, !!alvo.ativo && alvo.perfil === "total", Number(r?.n) || 0);
      if (erro) return NextResponse.json({ error: erro }, { status: 400 });
      updates.push("perfil = ?");
      vals.push(body.perfil);
    }
  }
  if ("ativo" in body) {
    const ativo = body.ativo ? 1 : 0;
    if (!ativo && alvo.ativo) {
      // Conta só quem tem acesso total: desativar o último deles trancaria a administração
      const r = await dbGet<{ n: number }>(
        alvo.perfil === "total"
          ? "SELECT COUNT(*) AS n FROM users WHERE COALESCE(ativo, 1) = 1 AND COALESCE(perfil, 'total') = 'total'"
          : "SELECT COUNT(*) AS n FROM users WHERE COALESCE(ativo, 1) = 1"
      );
      const erro = podeDesativar(id, session.userId, Number(r?.n) || 0);
      if (erro) return NextResponse.json({ error: erro }, { status: 400 });
    }
    updates.push("ativo = ?");
    vals.push(ativo);
  }

  if (updates.length === 0) return NextResponse.json({ ok: true });
  vals.push(id);
  await dbRun(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, ...vals);
  return NextResponse.json({ ok: true });
}
