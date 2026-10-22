/**
 * Operações de banco do inventário de equipamentos. Toda mudança de alocação
 * roda dentro de uma transação (dbTransaction) e usa UPDATE condicionado
 * (`WHERE evento_id IS NULL ...`): se duas pessoas tentarem alocar o mesmo
 * patrimônio ao mesmo tempo, só a primeira consegue — a segunda recebe 409.
 */

import type { Transaction } from "@libsql/client";

/** Erro de regra de negócio com status HTTP — a rota devolve `message` ao usuário. */
export class ErroEquipamento extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** "#numero · nome" da prova no momento do registro — continua legível se a prova for apagada. */
const SQL_EVENTO_REF = "(SELECT '#' || numero || ' · ' || nome FROM eventos WHERE id = ?)";

type EquipRow ={ id: number; patrimonio: string; evento_id: number | null; status: string };

async function lerEquip(tx: Transaction, id: number): Promise<EquipRow> {
  const r = await tx.execute({
    sql: "SELECT id, patrimonio, evento_id, status FROM equipamentos WHERE id = ?",
    args: [id],
  });
  const row = r.rows[0] as unknown as EquipRow | undefined;
  if (!row) throw new ErroEquipamento("Equipamento não encontrado", 404);
  return { ...row, evento_id: row.evento_id == null ? null : Number(row.evento_id) };
}

async function historico(
  tx: Transaction,
  equipamentoId: number,
  eventoId: number | null,
  acao: string,
  usuario: string | null,
  observacao: string | null = null
) {
  await tx.execute({
    sql: `INSERT INTO equipamento_historico (equipamento_id, evento_id, evento_ref, acao, observacao, usuario)
          VALUES (?, ?, ${SQL_EVENTO_REF}, ?, ?, ?)`,
    args: [equipamentoId, eventoId, eventoId, acao, observacao, usuario],
  });
}

export async function garantirEvento(tx: Transaction, eventoId: number) {
  const r = await tx.execute({ sql: "SELECT id FROM eventos WHERE id = ?", args: [eventoId] });
  if (r.rows.length === 0) throw new ErroEquipamento("Prova não encontrada", 404);
}

export async function garantirBase(tx: Transaction, baseId: number | null) {
  if (baseId === null) return;
  const r = await tx.execute({ sql: "SELECT id FROM bases WHERE id = ?", args: [baseId] });
  if (r.rows.length === 0) throw new ErroEquipamento("Base não encontrada", 400);
}

/**
 * Aloca vários equipamentos a uma prova — tudo ou nada. Os que já estão nesta
 * prova são ignorados. Qualquer um em manutenção ou em outra prova aborta o lote.
 */
export async function alocarNaProva(
  tx: Transaction,
  eventoId: number,
  ids: number[],
  usuario: string | null
): Promise<{ alocados: number; jaEstavam: number }> {
  await garantirEvento(tx, eventoId);
  let alocados = 0;
  let jaEstavam = 0;
  for (const id of ids) {
    const eq = await lerEquip(tx, id);
    if (eq.evento_id === eventoId) {
      jaEstavam++;
      continue;
    }
    if (eq.status === "manutencao") {
      throw new ErroEquipamento(`Patrimônio ${eq.patrimonio} está em manutenção e não pode ser alocado`, 409);
    }
    if (eq.status === "em_campo") {
      throw new ErroEquipamento(`Patrimônio ${eq.patrimonio} ainda está em campo (sem retorno registrado)`, 409);
    }
    if (eq.evento_id !== null) {
      throw new ErroEquipamento(
        `Patrimônio ${eq.patrimonio} já está alocado a outra prova. Libere-o antes de transferir.`,
        409
      );
    }
    const up = await tx.execute({
      sql: `UPDATE equipamentos SET evento_id = ?, status = 'alocado', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND evento_id IS NULL AND status = 'disponivel'`,
      args: [eventoId, id],
    });
    if (up.rowsAffected !== 1) {
      throw new ErroEquipamento(`Patrimônio ${eq.patrimonio} acabou de ser alterado por outra pessoa. Tente de novo.`, 409);
    }
    await historico(tx, id, eventoId, "alocado", usuario);
    alocados++;
  }
  return { alocados, jaEstavam };
}

