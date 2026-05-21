import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { dbAll, initDB } from "@/lib/db";
import { getStaffSession } from "@/lib/staff-auth";
import { registrarAuditoria } from "@/lib/staff-audit";
import { formatDuracao } from "@/lib/staff";

export const runtime = "nodejs";

type Row = {
  inicio: string | null;
  fim: string | null;
  tempo_total: number | null;
  device_nome: string;
  patrimonio: string | null;
  colaborador: string;
  funcao: string | null;
  created_by: string | null;
  ip: string | null;
};

function fmt(iso: string | null, tipo: "data" | "hora"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  if (tipo === "data") return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  return d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

// GET /api/staff/export — XLSX do histórico (somente admin), respeitando os filtros do histórico
export async function GET(req: NextRequest) {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Apenas administradores" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const where: string[] = ["1=1"];
  const args: unknown[] = [];
  if (sp.get("evento")) {
    where.push("a.event_id = ?");
    args.push(Number(sp.get("evento")));
  }
  if (sp.get("aparelho")) {
    where.push("a.device_id = ?");
    args.push(Number(sp.get("aparelho")));
  }
  if (sp.get("colaborador")) {
    where.push("a.colaborador LIKE ?");
    args.push(`%${sp.get("colaborador")}%`);
  }
  if (sp.get("funcao")) {
    where.push("a.funcao = ?");
    args.push(sp.get("funcao"));
  }
  if (sp.get("data_inicial")) {
    where.push("date(a.inicio) >= date(?)");
    args.push(sp.get("data_inicial"));
  }
  if (sp.get("data_final")) {
    where.push("date(a.inicio) <= date(?)");
    args.push(sp.get("data_final"));
  }
  const status = sp.get("status");
  if (status === "em_uso") where.push("a.fim IS NULL");
  else if (status === "finalizado") where.push("a.fim IS NOT NULL");

  const rows = await dbAll<Row>(
    `SELECT a.inicio, a.fim, a.tempo_total, a.colaborador, a.funcao, a.created_by, a.ip,
            d.nome AS device_nome, d.patrimonio
     FROM staff_assignments a
     JOIN staff_devices d ON d.id = a.device_id
     WHERE ${where.join(" AND ")}
     ORDER BY a.inicio DESC
     LIMIT 5000`,
    ...args
  );

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Controle de Staff");
  ws.columns = [
    { header: "Data", key: "data", width: 12 },
    { header: "Hora Inicial", key: "hi", width: 12 },
    { header: "Hora Final", key: "hf", width: 12 },
    { header: "Duração", key: "dur", width: 12 },
    { header: "Aparelho", key: "ap", width: 24 },
    { header: "Patrimônio", key: "pat", width: 14 },
    { header: "Colaborador", key: "col", width: 26 },
    { header: "Função", key: "fun", width: 18 },
    { header: "Status", key: "st", width: 12 },
    { header: "Usuário responsável", key: "user", width: 24 },
    { header: "IP", key: "ip", width: 16 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const r of rows) {
    ws.addRow({
      data: fmt(r.inicio, "data"),
      hi: fmt(r.inicio, "hora"),
      hf: fmt(r.fim, "hora"),
      dur: formatDuracao(r.tempo_total),
      ap: r.device_nome,
      pat: r.patrimonio || "",
      col: r.colaborador,
      fun: r.funcao || "",
      st: r.fim ? "Finalizado" : "Em uso",
      user: r.created_by || "",
      ip: r.ip || "",
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  await registrarAuditoria(req, s.usuario, "Exportou relatório", `${rows.length} registro(s)`);

  return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="controle-staff-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
