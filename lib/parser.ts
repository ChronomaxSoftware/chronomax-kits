import * as cheerio from "cheerio";
import { classificarKit, tipoKitDeModo } from "./kit-mode";

export type EventoExtraido = {
  numero: string | null;
  nome: string | null;
  data: string | null;
  cidade: string | null;
  uf: string | null;
  qtd_atletas: number;
  nivel: string | null;
  qtd_celulares: number;
  dias_entrega: number;
  qtd_totens: number;
  qtd_notebooks: number;
  local_prova: string | null;
  url_site_oficial: string | null;
  /**
   * Classifica o envolvimento da Chronomax na entrega de kit do evento:
   *   - 'entrega': envia equipe (algum técnico tem E.K cachê > 0)
   *   - 'sistema': só fornece sistema (item "Estação de Entrega de Kits via App GoRunKing")
   *   - null: sem kit
   */
  tipo_kit: "entrega" | "sistema" | null;
  tecnicos_gestao: {
    nome: string;
    funcao: string | null;
    cpf_prefixo: string | null;
    cache_ek: number;
    is_entrega_kit: boolean;
  }[];
  itens_brutos: { nome: string; quantidade: number; unidade: string }[];
  tem_entrega_kit: boolean;
  texto_extraido: string;
};

/**
 * Extrai o `value` de um `<input>` (qualquer atributo) que esteja DEPOIS de
 * um determinado label no HTML. Funciona pra campos onde o Gestão renderiza
 * `<label>Local da Prova</label> ... <input value="...">`.
 */
function extrairValorAposLabel(html: string, labelRegex: RegExp, janela = 800): string | null {
  const m = labelRegex.exec(html);
  if (!m) return null;
  const sub = html.slice(m.index, m.index + janela);
  const valueMatch = sub.match(/<input\b[^>]*?\bvalue="([^"]*)"/i);
  if (valueMatch && valueMatch[1].trim()) return valueMatch[1].trim();
  return null;
}

function parseValorRs(s: string): number {
  const m = s.match(/R\$\s*([\d.,]+)/);
  if (!m) return 0;
  const digitos = m[1].replace(/\D/g, "");
  return digitos ? parseInt(digitos, 10) : 0;
}

/**
 * Extrai cards de técnico da convocação (div.relative que contenha um filho
 * com texto exato "E.K"). Cada card tem: número, função (SUPORTE/APURADOR/TEC/STAFF),
 * CPF (opcional) + nome, e cards de cachê (CACHÊ BASE, E.K, ALIMENTAÇÃO, EXTRA, TOTAL).
 *
 * Retorna `null` quando o evento não tem cards (ex: "Todos os técnicos já
 * foram alocados" oculta a equipe). Nesse caso, cai no fallback de texto.
 */
function extrairCardsTecnicos(html: string): {
  nome: string;
  funcao: string | null;
  cpf_prefixo: string | null;
  cache_ek: number;
  is_entrega_kit: boolean;
}[] | null {
  if (!/<[a-z][\s\S]*>/i.test(html)) return null;
  const $ = cheerio.load(html);
  const cards = $("div.relative").filter((_, el) =>
    $(el).find("div").filter((_, d) => $(d).text().trim() === "E.K").length > 0
  );
  if (cards.length === 0) return null;

  const result: NonNullable<ReturnType<typeof extrairCardsTecnicos>> = [];
  cards.each((_, el) => {
    const card = $(el);
    const funcaoRaw = card.find("div.text-xs.font-semibold.tracking-wider").first().text().trim();
    const funcao = funcaoRaw ? funcaoRaw.toLowerCase() : null;

    // E.K: irmão do div "E.K" dentro do mesmo card de cachê
    const ekLabel = card.find("div").filter((_, d) => $(d).text().trim() === "E.K").first();
    const ekValor = parseValorRs(ekLabel.parent().find("div").first().text());

    // Nome (e CPF opcional) ficam no <h3> do card: "60.466.841 NOME" ou só "NOME"
    const h3 = card.find("h3").first().text().trim();
    if (!h3) return;
    const mCpf = h3.match(/^((?:\d{2,3}\.){2}\d{2,3})\s+(.+)$/);
    const cpf_prefixo = mCpf ? mCpf[1] : null;
    const nome = mCpf ? mCpf[2].trim() : h3;

    result.push({
      nome,
      funcao,
      cpf_prefixo,
      cache_ek: ekValor,
      is_entrega_kit: ekValor > 0,
    });
  });
  return result;
}

function txt(s: string | null | undefined) {
  return (s || "").replace(/[ \t]+/g, " ").replace(/^\s+|\s+$/gm, "").trim();
}

function extrairTexto(input: string): string {
  const trimmed = input.trim();
  const pareceHTML = /<[a-z][\s\S]*>/i.test(trimmed);
  if (!pareceHTML) {
    return trimmed.replace(/\r\n?/g, "\n");
  }

  const comQuebras = trimmed
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|tr|h[1-6]|section|article|header|footer|nav|main|aside|button|label|span|td|th)>/gi, "$&\n")
    .replace(/<(div|p|li|tr|h[1-6]|section|article|header|footer|nav|main|aside)\b/gi, "\n$&");

  const $ = cheerio.load(comQuebras);
  $("script, style, noscript, svg").remove();
  const texto = $("body").length ? $("body").text() : $.root().text();
  return texto.replace(/\r\n?/g, "\n");
}

