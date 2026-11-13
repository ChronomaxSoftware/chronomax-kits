import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { dbAll, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { idsDoPeriodo } from "@/lib/eventos-periodo";
import type { ConvocadoBruto } from "@/lib/excel-semana";
import { montarLinhasApuradores, type EquipeApurador, type ProvaApurador } from "@/lib/excel-apuradores";

export const runtime = "nodejs";

// GET /api/eventos/excel-apuradores?inicio=2026-11-23&fim=2026-11-29&nome=apuradores_23-11_a_29-11
// Uma linha por prova: cliente, apurador(es), se tem EK e quem faz a EK.
export async function GET(req: NextRequest) {
  await initDB();
  const s = await getSession();
  if (!s.isLoggedIn || s.role !== "admin") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // TODAS as provas do período (com ou sem kit, sem os filtros da tela)
  const sp = req.nextUrl.searchParams;
  const r = await idsDoPeriodo(sp.get("inicio"), sp.get("fim"));
  if ("erro" in r) return NextResponse.json({ error: r.erro }, { status: 400 });
  const ids = r.length ? r : [0];
  const nomeArq = (req.nextUrl.searchParams.get("nome") || "apuradores_semana").replace(/[^\w\-]/g, "_").slice(0, 80);
  const ph = ids.map(() => "?").join(",");

  const [provas, equipe, atribuidos] = await Promise.all([
    dbAll<ProvaApurador>(
      `SELECT id, numero, nome, data, cidade, uf, cliente, tipo_kit FROM eventos WHERE id IN (${ph})`,
      ...ids
    ),
    dbAll<EquipeApurador>(
      `SELECT evento_id, nome, funcao, cpf_prefixo, cache_ek FROM evento_equipe_gestao WHERE evento_id IN (${ph})`,
      ...ids
    ),
    dbAll<ConvocadoBruto>(
      `SELECT et.evento_id, t.nome, et.funcao, t.cpf_prefixo
         FROM evento_tecnicos et JOIN tecnicos t ON t.id = et.tecnico_id
        WHERE et.evento_id IN (${ph})`,
      ...ids
    ),
  ]);

  const linhas = montarLinhasApuradores(provas, equipe, atribuidos);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Apuradores");
  ws.columns = [
    { header: "Data", key: "data", width: 12 },
    { header: "Nº", key: "numero", width: 8 },
    { header: "Prova", key: "prova", width: 46 },
    { header: "Cliente", key: "cliente", width: 36 },
    { header: "Cidade/UF", key: "local", width: 26 },
    { header: "Apurador", key: "apurador", width: 40 },
    { header: "Tem EK?", key: "tem_ek", width: 16 },
    { header: "Quem faz a EK", key: "quem_ek", width: 46 },
    { header: "Observação", key: "obs", width: 34 },
  ];
  for (const l of linhas) {
    const { sem_apurador, ...dados } = l;
    const row = ws.addRow(dados);
    if (sem_apurador) {
      row.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE0A3" } };
      });
    }
  }
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: "I1" };

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArq}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
