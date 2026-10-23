import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbGet, dbTransaction, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { estadoConvite, hashTokenConvite } from "@/lib/convite";
import { resolverLoginTecnico, validarSenhaTecnico } from "@/lib/login-tecnico";

type Convite = {
  id: number;
  tecnico_id: number;
  usado_em: string | null;
  nome: string;
  telefone: string | null;
  login: string | null;
  ativo: number;
  tem_senha: number;
};

async function lerConvite(token: unknown) {
  if (!token || typeof token !== "string" || token.length > 200) return undefined;
  return dbGet<Convite>(
    `SELECT c.id, c.tecnico_id, c.usado_em, t.nome, t.telefone, t.login, t.ativo,
            (t.senha_hash IS NOT NULL AND t.senha_hash != '') AS tem_senha
     FROM convites_tecnico c JOIN tecnicos t ON t.id = c.tecnico_id
     WHERE c.token_hash = ?`,
    hashTokenConvite(token)
  );
}

// GET /api/auth/convite?token= — para a tela do link (público: o técnico pode ainda não ter senha)
export async function GET(req: NextRequest) {
  await initDB();
  const c = await lerConvite(req.nextUrl.searchParams.get("token"));
  const estado = estadoConvite(c);
  if (estado.modo === "invalido" || !c) {
    return NextResponse.json({ error: estado.modo === "invalido" ? estado.erro : "Link inválido" }, { status: 410 });
  }
  return NextResponse.json({ modo: estado.modo, nome: c.nome, login: resolverLoginTecnico(c.login, c.telefone, true) });
}

// POST /api/auth/convite { token, senha } — cria a senha (só no 1º uso do link) e já entra no portal
export async function POST(req: NextRequest) {
  await initDB();
  const { token, senha } = await req.json().catch(() => ({}));
  const c = await lerConvite(token);
  const estado = estadoConvite(c);
  if (estado.modo === "invalido" || !c) {
    return NextResponse.json({ error: estado.modo === "invalido" ? estado.erro : "Link inválido" }, { status: 410 });
  }
  if (estado.modo === "login") {
    return NextResponse.json({ error: "Sua senha já foi criada. Entre com o telefone e a senha." }, { status: 409 });
  }
  if (!senha) return NextResponse.json({ error: "Crie uma senha" }, { status: 400 });
  const erroSenha = validarSenhaTecnico(senha);
  if (erroSenha) return NextResponse.json({ error: erroSenha }, { status: 400 });

  const login = resolverLoginTecnico(c.login, c.telefone, true);
  if (!login) return NextResponse.json({ error: "Telefone inválido no cadastro. Fale com a equipe Chronomax." }, { status: 400 });

  try {
    await dbTransaction(async (tx) => {
      // Marca o 1º uso só se ainda estiver livre (dois cliques ao mesmo tempo: só um cria a senha)
      const up = await tx.execute({
        sql: "UPDATE convites_tecnico SET usado_em = ? WHERE id = ? AND usado_em IS NULL",
        args: [new Date().toISOString(), c.id],
      });
      if (up.rowsAffected !== 1) throw new Error("CONVITE_USADO");
      await tx.execute({
        sql: "UPDATE tecnicos SET login = ?, senha_hash = ? WHERE id = ?",
        args: [login, bcrypt.hashSync(String(senha), 10), c.tecnico_id],
      });
    });
  } catch (err) {
    if (String(err).includes("CONVITE_USADO")) {
      return NextResponse.json({ error: "Sua senha já foi criada. Entre com o telefone e a senha." }, { status: 409 });
    }
    if (String(err).includes("UNIQUE")) {
      return NextResponse.json({ error: "Este telefone já é login de outro técnico. Fale com a equipe Chronomax." }, { status: 409 });
    }
    console.error("[convite] erro ao criar senha", err);
    return NextResponse.json({ error: "Não foi possível criar a senha. Tente de novo." }, { status: 500 });
  }

  const session = await getSession();
  session.userId = undefined;
  session.username = login;
  session.name = c.nome;
  session.role = "tecnico";
  session.tecnicoId = c.tecnico_id;
  session.senhaPadrao = false;
  session.isLoggedIn = true;
  await session.save();
  return NextResponse.json({ ok: true, login });
}
