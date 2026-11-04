/**
 * "Datas e horários" da retirada de kit (eventos.datas_horarios_retirada): uma linha por dia
 * no formato "06/11/2026 das 12h00 às 21h00". A equipe chega HORAS_ANTES antes da abertura
 * no primeiro dia.
 */

export const HORAS_ANTES_CHEGADA = 2;

/** Dia de retirada: data ISO (AAAA-MM-DD) e horas "HH:MM" (como o input type=time). */
export type DiaRetirada = { data: string; inicio: string; fim: string };
/** Linha que não está no formato (fica como texto, não se perde). */
export type LinhaRetirada = DiaRetirada | { texto: string };

export const ehDia = (l: LinhaRetirada): l is DiaRetirada => "data" in l;

const pad = (n: number) => String(n).padStart(2, "0");

/** "12:00" → "12h00" */
export function rotuloHora(h: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(h.trim());
  return m ? `${pad(Number(m[1]))}h${m[2]}` : h;
}

/** "2026-11-06" → "06/11/2026" */
export function rotuloData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Um dia → "06/11/2026 das 12h00 às 21h00" (sem fim → "a partir das 12h00"). */
export function formatarDia(d: DiaRetirada): string {
  const data = rotuloData(d.data);
  if (d.inicio && d.fim) return `${data} das ${rotuloHora(d.inicio)} às ${rotuloHora(d.fim)}`;
  if (d.inicio) return `${data} a partir das ${rotuloHora(d.inicio)}`;
  return data;
}

/** Linhas → texto salvo no banco (uma por linha; dias sem data são ignorados). */
export function formatarLinhas(linhas: LinhaRetirada[]): string {
  return linhas
    .map((l) => (ehDia(l) ? (l.data ? formatarDia(l) : "") : l.texto.trim()))
    .filter(Boolean)
    .join("\n");
}

/** "12h", "12h00", "12:00", "9h30" → "12:00"; inválida → null. */
function lerHora(s: string | undefined): string | null {
  if (!s) return null;
  const m = /^(\d{1,2})(?:[h:](\d{2})?)?$/i.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

/**
 * Lê uma linha: "06/11/2026 das 12h00 às 21h00", "06/11 das 12h às 21h", "06/11/26 12:00 - 21:00".
 * Sem ano → `anoPadrao`. O que não casar volta como { texto }.
 */
export function lerLinha(linha: string, anoPadrao: number = new Date().getFullYear()): LinhaRetirada {
  const s = linha.trim();
  const m =
    /^(?:[a-zà-ú\-.,]+\s*,?\s*)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b[^\d]*?(\d{1,2}(?:[h:]\d{0,2})?)?\s*(?:h)?\s*(?:às|as|a|até|-|–)?\s*(\d{1,2}(?:[h:]\d{0,2})?)?\s*h?\s*$/i.exec(
      s
    );
  if (!m) return { texto: s };
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  let ano = m[3] ? Number(m[3]) : anoPadrao;
  if (ano < 100) ano += 2000;
  const dt = new Date(ano, mes - 1, dia);
  if (dt.getMonth() !== mes - 1 || dt.getDate() !== dia) return { texto: s };
  const inicio = lerHora(m[4]);
  const fim = lerHora(m[5]);
  if ((m[4] && !inicio) || (m[5] && !fim)) return { texto: s };
  return { data: `${ano}-${pad(mes)}-${pad(dia)}`, inicio: inicio ?? "", fim: fim ?? "" };
}

export function lerLinhas(texto: string | null | undefined, anoPadrao?: number): LinhaRetirada[] {
  return String(texto || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^datas?\s+e\s+hor[aá]rios?:?$/i.test(l)) // título colado junto
    .map((l) => lerLinha(l, anoPadrao));
}

/**
 * Texto colado (WhatsApp, e-mail, Gestão) → linhas de dias. Tira o título "Datas e horários:",
 * separa vários dias que vieram na mesma linha e normaliza para o formato do book.
 */
export function converterTextoColado(texto: string, anoPadrao?: number): LinhaRetirada[] {
  const limpo = String(texto || "")
    .replace(/\r/g, "")
    .replace(/datas?\s+e\s+hor[aá]rios?\s*:?/gi, "\n")
    // cada data (dd/mm ou dd/mm/aaaa) começa um dia novo
    .replace(/\s+(?=\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b)/g, "\n");
  return lerLinhas(limpo, anoPadrao).map((l) => (ehDia(l) ? l : { texto: l.texto.replace(/\s+/g, " ") }));
}

export type Chegada = { data: string; dataRotulo: string; abertura: string; chegada: string; horasAntes: number };

/** Chegada da equipe no 1º dia (o mais cedo com hora de início): abertura − horasAntes. */
export function chegadaPrimeiroDia(
  texto: string | null | undefined,
  horasAntes: number = HORAS_ANTES_CHEGADA,
  anoPadrao?: number
): Chegada | null {
  const dias = lerLinhas(texto, anoPadrao)
    .filter(ehDia)
    .filter((d) => d.inicio)
    .sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
  const d = dias[0];
  if (!d) return null;
  const [h, m] = d.inicio.split(":").map(Number);
  const total = Math.max(0, h * 60 + m - horasAntes * 60);
  const chegada = `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
  return {
    data: d.data,
    dataRotulo: rotuloData(d.data),
    abertura: rotuloHora(d.inicio),
    chegada: rotuloHora(chegada),
    horasAntes,
  };
}

/** "⏰ Chegada da equipe no 1º dia: 06/11/2026 às 10h00 (2h antes da abertura)" */
export function textoChegada(c: Chegada): string {
  return `Chegada da equipe no 1º dia: ${c.dataRotulo} às ${c.chegada} (${c.horasAntes}h antes da abertura, ${c.abertura})`;
}
