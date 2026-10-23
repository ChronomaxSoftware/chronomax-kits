import { NextResponse } from "next/server";
import { dbAll, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { parseDataBR } from "@/lib/semana";

/** O portal mostra só as provas de 7 dias atrás em diante (sem o histórico antigo). */
const DIAS_PASSADOS = 7;

export async function GET() {
  await initDB();
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "tecnico" || !session.tecnicoId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const tid = session.tecnicoId;

  const todos = await dbAll<{
    id: number;
    numero: string;
    nome: string;
    data: string;
    cidade: string | null;
    uf: string | null;
    local_entrega: string | null;
    data_entrega: string | null;
    hora_entrega: string | null;
    obs_recebimento: string | null;
    obs_em: string | null;
    confirmado_em: string | null;
  }>(
    `SELECT e.id, e.numero, e.nome, e.data, e.cidade, e.uf, e.local_entrega, e.data_entrega, e.hora_entrega,
            et.obs_recebimento, et.obs_em, et.confirmado_em
     FROM evento_tecnicos et JOIN eventos e ON e.id = et.evento_id
     WHERE et.tecnico_id = ?`,
    tid
  );

  const corte = new Date();
  corte.setHours(0, 0, 0, 0);
  corte.setDate(corte.getDate() - DIAS_PASSADOS);
  const eventos = todos
    .map((e) => ({ e, d: parseDataBR(e.data) }))
    .filter((x) => x.d === null || x.d >= corte)
    .sort((a, b) => (a.d?.getTime() ?? Infinity) - (b.d?.getTime() ?? Infinity))
    .map((x) => x.e);

  const result = [];
  for (const ev of eventos) {
    const produtos = await dbAll(
      `SELECT p.id, p.nome, ep.quantidade, ep.recebido, ep.qtd_recebida, ep.recebido_em
       FROM evento_produtos ep JOIN produtos p ON p.id = ep.produto_id
       WHERE ep.evento_id = ? ORDER BY p.nome`,
      ev.id
    );
    // Patrimônios separados/em campo para a prova (só leitura no portal)
    const equipamentos = await dbAll(
      `SELECT tipo, patrimonio, numero_chip, status FROM equipamentos
       WHERE evento_id = ? ORDER BY tipo, patrimonio`,
      ev.id
    );
    result.push({ ...ev, produtos, equipamentos });
  }

  return NextResponse.json(result);
}
