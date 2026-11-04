/**
 * Aba Envios: provas em que alguém (ex.: o ajudante do Rio) manda o material e os
 * números para o técnico. O escritório inclui a prova pelo card "📦 Envio" da prova e
 * define a data de envio; quem envia marca ✅ Material enviado e ✅ Números enviados.
 * Fica em envio_status (a linha existir = a prova está na lista; o sync não mexe).
 */

import { inicioDoDia, parseDataBR } from "./semana";

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const OBS_ENVIO_MAX = 500;
export const ENDERECO_MAX = 300;

/** Os dois "ok" da aba. */
export type EtapaEnvio = "material" | "numeros";

export function ehEtapaEnvio(x: unknown): x is EtapaEnvio {
  return x === "material" || x === "numeros";
}

export type SituacaoEnvio = "pendente" | "parcial" | "enviado";

export function situacaoEnvio(s: { material_em: string | null; numeros_em: string | null }): SituacaoEnvio {
  if (s.material_em && s.numeros_em) return "enviado";
  if (s.material_em || s.numeros_em) return "parcial";
  return "pendente";
}

/**
 * Data de envio vinda do formulário (input date = AAAA-MM-DD). Vazio → null (sem data);
 * inválida → undefined (o chamador responde erro).
 */
export function normalizarDataEnvio(x: unknown): string | null | undefined {
  if (x === null || x === undefined) return null;
  const s = String(x).trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return undefined;
  return s;
}

/** AAAA-MM-DD → Date local (meia-noite); null se vazio/inválido. */
export function dataEnvioParaDate(s: string | null | undefined): Date | null {
  const n = normalizarDataEnvio(s);
  if (!n) return null;
  const [a, m, d] = n.split("-").map(Number);
  return new Date(a, m - 1, d);
}

/** "2026-11-05" → "05/11" (ou "05/01/2027" se não for o ano de referência). */
export function rotuloDataEnvio(s: string | null | undefined, ref: Date = new Date()): string {
  const d = dataEnvioParaDate(s);
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return d.getFullYear() === ref.getFullYear() ? `${dd}/${mm}` : `${dd}/${mm}/${d.getFullYear()}`;
}

/** Endereço que vale para a entrega: o desta prova ou, em branco, o do cadastro do técnico. */
export function enderecoEntrega(daProva: string | null | undefined, doTecnico: string | null | undefined): string | null {
  return String(daProva || "").trim() || String(doTecnico || "").trim() || null;
}

/** Link do Google Maps para o endereço (null sem endereço). */
export function linkMapa(endereco: string | null | undefined): string | null {
  const e = String(endereco || "").trim();
  return e ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e)}` : null;
}

// ── Agrupamento da aba (pela data de envio) ──

export type EnvioBase = {
  id: number;
  nome: string;
  numero: string;
  data: string | null;
  data_envio: string | null;
  material_em: string | null;
  numeros_em: string | null;
};

export type GruposEnvio<T> = {
  /** Data de envio já passou e ainda falta enviar algo. */
  atrasadas: T[];
  /** De hoje em diante, por dia de envio (mais perto primeiro). */
  dias: { chave: string; dia: Date; provas: T[] }[];
  /** Incluídas na lista mas ainda sem data de envio. */
  semData: T[];
  /** Tudo enviado e a data de envio já passou (mais recente primeiro). */
  enviadas: T[];
};

function ordemProva(a: EnvioBase, b: EnvioBase): number {
  return (parseDataBR(a.data)?.getTime() ?? Infinity) - (parseDataBR(b.data)?.getTime() ?? Infinity);
}

/** Filtra (pendentes = falta material ou números; busca no nome/número) e agrupa. */
export function agruparEnvios<T extends EnvioBase>(
  provas: T[],
  opts: { hoje: Date; soPendentes: boolean; busca: string }
): GruposEnvio<T> {
  const q = sem(opts.busca.trim());
  const hoje = inicioDoDia(opts.hoje).getTime();
  const grupos: GruposEnvio<T> = { atrasadas: [], dias: [], semData: [], enviadas: [] };

  for (const p of provas) {
    const completo = situacaoEnvio(p) === "enviado";
    if (opts.soPendentes && completo) continue;
    if (q && !sem(p.nome || "").includes(q) && !String(p.numero || "").includes(q)) continue;
    const d = dataEnvioParaDate(p.data_envio);
    if (!d) grupos.semData.push(p);
    else if (d.getTime() < hoje) (completo ? grupos.enviadas : grupos.atrasadas).push(p);
    else {
      const chave = p.data_envio!;
      let g = grupos.dias.find((x) => x.chave === chave);
      if (!g) grupos.dias.push((g = { chave, dia: d, provas: [] }));
      g.provas.push(p);
    }
  }

  grupos.dias.sort((a, b) => a.dia.getTime() - b.dia.getTime());
  for (const g of grupos.dias) g.provas.sort(ordemProva);
  grupos.atrasadas.sort((a, b) => String(a.data_envio).localeCompare(String(b.data_envio)));
  grupos.semData.sort(ordemProva);
  grupos.enviadas.sort((a, b) => String(b.data_envio).localeCompare(String(a.data_envio)));
  return grupos;
}

// ── Material para entregar ao técnico ──

/** Quantidades do card "📘 Book — Equipamentos" da prova (eventos.qtd_*). */
export type QtdBook = {
  qtd_roteadores?: number | null;
  qtd_celulares?: number | null;
  qtd_celulares_grupo_online?: number | null;
  qtd_celulares_produtos_online?: number | null;
  qtd_totens?: number | null;
  qtd_notebooks?: number | null;
};

const ROTULO_BOOK: [keyof QtdBook, string][] = [
  ["qtd_celulares", "Celulares (número)"],
  ["qtd_celulares_grupo_online", "Celular grupo online"],
  ["qtd_celulares_produtos_online", "Celulares produtos online"],
  ["qtd_roteadores", "Roteadores"],
  ["qtd_totens", "Totens"],
  ["qtd_notebooks", "Notebooks"],
];

/** Itens do book com quantidade > 0, na ordem do card. */
export function itensBook(q: QtdBook): { nome: string; quantidade: number }[] {
  return ROTULO_BOOK.map(([k, nome]) => ({ nome, quantidade: Math.max(0, Math.floor(Number(q[k]) || 0)) })).filter(
    (x) => x.quantidade > 0
  );
}

/** Já tem material separado no escritório (produtos com quantidade ou patrimônios)? */
export function materialSeparado(m: { produtos: { quantidade: number }[]; equipamentos: unknown[] }): boolean {
  return m.produtos.some((p) => Number(p.quantidade) > 0) || m.equipamentos.length > 0;
}
