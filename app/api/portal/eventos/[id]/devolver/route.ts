import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbRun, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { parseDataBR } from "@/lib/semana";
import { podeDevolver } from "@/lib/portal-situacao";
import { criarAlerta } from "@/lib/alertas";

/**
 * POST /api/portal/eventos/[id]/devolver  { observacao?: string }
 * O técnico confirma que devolveu todo o material (do dia da prova até 30 dias depois).
 * Uma vez só; avisa o escritório (sino).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "tecnico" || !session.tecnicoId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;

  const link = await dbGet<{ devolvido_em: string | null }>(
    "SELECT devolvido_em FROM evento_tecnicos WHERE evento_id = ? AND tecnico_id = ?",
    id,
    session.tecnicoId
  );
  if (!link) {
    return NextResponse.json({ error: "Você não está atribuído a este evento" }, { status: 403 });
  }
  if (link.devolvido_em) {
    return NextResponse.json({ error: "Você já confirmou a devolução desta prova." }, { status: 409 });
  }

  const ev = await dbGet<{ data: string }>("SELECT data FROM eventos WHERE id = ?", id);
  if (!podeDevolver(parseDataBR(ev?.data))) {
    return NextResponse.json({ error: "A devolução fica disponível do dia da prova até 30 dias depois." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const obs = typeof body.observacao === "string" ? body.observacao.trim().slice(0, 2000) || null : null;

  // Só grava se ainda não estava devolvido (dois cliques ao mesmo tempo geram um alerta só)
  const r = await dbRun(
    "UPDATE evento_tecnicos SET devolvido_em = ?, obs_devolucao = ? WHERE evento_id = ? AND tecnico_id = ? AND devolvido_em IS NULL",
    new Date().toISOString(),
    obs,
    id,
    session.tecnicoId
  );
  if (r.changes > 0) {
    await criarAlerta("devolucao", id, session.tecnicoId, obs);
  }

  return NextResponse.json({ ok: true });
}
