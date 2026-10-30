import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbGet, dbRun, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { validarSenhaTecnico } from "@/lib/login-tecnico";
import { precisaAvisoApp } from "@/lib/aviso-app";

async function tecnicoLogado() {
  const s = await getSession();
  return s.isLoggedIn && s.role === "tecnico" && s.tecnicoId ? s.tecnicoId : null;
}

// GET /api/portal/conta — dados do técnico logado (ex.: se já viu o tutorial)
export async function GET() {
  await initDB();
  const tid = await tecnicoLogado();
  if (!tid) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const t = await dbGet<{
    nome: string;
    login: string | null;
    tutorial_visto_em: string | null;
    aviso_app_visto_em: string | null;
    convite_usado_em: string | null;
  }>(
    `SELECT nome, login, tutorial_visto_em, aviso_app_visto_em,
            (SELECT MIN(usado_em) FROM convites_tecnico WHERE tecnico_id = tecnicos.id) AS convite_usado_em
     FROM tecnicos WHERE id = ?`,
    tid
  );
  return NextResponse.json({
    nome: t?.nome,
    login: t?.login,
    tutorialVisto: !!t?.tutorial_visto_em,
    avisoApp: !!t && precisaAvisoApp(t),
  });
}

// POST /api/portal/conta { acao: "tutorial_visto" } | { acao: "aviso_app_visto" } | { acao: "senha", senhaAtual, novaSenha }
export async function POST(req: NextRequest) {
  await initDB();
  const tid = await tecnicoLogado();
  if (!tid) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (body.acao === "tutorial_visto") {
    await dbRun("UPDATE tecnicos SET tutorial_visto_em = ? WHERE id = ?", new Date().toISOString(), tid);
    return NextResponse.json({ ok: true });
  }

  if (body.acao === "aviso_app_visto") {
    await dbRun("UPDATE tecnicos SET aviso_app_visto_em = ? WHERE id = ?", new Date().toISOString(), tid);
    return NextResponse.json({ ok: true });
  }

  if (body.acao === "senha") {
    const t = await dbGet<{ senha_hash: string | null }>("SELECT senha_hash FROM tecnicos WHERE id = ?", tid);
    if (!t?.senha_hash || !body.senhaAtual || !bcrypt.compareSync(String(body.senhaAtual), t.senha_hash)) {
      return NextResponse.json({ error: "Senha atual incorreta" }, { status: 400 });
    }
    if (!body.novaSenha) return NextResponse.json({ error: "Informe a nova senha" }, { status: 400 });
    const erro = validarSenhaTecnico(body.novaSenha);
    if (erro) return NextResponse.json({ error: erro }, { status: 400 });
    if (body.novaSenha === body.senhaAtual) {
      return NextResponse.json({ error: "A nova senha deve ser diferente da atual" }, { status: 400 });
    }
    await dbRun("UPDATE tecnicos SET senha_hash = ? WHERE id = ?", bcrypt.hashSync(String(body.novaSenha), 10), tid);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
