import { NextResponse } from "next/server";
import { dbAll, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { estoqueDasBases } from "@/lib/estoque-bases";
import { calcularPrevisao, type EventoPrevisao } from "@/lib/previsao-estoque";

// GET /api/previsao — pedido (Produtos das provas) × estoque das bases nas próximas 6 semanas
export async function GET() {
  await initDB();
  const s = await getSession();
  if (!s.isLoggedIn || s.role !== "admin") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [bases, eventos, produtos] = await Promise.all([
    estoqueDasBases(),
    dbAll<{ id: number; numero: string; nome: string; data: string; uf: string | null }>(
      "SELECT id, numero, nome, data, uf FROM eventos"
    ),
    dbAll<{ evento_id: number; produto_id: number; nome: string; quantidade: number }>(
      `SELECT ep.evento_id, ep.produto_id, p.nome, ep.quantidade
         FROM evento_produtos ep JOIN produtos p ON p.id = ep.produto_id
        WHERE ep.quantidade > 0`
    ),
  ]);

  const porEvento = new Map<number, EventoPrevisao["produtos"]>();
  for (const p of produtos) {
    const id = Number(p.evento_id);
    if (!porEvento.has(id)) porEvento.set(id, []);
    porEvento.get(id)!.push({ produto_id: Number(p.produto_id), nome: p.nome, quantidade: Number(p.quantidade) });
  }
  const lista: EventoPrevisao[] = eventos
    .map((e) => ({ ...e, id: Number(e.id), produtos: porEvento.get(Number(e.id)) ?? [] }))
    .filter((e) => e.produtos.length > 0);

  const previsao = calcularPrevisao(
    bases.map((b) => ({ id: Number(b.id), nome: b.nome, uf: b.uf, estoque: b.estoque })),
    lista
  );
  return NextResponse.json(previsao);
}
