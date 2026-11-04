import { dbAll } from "./db";
import { tipoDeProduto } from "./equipamentos";
import type { LinhaAcessorio } from "./retorno-acessorios";

/**
 * Patrimônios de cada prova por tipo: os separados/em campo agora + os que já voltaram
 * dela (histórico de retorno). Assim o retorno de um celular não faz o "Celular" do
 * Produtos reaparecer como item a contar.
 */
export async function patrimoniosPorProvaTipo(): Promise<Map<string, number>> {
  const rows = await dbAll<{ evento_id: number; tipo: string; n: number }>(
    `SELECT evento_id, tipo, COUNT(DISTINCT id) AS n FROM (
       SELECT id, tipo, evento_id FROM equipamentos WHERE evento_id IS NOT NULL
       UNION
       SELECT e.id, e.tipo, h.evento_id FROM equipamento_historico h JOIN equipamentos e ON e.id = h.equipamento_id
       WHERE h.acao IN ('retorno', 'retorno_defeito') AND h.evento_id IS NOT NULL
     ) GROUP BY evento_id, tipo`
  );
  return new Map(rows.map((r) => [`${Number(r.evento_id)}:${r.tipo}`, Number(r.n)]));
}

/** Preenche qtd_patrimonio das linhas de equipamento (celular, notebook…). */
export async function comPatrimonios<T extends Pick<LinhaAcessorio, "evento_id" | "produto_nome">>(
  linhas: T[]
): Promise<(T & { qtd_patrimonio: number })[]> {
  const mapa = await patrimoniosPorProvaTipo();
  return linhas.map((l) => {
    const tipo = tipoDeProduto(l.produto_nome);
    return { ...l, qtd_patrimonio: tipo ? mapa.get(`${Number(l.evento_id)}:${tipo}`) ?? 0 : 0 };
  });
}
