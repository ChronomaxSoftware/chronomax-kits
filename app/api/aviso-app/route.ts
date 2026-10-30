import { NextResponse } from "next/server";
import { dbAll, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { get, set } from "@/lib/config";
import { CHAVE_REENVIO, precisaAvisoApp } from "@/lib/aviso-app";

async function escritorio() {
  const s = await getSession();
  return s.isLoggedIn && s.role !== "tecnico";
}

async function pendentes(reenviadoEm: string | null): Promise<number> {
  const tecs = await dbAll<{
    tutorial_visto_em: string | null;
    convite_usado_em: string | null;
    aviso_app_visto_em: string | null;
  }>(
    `SELECT tutorial_visto_em, aviso_app_visto_em,
            (SELECT MIN(usado_em) FROM convites_tecnico c WHERE c.tecnico_id = t.id) AS convite_usado_em
     FROM tecnicos t WHERE t.ativo = 1 AND t.senha_hash IS NOT NULL`
  );
  return tecs.filter((t) => precisaAvisoApp(t, reenviadoEm)).length;
}

/** GET → { reenviado_em, pendentes } — quantos técnicos ainda vão ver o aviso do app */
export async function GET() {
  await initDB();
  if (!(await escritorio())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const reenviado = await get(CHAVE_REENVIO);
  return NextResponse.json({ reenviado_em: reenviado, pendentes: await pendentes(reenviado) });
}

/** POST → reenvia: o aviso volta para todos os técnicos que já acessaram, inclusive quem confirmou */
export async function POST() {
  await initDB();
  if (!(await escritorio())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const agora = new Date().toISOString();
  await set(CHAVE_REENVIO, agora);
  return NextResponse.json({ ok: true, reenviado_em: agora, pendentes: await pendentes(agora) });
}
