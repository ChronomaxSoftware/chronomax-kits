import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbRun, initDB } from "@/lib/db";
import { tipoDeProduto } from "@/lib/equipamentos";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  const body = await req.json();
  const campos = ["nome", "uf", "ordem"];
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const c of campos) {
    if (c in body) {
      updates.push(`${c} = ?`);
      values.push(c === "uf" ? String(body[c]).toUpperCase().slice(0, 2) : body[c]);
    }
  }
  if (Array.isArray(body.estoque)) {
    // Equipamentos (Celular, Roteador, ...) vêm do inventário de patrimônios — não se digitam aqui
    const produtos = await dbAll<{ id: number; nome: string }>("SELECT id, nome FROM produtos");
    const doInventario = new Set(produtos.filter((p) => tipoDeProduto(p.nome)).map((p) => p.id));
    for (const e of body.estoque) {
      if (doInventario.has(Number(e.produto_id))) continue;
      const qtd = Math.max(0, parseInt(e.quantidade) || 0);
      if (qtd === 0) {
        await dbRun("DELETE FROM estoque_base WHERE base_id = ? AND produto_id = ?", id, e.produto_id);
      } else {
        await dbRun(
          `INSERT INTO estoque_base (base_id, produto_id, quantidade) VALUES (?, ?, ?)
           ON CONFLICT(base_id, produto_id) DO UPDATE SET quantidade = excluded.quantidade`,
          id, e.produto_id, qtd
        );
      }
    }
  }
  if (updates.length > 0) {
    values.push(id);
    await dbRun(`UPDATE bases SET ${updates.join(", ")} WHERE id = ?`, ...values);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  await dbRun("DELETE FROM bases WHERE id = ?", id);
  return NextResponse.json({ ok: true });
}
