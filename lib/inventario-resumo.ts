/**
 * Resumo do inventário por tipo para o gráfico: quantos tenho (patrimônios), quantos
 * estão alocados (separados + em campo), em manutenção e disponíveis — filtrado por base —
 * e o pedido das provas da semana (card "Produtos"), casando a prova com a base pela UF.
 */

import { TIPOS_EQUIPAMENTO, tipoDeProduto, type TipoEquipamento } from "./equipamentos";
import { chaveSemana, parseDataBR } from "./semana";

export type EquipResumo = { tipo: string; status: string; base_id: number | null };
export type EventoPedido = { data: string; uf: string | null; produtos: { nome: string; quantidade: number }[] };
export type BaseResumo = { id: number; uf: string };

/** "todas" | id da base | "sem_base" */
export type FiltroBase = "todas" | "sem_base" | number;

export type LinhaInventario = {
  tipo: TipoEquipamento;
  total: number;
  alocado: number;
  manutencao: number;
  disponivel: number;
  pedido: number;
};

export function resumoInventario(
  equipamentos: EquipResumo[],
  eventos: EventoPedido[],
  bases: BaseResumo[],
  filtro: FiltroBase,
  inicioSemana: Date
): LinhaInventario[] {
  const ufsComBase = new Set(bases.map((b) => b.uf.toUpperCase()));
  const base = typeof filtro === "number" ? bases.find((b) => b.id === filtro) : undefined;

  const equipDaBase = (e: EquipResumo) =>
    filtro === "todas" ? true : filtro === "sem_base" ? e.base_id === null : e.base_id === filtro;
  const eventoDaBase = (ev: EventoPedido) => {
    const uf = (ev.uf || "").toUpperCase();
    if (filtro === "todas") return true;
    if (filtro === "sem_base") return !ufsComBase.has(uf);
    return !!base && uf === base.uf.toUpperCase();
  };

  const semana = chaveSemana(inicioSemana);
  const pedido = new Map<TipoEquipamento, number>();
  for (const ev of eventos) {
    const d = parseDataBR(ev.data);
    if (!d || chaveSemana(d) !== semana || !eventoDaBase(ev)) continue;
    for (const p of ev.produtos) {
      const t = tipoDeProduto(p.nome);
      if (t) pedido.set(t, (pedido.get(t) || 0) + (Number(p.quantidade) || 0));
    }
  }

  return TIPOS_EQUIPAMENTO.map((tipo) => {
    const doTipo = equipamentos.filter((e) => e.tipo === tipo && equipDaBase(e));
    const conta = (...s: string[]) => doTipo.filter((e) => s.includes(e.status)).length;
    return {
      tipo,
      total: doTipo.length,
      alocado: conta("alocado", "em_campo"),
      manutencao: conta("manutencao"),
      disponivel: conta("disponivel"),
      pedido: pedido.get(tipo) || 0,
    };
  }).filter((l) => l.total > 0 || l.pedido > 0);
}

/** Estoque por base dos produtos que são equipamento: conta patrimônios fora de manutenção. */
export function contagemPorBase(equipamentos: EquipResumo[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of equipamentos) {
    if (e.base_id === null || e.status === "manutencao") continue;
    const k = `${e.base_id}:${e.tipo}`;
    out.set(k, (out.get(k) || 0) + 1);
  }
  return out;
}
