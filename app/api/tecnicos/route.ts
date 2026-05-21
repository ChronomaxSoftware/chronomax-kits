import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbAll, dbRun, initDB } from "@/lib/db";

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
  const loginVal = login?.trim() || null;
  const senhaHash = senha ? bcrypt.hashSync(senha, 10) : null;
  try {
    const r = await dbRun(
      "INSERT INTO tecnicos (nome, telefone, login, senha_hash) VALUES (?, ?, ?, ?)",
      nome.trim(),
      telefone || null,
      loginVal,
      senhaHash
    );
    return NextResponse.json({ id: r.lastInsertRowid });
  } catch {
    return NextResponse.json({ error: "Esse login já está em uso por outro técnico" }, { status: 400 });
  }
}
