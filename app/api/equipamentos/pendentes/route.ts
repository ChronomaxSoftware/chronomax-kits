import { NextResponse } from "next/server";
import { dbAll, initDB } from "@/lib/db";
import { pendenteDeRetorno } from "@/lib/retorno-equipamentos";

// GET /api/equipamentos/pendentes — o que está em campo e ainda não teve retorno registrado:
// com 📦 Saída registrada, ou separado para uma prova cuja entrega/data já chegou (saída não registrada)
export async function GET() {
  await initDB();
  const rows = await dbAll<{
    id: number;
    status: string;
    evento_id: number | null;
    evento_data: string | null;
    evento_data_entrega: string | null;
  }>(
    `SELECT e.id, e.tipo, e.patrimonio, e.numero_chip, e.numero_serie, e.saida_em, e.saida_por, e.status,
            e.evento_id, COALESCE('#' || v.numero || ' · ' || v.nome, e.evento_ref, 'Prova removida') AS evento_ref,
            v.data AS evento_data, v.data_entrega AS evento_data_entrega, v.numero AS evento_numero, b.nome AS base_nome
     FROM equipamentos e
     LEFT JOIN eventos v ON v.id = e.evento_id
     LEFT JOIN bases b ON b.id = e.base_id
     WHERE e.status IN ('em_campo', 'alocado')
     ORDER BY e.saida_em, e.tipo, e.patrimonio`
  );
  const agora = new Date();
  return NextResponse.json(
    rows
      .filter((r) => pendenteDeRetorno(r, { data: r.evento_data, data_entrega: r.evento_data_entrega }, agora))
      .map(({ status, evento_data_entrega, ...r }) => ({ ...r, saida_registrada: status === "em_campo" }))
  );
}
