import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbRun, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "tecnico" || !session.tecnicoId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;

  // Garante que o técnico logado está atribuído a este evento
  const link = await dbGet(
    "SELECT 1 AS ok FROM evento_tecnicos WHERE evento_id = ? AND tecnico_id = ?",
    id,
    session.tecnicoId
  );
  if (!link) {
    return NextResponse.json({ error: "Você não está atribuído a este evento" }, { status: 403 });
  }

  const { itens } = await req.json();
  if (!Array.isArray(itens)) {
    return NextResponse.json({ error: "Itens inválidos" }, { status: 400 });
  }

  const agora = new Date().toISOString();
  for (const it of itens) {
    const recebido = it.recebido ? 1 : 0;
    const qtdRaw = it.qtd_recebida;
    const qtd =
      qtdRaw === null || qtdRaw === undefined || qtdRaw === "" ? null : Number(qtdRaw);
    await dbRun(
      `UPDATE evento_produtos SET recebido = ?, qtd_recebida = ?, recebido_em = ?
       WHERE evento_id = ? AND produto_id = ?`,
      recebido,
      qtd,
      recebido ? agora : null,
      id,
      it.produto_id
    );
  }

  return NextResponse.json({ ok: true });
}
