import { NextResponse } from "next/server";
import { dbAll, initDB } from "@/lib/db";
import { parseDataBR } from "@/lib/semana";

type EventoRow = {
  id: number;
  numero: string;
  nome: string;
  data: string;
  cidade: string | null;
  uf: string | null;
  qtd_celulares: number;
  dias_entrega: number;
  qtd_atletas: number;
  nivel: string | null;
  data_entrega: string | null;
  hora_entrega: string | null;
  local_entrega: string | null;
  status: string;
  url_gestao: string | null;
  base1_ok: number;
  base_final_ok: number;
  base1_ok_em: string | null;
  base_final_ok_em: string | null;
  tem_kit: number;
  tipo_kit: "entrega" | "sistema" | null;
};

export async function GET() {
  await initDB();

  // Sem limite: retorna TODOS os eventos. A ordenação por data é feita em JS
  // porque `data` é texto "dd/mm/yyyy" (ORDER BY no SQL ordenaria alfabeticamente).
  const eventos = await dbAll<EventoRow>(
    `SELECT id, numero, nome, data, cidade, uf, qtd_celulares, dias_entrega, qtd_atletas, nivel, data_entrega, hora_entrega, local_entrega, status, url_gestao, base1_ok, base_final_ok, base1_ok_em, base_final_ok_em, tem_kit, tipo_kit FROM eventos`
  );

  // Só técnicos ativos; inclui função e data/hora da atribuição
  const tecnicosPorEvento = await dbAll<{
    evento_id: number;
    id: number;
    nome: string;
    funcao: string | null;
    atribuido_em: string | null;
  }>(
    `SELECT et.evento_id, t.id, t.nome, et.funcao, et.atribuido_em
     FROM evento_tecnicos et JOIN tecnicos t ON t.id = et.tecnico_id
     WHERE t.ativo = 1`
  );

  const produtosPorEvento = await dbAll<{ evento_id: number; id: number; nome: string; quantidade: number }>(
    `SELECT ep.evento_id, p.id, p.nome, ep.quantidade FROM evento_produtos ep JOIN produtos p ON p.id = ep.produto_id`
  );

  const out = eventos.map((e) => ({
    ...e,
    tecnicos: tecnicosPorEvento
      .filter((t) => t.evento_id === e.id)
      .map(({ id, nome, funcao, atribuido_em }) => ({ id, nome, funcao, atribuido_em })),
    produtos: produtosPorEvento
      .filter((p) => p.evento_id === e.id)
      .map(({ id, nome, quantidade }) => ({ id, nome, quantidade })),
  }));

  // Ordena por data crescente; eventos com data inválida/nula vão para o fim.
  out.sort((a, b) => {
    const da = parseDataBR(a.data);
    const db = parseDataBR(b.data);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.getTime() - db.getTime();
  });

  return NextResponse.json(out);
}
