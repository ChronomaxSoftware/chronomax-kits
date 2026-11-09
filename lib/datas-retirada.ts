/**
 * "Datas e horários" da retirada de kit (eventos.datas_horarios_retirada): uma linha por dia
 * no formato "06/11/2026 das 12h00 às 21h00". A equipe chega HORAS_ANTES antes da abertura
 * no primeiro dia.
 */

export const HORAS_ANTES_CHEGADA = 2;

/**
 * Dia de retirada: data ISO (AAAA-MM-DD) e horas "HH:MM" (como o input type=time).
 * `local` = local só deste dia (entrega em locais diferentes); vazio = Local de entrega da prova.
 */
export type DiaRetirada = { data: string; inicio: string; fim: string; local?: string };

/** Separador do local na linha salva: "13/11/2026 das 10h00 às 16h00 — Agência Sicredi" */
export const SEPARADOR_LOCAL = " — ";
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

/** Um dia → "06/11/2026 das 12h00 às 21h00" (sem fim → "a partir das 12h00"), + " — local" se tiver. */
export function formatarDia(d: DiaRetirada): string {
  const data = rotuloData(d.data);
  const local = d.local?.replace(/\s+/g, " ").trim();
  const sufixo = local ? `${SEPARADOR_LOCAL}${local}` : "";
  if (d.inicio && d.fim) return `${data} das ${rotuloHora(d.inicio)} às ${rotuloHora(d.fim)}${sufixo}`;
  if (d.inicio) return `${data} a partir das ${rotuloHora(d.inicio)}${sufixo}`;
  return `${data}${sufixo}`;
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

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

/**
 * Data por extenso → dd/mm: "Quinta-feira (5 de novembro): 11h às 21h" → "5/11: 11h às 21h".
 * Tira marcador de lista ("- ", "• "), dia da semana e parênteses.
 */
export function normalizarDataExtenso(texto: string): string {
  return texto
    .replace(
      /\b(\d{1,2})\s*(?:de\s+)?(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?(?:\s*(?:de\s+)?(\d{4}))?(?![a-zà-ú])/gi,
      (_, d: string, mes: string, ano?: string) =>
        `${d}/${MESES[mes.slice(0, 3).toLowerCase().replace("ç", "c")]}${ano ? `/${ano}` : ""}`
    )
    .replace(/(?<![a-zà-ú])(?:(?:segunda|ter[çc]a|quarta|quinta|sexta)(?:[\s-]*feira)?|s[áa]bado|domingo)(?![a-zà-ú])\s*[,–—-]?\s*(?=\(?\s*\d{1,2}\/)/gi, "")
    .replace(/\(\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*\)/g, " $1 ")
    .replace(/^[ \t]*[-–•*]+[ \t]*/gm, "");
}

/**
 * Lê uma linha: "06/11/2026 das 12h00 às 21h00", "06/11 das 12h às 21h", "06/11/26 12:00 - 21:00".
 * Sem ano → `anoPadrao`. O que não casar volta como { texto }.
 */
export function lerLinha(linha: string, anoPadrao: number = new Date().getFullYear()): LinhaRetirada {
  const s = linha.trim();
  const direto = lerLinhaSemLocal(s, anoPadrao);
  if (ehDia(direto)) return direto;
  // "13/11/2026 das 10h00 às 16h00 — Agência Sicredi": o que vem depois do travessão é o local do dia
  const sep = /\s+[—–]\s+/g;
  let m: RegExpExecArray | null;
  while ((m = sep.exec(s))) {
    const local = s.slice(m.index + m[0].length).trim();
    const dia = lerLinhaSemLocal(s.slice(0, m.index), anoPadrao);
    if (ehDia(dia) && local) return { ...dia, local };
  }
  return direto;
}

function lerLinhaSemLocal(linha: string, anoPadrao: number): LinhaRetirada {
  const s = linha.trim();
  const n = normalizarDataExtenso(s).trim();
  const m =
    /^(?:[a-zà-ú\-.,]+\s*,?\s*)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b[^\d]*?(\d{1,2}(?:[h:]\d{0,2})?)?\s*(?:h)?\s*(?:às|as|a|até|-|–)?\s*(\d{1,2}(?:[h:]\d{0,2})?)?\s*h?\s*$/i.exec(
      n
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
  const data = `${ano}-${pad(mes)}-${pad(dia)}`;
  // um horário só ("a partir das 10h00") é a abertura
  if (!inicio && fim) return { data, inicio: fim, fim: "" };
  return { data, inicio: inicio ?? "", fim: fim ?? "" };
}

export function lerLinhas(texto: string | null | undefined, anoPadrao?: number): LinhaRetirada[] {
  return String(texto || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^datas?\s+e\s+hor[aá]rios?:?$/i.test(l)) // título colado junto
    .map((l) => lerLinha(l, anoPadrao));
}

/** Tira emojis (📅 ⏰ 📍 …) e marcadores de variação — atrapalham a leitura das linhas. */
function semEmojis(texto: string): string {
  return texto.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu, "");
}

/** Linha que começa o bloco do local ("📍 LOCAL: …", "Endereço: …"). */
const INICIO_LOCAL = /^\s*(?:local(?:\s+da\s+retirada)?|endere[çc]o(?:\s+da\s+retirada)?)\s*:/i;

/**
 * Texto colado → dias + o bloco do local (da linha "📍 LOCAL:" até o fim), que vai para o
 * Local de entrega da prova em vez de ficar nos Datas e horários.
 */
export function separarTextoColado(texto: string, anoPadrao?: number): { linhas: LinhaRetirada[]; local: string | null } {
  const linhas = semEmojis(String(texto || "").replace(/\r/g, "")).split("\n");
  const i = linhas.findIndex((l) => INICIO_LOCAL.test(l));
  let local: string | null = null;
  if (i >= 0) {
    const bloco = linhas
      .slice(i)
      .map((l, k) => (k === 0 ? l.replace(INICIO_LOCAL, "") : l).replace(/\s+/g, " ").trim())
      .filter(Boolean);
    local = bloco.length ? bloco.join("\n") : null;
  }
  let dias = converterTextoColado((i >= 0 ? linhas.slice(0, i) : linhas).join("\n"), anoPadrao);
  if (!local) {
    // locais por dia (texto corrido): um só → vira o Local de entrega; vários → lista "13/11: …"
    const comLocal = dias.filter(ehDia).filter((d) => d.local);
    const distintos = [...new Set(comLocal.map((d) => d.local!))];
    if (distintos.length === 1) {
      local = distintos[0];
      dias = dias.map((d) => (ehDia(d) ? { data: d.data, inicio: d.inicio, fim: d.fim } : d));
    } else if (distintos.length > 1) {
      local = comLocal.map((d) => `${rotuloData(d.data).slice(0, 5)}: ${d.local}`).join("\n");
    }
  }
  return { linhas: dias, local };
}

/** Trecho de conversa que não é local ("temos dois locais confirmados", "mesmos do ano passado"…). */
const CONVERSA =
  /\b(temos|teremos|confirmad[oa]s?|mesm[oa]s? do ano|ano passado|locais?\s+(?:de|para)\s+(?:a\s+)?entrega|segue|seguem|bom dia|boa tarde|boa noite|ol[áa])\b/i;
const DIA_SEMANA = /(?<![a-zà-ú])(?:(?:segunda|ter[çc]a|quarta|quinta|sexta)(?:[\s-]*feira)?|s[áa]bado|domingo)(?![a-zà-ú])/gi;

/** Sobra do texto de um dia → sugestão de local (o usuário confere antes de salvar). */
function limparLocal(trecho: string): string {
  return trecho
    .split(/[,;]/)
    .map((c) =>
      c
        .replace(DIA_SEMANA, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^(?:(?:e|dia|dias|no dia|em|,)\s+)+/i, "")
        .replace(/^(?:a\s+)?(?:entrega|retirada)s?(?:\s+de\s+kits?)?\s+(?:ser[áa]|vai\s+ser|acontece(?:r[áa])?|fica)\s+/i, "")
        .replace(/(?:\s+(?:e|dia|dias|no dia))+$/i, "")
        .replace(/[.:]+$/, "")
        .trim()
    )
    .filter((c) => c && !/^(?:e|dia|dias)$/i.test(c) && !CONVERSA.test(c))
    .join(", ")
    .replace(/^(?:no|na|nos|nas|em)\s+/i, "")
    .replace(/^./, (x) => x.toUpperCase());
}

const HORARIO_NO_TEXTO =
  /(?:das?\s*)?(\d{1,2}(?:[h:]\d{2})?)\s*h?\s*(?:às|as|até|a|-|–)\s*(\d{1,2}(?:[h:]\d{2})?)\s*h?|a\s+partir\s+das?\s*(\d{1,2}(?:[h:]\d{2})?)\s*h?/i;

/**
 * Mensagem em texto corrido ("…agência do Sicredi na Av Protásio Alves, 1180, dia 13/11/2026
 * das 10h às 16h e sábado dia 14/11/2026, no shopping…, das 11h às 18h."): cada data com o 1º
 * horário depois dela; o texto em volta vira a sugestão de local daquele dia.
 */
export function lerTextoCorrido(texto: string, anoPadrao: number = new Date().getFullYear()): LinhaRetirada[] {
  const t = normalizarDataExtenso(semEmojis(String(texto || "").replace(/\s+/g, " ")));
  const datas = [...t.matchAll(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?![\d/])/g)];
  const out: LinhaRetirada[] = [];
  let cursor = 0;
  datas.forEach((m, i) => {
    const ini = m.index!;
    const fimData = ini + m[0].length;
    const proxima = i + 1 < datas.length ? datas[i + 1].index! : t.length;
    const seg = t.slice(fimData, proxima);
    const h = HORARIO_NO_TEXTO.exec(seg);
    const dia = lerLinha(`${m[0]} ${h ? (h[3] ? `a partir das ${h[3]}` : `${h[1]} às ${h[2]}`) : ""}`, anoPadrao);
    if (!ehDia(dia)) return;
    const ultimo = i === datas.length - 1;
    const depois = h ? seg.slice(0, h.index) + (ultimo ? seg.slice(h.index + h[0].length) : "") : ultimo ? seg : "";
    const local = limparLocal(`${t.slice(cursor, ini)},${depois}`);
    cursor = h ? fimData + h.index + h[0].length : ultimo ? t.length : fimData;
    out.push(local ? { ...dia, local } : dia);
  });
  return out;
}

/**
 * Texto colado (WhatsApp, e-mail, Gestão) → linhas de dias. Tira o título "Datas e horários:",
 * separa vários dias que vieram na mesma linha e normaliza para o formato do book.
 */
export function converterTextoColado(texto: string, anoPadrao?: number): LinhaRetirada[] {
  const limpo = normalizarDataExtenso(semEmojis(String(texto || "").replace(/\r/g, "")))
    .replace(/datas?\s+e\s+hor[aá]rios?\s*:?/gi, "\n")
    // cada data (dd/mm ou dd/mm/aaaa) começa um dia novo
    .replace(/\s+(?=\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b)/g, "\n");
  const lidas = lerLinhas(limpo, anoPadrao).map((l) => (ehDia(l) ? l : { texto: l.texto.replace(/\s+/g, " ").trim() }));
  // horário na linha de baixo da data ("13/11" + "Das 10h às 18h") vira o horário daquele dia
  const out: LinhaRetirada[] = [];
  for (const l of lidas) {
    const ant = out[out.length - 1];
    if (!ehDia(l) && ant && ehDia(ant) && !ant.inicio) {
      const h = lerLinha(`01/01/2000 ${l.texto}`);
      if (ehDia(h) && h.inicio) {
        out[out.length - 1] = { ...ant, inicio: h.inicio, fim: h.fim };
        continue;
      }
    }
    out.push(l);
  }
  const porLinha = out.filter((l) => ehDia(l) || l.texto);
  // texto corrido (datas no meio da frase): fica com ele se achar mais dias com horário
  const comHora = (ls: LinhaRetirada[]) => ls.filter((l) => ehDia(l) && l.inicio).length;
  const corrido = lerTextoCorrido(String(texto || ""), anoPadrao);
  return comHora(corrido) > comHora(porLinha) ? corrido : porLinha;
}

/**
 * "Data da entrega" e "Hora" (eventos.data_entrega / hora_entrega) saem do 1º dia dos
 * Datas e horários: data ISO (AAAA-MM-DD, como o input date gravava) e abertura "HH:MM".
 */
export function entregaDoPrimeiroDia(
  texto: string | null | undefined,
  anoPadrao?: number
): { data_entrega: string | null; hora_entrega: string | null } {
  const d = lerLinhas(texto, anoPadrao)
    .filter(ehDia)
    .sort((a, b) => (a.data + (a.inicio || "99")).localeCompare(b.data + (b.inicio || "99")))[0];
  return { data_entrega: d?.data ?? null, hora_entrega: d?.inicio || null };
}

/**
 * Prova antiga com data/hora da entrega e sem Datas e horários: vira o 1º dia do editor
 * (ex.: "2026-11-04" + "10:00" → "04/11/2026 a partir das 10h00"). Sem data → "".
 */
export function diaDaEntregaAntiga(dataEntrega: string | null | undefined, horaEntrega: string | null | undefined): string {
  const s = String(dataEntrega || "").trim();
  let iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (br) iso = `${br[3]}-${pad(Number(br[2]))}-${pad(Number(br[1]))}`;
  if (!iso) return "";
  const hora = /^\d{1,2}:\d{2}$/.test(String(horaEntrega || "").trim()) ? String(horaEntrega).trim().padStart(5, "0") : "";
  return formatarDia({ data: iso, inicio: hora, fim: "" });
}

export type Chegada = {
  data: string;
  dataRotulo: string;
  abertura: string;
  chegada: string;
  horasAntes: number;
  /** local do 1º dia, quando cada dia tem o seu */
  local?: string;
};

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
    ...(d.local ? { local: d.local } : {}),
  };
}

/** "⏰ Chegada da equipe no 1º dia: 06/11/2026 às 10h00 (2h antes da abertura)" [+ " — 📍 local"] */
export function textoChegada(c: Chegada): string {
  return (
    `Chegada da equipe no 1º dia: ${c.dataRotulo} às ${c.chegada} (${c.horasAntes}h antes da abertura, ${c.abertura})` +
    (c.local ? ` — 📍 ${c.local}` : "")
  );
}

/** Todos os dias têm o próprio local? (aí o book não repete o endereço geral) */
export function todosOsDiasComLocal(texto: string | null | undefined): boolean {
  const dias = lerLinhas(texto).filter(ehDia);
  return dias.length > 0 && dias.every((d) => !!d.local);
}
