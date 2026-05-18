import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const rows = db
    .prepare(
      `SELECT c.*, b.nome as base_nome, b.uf as base_uf,
              e.numero as evento_numero, e.nome as evento_nome, e.data as evento_data, e.cidade as evento_cidade, e.uf as evento_uf
       FROM celulares_chip c
       LEFT JOIN bases b ON b.id = c.base_id
       LEFT JOIN eventos e ON e.id = c.evento_id
       ORDER BY COALESCE(c.apelido, c.numero, ''), c.id`
    )
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { apelido, numero, operadora, identificador, base_id, evento_id, observacao, quantidade } = await req.json();
  const qtd = Math.max(1, parseInt(quantidade) || 1);
  const r = db
    .prepare(
      `INSERT INTO celulares_chip (apelido, numero, operadora, identificador, base_id, evento_id, observacao, quantidade)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      apelido || null,
      numero || null,
      operadora || null,
      identificador || null,
      base_id || null,
      evento_id || null,
      observacao || null,
      qtd
    );
  return NextResponse.json({ id: r.lastInsertRowid });
}
