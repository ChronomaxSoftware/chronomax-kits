import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbGet, dbRun, initDB } from "@/lib/db";
import { resolverLoginTecnico, validarSenhaTecnico } from "@/lib/login-tecnico";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  const body = await req.json();

  const erroSenha = validarSenhaTecnico(body.senha);
  if (erroSenha) return NextResponse.json({ error: erroSenha }, { status: 400 });

  const atual = await dbGet<{ telefone: string | null; tem_senha: number }>(
    "SELECT telefone, (senha_hash IS NOT NULL AND senha_hash != '') AS tem_senha FROM tecnicos WHERE id = ?",
    id
  );
  if (!atual) return NextResponse.json({ error: "Técnico não encontrado" }, { status: 404 });

  const updates: string[] = [];
  const vals: unknown[] = [];
  if ("nome" in body) {
    updates.push("nome = ?");
    vals.push(body.nome);
  }
  if ("telefone" in body) {
    updates.push("telefone = ?");
    vals.push(body.telefone || null);
  }
  if ("ativo" in body) {
    updates.push("ativo = ?");
    vals.push(body.ativo ? 1 : 0);
  }
  if ("login" in body || body.senha) {
    // Sem login manual, quem tem (ou vai ter) senha usa o telefone como login
    const telefone = "telefone" in body ? body.telefone : atual.telefone;
    const temSenha = !!body.senha || !!atual.tem_senha;
    const login = resolverLoginTecnico(body.login, telefone, temSenha);
    if (temSenha && !login) {
      return NextResponse.json(
        { error: "Informe um login ou um telefone válido (DDD + número) para o acesso ao portal" },
        { status: 400 }
      );
    }
    updates.push("login = ?");
    vals.push(login);
  }
  // Só troca a senha quando vier preenchida (em branco mantém a atual)
  if (body.senha) {
    updates.push("senha_hash = ?");
    vals.push(bcrypt.hashSync(body.senha, 10));
  }

  if (updates.length === 0) return NextResponse.json({ ok: true });
  vals.push(id);
  try {
    await dbRun(`UPDATE tecnicos SET ${updates.join(", ")} WHERE id = ?`, ...vals);
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return NextResponse.json({ error: "Esse login (ou telefone) já está em uso por outro técnico" }, { status: 409 });
    }
    console.error("[tecnicos] erro ao atualizar", err);
    return NextResponse.json({ error: "Não foi possível salvar o técnico" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  await dbRun("DELETE FROM tecnicos WHERE id = ?", id);
  return NextResponse.json({ ok: true });
}