function buscarValorAposLabel(linhas: string[], label: RegExp, maxAvante = 3): string | null {
  for (let i = 0; i < linhas.length; i++) {
    if (label.test(linhas[i])) {
      const mesma = linhas[i].replace(label, "").trim();
      if (mesma) return mesma;
      for (let j = 1; j <= maxAvante && i + j < linhas.length; j++) {
        const v = linhas[i + j].trim();
        if (v) return v;
      }
    }
  }
  return null;
}

function buscarQuantidadeApos(linhas: string[], chave: RegExp, unidade: RegExp, maxAvante = 6): number {
  for (let i = 0; i < linhas.length; i++) {
    if (chave.test(linhas[i])) {
      for (let j = i; j <= i + maxAvante && j < linhas.length; j++) {
        const m = linhas[j].match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:${unidade.source})`, "i"));
        if (m && m[1]) return parseFloat(m[1].replace(",", "."));
      }
    }
  }
  return 0;
}

export function parseEventoHTML(input: string): EventoExtraido {
  const texto = extrairTexto(input);
  const linhas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const corpo = linhas.join("\n");

  const result: EventoExtraido = {
    numero: null,
    nome: null,
    data: null,
    cidade: null,
    uf: null,
    qtd_atletas: 0,
    nivel: null,
    qtd_celulares: 0,
    dias_entrega: 0,
    qtd_totens: 0,
    qtd_notebooks: 0,
    local_prova: null,
    url_site_oficial: null,
    tipo_kit: null,
    tecnicos_gestao: [],
    itens_brutos: [],
    tem_entrega_kit: false,
    texto_extraido: texto.slice(0, 5000),
  };

  // Local da Prova e Site Oficial vivem em <input> com value="...",
  // não aparecem no texto extraído por cheerio (form values não viram body text).
  // Por isso, extrai direto do HTML bruto buscando o label e o próximo input.
  if (/<[a-z][\s\S]*>/i.test(input)) {
    result.local_prova = extrairValorAposLabel(input, /Local\s+da\s+Prova/i);
    result.url_site_oficial = extrairValorAposLabel(input, /Site\s+Oficial(?:\s+do\s+Evento)?/i);
  }

  const tituloMatch = corpo.match(/Convoca[çc][ãa]o\s*-\s*([^\n]+)/i);
  if (tituloMatch) result.nome = txt(tituloMatch[1]);

  const subtituloMatch = corpo.match(/#?(\d{3,6})\s*-\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*([^\n]+)/);
  if (subtituloMatch) {
    result.numero = subtituloMatch[1];
    result.data = subtituloMatch[2];
    const local = txt(subtituloMatch[3]);
    const cidadeUf = local.match(/(.+?)\s*-\s*([A-Z]{2})\s*$/);
    if (cidadeUf) {
      result.cidade = txt(cidadeUf[1]);
      result.uf = cidadeUf[2];
    } else {
      result.cidade = local;
    }
  }

  if (!result.numero) {
    const v = buscarValorAposLabel(linhas, /N[úu]mero\s+da\s+Proposta/i);
    if (v) {
      const m = v.match(/(\d{3,6})/);
      if (m) result.numero = m[1];
    }
  }

  if (!result.data) {
    const v = buscarValorAposLabel(linhas, /^Data$/i);
    if (v) {
      const m = v.match(/(\d{2}\/\d{2}\/\d{4})/);
      if (m) result.data = m[1];
    }
  }

  if (!result.cidade) {
    const v = buscarValorAposLabel(linhas, /^Cidade$/i);
    if (v) {
      const m = v.match(/(.+?)\s*-\s*([A-Z]{2})\s*$/);
      if (m) {
        result.cidade = txt(m[1]);
        result.uf = m[2];
      } else {
        result.cidade = txt(v);
      }
    }
  }

  const atletas = buscarValorAposLabel(linhas, /Qtd\s+Estimada\s+de\s+Atletas/i);
  if (atletas) {
    const m = atletas.match(/(\d+)/);
    if (m) result.qtd_atletas = parseInt(m[1]);
  }

  const nivel = buscarValorAposLabel(linhas, /N[íi]vel\s+do\s+Evento/i);
  if (nivel) result.nivel = txt(nivel);

  result.qtd_celulares = buscarQuantidadeApos(
    linhas,
    /Esta[çc][ãa]o\s+de\s+Entrega\s+de\s+Kits/i,
    /unidade/i
  );

  if (result.qtd_celulares === 0) {
    result.qtd_celulares = buscarQuantidadeApos(
      linhas,
      /Sistema\s+Para\s+Entrega\s+De\s+Kits.*?GO\s*RUN\s*KING/i,
      /evento|unidade|login|esta[çc][ãa]o/i
    );
  }

  result.dias_entrega = buscarQuantidadeApos(
    linhas,
    /T[eé]cnico\s+Especializado\s+para\s+Entrega\s+de\s+Kits/i,
    /dia/i
  );

  result.qtd_totens = buscarQuantidadeApos(
    linhas,
    /Totem\s+touchscreen.*?Entrega\s+de\s+Kits/i,
    /unidade/i
  );

  if (result.qtd_totens === 0) {
    result.qtd_totens = buscarQuantidadeApos(linhas, /Totem.*?Kits/i, /unidade/i);
  }

  result.qtd_notebooks = buscarQuantidadeApos(
    linhas,
    /Loca[çc][ãa]o\s+de\s+Notebook.*?Entrega\s+de\s+Kits/i,
    /unidade/i
  );

  // Fonte primária: cards estruturais de técnico (têm valor E.K e função).
  // Quando o Gestão oculta a lista ("Todos os técnicos já foram alocados"),
  // cai no fallback baseado em texto.
  const cards = extrairCardsTecnicos(input);
  if (cards && cards.length > 0) {
    result.tecnicos_gestao = cards;
  } else {
    const idxTecnicos = linhas.findIndex((l) => /^T[eé]cnicos\s+respons[aá]veis\s*:?\s*$/i.test(l));
    if (idxTecnicos >= 0) {
      // Title Case (ex: "Camila Brandão Figueirôa de Sousa") e all-caps são aceitos.
      // O nome precisa começar com letra maiúscula e ter pelo menos 4 chars.
      const NOME = "[A-ZÀ-Ÿ][A-Za-zÀ-ÿ\\s'.-]{3,}?";
      for (let i = idxTecnicos + 1; i < linhas.length; i++) {
        const l = linhas[i];
        if (/^(Adicionar|Book do Evento|Logística|Hospedagem|Anexar|Observa)/i.test(l)) break;
        if (/^Todos\s+os\s+t[eé]cnicos\s+j[aá]\s+foram\s+alocados/i.test(l)) break;
        const mComCPF = l.match(new RegExp(`^([\\d.]{8,})\\s+(${NOME})\\s*(?:\\(([^)]+)\\))?\\s*$`));
        const mNomeFuncao = !mComCPF && l.match(new RegExp(`^(${NOME})\\s*\\(([^)]+)\\)\\s*$`));
        const mNomeOnly = !mComCPF && !mNomeFuncao && l.match(new RegExp(`^(${NOME})$`));
        if (mComCPF) {
          result.tecnicos_gestao.push({
            nome: mComCPF[2].trim(),
            funcao: mComCPF[3] ? mComCPF[3].trim().toLowerCase() : null,
            cpf_prefixo: mComCPF[1].trim(),
            cache_ek: 0,
            is_entrega_kit: false,
          });
        } else if (mNomeFuncao) {
          result.tecnicos_gestao.push({
            nome: mNomeFuncao[1].trim(),
            funcao: mNomeFuncao[2].trim().toLowerCase(),
            cpf_prefixo: null,
            cache_ek: 0,
            is_entrega_kit: false,
          });
        } else if (mNomeOnly) {
          result.tecnicos_gestao.push({
            nome: mNomeOnly[1].trim(),
            funcao: null,
            cpf_prefixo: null,
            cache_ek: 0,
            is_entrega_kit: false,
          });
        }
      }
    }
  }

  const itens: { nome: string; quantidade: number; unidade: string }[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(/^(\d+(?:[.,]\d+)?)\s*(unidade|dia|hora|km|servi[çc]o|m)s?$/i);
    if (m && i > 0) {
      let nome = "";
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        if (/^servi[çc]os?$/i.test(linhas[j]) || /^produtos?$/i.test(linhas[j])) continue;
        nome = linhas[j];
        break;
      }
      if (nome) {
        itens.push({
          nome: nome.slice(0, 200),
          quantidade: parseFloat(m[1].replace(",", ".")),
          unidade: m[2].toLowerCase(),
        });
      }
    }
  }
  result.itens_brutos = itens;

  // Classifica o tipo de contratação a partir dos itens:
  //   OPERATION (Estação / Técnico de Entrega de Kits) → 'entrega'
  //   SYSTEM_ONLY (Sistema ... Locação por Login/Estação) → 'sistema'
  //   Nenhum → null
  const modo = classificarKit(itens.map((it) => it.nome));
  result.tipo_kit = tipoKitDeModo(modo);
  // Só eventos OPERATION têm equipe de entrega de kit; SYSTEM_ONLY (só locação) zera.
  if (modo !== "OPERATION") {
    result.tecnicos_gestao.forEach((t) => {
      t.is_entrega_kit = false;
    });
  }

  result.tem_entrega_kit =
    result.qtd_celulares > 0 ||
    result.dias_entrega > 0 ||
    result.qtd_totens > 0 ||
    result.qtd_notebooks > 0 ||
    result.tipo_kit !== null;

  return result;
}
