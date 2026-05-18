import { chromium, Browser, Page } from "playwright";
import path from "path";
import fs from "fs";

export type TecnicoEquipe = {
  cpf_prefixo: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
};

export type EquipeScrapeResult = {
  ok: boolean;
  erro?: string;
  totalCards: number;
  tecnicos: TecnicoEquipe[];
  diagnostico: string[];
};

export type EquipeScrapeOptions = {
  baseUrl: string;
  usuario: string;
  senha: string;
  visivel?: boolean;
  debug?: boolean;
  limite?: number;
};

function debugDir(): string {
  const dir = path.join(process.cwd(), "data", "debug");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function snap(page: Page, nome: string, log: string[]) {
  const ts = Date.now();
  const file = path.join(debugDir(), `equipe-${ts}-${nome}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  log.push(`📷 ${file}`);
}

async function dumpHtml(page: Page, nome: string, log: string[]) {
  const ts = Date.now();
  const file = path.join(debugDir(), `equipe-${ts}-${nome}.html`);
  const html = await page.content().catch(() => "");
  fs.writeFileSync(file, html);
  log.push(`📄 ${file}`);
}

async function login(page: Page, baseUrl: string, usuario: string, senha: string, log: string[]) {
  await page.goto(baseUrl + "/login", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const abaGestor = page.locator('button:has-text("Gestor"), [role="tab"]:has-text("Gestor")').first();
  if (await abaGestor.count()) {
    await abaGestor.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
  }

  const emailEl = page.locator('input[type="email"], input[name*="mail" i], input[name*="user" i]').first();
  await emailEl.fill(usuario, { timeout: 5000 });
  const senhaEl = page.locator('input[type="password"]').first();
  await senhaEl.fill(senha, { timeout: 5000 });

  const submit = page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Acessar")').first();
  await submit.click({ timeout: 5000 });

  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  if (page.url().includes("/login")) {
    throw new Error("Login falhou — verifique usuário/senha");
  }
  log.push(`Login OK: ${page.url()}`);
}

async function navegarParaEquipe(page: Page, log: string[]) {
  const squadsBtn = page.locator('button:has(span:has-text("Squads"))').first();
  if (await squadsBtn.count()) {
    await squadsBtn.click({ timeout: 5000 }).catch(() => {});
    log.push("Cliquei em Squads");
    await page.waitForTimeout(800);
  }
  const equipeBtn = page
    .locator('button:has-text("Equipe"), a:has-text("Equipe"), [class*="sidebar"] :has-text("Equipe")')
    .first();
  if (await equipeBtn.count()) {
    await equipeBtn.click({ timeout: 5000 }).catch(() => {});
    log.push("Cliquei em Equipe");
  } else {
    log.push("⚠️ Item Equipe não encontrado, indo direto pela URL");
  }
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  log.push(`URL: ${page.url()}`);
}

// Extrai dados do modal "Editar Técnico" usando vários seletores possíveis
async function extrairDadosModal(page: Page): Promise<TecnicoEquipe | null> {
  // Tenta múltiplas estratégias pra cada campo
  async function valorPorLabel(regex: RegExp): Promise<string | null> {
    // estratégia 1: getByLabel
    try {
      const el = page.getByLabel(regex).first();
      if (await el.count()) {
        const v = await el.inputValue({ timeout: 1500 }).catch(() => "");
        if (v) return v;
        const t = await el.textContent({ timeout: 1500 }).catch(() => "");
        if (t) return t.trim();
      }
    } catch {}
    // estratégia 2: label seguido de input no DOM
    try {
      const v = await page.evaluate((reSrc) => {
        const re = new RegExp(reSrc, "i");
        const labels = Array.from(document.querySelectorAll("label, span, div"));
        for (const lab of labels) {
          if (re.test((lab.textContent || "").trim())) {
            // procura input próximo
            let parent: Element | null = lab as Element;
            for (let depth = 0; depth < 4 && parent; depth++) {
              const inp = parent.querySelector("input, textarea") as HTMLInputElement | null;
              if (inp && inp.value) return inp.value;
              parent = parent.parentElement;
            }
          }
        }
        return null;
      }, regex.source);
      if (v) return v;
    } catch {}
    return null;
  }

  const nomeCompleto = await valorPorLabel(/^Nome\s+Completo\s*\*?\s*$/);
  const cpfCnpj = await valorPorLabel(/^CPF\s*\/?\s*CNPJ\s*\*?\s*$/);
  const celular = await valorPorLabel(/^Celular\s*\*?\s*$/);
  const email = await valorPorLabel(/^E[\s\-]?mail\s*\*?\s*$/);
  const cidade = await valorPorLabel(/^Cidade\s*\*?\s*$/);

  if (!nomeCompleto && !celular) return null;

  // Extrai prefixo CPF: "31.420.386 EDERSON" → "31.420.386"
  let cpf_prefixo: string | null = null;
  if (nomeCompleto) {
    const m = nomeCompleto.match(/^([\d.]{8,})\s/);
    if (m) cpf_prefixo = m[1];
  }
  if (!cpf_prefixo && cpfCnpj) {
    const so = cpfCnpj.replace(/\D/g, "");
    if (so.length >= 8) {
      cpf_prefixo = `${so.slice(0, 3)}.${so.slice(3, 6)}.${so.slice(6, 9)}`;
    }
  }

  // Limpa nome (remove prefixo CPF se vier junto)
  let nome = (nomeCompleto || "").replace(/^[\d.]{8,}\s+/, "").trim();
  if (!nome && nomeCompleto) nome = nomeCompleto.trim();

  return {
    cpf_prefixo,
    nome,
    telefone: celular ? celular.trim() : null,
    email: email ? email.trim() : null,
    cidade: cidade ? cidade.trim() : null,
  };
}

async function fecharModal(page: Page) {
  // Tenta Escape
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);
  // Tenta clicar em X / Cancelar / Fechar
  const fechar = page
    .locator('button:has-text("Fechar"), button:has-text("Cancelar"), button:has-text("✕"), button[aria-label*="ech" i], [aria-label*="lose" i]')
    .first();
  if (await fechar.count()) {
    await fechar.click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

export async function scrapeEquipe(opts: EquipeScrapeOptions): Promise<EquipeScrapeResult> {
  const log: string[] = [];
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: !opts.visivel, slowMo: opts.visivel ? 200 : 0 });
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();

    await login(page, opts.baseUrl, opts.usuario, opts.senha, log);
    await navegarParaEquipe(page, log);
    await snap(page, "01-equipe", log);
    if (opts.debug) await dumpHtml(page, "01-equipe", log);

    const cardLocator = page.locator('div.cursor-pointer:has(h3[title])');
    const tecnicos: TecnicoEquipe[] = [];
    const cpfsVistos = new Set<string>();
    let totalCards = 0;
    let pagina = 1;
    let primeiroModalDumpado = false;

    while (true) {
      // Aguarda os cards renderizarem na nova página
      await page.waitForTimeout(1500);
      const titulos = await page
        .locator('div.cursor-pointer h3[title]')
        .evaluateAll((els) => (els as HTMLElement[]).map((e) => e.getAttribute("title") || ""));

      if (titulos.length === 0) {
        log.push(`⚠️ Página ${pagina}: nenhum card encontrado`);
        break;
      }

      log.push(`📄 Página ${pagina}: ${titulos.length} cards`);
      totalCards += titulos.length;

      const limiteRestante = opts.limite ? Math.max(0, opts.limite - tecnicos.length) : titulos.length;
      const ate = Math.min(limiteRestante, titulos.length);

      for (let i = 0; i < ate; i++) {
        const titulo = titulos[i];
        const mTitulo = titulo.match(/^([\d.]{8,})\s+(.+)$/);
        const cpfDoTitulo = mTitulo ? mTitulo[1] : null;
        const nomeDoTitulo = mTitulo ? mTitulo[2].trim() : titulo.trim();

        if (cpfDoTitulo && cpfsVistos.has(cpfDoTitulo)) continue;
        if (cpfDoTitulo) cpfsVistos.add(cpfDoTitulo);

        try {
          const card = cardLocator.nth(i);
          await card.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
          await card.click({ timeout: 5000 });
          await page.waitForTimeout(700);
          await page.waitForSelector('text=/Editar T[eé]cnico/i', { timeout: 5000 }).catch(() => {});

          if (!primeiroModalDumpado && opts.debug) {
            await dumpHtml(page, `02-modal-0`, log);
            primeiroModalDumpado = true;
          }

          const dados = await extrairDadosModal(page);
          const tec: TecnicoEquipe = {
            cpf_prefixo: dados?.cpf_prefixo || cpfDoTitulo,
            nome: dados?.nome || nomeDoTitulo,
            telefone: dados?.telefone || null,
            email: dados?.email || null,
            cidade: dados?.cidade || null,
          };

          if (tec.nome) {
            tecnicos.push(tec);
            log.push(`  ✓ p${pagina} ${i + 1}/${titulos.length}: ${tec.nome} — ${tec.telefone || "(sem tel)"}`);
          } else {
            log.push(`  ⚠️ p${pagina} ${i + 1}/${titulos.length}: sem dados úteis`);
          }

          await fecharModal(page);
        } catch (e) {
          log.push(`  ❌ p${pagina} card ${i + 1}: ${e instanceof Error ? e.message : e}`);
          if (cpfDoTitulo) {
            tecnicos.push({
              cpf_prefixo: cpfDoTitulo,
              nome: nomeDoTitulo,
              telefone: null,
              email: null,
              cidade: null,
            });
          }
          await fecharModal(page);
        }
      }

      if (opts.limite && tecnicos.length >= opts.limite) {
        log.push(`Limite ${opts.limite} atingido`);
        break;
      }

      // Tenta avançar para a próxima página
      const proximo = page.locator('button:has-text("Próximo"):not([disabled])').first();
      const temProximo = (await proximo.count()) > 0;
      if (!temProximo) {
        log.push(`Última página (${pagina}) — fim`);
        break;
      }
      await proximo.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      await proximo.click({ timeout: 5000 }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      pagina++;
      if (pagina > 30) {
        log.push(`Limite de segurança 30 páginas atingido`);
        break;
      }
    }

    fs.writeFileSync(path.join(debugDir(), "ultimo-log-equipe.txt"), log.join("\n"));
    return { ok: true, totalCards, tecnicos, diagnostico: log };
  } catch (err) {
    log.push(`❌ ERRO: ${err instanceof Error ? err.message : err}`);
    fs.writeFileSync(path.join(debugDir(), "ultimo-log-equipe.txt"), log.join("\n"));
    return {
      ok: false,
      erro: err instanceof Error ? err.message : String(err),
      totalCards: 0,
      tecnicos: [],
      diagnostico: log,
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
