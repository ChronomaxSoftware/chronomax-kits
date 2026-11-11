import { dbAll, dbGet, dbRun } from "./db";
import type { Correcao } from "./correcoes";

/** Quantidade oficial de cada item: a última correção aprovada ou a esperada. */
export const SQL_QTD_OFICIAL = `COALESCE(
  (SELECT c.qtd_pedida FROM correcoes_quantidade c
    WHERE c.evento_id = evento_produtos.evento_id AND c.produto_id = evento_produtos.produto_id AND c.status = 'aprovado'
    ORDER BY c.id DESC LIMIT 1),
  evento_produtos.quantidade)`;

export async function listarCorrecoes(eventoId: number | string, tecnicoId?: number): Promise<Correcao[]> {
  return dbAll<Correcao>(
    `SELECT c.*, p.nome AS produto, t.nome AS tecnico
       FROM correcoes_quantidade c
       LEFT JOIN produtos p ON p.id = c.produto_id
       LEFT JOIN tecnicos t ON t.id = c.tecnico_id
      WHERE c.evento_id = ? ${tecnicoId ? "AND c.tecnico_id = ?" : ""}
      ORDER BY c.id DESC`,
    ...(tecnicoId ? [eventoId, tecnicoId] : [eventoId])
  );
}

/**
 * Marca (ou desmarca) que o técnico confirmou tudo: todos os itens recebidos na quantidade esperada.
 * Devolve se ficou completo e se acabou de ficar (para o alerta de recebimento).
 */
export async function atualizarConfirmacao(
  eventoId: number | string,
  tecnicoId: number,
  agora = new Date().toISOString()
): Promise<{ completo: boolean; novo: boolean }> {
  const pend = await dbAll(
    "SELECT 1 FROM evento_produtos WHERE evento_id = ? AND (COALESCE(recebido, 0) = 0 OR COALESCE(qtd_recebida, quantidade) < quantidade)",
    eventoId
  );
  const total = await dbGet<{ n: number }>("SELECT COUNT(*) AS n FROM evento_produtos WHERE evento_id = ?", eventoId);
  const completo = pend.length === 0 && (Number(total?.n) || 0) > 0;
  const antes = await dbGet<{ confirmado_em: string | null }>(
    "SELECT confirmado_em FROM evento_tecnicos WHERE evento_id = ? AND tecnico_id = ?",
    eventoId,
    tecnicoId
  );
  await dbRun(
    "UPDATE evento_tecnicos SET confirmado_em = ? WHERE evento_id = ? AND tecnico_id = ?",
    completo ? antes?.confirmado_em || agora : null,
    eventoId,
    tecnicoId
  );
  return { completo, novo: completo && !antes?.confirmado_em };
}
