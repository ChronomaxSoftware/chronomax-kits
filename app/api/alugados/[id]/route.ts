import { NextRequest, NextResponse } from "next/server";
import { dbRun, initDB } from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  const { tipo, quantidade, identificador, fornecedor, evento_id, observacao, data_inicio, data_fim } = await req.json();
  const qtd = Math.max(1, parseInt(quantidade) || 1);
  await dbRun(
    `UPDATE equipamentos_alugados SET tipo = ?, quantidade = ?, identificador = ?, fornecedor = ?, evento_id = ?, observacao = ?, data_inicio = ?, data_fim = ? WHERE id = ?`,
    tipo,
    qtd,
    identificador || null,
    fornecedor || null,
    evento_id || null,
    observacao || null,
    data_inicio || null,
    data_fim || null,
    id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  await dbRun("DELETE FROM equipamentos_alugados WHERE id = ?", id);
  return NextResponse.json({ ok: true });
}
