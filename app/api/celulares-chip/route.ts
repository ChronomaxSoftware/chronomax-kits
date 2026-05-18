import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbRun, initDB } from "@/lib/db";

export async function GET() {
  await initDB();
  const rows = await dbAll(
    `SELECT c.*, b.nome as base_nome, b.uf as base_uf,
            e.numero as evento_numero, e.nome as evento_nome, e.data as evento_data, e.cidade as evento_cidade, e.uf as evento_uf
     FROM celulares_chip c
     LEFT JOIN bases b ON b.id = c.base_id
     LEFT JOIN eventos e ON e.id = c.evento_id
     ORDER BY COALESCE(c.apelido, c.numero, ''), c.id`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  await initDB();
  const { apelido, numero, operadora, identificador, base_id, evento_id, observacao, quantidade } = await req.json();
  const qtd = Math.max(1, parseInt(quantidade) || 1);
  const r = await dbRun(
    `INSERT INTO celulares_chip (apelido, numero, operadora, identificador, base_id, evento_id, observacao, quantidade)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
