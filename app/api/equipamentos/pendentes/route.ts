import { NextResponse } from "next/server";
import { dbAll, initDB } from "@/lib/db";

// GET /api/equipamentos/pendentes — tudo que saiu e ainda não teve retorno registrado
export async function GET() {
  await initDB();
  const rows = await dbAll(
    `SELECT e.id, e.tipo, e.patrimonio, e.numero_chip, e.numero_serie, e.saida_em, e.saida_por,
            e.evento_id, COALESCE('#' || v.numero || ' · ' || v.nome, e.evento_ref, 'Prova removida') AS evento_ref,
            v.data AS evento_data, v.numero AS evento_numero, b.nome AS base_nome
     FROM equipamentos e
     LEFT JOIN eventos v ON v.id = e.evento_id
     LEFT JOIN bases b ON b.id = e.base_id
     WHERE e.status = 'em_campo'
     ORDER BY e.saida_em, e.tipo, e.patrimonio`
  );
  return NextResponse.json(rows);
}
