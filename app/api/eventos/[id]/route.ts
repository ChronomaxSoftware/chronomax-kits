import { NextRequest, NextResponse } from "next/server";
import { dbRun, dbGet, dbAll, initDB } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  const evento = await dbGet<Record<string, unknown>>("SELECT * FROM eventos WHERE id = ?", id);
  if (!evento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const tecnicos = await dbAll(
    `SELECT t.id, t.nome, t.telefone FROM evento_tecnicos et JOIN tecnicos t ON t.id = et.tecnico_id WHERE et.evento_id = ?`,
    id
  );

  const produtos = await dbAll(
    `SELECT p.id, p.nome, ep.quantidade, ep.recebido, ep.qtd_recebida, ep.recebido_em
     FROM evento_produtos ep JOIN produtos p ON p.id = ep.produto_id WHERE ep.evento_id = ?`,
    id
  );

  return NextResponse.json({ ...evento, tecnicos, produtos });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  const body = await req.json();

  const camposEvento = [
    "data_entrega", "hora_entrega", "status", "observacoes",
    "qtd_celulares", "dias_entrega", "local_entrega",
    "base1_ok", "base_final_ok", "briefing_data", "briefing_hora",
    "datas_horarios_retirada", "endereco_retirada", "avisos_retirada", "obs_retirada",
    "cronograma_evento", "passo_a_passo_kits", "entrega_locais_separados",
    "qtd_roteadores", "qtd_celulares_grupo_online", "qtd_celulares_produtos_online",
    "qtd_notebooks", "qtd_totens",
    "url_site_oficial",
  ];
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const c of camposEvento) {
    if (c in body) {
      updates.push(`${c} = ?`);
      values.push(body[c]);
    }
  }
  if ("base1_ok" in body) {
    updates.push("base1_ok_em = ?");
    values.push(body.base1_ok ? new Date().toISOString() : null);
  }
  if ("base_final_ok" in body) {
    updates.push("base_final_ok_em = ?");
    values.push(body.base_final_ok ? new Date().toISOString() : null);
  }
  if (updates.length > 0) {
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);
    await dbRun(`UPDATE eventos SET ${updates.join(", ")} WHERE id = ?`, ...values);
  }

  if (Array.isArray(body.tecnicos)) {
    await dbRun("DELETE FROM evento_tecnicos WHERE evento_id = ?", id);
    for (const tid of body.tecnicos) {
      await dbRun("INSERT INTO evento_tecnicos (evento_id, tecnico_id) VALUES (?, ?)", id, tid);
    }
  }

  if (Array.isArray(body.produtos)) {
    // Preserva a confirmação de recebimento: remove só os produtos que saíram da lista
    // e faz upsert dos demais atualizando apenas a quantidade.
    const ids = body.produtos
      .filter((p: { quantidade: number }) => p.quantidade > 0)
      .map((p: { id: number }) => p.id);
    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      await dbRun(
        `DELETE FROM evento_produtos WHERE evento_id = ? AND produto_id NOT IN (${placeholders})`,
        id,
        ...ids
      );
    } else {
      await dbRun("DELETE FROM evento_produtos WHERE evento_id = ?", id);
    }
    for (const p of body.produtos) {
      if (p.quantidade > 0) {
        await dbRun(
          `INSERT INTO evento_produtos (evento_id, produto_id, quantidade) VALUES (?, ?, ?)
           ON CONFLICT(evento_id, produto_id) DO UPDATE SET quantidade = excluded.quantidade`,
          id,
          p.id,
          p.quantidade
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const { id } = await params;
  await dbRun("DELETE FROM eventos WHERE id = ?", id);
  return NextResponse.json({ ok: true });
}
