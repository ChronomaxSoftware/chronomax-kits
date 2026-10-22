import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbAll, dbRun, initDB } from "@/lib/db";
import { resolverLoginTecnico, validarSenhaTecnico } from "@/lib/login-tecnico";

export async function GET(req: NextRequest) {
  await initDB();
  // Por padrão só técnicos ativos (seletores/atribuição); ?incluirInativos=1 para a tela de gestão.
  const incluirInativos = req.nextUrl.searchParams.get("incluirInativos") === "1";
  const rows = await dbAll(
    `SELECT id, nome, telefone, ativo, login,
            (senha_hash IS NOT NULL AND senha_hash != '') AS tem_senha
     FROM tecnicos ${incluirInativos ? "" : "WHERE ativo = 1"} ORDER BY nome`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  await initDB();
  const { nome, telefone, login, senha } = await req.json();
  if (!nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  const erroSenha = validarSenhaTecnico(senha);
  if (erroSenha) return NextResponse.json({ error: erroSenha }, { status: 400 });
  // Sem login manual, o telefone (só dígitos) vira o login do portal
  const loginVal = resolverLoginTecnico(login, telefone, !!senha);
  if (senha && !loginVal) {
    return NextResponse.json(
      { error: "Informe um login ou um telefone válido (DDD + número) para o acesso ao portal" },
      { status: 400 }
    );
  }
  const senhaHash = senha ? bcrypt.hashSync(senha, 10) : null;
  try {
    const r = await dbRun(
      "INSERT INTO tecnicos (nome, telefone, login, senha_hash) VALUES (?, ?, ?, ?)",
      nome.trim(),
      String(telefone ?? "").trim() || null,
      loginVal,
      senhaHash
    );
    return NextResponse.json({ id: r.lastInsertRowid });
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return NextResponse.json({ error: "Esse login (ou telefone) já está em uso por outro técnico" }, { status: 409 });
    }
    console.error("[tecnicos] erro ao cadastrar", err);
    return NextResponse.json({ error: "Não foi possível cadastrar o técnico" }, { status: 500 });
  }
}
