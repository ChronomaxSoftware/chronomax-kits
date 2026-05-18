import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tipo, quantidade, identificador, fornecedor, evento_id, observacao, data_inicio, data_fim } = await req.json();
  const qtd = Math.max(1, parseInt(quantidade) || 1);
  db.prepare(
    `UPDATE equipamentos_alugados SET tipo = ?, quantidade = ?, identificador = ?, fornecedor = ?, evento_id = ?, observacao = ?, data_inicio = ?, data_fim = ? WHERE id = ?`
  ).run(tipo, qtd, identificador || null, fornecedor || null, evento_id || null, observacao || null, data_inicio || null, data_fim || null, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  db.prepare("DELETE FROM equipamentos_alugados WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
