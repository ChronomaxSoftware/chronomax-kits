/**
 * Previsão de estoque das próximas semanas: soma os Produtos das provas de cada semana
 * por base (a prova entra na base da sua UF) e compara com o estoque da base. O material
 * volta depois da prova, então cada semana é comparada com o estoque cheio.
 *
 * A base abastecedora (SP) cobre a falta das outras com a própria sobra da semana —
 * inclusive as provas de estado sem base (que não têm estoque próprio). Quando a sobra
 * não dá para todos, atende primeiro a prova mais próxima; o resto é falta real.
 * Tudo aqui é só cálculo: nada é movido no inventário.
 */

import { chaveSemana, fimSemana, formatBR, inicioSemana, parseDataBR } from "./semana";

export const SEMANAS_PREVISAO = 6;
export const UF_ABASTECEDORA = "SP";

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

/** abastecido = faltava na base, mas a base abastecedora cobre tudo */
export type Situacao = "falta" | "abastecido" | "limite" | "sobra" | "vazio";

export type ProvaPedido = { id: number; numero: string; nome: string; data: string; quantidade: number };

export type Celula = {
  pedido: number;
  /** estoque próprio − pedido (negativo = faltaria sem ajuda) */
  saldo: number;
  situacao: Situacao;
  provas: ProvaPedido[];
  /** quanto vem da base abastecedora */
  doAbastecedor: number;
  /** o que nem a abastecedora cobre (precisa comprar/alugar/ajustar) */
  faltaReal: number;
  /** Na falta real: outras bases com sobra (sugestão) */
  cobertura: { base: string; sobra: number }[];
};

export type LinhaPrevisao = {
  produto_id: number;
  nome: string;
  estoque: number;
  celulas: Celula[];
  /** só na abastecedora: quanto sai para outras bases em cada semana */
  enviado?: number[];
};

export type BlocoPrevisao = {
  chave: string;
  titulo: string;
  semBase: boolean;
  abastecedor: boolean;
  linhas: LinhaPrevisao[];
};

export type SemanaPrevisao = { chave: string; inicio: string; fim: string; rotulo: string };

export type FaltaPrevisao = { semana: string; bloco: string; produto: string; falta: number; pedido: number; estoque: number };

export type EnvioPlano = { produto: string; para: string; quantidade: number };

/** "O que fazer" de cada semana */
export type PlanoSemana = {
  semana: string;
  envios: EnvioPlano[];
  faltas: { produto: string; bloco: string; falta: number }[];
  /** sobra da abastecedora depois dos envios, por produto enviado/pedido */
  sobraAbastecedor: { produto: string; sobra: number }[];
};

export type Previsao = {
  semanas: SemanaPrevisao[];
  blocos: BlocoPrevisao[];
  faltas: FaltaPrevisao[];
  plano: PlanoSemana[];
  /** "São Paulo/SP" (null = nenhuma base na UF abastecedora) */
  abastecedor: string | null;
};

export function situacaoDe(pedido: number, estoque: number): Situacao {
  if (pedido <= 0) return "vazio";
  if (pedido > estoque) return "falta";
  if (pedido === estoque) return "limite";
  return "sobra";
}

const ddmm = (d: Date) => formatBR(d).slice(0, 5);
const dataNum = (s: string) => parseDataBR(s)?.getTime() ?? Infinity;
const SEM_BASE = "Sem base (prova em estado sem base)";

