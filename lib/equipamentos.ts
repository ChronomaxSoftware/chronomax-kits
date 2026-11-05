/**
 * Regras do inventário de equipamentos por patrimônio (sem acesso ao banco —
 * testável isoladamente). As operações no banco ficam em lib/equipamentos-db.ts.
 */

export const TIPOS_EQUIPAMENTO = ["Celular", "Tablet", "Notebook", "Roteador", "Totem"] as const;
export type TipoEquipamento = (typeof TIPOS_EQUIPAMENTO)[number];

/** disponivel → alocado (separado p/ prova) → em_campo (saiu) → retorno → disponivel | manutencao */
export type StatusEquipamento = "disponivel" | "alocado" | "em_campo" | "manutencao";

/** Tipos que costumam ter chip de operadora. */
export const TIPOS_COM_CHIP: readonly string[] = ["Celular", "Roteador"];

export const OPERADORAS = ["Vivo", "Claro", "TIM", "Outra"] as const;

export function labelStatusEquipamento(s: string): string {
  if (s === "disponivel") return "Disponível";
  if (s === "alocado") return "Separado";
  if (s === "em_campo") return "Em campo";
  if (s === "manutencao") return "Manutenção";
  return s;
}

/** Patrimônio canônico: sem espaços nas pontas, espaços internos colapsados, maiúsculas. */
export function normalizarPatrimonio(p: unknown): string {
  return String(p ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function textoOuNull(v: unknown, max = 200): string | null {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}

/** Converte para id inteiro positivo; vazio/0/inválido → null. */
export function idOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export type DadosCadastrais = {
  tipo: TipoEquipamento;
  patrimonio: string;
  numero_chip: string | null;
  operadora: string | null;
  numero_serie: string | null;
  base_id: number | null;
  status: "disponivel" | "manutencao";
  observacao: string | null;
};

export type ResultadoValidacao<T> = { ok: true; dados: T } | { ok: false; erro: string };

/**
 * Valida os dados cadastrais de um equipamento (não trata alocação — isso tem
 * regras próprias de concorrência). `status` só aceita disponivel/manutencao:
 * "alocado" é consequência de ter prova, nunca escolhido à mão.
 */
export function validarCadastro(body: Record<string, unknown>): ResultadoValidacao<DadosCadastrais> {
  const tipo = String(body.tipo ?? "").trim();
  if (!(TIPOS_EQUIPAMENTO as readonly string[]).includes(tipo)) {
    return { ok: false, erro: "Tipo de equipamento inválido" };
  }
  const patrimonio = normalizarPatrimonio(body.patrimonio);
  if (!patrimonio) return { ok: false, erro: "Número de patrimônio obrigatório" };
  if (patrimonio.length > 60) return { ok: false, erro: "Patrimônio muito longo (máx. 60 caracteres)" };

  const statusRaw = String(body.status ?? "disponivel");
  if (!["disponivel", "manutencao", "alocado", "em_campo"].includes(statusRaw)) {
    return { ok: false, erro: "Status inválido" };
  }
  const status = statusRaw === "manutencao" ? "manutencao" : "disponivel";

  const baseRaw = body.base_id;
  const base_id = idOuNull(baseRaw);
  if (baseRaw !== undefined && baseRaw !== null && baseRaw !== "" && base_id === null) {
    return { ok: false, erro: "Base inválida" };
  }

  const comChip = TIPOS_COM_CHIP.includes(tipo);
  return {
    ok: true,
    dados: {
      tipo: tipo as TipoEquipamento,
      patrimonio,
      numero_chip: comChip ? textoOuNull(body.numero_chip, 30) : null,
      operadora: comChip ? textoOuNull(body.operadora, 30) : null,
      numero_serie: textoOuNull(body.numero_serie, 60),
      base_id,
      status,
      observacao: textoOuNull(body.observacao, 500),
    },
  };
}

/** Lista de ids para alocação em lote: aceita `equipamento_ids` (array) ou `equipamento_id`. */
export function lerIdsLote(body: Record<string, unknown>): number[] | null {
  const bruto = Array.isArray(body.equipamento_ids) ? body.equipamento_ids : [body.equipamento_id];
  const ids = bruto.map(idOuNull);
  if (ids.length === 0 || ids.length > 500 || ids.some((i) => i === null)) return null;
  return [...new Set(ids as number[])];
}

/**
 * Produto do evento (card "Produtos", por quantidade) → tipo do inventário, pra comparar
 * "pedido x separado". Ex.: "Celular" → Celular, "Roteador 4G" → Roteador. Sem par → null.
 */
export function tipoDeProduto(nomeProduto: string | null | undefined): TipoEquipamento | null {
  const n = String(nomeProduto ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (/\bcelular(es)?\b/.test(n)) return "Celular";
  if (/\broteador(es)?\b/.test(n)) return "Roteador";
  if (/\bnotebook(s)?\b/.test(n)) return "Notebook";
  if (/\btablet(s)?\b/.test(n)) return "Tablet";
  if (/\btotem(s)?\b/.test(n)) return "Totem";
  return null;
}

export type ResultadoRetorno = "ok" | "defeito";

/** Itens da conferência de retorno: [{ id, resultado: "ok"|"defeito", observacao? }]. */
export function lerItensRetorno(
  body: Record<string, unknown>
): { id: number; resultado: ResultadoRetorno; observacao: string | null }[] | null {
  if (!Array.isArray(body.itens) || body.itens.length === 0 || body.itens.length > 500) return null;
  const out: { id: number; resultado: ResultadoRetorno; observacao: string | null }[] = [];
  const vistos = new Set<number>();
  for (const raw of body.itens as Record<string, unknown>[]) {
    const id = idOuNull(raw?.id);
    const resultado = raw?.resultado;
    if (!id || (resultado !== "ok" && resultado !== "defeito")) return null;
    if (vistos.has(id)) continue;
    vistos.add(id);
    out.push({ id, resultado, observacao: textoOuNull(raw.observacao, 500) });
  }
  return out;
}

/** Mensagem amigável para violação do índice único de patrimônio. */
export function ehErroPatrimonioDuplicado(err: unknown): boolean {
  const s = String(err instanceof Error ? err.message : err);
  return s.includes("UNIQUE") && s.includes("patrimonio");
}

// ── Chip do aparelho ──

export type InfoChip = {
  /** null = tipo que não usa chip (tablet, notebook, totem) */
  temChip: boolean | null;
  /** "Vivo · (11) 93066-0118", "Vivo (número não cadastrado)", "Sem chip" ou "" */
  rotulo: string;
};

/** "11930660118" → "(11) 93066-0118"; outro formato fica como veio. */
export function formatarNumeroChip(n: string | null | undefined): string {
  const s = String(n ?? "").trim();
  const d = s.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s;
}

/** Tem chip = tem operadora ou número cadastrado (só celular/roteador). */
export function infoChip(e: { tipo: string; numero_chip?: string | null; operadora?: string | null }): InfoChip {
  if (!TIPOS_COM_CHIP.includes(e.tipo)) return { temChip: null, rotulo: "" };
  const numero = formatarNumeroChip(e.numero_chip);
  const operadora = String(e.operadora ?? "").trim();
  if (!numero && !operadora) return { temChip: false, rotulo: "Sem chip" };
  if (!numero) return { temChip: true, rotulo: `${operadora} (número não cadastrado)` };
  return { temChip: true, rotulo: operadora ? `${operadora} · ${numero}` : numero };
}

export type ResumoChips = {
  celulares: number;
  comChip: number;
  semChip: number;
  /** com chip separados para prova ou em campo */
  emUso: number;
  /** com chip disponíveis no estoque */
  livres: number;
  /** com chip em manutenção */
  manutencao: number;
};

/** Controle dos chips dos celulares do inventário. */
export function resumoChips(
  lista: { tipo: string; status: string; numero_chip?: string | null; operadora?: string | null }[]
): ResumoChips {
  const cel = lista.filter((e) => e.tipo === "Celular");
  const com = cel.filter((e) => infoChip(e).temChip);
  return {
    celulares: cel.length,
    comChip: com.length,
    semChip: cel.length - com.length,
    emUso: com.filter((e) => e.status === "alocado" || e.status === "em_campo").length,
    livres: com.filter((e) => e.status === "disponivel").length,
    manutencao: com.filter((e) => e.status === "manutencao").length,
  };
}

/**
 * Patrimônios de cada linha de produto da prova (Celular → celulares separados…):
 * `porProduto` por nome do produto, `sobra` = patrimônio sem linha do mesmo tipo.
 */
export function patrimoniosPorProduto<P extends { nome: string }, E extends { tipo: string }>(
  produtos: P[],
  equipamentos: E[]
): { porProduto: Map<string, E[]>; sobra: E[] } {
  const porProduto = new Map<string, E[]>();
  const usados = new Set<E>();
  for (const p of produtos) {
    const tipo = tipoDeProduto(p.nome);
    if (!tipo || porProduto.has(p.nome)) continue;
    // um tipo vai para a 1ª linha dele (ex.: "Celular" e "Celular reserva" → a primeira)
    const lista = equipamentos.filter((e) => e.tipo === tipo && !usados.has(e));
    lista.forEach((e) => usados.add(e));
    porProduto.set(p.nome, lista);
  }
  return { porProduto, sobra: equipamentos.filter((e) => !usados.has(e)) };
}
