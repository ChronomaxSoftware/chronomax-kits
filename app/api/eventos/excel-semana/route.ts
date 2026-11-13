import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { dbAll, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  montarLinhas,
  resumoPorProva,
  type ConvocadoBruto,
  type ProvaPlanilha,
  type TecnicoCadastro,
} from "@/lib/excel-semana";

export const runtime = "nodejs";

// GET /api/eventos/excel-semana?ids=1,2,3&nome=provas_09-11_a_15-11
// Planilha com todas as provas pedidas e todos os convocados (equipe do Gestão + técnicos atribuídos).
export async function GET(req: NextRequest) {
  await initDB();
  const s = await getSession();
  if (!s.isLoggedIn || s.role !== "admin") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const ids = (req.nextUrl.searchParams.get("ids") || "")
    .split(",")
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 500);
  if (ids.length === 0) return NextResponse.json({ error: "Nenhuma prova" }, { status: 400 });
  const nomeArq = (req.nextUrl.searchParams.get("nome") || "provas_semana").replace(/[^\w\-]/g, "_").slice(0, 80);
  const ph = ids.map(() => "?").join(",");

  const [provas, equipe, atribuidos, cadastro] = await Promise.all([
    dbAll<ProvaPlanilha>(`SELECT id, numero, nome, data, cidade, uf FROM eventos WHERE id IN (${ph})`, ...ids),
    dbAll<ConvocadoBruto>(
      `SELECT evento_id, nome, funcao, cpf_prefixo FROM evento_equipe_gestao WHERE evento_id IN (${ph})`,
      ...ids
    ),
    dbAll<ConvocadoBruto>(
      `SELECT et.evento_id, t.nome, et.funcao, t.cpf_prefixo
         FROM evento_tecnicos et JOIN tecnicos t ON t.id = et.tecnico_id
        WHERE et.evento_id IN (${ph})`,
      ...ids
    ),
    dbAll<TecnicoCadastro>("SELECT nome, cpf_prefixo, telefone, cpf FROM tecnicos"),
  ]);

  const linhas = montarLinhas(provas, [...equipe, ...atribuidos], cadastro);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Convocados");
  ws.columns = [
    { header: "Data", key: "data", width: 12 },
    { header: "Prova", key: "prova", width: 40 },
    { header: "Nº", key: "numero", width: 8 },
    { header: "Cidade/UF", key: "local", width: 22 },
    { header: "Nome", key: "nome", width: 38 },
    { header: "Função", key: "funcao", width: 14 },
    { header: "Telefone", key: "telefone", width: 16 },
    { header: "CPF", key: "cpf", width: 16 },
  ];
  linhas.forEach((l) => ws.addRow(l));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: "A1", to: "H1" };

  const wr = wb.addWorksheet("Resumo");
  wr.columns = [
    { header: "Data", key: "data", width: 12 },
    { header: "Prova", key: "prova", width: 40 },
    { header: "Nº", key: "numero", width: 8 },
    { header: "Cidade/UF", key: "local", width: 22 },
    { header: "Qtd", key: "quantidade", width: 6 },
    { header: "Convocados", key: "nomes", width: 90 },
  ];
  resumoPorProva(linhas).forEach((r) => wr.addRow(r));
  wr.getRow(1).font = { bold: true };
  wr.views = [{ state: "frozen", ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArq}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