/** Libera um equipamento da prova em que está. Devolve false se já estava livre. */
export async function liberarDaProva(
  tx: Transaction,
  id: number,
  usuario: string | null,
  observacao: string | null = null
): Promise<boolean> {
  const eq = await lerEquip(tx, id);
  if (eq.status === "em_campo") {
    throw new ErroEquipamento(`Patrimônio ${eq.patrimonio} está em campo. Registre o retorno em vez de liberar.`, 409);
  }
  if (eq.evento_id === null) return false;
  const up = await tx.execute({
    sql: `UPDATE equipamentos SET evento_id = NULL, status = 'disponivel', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND evento_id = ? AND status = 'alocado'`,
    args: [id, eq.evento_id],
  });
  if (up.rowsAffected !== 1) {
    throw new ErroEquipamento(`Patrimônio ${eq.patrimonio} acabou de ser alterado por outra pessoa. Tente de novo.`, 409);
  }
  await historico(tx, id, eq.evento_id, "liberado", usuario, observacao);
  return true;
}

/**
 * Saída: os equipamentos separados para a prova saem da base (status em_campo).
 * Tudo ou nada; os que já saíram são ignorados. Guarda a prova em texto (evento_ref)
 * para o aparelho continuar rastreável mesmo se a prova sumir do Gestão.
 */
export async function darSaida(
  tx: Transaction,
  eventoId: number,
  ids: number[],
  usuario: string | null
): Promise<{ sairam: number; jaEstavamEmCampo: number }> {
  await garantirEvento(tx, eventoId);
  let sairam = 0;
  let jaEstavamEmCampo = 0;
  for (const id of ids) {
    const eq = await lerEquip(tx, id);
    if (eq.evento_id !== eventoId) {
      throw new ErroEquipamento(`Patrimônio ${eq.patrimonio} não está separado para esta prova`, 409);
    }
    if (eq.status === "em_campo") {
      jaEstavamEmCampo++;
      continue;
    }
    const up = await tx.execute({
      sql: `UPDATE equipamentos SET status = 'em_campo', saida_em = CURRENT_TIMESTAMP, saida_por = ?,
              evento_ref = ${SQL_EVENTO_REF}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND evento_id = ? AND status = 'alocado'`,
      args: [usuario, eventoId, id, eventoId],
    });
    if (up.rowsAffected !== 1) {
      throw new ErroEquipamento(`Patrimônio ${eq.patrimonio} acabou de ser alterado por outra pessoa. Tente de novo.`, 409);
    }
    await historico(tx, id, eventoId, "saida", usuario);
    sairam++;
  }
  return { sairam, jaEstavamEmCampo };
}

/**
 * Retorno conferido: o aparelho em campo volta para a base — "ok" fica disponível,
 * "defeito" vai para manutenção. Funciona mesmo se a prova já tiver sido apagada.
 */
export async function registrarRetorno(
  tx: Transaction,
  id: number,
  resultado: "ok" | "defeito",
  usuario: string | null,
  observacao: string | null
) {
  const eq = await lerEquip(tx, id);
  if (eq.status !== "em_campo") {
    throw new ErroEquipamento(`Patrimônio ${eq.patrimonio} não está em campo (nada a dar entrada)`, 409);
  }
  const ref = await tx.execute({ sql: "SELECT evento_ref FROM equipamentos WHERE id = ?", args: [id] });
  const eventoRef = (ref.rows[0]?.evento_ref as string | null) ?? null;
  const up = await tx.execute({
    sql: `UPDATE equipamentos SET status = ?, evento_id = NULL, saida_em = NULL, saida_por = NULL, evento_ref = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'em_campo'`,
    args: [resultado === "ok" ? "disponivel" : "manutencao", id],
  });
  if (up.rowsAffected !== 1) {
    throw new ErroEquipamento(`Patrimônio ${eq.patrimonio} acabou de ser alterado por outra pessoa. Tente de novo.`, 409);
  }
  await tx.execute({
    sql: `INSERT INTO equipamento_historico (equipamento_id, evento_id, evento_ref, acao, observacao, usuario)
          VALUES (?, ?, COALESCE(${SQL_EVENTO_REF}, ?), ?, ?, ?)`,
    args: [id, eq.evento_id, eq.evento_id, eventoRef, resultado === "ok" ? "retorno" : "retorno_defeito", observacao, usuario],
  });
}

