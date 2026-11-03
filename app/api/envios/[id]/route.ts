import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbRun, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { OBS_ENVIO_MAX, ehEtapaEnvio } from "@/lib/envios";

/**
 * POST /api/envios/[id] — quem envia marca/desmarca um "ok" ou salva a observação.
 *   { etapa: "material" | "numeros", marcado: boolean }  ou  { obs: string }
 * Só para provas já incluídas na aba (a inclusão é do escritório, na tela da prova).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const s = await getSession();
  if (!s.isLoggedIn || (s.role !== "admin" && s.role !== "envios")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const id = Number((await params).id);
  const atual = await dbGet<{ evento_id: number }>("SELECT evento_id FROM envio_status WHERE evento_id = ?", id);
  if (!atual) return NextResponse.json({ error: "Esta prova não está na lista de envios" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const quem = s.name || s.username || null;
  const agora = new Date().toISOString();

  if (ehEtapaEnvio(body.etapa)) {
    // nome da coluna vem de uma lista fechada (ehEtapaEnvio), não do texto do pedido
    const col = body.etapa === "material" ? "material" : "numeros";
    if (body.marcado) await dbRun(`UPDATE envio_status SET ${col}_em = ?, ${col}_por = ? WHERE evento_id = ?`, agora, quem, id);
    else await dbRun(`UPDATE envio_status SET ${col}_em = NULL, ${col}_por = NULL WHERE evento_id = ?`, id);
  } else if (typeof body.obs === "string") {
    const obs = body.obs.trim().slice(0, OBS_ENVIO_MAX);
    await dbRun(
      "UPDATE envio_status SET obs = ?, obs_em = ?, obs_por = ? WHERE evento_id = ?",
      obs || null,
      obs ? agora : null,
      obs ? quem : null,
      id
    );
  } else {
    return NextResponse.json({ error: "Nada para salvar" }, { status: 400 });
  }

  return NextResponse.json(await dbGet("SELECT * FROM envio_status WHERE evento_id = ?", id));
}
