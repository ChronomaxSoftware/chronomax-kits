/**
 * Próximas entregas de cada técnico (de hoje em diante), para a aba Técnicos mostrar
 * quem está alocado e quem ainda precisa receber o link de acesso ao portal.
 */
import { parseDataBR } from "./semana";

export type EntregaAlocada = {
  evento_id: number;
  numero: string;
  nome: string;
  data: string;
  cidade: string | null;
  uf: string | null;
};

type Linha = EntregaAlocada & { tecnico_id: number };

/** "YYYY-MM-DD" de uma data local. */
function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Agrupa por técnico só as entregas de `hojeIso` em diante (data inválida fica de fora),
 * em ordem de data, sem repetir a mesma prova.
 */
export function proximasEntregasPorTecnico(linhas: Linha[], hojeIso: string): Map<number, EntregaAlocada[]> {
  const out = new Map<number, (EntregaAlocada & { _k: string })[]>();
  for (const l of linhas) {
    const d = parseDataBR(l.data);
    if (!d) continue;
    const k = iso(d);
    if (k < hojeIso) continue;
    const tid = Number(l.tecnico_id);
    const lista = out.get(tid) ?? [];
    if (lista.some((e) => e.evento_id === Number(l.evento_id))) continue;
    lista.push({
      evento_id: Number(l.evento_id),
      numero: String(l.numero ?? ""),
      nome: l.nome,
      data: l.data,
      cidade: l.cidade ?? null,
      uf: l.uf ?? null,
      _k: k,
    });
    out.set(tid, lista);
  }
  const final = new Map<number, EntregaAlocada[]>();
  for (const [tid, lista] of out) {
    lista.sort((a, b) => (a._k < b._k ? -1 : a._k > b._k ? 1 : 0));
    final.set(tid, lista.map(({ _k: _, ...e }) => e));
  }
  return final;
}

/** "13/11/2026" → "13/11" (outro formato volta como veio). */
export function diaMes(data: string): string {
  const d = parseDataBR(data);
  return d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : data;
}
