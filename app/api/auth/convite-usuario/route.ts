import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { dbGet, dbTransaction, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { estadoConviteUsuario, hashTokenConvite } from "@/lib/convite-usuario";
import { validarNovaSenhaAdmin } from "@/lib/senha-admin";
import { roleDoPerfil } from "@/lib/perfil-usuario";

type Convite = {
  id: number;
  user_id: number;
  usado_em: string | null;
  expira_em: string;
  username: string;
  name: string;
  ativo: number;
  perfil: string | null;
};

async function lerConvite(token: unknown) {
  if (!token || typeof token !== "string" || token.length > 200) return undefined;
  return dbGet<Convite>(
    `SELECT c.id, c.user_id, c.usado_em, c.expira_em, u.username, u.name, COALESCE(u.ativo, 1) AS ativo, u.perfil
     FROM convites_usuario c JOIN users u ON u.id = c.user_id
     WHERE c.token_hash = ?`,
    hashTokenConvite(token)
  );
}

// GET /api/auth/convite-usuario?token= — tela do link (público: a pessoa ainda não tem a senha)
export async function GET(req: NextRequest) {
  await initDB();
  const c = await lerConvite(req.nextUrl.searchParams.get("token"));
  const estado = estadoConviteUsuario(c);
  if (!estado.ok || !c) return NextResponse.json({ error: estado.ok ? "Link inválido" : estado.erro }, { status: 410 });
  return NextResponse.json({ nome: c.name, username: c.username });
}

// POST /api/auth/convite-usuario { token, senha } — cria a senha nova, gasta o link e já entra
export async function POST(req: NextRequest) {
  await initDB();
  const { token, senha } = await req.json().catch(() => ({}));
  const c = await lerConvite(token);
  const estado = estadoConviteUsuario(c);
  if (!estado.ok || !c) return NextResponse.json({ error: estado.ok ? "Link inválido" : estado.erro }, { status: 410 });

  const erroSenha = validarNovaSenhaAdmin(senha, null, c.username);
  if (erroSenha) return NextResponse.json({ error: erroSenha.replace("A nova senha", "A senha") }, { status: 400 });

  try {
    await dbTransaction(async (tx) => {
      // Gasta o link só se ainda estiver livre e no prazo (dois cliques ao mesmo tempo: só um vale)
      const agora = new Date().toISOString();
      const up = await tx.execute({
        sql: "UPDATE convites_usuario SET usado_em = ? WHERE id = ? AND usado_em IS NULL AND expira_em > ?",
        args: [agora, c.id, agora],
      });
      if (up.rowsAffected !== 1) throw new Error("CONVITE_USADO");
      await tx.execute({
        sql: "UPDATE users SET password_hash = ? WHERE id = ?",
        args: [bcrypt.hashSync(String(senha), 10), c.user_id],
      });
    });
  } catch (err) {
    if (String(err).includes("CONVITE_USADO")) {
      return NextResponse.json({ error: "Este link já foi usado. Entre com a sua senha ou peça um novo link." }, { status: 410 });
    }
    console.error("[convite-usuario] erro ao criar senha", err);
    return NextResponse.json({ error: "Não foi possível salvar a senha. Tente de novo." }, { status: 500 });
  }

  const session = await getSession();
  session.userId = c.user_id;
  session.username = c.username;
  session.name = c.name;
  session.role = roleDoPerfil(c.perfil);
  session.tecnicoId = undefined;
  session.senhaPadrao = false;
  session.isLoggedIn = true;
  await session.save();
  return NextResponse.json({ ok: true, role: session.role });
}
