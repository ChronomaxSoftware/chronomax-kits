import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbGet, dbTransaction, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { idOuNull, lerIdsLote } from "@/lib/equipamentos";
import { ErroEquipamento, alocarNaProva } from "@/lib/equipamentos-db";

type Params = { params: Promise<{ id: string }> };

// GET /api/eventos/:id/equipamentos — equipamentos (por patrimônio) alocados à prova
export async function GET(_req: NextRequest, { params }: Params) {
  await initDB();
  const eventoId = idOuNull((await params).id);
  if (!eventoId) return NextResponse.json({ error: "Prova inválida" }, { status: 400 });
  const evento = await dbGet("SELECT id FROM eventos WHERE id = ?", eventoId);
  if (!evento) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  return NextResponse.json(
    await dbAll("SELECT * FROM equipamentos WHERE evento_id = ? ORDER BY tipo, patrimonio", eventoId)
  );
}

// POST /api/eventos/:id/equipamentos { equipamento_ids: number[] } — aloca em lote, tudo ou nada
export async function POST(req: NextRequest, { params }: Params) {
  await initDB();
  const eventoId = idOuNull((await params).id);
  if (!eventoId) return NextResponse.json({ error: "Prova inválida" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const ids = lerIdsLote(body);
  if (!ids) return NextResponse.json({ error: "Selecione pelo menos um equipamento válido" }, { status: 400 });
  const usuario = (await getSession()).name || null;
  try {
    const r = await dbTransaction((tx) => alocarNaProva(tx, eventoId, ids, usuario));
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    if (err instanceof ErroEquipamento) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[equipamentos] erro na alocação em lote", err);
    return NextResponse.json({ error: "Não foi possível concluir a alocação" }, { status: 500 });
  }
}
