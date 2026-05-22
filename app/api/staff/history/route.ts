import { NextRequest, NextResponse } from "next/server";
import { dbAll, initDB } from "@/lib/db";
import { getStaffSession } from "@/lib/staff-auth";

// GET /api/staff/history — histórico com filtros (admin + técnico)
export async function GET(req: NextRequest) {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const where: string[] = ["1=1"];
  const args: unknown[] = [];

  const evento = sp.get("evento");
  if (evento) {
    where.push("a.event_id = ?");
    args.push(Number(evento));
  }
  const aparelho = sp.get("aparelho");
  if (aparelho) {
    where.push("a.device_id = ?");
    args.push(Number(aparelho));
  }
  const colaborador = sp.get("colaborador");
  if (colaborador) {
    where.push("a.colaborador LIKE ?");
    args.push(`%${colaborador}%`);
  }
  const funcao = sp.get("funcao");
  if (funcao) {
    where.push("a.funcao = ?");
    args.push(funcao);
  }
  const di = sp.get("data_inicial");
  if (di) {
    where.push("date(a.inicio) >= date(?)");
    args.push(di);
  }
  const df = sp.get("data_final");
  if (df) {
    where.push("date(a.inicio) <= date(?)");
    args.push(df);
  }
  const status = sp.get("status");
  if (status === "em_uso") where.push("a.fim IS NULL");
  else if (status === "finalizado") where.push("a.fim IS NOT NULL");

  const rows = await dbAll(
    `SELECT a.id, a.colaborador, a.funcao, a.observacao, a.inicio, a.fim, a.tempo_total,
            a.created_by, a.event_id,
            d.nome AS device_nome, d.patrimonio,
            e.nome AS evento_nome
     FROM staff_assignments a
     JOIN staff_devices d ON d.id = a.device_id
     LEFT JOIN eventos e ON e.id = a.event_id
     WHERE ${where.join(" AND ")}
     ORDER BY a.inicio DESC
     LIMIT 2000`,
    ...args
  );
  return NextResponse.json(rows);
}
