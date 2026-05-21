import { NextRequest, NextResponse } from "next/server";
import { dbAll, initDB } from "@/lib/db";
import { getStaffSession } from "@/lib/staff-auth";

// GET /api/staff/audit — log de auditoria (somente admin)
export async function GET(req: NextRequest) {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Apenas administradores" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const where: string[] = ["1=1"];
  const args: unknown[] = [];
  const acao = sp.get("acao");
  if (acao) {
    where.push("acao = ?");
    args.push(acao);
  }
  const usuario = sp.get("usuario");
  if (usuario) {
    where.push("usuario LIKE ?");
    args.push(`%${usuario}%`);
  }
  const di = sp.get("data_inicial");
  if (di) {
    where.push("date(data_hora) >= date(?)");
    args.push(di);
  }
  const df = sp.get("data_final");
  if (df) {
    where.push("date(data_hora) <= date(?)");
    args.push(df);
  }

  const rows = await dbAll(
    `SELECT id, usuario, acao, detalhes, ip, navegador, data_hora
     FROM staff_audit_logs WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT 2000`,
    ...args
  );
  return NextResponse.json(rows);
}
