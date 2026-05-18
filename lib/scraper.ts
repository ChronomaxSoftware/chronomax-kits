import { chromium, Browser, Page } from "playwright";
import path from "path";
import fs from "fs";
import { parseEventoHTML, EventoExtraido } from "./parser";

export type ScrapeResult = {
  ok: boolean;
  erro?: string;
  eventosEncontrados: number;
  eventosKit: number;
  eventos: (EventoExtraido & { url: string })[];
  diagnostico?: string[];
};

export type ScrapeOptions = {
  baseUrl: string;
  usuario: string;
  senha: string;
  semanas: number;
  visivel?: boolean;
  debug?: boolean;
  /**
   * Callback opcional chamado em pontos chave da sincronização pra UI atualizar progresso.
   * Porcentagem é uma estimativa: 0..15 login+links, 15..90 eventos, 90..100 salvando.
   */
  onProgress?: (fase: string, porcentagem: number, atual?: number, total?: number) => void;
};

function debugDir(): string {
  const dir = path.join(process.cwd(), "data", "debug");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function snap(page: Page, nome: string, log: string[]) {
  const ts = Date.now();
  const file = path.join(debugDir(), `${ts}-${nome}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  log.push(`📷 ${file}`);
}

async function dumpHtml(page: Page, nome: string, log: string[]) {
  const ts = Date.now();
  const file = path.join(debugDir(), `${ts}-${nome}.html`);
  const html = await page.content().catch(() => "");
  fs.writeFileSync(file, html);
  log.push(`📄 ${file}`);
}

async function login(page: Page, baseUrl: string, usuario: string, senha: string, log: string[]) {
  await page.goto(baseUrl + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
  log.push(`Página de login carregada: ${page.url()}`);
  await snap(page, "01-login-aberto", log);

  const abaGestor = page.locator('button:has-text("Gestor"), [role="tab"]:has-text("Gestor")').first();
  if (await abaGestor.count()) {
    await abaGestor.click({ timeout: 3000 }).catch(() => {});
    log.push("Selecionei aba 'Gestor'");
    await page.waitForTimeout(500);
  }

  const emailSel = ['input[type="email"]', 'input[name*="mail" i]', 'input[name*="user" i]', 'input[id*="mail" i]', 'input[id*="user" i]', 'input:not([type="password"]):not([type="hidden"])'];
  const senhaSel = ['input[type="password"]', 'input[name*="senha" i]', 'input[name*="pass" i]'];

  let preenchidoEmail = false;
  for (const s of emailSel) {
    const el = page.locator(s).first();
    if (await el.count()) {
      await el.fill(usuario, { timeout: 5000 }).catch(() => {});
      preenchidoEmail = true;
      log.push(`Campo e-mail preenchido (seletor: ${s})`);
      break;
    }
  }
  if (!preenchidoEmail) {
    await dumpHtml(page, "01b-login-sem-campo-email", log);
    throw new Error("Não encontrei campo de e-mail/usuário no Gestão");
  }

  let preenchidaSenha = false;
  for (const s of senhaSel) {
    const el = page.locator(s).first();
    if (await el.count()) {
      await el.fill(senha, { timeout: 5000 }).catch(() => {});
      preenchidaSenha = true;
      log.push(`Campo senha preenchido (seletor: ${s})`);
      break;
    }
  }
  if (!preenchidaSenha) {
    await dumpHtml(page, "01c-login-sem-campo-senha", log);
    throw new Error("Não encontrei campo de senha no Gestão");
  }

  await snap(page, "02-login-preenchido", log);

  const submitSel = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Entrar")',
    'button:has-text("Login")',
    'button:has-text("Acessar")',
    'button',
  ];
  let clicou = false;
  for (const s of submitSel) {
    const el = page.locator(s).first();
    if (await el.count()) {
      await el.click({ timeout: 5000 }).catch(() => {});
      clicou = true;
      log.push(`Clicou em submit (seletor: ${s})`);
      break;
    }
  }
  if (!clicou) log.push("⚠️ Não encontrei botão de submit, tentei mesmo assim");

  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await snap(page, "03-pos-login", log);

  log.push(`URL após login: ${page.url()}`);

  if (page.url().includes("/login")) {
    await dumpHtml(page, "03b-pos-login-falhou", log);
    throw new Error("Login falhou — ainda na página de login. Verifique usuário e senha");
  }
}

async function navegarParaConvocacoes(page: Page, log: string[]) {
  log.push("Tentando expandir menu 'Squads' e clicar em 'Convocações'");

  const squadsBtn = page.locator('button:has(span:has-text("Squads"))').first();
  if (await squadsBtn.count()) {
    await squadsBtn.click({ timeout: 5000 }).catch(() => {});
    log.push("Cliquei no menu Squads");
    await page.waitForTimeout(800);
  } else {
    log.push("⚠️ Botão 'Squads' não encontrado no menu");
  }

  const convocBtn = page
    .locator('button:has-text("Convocações"), a:has-text("Convocações"), [class*="sidebar"] :has-text("Convocações")')
    .first();
  if (await convocBtn.count()) {
    await convocBtn.click({ timeout: 5000 }).catch(() => {});
    log.push("Cliquei em Convocações");
  } else {
    log.push("⚠️ Item 'Convocações' não encontrado — tentando ir direto pela URL");
  }

  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function coletarLinksEventos(page: Page, baseUrl: string, semanas: number, log: string[]): Promise<string[]> {
  const links = new Set<string>();

  await navegarParaConvocacoes(page, log);
  log.push(`URL após navegação: ${page.url()}`);
  await snap(page, "04-lista-convocacoes", log);
  await dumpHtml(page, "04-lista-convocacoes", log);

  async function lerEstadoLista() {
    return await page.evaluate(() => {
      const hrefs: string[] = [];
      const ids: string[] = [];
      document.querySelectorAll<HTMLAnchorElement>('a[href*="/squads/convocacoes/"]').forEach((a) => {
        const h = a.getAttribute("href") || "";
        if (/\/squads\/convocacoes\/[\w-]{8,}/.test(h)) hrefs.push(h);
      });
      const seen = new Set<string>();
      document.querySelectorAll<HTMLElement>("body *").forEach((el) => {
        const t = (el.innerText || "").trim();
        const m = t.match(/^#(\d{3,6})\b/);
        if (m && el.children.length < 30 && el.children.length > 0 && !seen.has(m[1])) {
          seen.add(m[1]);
          ids.push(m[1]);
        }
      });
      const corpo = document.body.innerText || "";
      const matchTotal = corpo.match(/(\d+)\s*-\s*(\d+)\s+de\s+(\d+)\s+semanas/i);
      const totalSemanas = matchTotal
        ? { ini: parseInt(matchTotal[1]), fim: parseInt(matchTotal[2]), total: parseInt(matchTotal[3]) }
        : null;
      return { hrefs, ids, totalSemanas, infoSemana: matchTotal ? matchTotal[0] : "" };
    });
  }

  async function avancarParaJanela(janelaTarget: number) {
    await navegarParaConvocacoes(page, log);
    for (let i = 0; i < janelaTarget; i++) {
      const proximo = page
        .locator('button:has-text("Próximas Semanas"), button:has-text("Próxima"), a:has-text("Próximas Semanas")')
        .first();
      if (!(await proximo.count())) return false;
      const desab = await proximo.isDisabled().catch(() => false);
      if (desab) return false;
      await proximo.click({ timeout: 5000 }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1200);
    }
    return true;
  }

  let totalDeclarado = 0;
  let janelaIndex = 0;
  const limiteMax = Math.max(semanas, 100);

  for (let iter = 0; iter < limiteMax; iter++) {
    if (iter > 0) {
      const ok = await avancarParaJanela(janelaIndex);
      if (!ok) {
        log.push(`Não consegui chegar na janela ${janelaIndex + 1} — fim`);
        break;
      }
    }

    await page.waitForTimeout(2000);
    const dados = await lerEstadoLista();
    if (dados.totalSemanas) totalDeclarado = dados.totalSemanas.total;

    const tamanhoAntes = links.size;

    dados.hrefs.forEach((href) => {
      const u = href.startsWith("http") ? href : new URL(href, page.url()).toString();
      links.add(u);
    });

    if (dados.hrefs.length === 0 && dados.ids.length > 0) {
      log.push(`Janela ${janelaIndex + 1} [${dados.infoSemana}]: ${dados.ids.length} cards via #ID — capturando URLs`);
      for (const id of dados.ids) {
        try {
          const card = page.locator(`text=/^#${id}\\b/`).first();
          if (!(await card.count())) continue;
          await card.click({ timeout: 5000 });
          await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
          await page.waitForTimeout(600);
          const url = page.url();
          if (/\/squads\/convocacoes\/[\w-]{8,}/.test(url)) {
            links.add(url);
            log.push(`    ✓ #${id}`);
          }
          const ok = await avancarParaJanela(janelaIndex);
          if (!ok) {
            log.push(`    ⚠️ Não voltei pra janela ${janelaIndex + 1}, parando`);
            break;
          }
        } catch (e) {
          log.push(`    ❌ #${id}: ${e instanceof Error ? e.message : e}`);
          await avancarParaJanela(janelaIndex);
        }
      }
    }

    const novos = links.size - tamanhoAntes;
    log.push(
      `Janela ${janelaIndex + 1}${dados.infoSemana ? ` [${dados.infoSemana}]` : ""}: ${dados.ids.length} cards · ${novos} URLs novas · total: ${links.size}`
    );

    if (dados.totalSemanas && dados.totalSemanas.fim >= dados.totalSemanas.total) {
      log.push(`Última janela alcançada (${dados.totalSemanas.fim}/${dados.totalSemanas.total}) — fim`);
      break;
    }

    janelaIndex++;
  }
  log.push(`Total de semanas declaradas pelo Gestão: ${totalDeclarado || "não detectado"}`);

  log.push(`Total de URLs únicas coletadas: ${links.size}`);
  return Array.from(links).map((href) => (href.startsWith("http") ? href : baseUrl + href));
}

