/**
 * Texto da semana para emitir a nota fiscal dos equipamentos que vão para as provas:
 * técnico, prova e quantidade de cada equipamento (só os que vão, qtd > 0).
 * Quantidades vêm do card "Produtos" do evento.
 */

import { tipoDeProduto, type TipoEquipamento } from "./equipamentos";
import { formatBR, parseDataBR } from "./semana";

/** Ordem e nome de cada item na nota (marca/modelo usados na emissão). */
export const ITENS_NOTA: { tipo: TipoEquipamento; rotulo: string }[] = [
  { tipo: "Celular", rotulo: "Celular Motorola" },
  { tipo: "Notebook", rotulo: "Notebook" },
  { tipo: "Tablet", rotulo: "Tablet Positivo" },
  { tipo: "Roteador", rotulo: "Roteador" },
  { tipo: "Totem", rotulo: "Totem Sunmi" },
];

export type EventoNota = {
  numero: string;
  nome: string;
  data: string;
  cidade: string | null;
  uf: string | null;
  tecnicos: { nome: string }[];
  produtos: { nome: string; quantidade: number }[];
};

/** Quantidade por tipo (soma produtos do mesmo tipo, ex.: "Celular" + "Celular reserva"). */
export function quantidadesNota(produtos: EventoNota["produtos"]): Map<TipoEquipamento, number> {
  const out = new Map<TipoEquipamento, number>();
  for (const p of produtos) {
    const t = tipoDeProduto(p.nome);
    const q = Number(p.quantidade) || 0;
    if (t && q > 0) out.set(t, (out.get(t) || 0) + q);
  }
  return out;
}

export function textoNotaFiscalSemana(inicio: Date, fim: Date, eventos: EventoNota[]): string {
  const linhas = [`NOTA FISCAL — Semana ${formatBR(inicio)} a ${formatBR(fim)}`, ""];
  const total = new Map<TipoEquipamento, number>();
  const ordenados = [...eventos].sort(
    (a, b) => (parseDataBR(a.data)?.getTime() ?? Infinity) - (parseDataBR(b.data)?.getTime() ?? Infinity)
  );

  let provas = 0;
  for (const e of ordenados) {
    const qtd = quantidadesNota(e.produtos);
    if (qtd.size === 0) continue;
    provas++;
    const tecnicos = e.tecnicos.map((t) => t.nome).join(", ") || "(sem técnico)";
    const local = [e.cidade, e.uf].filter(Boolean).join("/");
    linhas.push(`Técnico: ${tecnicos}`);
    linhas.push(`Prova: ${e.nome} (#${e.numero})${e.data ? ` — ${e.data}` : ""}${local ? ` — ${local}` : ""}`);
    for (const { tipo, rotulo } of ITENS_NOTA) {
      const q = qtd.get(tipo);
      if (!q) continue;
      linhas.push(`${rotulo}: ${q}`);
      total.set(tipo, (total.get(tipo) || 0) + q);
    }
    linhas.push("");
  }

  if (provas === 0) {
    linhas.push("Nenhuma prova desta semana tem celular, notebook, tablet, roteador ou totem indo.");
    return linhas.join("\n");
  }
  linhas.push("TOTAL DA SEMANA");
  for (const { tipo, rotulo } of ITENS_NOTA) {
    const q = total.get(tipo);
    if (q) linhas.push(`${rotulo}: ${q}`);
  }
  return linhas.join("\n") + "\n";
}
