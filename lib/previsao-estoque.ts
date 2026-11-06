/**
 * Previsão de estoque das próximas semanas: soma os Produtos das provas de cada semana
 * por base (a prova entra na base da sua UF) e compara com o estoque da base. O material
 * volta depois da prova, então cada semana é comparada com o estoque cheio.
 * Prova de estado sem base → bloco "Sem base", comparado com o total de todas as bases.
 */

import { chaveSemana, fimSemana, formatBR, inicioSemana, parseDataBR } from "./semana";

export const SEMANAS_PREVISAO = 6;

export type BaseEstoque = {
  id: number;
  nome: string;
  uf: string;
  estoque: { produto_id: number; produto_nome: string; quantidade: number }[];
};

export type EventoPrevisao = {
  id: number;
  numero: string;
  nome: string;
  data: string;
  uf: string | null;
  produtos: { produto_id: number; nome: string; quantidade: number }[];
};

export type Situacao = "falta" | "limite" | "sobra" | "vazio";

export type ProvaPedido = { id: number; numero: string; nome: string; data: string; quantidade: number };

export type Celula = {
  pedido: number;
  /** estoque − pedido (negativo = falta) */
  saldo: number;
  situacao: Situacao;
  provas: ProvaPedido[];
  /** Na falta: outras bases com sobra desse produto na mesma semana */
  cobertura: { base: string; sobra: number }[];
};

export type LinhaPrevisao = { produto_id: number; nome: string; estoque: number; celulas: Celula[] };

export type BlocoPrevisao = { chave: string; titulo: string; semBase: boolean; linhas: LinhaPrevisao[] };

export type SemanaPrevisao = { chave: string; inicio: string; fim: string; rotulo: string };

export type FaltaPrevisao = { semana: string; bloco: string; produto: string; falta: number; pedido: number; estoque: number };

export type Previsao = { semanas: SemanaPrevisao[]; blocos: BlocoPrevisao[]; faltas: FaltaPrevisao[] };

export function situacaoDe(pedido: number, estoque: number): Situacao {
  if (pedido <= 0) return "vazio";
  if (pedido > estoque) return "falta";
  if (pedido === estoque) return "limite";
  return "sobra";
}

const ddmm = (d: Date) => formatBR(d).slice(0, 5);

export function calcularPrevisao(
  bases: BaseEstoque[],
  eventos: EventoPrevisao[],
  hoje: Date = new Date(),
  qtdSemanas: number = SEMANAS_PREVISAO
): Previsao {
  const semanas: SemanaPrevisao[] = [];
  const primeira = inicioSemana(hoje);
  for (let i = 0; i < qtdSemanas; i++) {
    const ini = new Date(primeira);
    ini.setDate(ini.getDate() + i * 7);
    semanas.push({ chave: chaveSemana(ini), inicio: formatBR(ini), fim: formatBR(fimSemana(ini)), rotulo: `${ddmm(ini)}–${ddmm(fimSemana(ini))}` });
  }
  const idxSemana = new Map(semanas.map((s, i) => [s.chave, i]));

  const basePorUf = new Map(bases.map((b) => [b.uf.trim().toUpperCase(), b]));
  const chaveBloco = (uf: string | null) => {
    const b = basePorUf.get(String(uf || "").trim().toUpperCase());
    return b ? `base:${b.id}` : "sem_base";
  };

  // pedido[bloco][produto][semana] = provas
  const pedidos = new Map<string, Map<number, { nome: string; porSemana: ProvaPedido[][] }>>();
  for (const ev of eventos) {
    const d = parseDataBR(ev.data);
    if (!d) continue;
    const i = idxSemana.get(chaveSemana(d));
    if (i === undefined) continue;
    const bloco = chaveBloco(ev.uf);
    if (!pedidos.has(bloco)) pedidos.set(bloco, new Map());
    const porProduto = pedidos.get(bloco)!;
    for (const p of ev.produtos) {
      const q = Number(p.quantidade) || 0;
      if (q <= 0) continue;
      if (!porProduto.has(p.produto_id)) porProduto.set(p.produto_id, { nome: p.nome, porSemana: semanas.map(() => []) });
      porProduto.get(p.produto_id)!.porSemana[i].push({ id: ev.id, numero: ev.numero, nome: ev.nome, data: ev.data, quantidade: q });
    }
  }

  const estoqueBase = (b: BaseEstoque, produtoId: number) =>
    b.estoque.filter((e) => e.produto_id === produtoId).reduce((s, e) => s + (Number(e.quantidade) || 0), 0);
  const estoqueTotal = (produtoId: number) => bases.reduce((s, b) => s + estoqueBase(b, produtoId), 0);
  const pedidoNa = (bloco: string, produtoId: number, i: number) =>
    (pedidos.get(bloco)?.get(produtoId)?.porSemana[i] ?? []).reduce((s, p) => s + p.quantidade, 0);

  const ordem = [...bases.map((b) => ({ chave: `base:${b.id}`, titulo: `${b.nome}/${b.uf}`, base: b as BaseEstoque | null })), { chave: "sem_base", titulo: "Sem base (prova em estado sem base)", base: null }];

  const blocos: BlocoPrevisao[] = [];
  const faltas: FaltaPrevisao[] = [];
  for (const o of ordem) {
    const porProduto = pedidos.get(o.chave);
    if (!porProduto) continue;
    const linhas: LinhaPrevisao[] = [...porProduto.entries()]
      .map(([produtoId, info]) => {
        const estoque = o.base ? estoqueBase(o.base, produtoId) : estoqueTotal(produtoId);
        const celulas = info.porSemana.map((provas, i): Celula => {
          const pedido = provas.reduce((s, p) => s + p.quantidade, 0);
          const situacao = situacaoDe(pedido, estoque);
          const cobertura =
            situacao === "falta" && o.base
              ? bases
                  .filter((b) => b.id !== o.base!.id)
                  .map((b) => ({ base: `${b.nome}/${b.uf}`, sobra: estoqueBase(b, produtoId) - pedidoNa(`base:${b.id}`, produtoId, i) }))
                  .filter((c) => c.sobra > 0)
                  .sort((a, b) => b.sobra - a.sobra)
              : [];
          if (situacao === "falta") {
            faltas.push({ semana: semanas[i].rotulo, bloco: o.titulo, produto: info.nome, falta: pedido - estoque, pedido, estoque });
          }
          return { pedido, saldo: estoque - pedido, situacao, provas: [...provas].sort((a, b) => (parseDataBR(a.data)?.getTime() ?? 0) - (parseDataBR(b.data)?.getTime() ?? 0)), cobertura };
        });
        return { produto_id: produtoId, nome: info.nome, estoque, celulas };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    blocos.push({ chave: o.chave, titulo: o.titulo, semBase: !o.base, linhas });
  }
  return { semanas, blocos, faltas };
}