/** Registra a criação (e, se veio com prova, já aloca na mesma transação). */
export async function registrarCadastro(tx: Transaction, id: number, usuario: string | null, status: string) {
  await historico(tx, id, null, status === "manutencao" ? "cadastrado_manutencao" : "cadastrado", usuario);
}

/** Entra/sai de manutenção. Equipamento alocado não pode ir para manutenção. */
export async function mudarStatus(
  tx: Transaction,
  id: number,
  novo: "disponivel" | "manutencao",
  usuario: string | null
) {
  const eq = await lerEquip(tx, id);
  const atual = eq.status === "manutencao" ? "manutencao" : "disponivel";
  if (atual === novo) return;
  if (novo === "manutencao") {
    const up = await tx.execute({
      sql: `UPDATE equipamentos SET status = 'manutencao', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND evento_id IS NULL AND status = 'disponivel'`,
      args: [id],
    });
    if (up.rowsAffected !== 1) {
      throw new ErroEquipamento(
        eq.status === "em_campo"
          ? `Patrimônio ${eq.patrimonio} está em campo. Registre o retorno como "com defeito" para mandar à manutenção.`
          : `Patrimônio ${eq.patrimonio} está alocado a uma prova. Libere-o antes de mandar para manutenção.`,
        409
      );
    }
    await historico(tx, id, null, "manutencao", usuario);
  } else {
    await tx.execute({
      sql: `UPDATE equipamentos SET status = 'disponivel', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'manutencao'`,
      args: [id],
    });
    await historico(tx, id, null, "retorno_manutencao", usuario);
  }
}

/**
 * Statements (para dbBatch) para os equipamentos das provas que vão ser apagadas —
 * registrando no histórico antes. Usado pelo sync, pela exclusão de evento e pelo
 * "limpar eventos".
 * - separados (alocado) voltam a ficar disponíveis;
 * - em campo CONTINUAM em campo (o aparelho está fisicamente fora): só perdem o
 *   vínculo com a prova e seguem na aba "Pendentes de retorno" pelo evento_ref.
 */
export function statementsLiberarEquipamentosDasProvas(
  eventoIds: number[],
  observacao: string
): { sql: string; args: (string | number)[] }[] {
  if (eventoIds.length === 0) return [];
  const ph = eventoIds.map(() => "?").join(",");
  return [
    {
      sql: `INSERT INTO equipamento_historico (equipamento_id, evento_id, evento_ref, acao, observacao, usuario)
            SELECT e.id, e.evento_id, '#' || v.numero || ' · ' || v.nome,
                   CASE WHEN e.status = 'em_campo' THEN 'prova_removida' ELSE 'liberado' END, ?, 'sistema'
            FROM equipamentos e LEFT JOIN eventos v ON v.id = e.evento_id
            WHERE e.evento_id IN (${ph})`,
      args: [observacao, ...eventoIds],
    },
    {
      sql: `UPDATE equipamentos SET evento_id = NULL,
              status = CASE WHEN status = 'em_campo' THEN 'em_campo' ELSE 'disponivel' END,
              updated_at = CURRENT_TIMESTAMP
            WHERE evento_id IN (${ph})`,
      args: [...eventoIds],
    },
  ];
}
