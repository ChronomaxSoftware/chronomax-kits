/**
 * TXT de separação: o que separar para cada prova escolhida (itens do card "Produtos",
 * só qtd > 0) e o total. As provas são escolhidas na tela — ex.: só as do RJ, cujo
 * material já está lá e só vai ser separado e entregue.
 */

import { formatBR, parseDataBR } from "./semana";

export type EventoSeparacao = {
  numero: string;
  nome: string;
  data: string;
  cidade: string | null;
  uf: string | null;
  local_entrega: string | null;
  data_entrega: string | null;
  hora_entrega: string | null;
  tecnicos: { nome: string }[];
  produtos: { nome: string; quantidade: number }[];
};

const LINHA = "------------------------------";
const DUPLA = "==============================";

/** UFs presentes nas provas (para os atalhos de seleção), em ordem alfabética. */
export function ufsDasProvas(eventos: { uf: string | null }[]): string[] {
  const s = new Set<string>();
  for (const e of eventos) {
    const uf = (e.uf || "").trim().toUpperCase();
    if (uf) s.add(uf);
  }
  return [...s].sort();
}

export function itensParaSeparar(produtos: EventoSeparacao["produtos"]): { nome: string; quantidade: number }[] {
  return produtos
    .map((p) => ({ nome: p.nome, quantidade: Number(p.quantidade) || 0 }))
    .filter((p) => p.quantidade > 0);
}

export function textoSeparacao(inicio: Date, fim: Date, eventos: EventoSeparacao[]): string {
  const linhas = [DUPLA, `SEPARAÇÃO — Semana ${formatBR(inicio)} a ${formatBR(fim)}`, DUPLA, ""];
  if (eventos.length === 0) {
    linhas.push("Nenhuma prova selecionada.");
    return linhas.join("\n");
  }

  const ordenados = [...eventos].sort(
    (a, b) => (parseDataBR(a.data)?.getTime() ?? Infinity) - (parseDataBR(b.data)?.getTime() ?? Infinity)
  );
  const total = new Map<string, number>();

  for (const e of ordenados) {
    const local = [e.cidade, e.uf].filter(Boolean).join("/");
    linhas.push(`PROVA: ${e.nome} (#${e.numero})${e.data ? ` — ${e.data}` : ""}${local ? ` — ${local}` : ""}`);
    linhas.push(`Técnico: ${e.tecnicos.map((t) => t.nome).join(", ") || "(sem técnico)"}`);
    const entrega = [e.local_entrega, [e.data_entrega, e.hora_entrega].filter(Boolean).join(" ")]
      .map((s) => (s || "").trim())
      .filter(Boolean);
    if (entrega.length) linhas.push(`Entrega: ${entrega.join(" · ")}`);

    const itens = itensParaSeparar(e.produtos);
    if (itens.length === 0) linhas.push("(nenhum item no card Produtos)");
    for (const p of itens) {
      linhas.push(`- ${p.nome}: ${p.quantidade}`);
      total.set(p.nome, (total.get(p.nome) || 0) + p.quantidade);
    }
    linhas.push(LINHA, "");
  }

  linhas.push(DUPLA, `TOTAL A SEPARAR (${ordenados.length} prova${ordenados.length > 1 ? "s" : ""})`, DUPLA);
  if (total.size === 0) linhas.push("(nenhum item)");
  for (const [nome, q] of total) linhas.push(`- ${nome}: ${q}`);
  return linhas.join("\n") + "\n";
}
