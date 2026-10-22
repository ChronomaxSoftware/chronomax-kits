import { NextRequest, NextResponse } from "next/server";
import { dbTransaction, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { idOuNull, lerIdsLote } from "@/lib/equipamentos";
import { ErroEquipamento, darSaida } from "@/lib/equipamentos-db";

// POST /api/eventos/:id/equipamentos/saida { equipamento_ids } — registra a saída (tudo ou nada)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const eventoId = idOuNull((await params).id);
  if (!eventoId) return NextResponse.json({ error: "Prova inválida" }, { status: 400 });
  const ids = lerIdsLote(await req.json().catch(() => ({})));
  if (!ids) return NextResponse.json({ error: "Selecione pelo menos um equipamento válido" }, { status: 400 });
  const usuario = (await getSession()).name || null;
  try {
    const r = await dbTransaction((tx) => darSaida(tx, eventoId, ids, usuario));
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    if (err instanceof ErroEquipamento) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[equipamentos] erro ao registrar saída", err);
    return NextResponse.json({ error: "Não foi possível registrar a saída" }, { status: 500 });
  }
}
