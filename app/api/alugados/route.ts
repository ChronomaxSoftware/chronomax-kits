import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const rows = db
    .prepare(
      `SELECT a.*, e.numero as evento_numero, e.nome as evento_nome, e.data as evento_data
       FROM equipamentos_alugados a
       LEFT JOIN eventos e ON e.id = a.evento_id
       ORDER BY a.created_at DESC`
    )
    .all();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { tipo, quantidade, identificador, fornecedor, evento_id, observacao, data_inicio, data_fim } = await req.json();
  if (!tipo) return NextResponse.json({ error: "Tipo obrigatório" }, { status: 400 });
  const qtd = Math.max(1, parseInt(quantidade) || 1);
  const r = db
    .prepare(
      `INSERT INTO equipamentos_alugados (tipo, quantidade, identificador, fornecedor, evento_id, observacao, data_inicio, data_fim) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(tipo, qtd, identificador || null, fornecedor || null, evento_id || null, observacao || null, data_inicio || null, data_fim || null);
  return NextResponse.json({ id: r.lastInsertRowid });
}
