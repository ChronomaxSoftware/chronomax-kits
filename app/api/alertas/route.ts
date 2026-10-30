import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbGet, dbRun, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { gerarAlertasRetorno } from "@/lib/alertas";

/** Só o escritório vê os alertas (o técnico já é barrado no proxy; reforço aqui). */
async function escritorio() {
  const s = await getSession();
  return s.isLoggedIn && s.role !== "tecnico";
}

/** GET → { nao_lidos, alertas: últimos 30 } */
export async function GET() {
  await initDB();
  if (!(await escritorio())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  // Sem agendador na Vercel: os alertas de retorno pendente são gerados quando o sino consulta
  await gerarAlertasRetorno();
  const alertas = await dbAll(
    "SELECT id, tipo, evento_id, mensagem, criado_em, lido_em FROM alertas ORDER BY criado_em DESC, id DESC LIMIT 30"
  );
  const n = await dbGet<{ n: number }>("SELECT COUNT(*) AS n FROM alertas WHERE lido_em IS NULL");
  return NextResponse.json({ nao_lidos: Number(n?.n) || 0, alertas });
}

/** POST { lidos: true } → marca todos como lidos */
export async function POST(req: NextRequest) {
  await initDB();
  if (!(await escritorio())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body.lidos === true) {
    await dbRun("UPDATE alertas SET lido_em = ? WHERE lido_em IS NULL", new Date().toISOString());
  }
  return NextResponse.json({ ok: true });
}
