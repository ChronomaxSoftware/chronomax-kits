import { NextResponse } from "next/server";
import { dbAll, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  await initDB();
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "tecnico" || !session.tecnicoId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const tid = session.tecnicoId;

  const eventos = await dbAll<{
    id: number;
    numero: string;
    nome: string;
    data: string;
    cidade: string | null;
    uf: string | null;
    local_entrega: string | null;
    data_entrega: string | null;
    hora_entrega: string | null;
  }>(
    `SELECT e.id, e.numero, e.nome, e.data, e.cidade, e.uf, e.local_entrega, e.data_entrega, e.hora_entrega
     FROM evento_tecnicos et JOIN eventos e ON e.id = et.evento_id
     WHERE et.tecnico_id = ?
     ORDER BY e.data DESC`,
    tid
  );

  const result = [];
  for (const ev of eventos) {
    const produtos = await dbAll(
      `SELECT p.id, p.nome, ep.quantidade, ep.recebido, ep.qtd_recebida, ep.recebido_em
       FROM evento_produtos ep JOIN produtos p ON p.id = ep.produto_id
       WHERE ep.evento_id = ? ORDER BY p.nome`,
      ev.id
    );
    result.push({ ...ev, produtos });
  }

  return NextResponse.json(result);
}