export function calcularPrevisao(
  bases: BaseEstoque[],
  eventos: EventoPrevisao[],
  hoje: Date = new Date(),
  qtdSemanas: number = SEMANAS_PREVISAO,
  ufAbastecedora: string | null = UF_ABASTECEDORA
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
  const abast = ufAbastecedora ? basePorUf.get(ufAbastecedora.toUpperCase()) ?? null : null;
  const chaveBloco = (uf: string | null) => {
    const b = basePorUf.get(String(uf || "").trim().toUpperCase());
    return b ? `base:${b.id}` : "sem_base";
  };

  // pedido[bloco][produto][semana] = provas
  const pedidos = new Map<string, Map<number, { nome: string; porSemana: ProvaPedido[][] }>>();
  const nomeProduto = new Map<number, string>();
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
      nomeProduto.set(p.produto_id, p.nome);
      if (!porProduto.has(p.produto_id)) porProduto.set(p.produto_id, { nome: p.nome, porSemana: semanas.map(() => []) });
      porProduto.get(p.produto_id)!.porSemana[i].push({ id: ev.id, numero: ev.numero, nome: ev.nome, data: ev.data, quantidade: q });
    }
  }

  const estoqueBase = (b: BaseEstoque, produtoId: number) =>
    b.estoque.filter((e) => e.produto_id === produtoId).reduce((s, e) => s + (Number(e.quantidade) || 0), 0);
  const estoqueTotal = (produtoId: number) => bases.reduce((s, b) => s + estoqueBase(b, produtoId), 0);
  const nomeBloco = (b: BaseEstoque | null) => (b ? `${b.nome}/${b.uf}` : SEM_BASE);

  const ordem = [
    ...bases.map((b) => ({ chave: `base:${b.id}`, base: b as BaseEstoque | null })),
    { chave: "sem_base", base: null as BaseEstoque | null },
  ];

  // 1) cada bloco com o estoque próprio (sem base: 0 se há abastecedora; senão o total)
  const blocos: BlocoPrevisao[] = [];
  for (const o of ordem) {
    const porProduto = pedidos.get(o.chave);
    const ehAbast = !!abast && o.base?.id === abast.id;
    if (!porProduto && !ehAbast) continue;
    const linhas: LinhaPrevisao[] = [...(porProduto?.entries() ?? [])].map(([produtoId, info]) => {
      const estoque = o.base ? estoqueBase(o.base, produtoId) : abast ? 0 : estoqueTotal(produtoId);
      const celulas = info.porSemana.map((provas): Celula => {
        const pedido = provas.reduce((s, p) => s + p.quantidade, 0);
        const situacao = situacaoDe(pedido, estoque);
        return {
          pedido,
          saldo: estoque - pedido,
          situacao,
          provas: [...provas].sort((a, b) => dataNum(a.data) - dataNum(b.data)),
          doAbastecedor: 0,
          faltaReal: situacao === "falta" ? pedido - estoque : 0,
          cobertura: [],
        };
      });
      return { produto_id: produtoId, nome: info.nome, estoque, celulas };
    });
    blocos.push({ chave: o.chave, titulo: nomeBloco(o.base), semBase: !o.base, abastecedor: ehAbast, linhas });
  }

  const blocoAbast = blocos.find((b) => b.abastecedor) ?? null;
  const linhaAbast = (produtoId: number): LinhaPrevisao => {
    let l = blocoAbast!.linhas.find((x) => x.produto_id === produtoId);
    if (!l) {
      // produto que SP não pede, mas envia: linha só com o "enviado"
      const estoque = estoqueBase(abast!, produtoId);
      l = {
        produto_id: produtoId,
        nome: nomeProduto.get(produtoId) ?? `Produto ${produtoId}`,
        estoque,
        celulas: semanas.map(() => ({ pedido: 0, saldo: estoque, situacao: "vazio", provas: [], doAbastecedor: 0, faltaReal: 0, cobertura: [] })),
      };
      blocoAbast!.linhas.push(l);
    }
    l.enviado ??= semanas.map(() => 0);
    return l;
  };

  // 2) a abastecedora cobre as faltas das outras, prova mais próxima primeiro
  const plano: PlanoSemana[] = semanas.map((s) => ({ semana: s.rotulo, envios: [], faltas: [], sobraAbastecedor: [] }));
  if (blocoAbast) {
    for (let i = 0; i < semanas.length; i++) {
      const pedidosFalta = blocos
        .filter((b) => !b.abastecedor)
        .flatMap((b) => b.linhas.map((l) => ({ b, l, c: l.celulas[i] })))
        .filter((x) => x.c.situacao === "falta")
        .sort((a, b) => dataNum(a.c.provas[0]?.data ?? "") - dataNum(b.c.provas[0]?.data ?? ""));
      const sobra = new Map<number, number>();
      const sobraDe = (produtoId: number) => {
        if (!sobra.has(produtoId)) {
          const l = blocoAbast.linhas.find((x) => x.produto_id === produtoId);
          sobra.set(produtoId, estoqueBase(abast!, produtoId) - (l?.celulas[i].pedido ?? 0));
        }
        return sobra.get(produtoId)!;
      };
      for (const { b, l, c } of pedidosFalta) {
        const precisa = c.faltaReal;
        const envia = Math.min(precisa, Math.max(0, sobraDe(l.produto_id)));
        if (envia <= 0) continue;
        sobra.set(l.produto_id, sobraDe(l.produto_id) - envia);
        c.doAbastecedor = envia;
        c.faltaReal = precisa - envia;
        if (c.faltaReal === 0) c.situacao = "abastecido";
        linhaAbast(l.produto_id).enviado![i] += envia;
        plano[i].envios.push({ produto: l.nome, para: b.titulo, quantidade: envia });
      }
      plano[i].sobraAbastecedor = [...sobra.entries()]
        .map(([produtoId, s]) => ({ produto: nomeProduto.get(produtoId) ?? String(produtoId), sobra: s }))
        .sort((a, b) => a.produto.localeCompare(b.produto, "pt-BR"));
    }
  }

  // 3) faltas reais + sugestão de outra base com sobra
  const pedidoNa = (chave: string, produtoId: number, i: number) =>
    (blocos.find((b) => b.chave === chave)?.linhas.find((l) => l.produto_id === produtoId)?.celulas[i].pedido ?? 0) +
    (blocos.find((b) => b.chave === chave)?.linhas.find((l) => l.produto_id === produtoId)?.enviado?.[i] ?? 0);
  const faltas: FaltaPrevisao[] = [];
  for (const b of blocos) {
    for (const l of b.linhas) {
      l.celulas.forEach((c, i) => {
        if (c.faltaReal <= 0) return;
        const minhaBase = bases.find((x) => `base:${x.id}` === b.chave);
        // sem base e sem abastecedora já comparou com o total: não há de onde tirar
        c.cobertura = b.semBase && !abast ? [] : bases
          .filter((x) => x.id !== minhaBase?.id)
          .map((x) => ({ base: nomeBloco(x), sobra: estoqueBase(x, l.produto_id) - pedidoNa(`base:${x.id}`, l.produto_id, i) }))
          .filter((x) => x.sobra > 0)
          .sort((a, z) => z.sobra - a.sobra);
        faltas.push({ semana: semanas[i].rotulo, bloco: b.titulo, produto: l.nome, falta: c.faltaReal, pedido: c.pedido, estoque: l.estoque });
        plano[i].faltas.push({ produto: l.nome, bloco: b.titulo, falta: c.faltaReal });
      });
    }
    b.linhas.sort((a, z) => a.nome.localeCompare(z.nome, "pt-BR"));
  }

  return {
    semanas,
    blocos: blocos.filter((b) => b.linhas.length > 0),
    faltas,
    plano,
    abastecedor: abast ? nomeBloco(abast) : null,
  };
}
