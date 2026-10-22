import { NextRequest, NextResponse } from "next/server";
import { dbTransaction, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { lerItensRetorno } from "@/lib/equipamentos";
import { ErroEquipamento, registrarRetorno } from "@/lib/equipamentos-db";

// POST /api/equipamentos/retorno { itens: [{ id, resultado: "ok"|"defeito", observacao? }] }
// Conferência do retorno — tudo ou nada. Os que não vierem na lista continuam em campo.
export async function POST(req: NextRequest) {
  await initDB();
  const itens = lerItensRetorno(await req.json().catch(() => ({})));
  if (!itens) return NextResponse.json({ error: "Marque pelo menos um equipamento como OK ou com defeito" }, { status: 400 });
  const usuario = (await getSession()).name || null;
  try {
    await dbTransaction(async (tx) => {
      for (const it of itens) await registrarRetorno(tx, it.id, it.resultado, usuario, it.observacao);
    });
    return NextResponse.json({
      ok: true,
      retornaram: itens.length,
      paraManutencao: itens.filter((i) => i.resultado === "defeito").length,
    });
  } catch (err) {
    if (err instanceof ErroEquipamento) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[equipamentos] erro ao registrar retorno", err);
    return NextResponse.json({ error: "Não foi possível registrar o retorno" }, { status: 500 });
  }
}