async function extrairEvento(page: Page, url: string): Promise<EventoExtraido & { url: string }> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const html = await page.content();
  if (typeof html !== "string" || !html.length) {
    throw new Error(`page.content() retornou vazio para ${url}`);
  }
  try {
    const dados = parseEventoHTML(html);
    return { ...dados, url };
  } catch (e) {
    const ts = Date.now();
    const file = path.join(debugDir(), `${ts}-falha-parse.html`);
    try { fs.writeFileSync(file, html); } catch {}
    const stack = e instanceof Error && e.stack ? e.stack : String(e);
    throw new Error(`parseEventoHTML falhou em ${url}\nHTML salvo: ${file}\n${stack}`);
  }
}

export async function scrapeGestao(opts: ScrapeOptions): Promise<ScrapeResult> {
  const log: string[] = [];
  let browser: Browser | null = null;
  const progress = opts.onProgress ?? (() => {});
  try {
    log.push(`Iniciando scraper. Visível: ${opts.visivel}, Debug: ${opts.debug}`);
    progress("Abrindo navegador", 2);
    browser = await chromium.launch({ headless: !opts.visivel, slowMo: opts.visivel ? 300 : 0 });
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();

    progress("Fazendo login no Gestão", 5);
    await login(page, opts.baseUrl, opts.usuario, opts.senha, log);
    progress("Coletando links de eventos", 10);
    const links = await coletarLinksEventos(page, opts.baseUrl, opts.semanas, log);
    progress(`Encontrados ${links.length} eventos`, 15, 0, links.length);

    const eventos: (EventoExtraido & { url: string })[] = [];
    const relatorio: { numero: string | null; nome: string | null; celulares: number; dias: number; totens: number; kit: boolean; url: string }[] = [];

    const fimEventos = 90; // % depois de processar todos eventos
    for (let i = 0; i < links.length; i++) {
      log.push(`Lendo evento ${i + 1}/${links.length}`);
      // Progresso linear de 15% até 90% conforme processa cada evento
      const pct = 15 + Math.round(((i + 1) / links.length) * (fimEventos - 15));
      progress(`Processando evento ${i + 1}/${links.length}`, pct, i + 1, links.length);
      try {
        const ev = await extrairEvento(page, links[i]);
        relatorio.push({
          numero: ev.numero,
          nome: ev.nome,
          celulares: ev.qtd_celulares,
          dias: ev.dias_entrega,
          totens: ev.qtd_totens,
          kit: ev.tem_entrega_kit,
          url: links[i],
        });
        log.push(
          `  → #${ev.numero || "?"} ${ev.nome?.slice(0, 50) || "?"} | cel:${ev.qtd_celulares} dias:${ev.dias_entrega} tot:${ev.qtd_totens} | KIT:${ev.tem_entrega_kit ? "✓" : "✗"}`
        );

        const htmlEvento = await page.content();
        fs.writeFileSync(path.join(debugDir(), `evento-${ev.numero || i}.html`), htmlEvento);

        eventos.push(ev);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const stack = e instanceof Error && e.stack ? e.stack : "";
        log.push(`  ❌ Falhou em ${links[i]}: ${msg}`);
        if (stack) log.push(stack);
      }
    }

    fs.writeFileSync(path.join(debugDir(), "relatorio-eventos.json"), JSON.stringify(relatorio, null, 2));
    log.push(`📊 Relatório completo salvo em data/debug/relatorio-eventos.json`);

    const eventosKit = eventos.filter((e) => e.tem_entrega_kit);
    log.push(`Total de eventos visitados: ${eventos.length}`);
    log.push(`Total de eventos COM kit: ${eventosKit.length}`);
    log.push(`Total de eventos SEM kit: ${eventos.length - eventosKit.length}`);

    fs.writeFileSync(path.join(debugDir(), "ultimo-log.txt"), log.join("\n"));

    return {
      ok: true,
      eventosEncontrados: eventos.length,
      eventosKit: eventosKit.length,
      eventos: eventos,
      diagnostico: log,
    };
  } catch (err) {
    log.push(`❌ ERRO: ${err instanceof Error ? err.message : err}`);
    fs.writeFileSync(path.join(debugDir(), "ultimo-log.txt"), log.join("\n"));
    return {
      ok: false,
      erro: err instanceof Error ? err.message : String(err),
      eventosEncontrados: 0,
      eventosKit: 0,
      eventos: [],
      diagnostico: log,
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
