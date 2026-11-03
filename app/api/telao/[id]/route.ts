import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbGet, dbRun, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { OBS_TELAO_MAX, ehEtapaTelao, tiposTelao } from "@/lib/telao";

/**
 * POST /api/telao/[id] — marca/desmarca um "ok" da prova ou salva a observação.
 *   { etapa: "arte" | "pronto", marcado: boolean }  ou  { obs: string }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const s = await getSession();
  if (!s.isLoggedIn || (s.role !== "admin" && s.role !== "telao")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const id = Number((await params).id);
  const ev = await dbGet<{ id: number }>("SELECT id FROM eventos WHERE id = ?", id);
  if (!ev) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  const itens = await dbAll<{ nome: string }>("SELECT nome FROM evento_itens_gestao WHERE evento_id = ?", id);
  if (tiposTelao(itens.map((i) => i.nome)).length === 0) {
    return NextResponse.json({ error: "Esta prova não tem telão no pedido" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const quem = s.name || s.username || null;
  const agora = new Date().toISOString();

  if (ehEtapaTelao(body.etapa)) {
    await dbRun("INSERT OR IGNORE INTO telao_status (evento_id) VALUES (?)", id);
    if (body.etapa === "arte") {
      if (body.marcado) await dbRun("UPDATE telao_status SET arte_cobrada_em = ?, arte_cobrada_por = ? WHERE evento_id = ?", agora, quem, id);
      else await dbRun("UPDATE telao_status SET arte_cobrada_em = NULL, arte_cobrada_por = NULL WHERE evento_id = ?", id);
    } else {
      if (body.marcado) await dbRun("UPDATE telao_status SET pronto_em = ?, pronto_por = ? WHERE evento_id = ?", agora, quem, id);
      else await dbRun("UPDATE telao_status SET pronto_em = NULL, pronto_por = NULL WHERE evento_id = ?", id);
    }
  } else if (typeof body.obs === "string") {
    await dbRun("INSERT OR IGNORE INTO telao_status (evento_id) VALUES (?)", id);
    const obs = body.obs.trim().slice(0, OBS_TELAO_MAX);
    await dbRun(
      "UPDATE telao_status SET obs = ?, obs_em = ?, obs_por = ? WHERE evento_id = ?",
      obs || null,
      obs ? agora : null,
      obs ? quem : null,
      id
    );
  } else {
    return NextResponse.json({ error: "Nada para salvar" }, { status: 400 });
  }

  return NextResponse.json(await dbGet("SELECT * FROM telao_status WHERE evento_id = ?", id));
}
