import { statementsLiberarEquipamentosDasProvas } from "./equipamentos-db";

/**
 * Statements (para dbBatch) que apagam um lote de eventos e tudo que depende
 * deles. libsql/Turso não força FK, então o cascade é feito à mão aqui — num
 * único lugar, usado pelo sync, pela exclusão de evento e pelo "limpar eventos".
 * Chamar com no máximo ~100 ids por vez (limite de parâmetros do SQLite).
 */
export function statementsApagarEventos(ids: number[], motivo: string): { sql: string; args: (string | number)[] }[] {
  if (ids.length === 0) return [];
  const ph = ids.map(() => "?").join(",");
  return [
    // Filhas com cascade lógico
    { sql: `DELETE FROM evento_tecnicos WHERE evento_id IN (${ph})`, args: [...ids] },
    { sql: `DELETE FROM evento_produtos WHERE evento_id IN (${ph})`, args: [...ids] },
    { sql: `DELETE FROM evento_produtos_gestao WHERE evento_id IN (${ph})`, args: [...ids] },
    { sql: `DELETE FROM evento_itens_gestao WHERE evento_id IN (${ph})`, args: [...ids] },
    { sql: `DELETE FROM evento_equipe_gestao WHERE evento_id IN (${ph})`, args: [...ids] },
    { sql: `DELETE FROM evento_kits WHERE evento_id IN (${ph})`, args: [...ids] },
    // Equipamentos por patrimônio voltam a ficar disponíveis (com histórico)
    ...statementsLiberarEquipamentosDasProvas(ids, motivo),
    // Referências que só desvinculam (equivalente a ON DELETE SET NULL).
    // equipamento_historico mantém evento_id de propósito: guarda evento_ref (número · nome)
    // e AUTOINCREMENT nunca reaproveita ids, então o registro continua legível.
    { sql: `UPDATE celulares_chip SET evento_id = NULL WHERE evento_id IN (${ph})`, args: [...ids] },
    { sql: `UPDATE equipamentos_alugados SET evento_id = NULL WHERE evento_id IN (${ph})`, args: [...ids] },
    { sql: `UPDATE staff_assignments SET event_id = NULL WHERE event_id IN (${ph})`, args: [...ids] },
    { sql: `DELETE FROM staff_celular_tecnico WHERE evento_id IN (${ph})`, args: [...ids] },
    // Por fim, o próprio evento
    { sql: `DELETE FROM eventos WHERE id IN (${ph})`, args: [...ids] },
  ];
}
