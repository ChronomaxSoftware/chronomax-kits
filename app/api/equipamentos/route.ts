import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbTransaction, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { TIPOS_EQUIPAMENTO, ehErroPatrimonioDuplicado, idOuNull, validarCadastro } from "@/lib/equipamentos";
import { ErroEquipamento, alocarNaProva, garantirBase, registrarCadastro } from "@/lib/equipamentos-db";

// GET /api/equipamentos?q=&tipo=&status= — lista o inventário (com base e prova atuais)
export async function GET(req: NextRequest) {
  await initDB();
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim();
  const tipo = (sp.get("tipo") || "").trim();
  const status = (sp.get("status") || "").trim();
  const params: string[] = [];
  let where = "WHERE 1=1";
  if (q) {
    where += ` AND (e.patrimonio LIKE ? OR COALESCE(e.numero_chip,'') LIKE ? OR COALESCE(e.numero_serie,'') LIKE ?
               OR COALESCE(e.observacao,'') LIKE ? OR COALESCE(v.numero,'') LIKE ? OR COALESCE(v.nome,'') LIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like);
  }
  if (tipo && (TIPOS_EQUIPAMENTO as readonly string[]).includes(tipo)) {
    where += " AND e.tipo = ?";
    params.push(tipo);
  }
  if (["disponivel", "alocado", "em_campo", "manutencao"].includes(status)) {
    where += " AND e.status = ?";
    params.push(status);
  }
  const rows = await dbAll(
    `SELECT e.*, b.nome AS base_nome, b.uf AS base_uf, v.numero AS evento_numero, v.nome AS evento_nome, v.data AS evento_data,
            COALESCE('#' || v.numero || ' · ' || v.nome, e.evento_ref) AS prova_ref
     FROM equipamentos e
     LEFT JOIN bases b ON b.id = e.base_id
     LEFT JOIN eventos v ON v.id = e.evento_id
     ${where}
     ORDER BY e.tipo, e.patrimonio`,
    ...params
  );
  return NextResponse.json(rows);
}

// POST /api/equipamentos — cadastra (e, opcionalmente, já aloca a uma prova na mesma transação)
export async function POST(req: NextRequest) {
  await initDB();
  const body = await req.json().catch(() => ({}));
  const v = validarCadastro(body);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });
  const d = v.dados;
  const eventoId = idOuNull(body.evento_id);
  if (eventoId && d.status === "manutencao") {
    return NextResponse.json({ error: "Equipamento em manutenção não pode ser alocado" }, { status: 400 });
  }
  const usuario = (await getSession()).name || null;

  try {
    const id = await dbTransaction(async (tx) => {
      await garantirBase(tx, d.base_id);
      const r = await tx.execute({
        sql: `INSERT INTO equipamentos (tipo, patrimonio, numero_chip, operadora, numero_serie, base_id, status, observacao)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [d.tipo, d.patrimonio, d.numero_chip, d.operadora, d.numero_serie, d.base_id, d.status, d.observacao],
      });
      const novoId = Number(r.lastInsertRowid);
      await registrarCadastro(tx, novoId, usuario, d.status);
      if (eventoId) await alocarNaProva(tx, eventoId, [novoId], usuario);
      return novoId;
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof ErroEquipamento) return NextResponse.json({ error: err.message }, { status: err.status });
    if (ehErroPatrimonioDuplicado(err)) {
      return NextResponse.json({ error: `O patrimônio ${d.patrimonio} já está cadastrado` }, { status: 409 });
    }
    console.error("[equipamentos] erro ao cadastrar", err);
    return NextResponse.json({ error: "Não foi possível cadastrar o equipamento" }, { status: 500 });
  }
}
