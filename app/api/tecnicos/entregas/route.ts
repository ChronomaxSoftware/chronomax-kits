import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes");
  const m = mes?.match(/^(\d{4})-(\d{2})$/);
  if (!m) return NextResponse.json({ error: "Parâmetro mes=YYYY-MM obrigatório" }, { status: 400 });
  const ano = m[1];
  const mm = m[2];

  const rows = db
    .prepare(
      `
      SELECT t.id, t.nome, t.telefone,
             COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS total,
             GROUP_CONCAT(
               CASE WHEN e.id IS NOT NULL
                 THEN e.numero || '|' || e.nome || '|' || e.data || '|' || COALESCE(e.cidade,'') || '|' || COALESCE(e.uf,'')
                 ELSE NULL END,
               '||'
             ) AS eventos_str
      FROM tecnicos t
      LEFT JOIN evento_tecnicos et ON et.tecnico_id = t.id
      LEFT JOIN eventos e ON e.id = et.evento_id
        AND substr(e.data, 4, 2) = ?
        AND substr(e.data, 7, 4) = ?
        AND e.tem_kit = 1
      WHERE t.ativo = 1
      GROUP BY t.id, t.nome, t.telefone
      ORDER BY total DESC, t.nome
      `
    )
    .all(mm, ano) as { id: number; nome: string; telefone: string | null; total: number; eventos_str: string | null }[];

  const lista = rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    telefone: r.telefone,
    total: r.total,
    eventos: r.eventos_str
      ? r.eventos_str.split("||").map((s) => {
          const [numero, nome, data, cidade, uf] = s.split("|");
          return { numero, nome, data, cidade, uf };
        })
      : [],
  }));

  return NextResponse.json({ mes, total_tecnicos: lista.length, tecnicos: lista });
}
