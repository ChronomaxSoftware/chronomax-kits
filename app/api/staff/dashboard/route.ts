import { NextResponse } from "next/server";
import { dbAll, dbGet, initDB } from "@/lib/db";
import { getStaffSession } from "@/lib/staff-auth";

// GET /api/staff/dashboard — cards + tabela operacional (admin + técnico)
export async function GET() {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const num = async (sql: string) => Number((await dbGet<{ n: number }>(sql))?.n || 0);

  const cards = {
    total: await num("SELECT COUNT(*) AS n FROM staff_devices"),
    disponiveis: await num("SELECT COUNT(*) AS n FROM staff_devices WHERE status = 'disponivel'"),
    em_uso: await num("SELECT COUNT(*) AS n FROM staff_devices WHERE status = 'em_uso'"),
    inativos: await num("SELECT COUNT(*) AS n FROM staff_devices WHERE status = 'inativo'"),
    colaboradores_ativos: await num(
      "SELECT COUNT(DISTINCT colaborador) AS n FROM staff_assignments WHERE fim IS NULL"
    ),
    movimentacoes_hoje: await num(
      "SELECT COUNT(*) AS n FROM staff_assignments WHERE date(inicio) = date('now')"
    ),
    trocas_hoje: await num(
      "SELECT COUNT(*) AS n FROM staff_audit_logs WHERE acao = 'Troca de responsável' AND date(data_hora) = date('now')"
    ),
  };

  const operacional = await dbAll(
    `SELECT a.id, a.colaborador, a.funcao, a.inicio, a.event_id,
            d.id AS device_id, d.nome AS device_nome, d.patrimonio, d.status,
            e.nome AS evento_nome
     FROM staff_assignments a
     JOIN staff_devices d ON d.id = a.device_id
     LEFT JOIN eventos e ON e.id = a.event_id
     WHERE a.fim IS NULL
     ORDER BY a.inicio DESC`
  );

  return NextResponse.json({ cards, operacional });
}
