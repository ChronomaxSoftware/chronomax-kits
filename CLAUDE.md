@AGENTS.md

# CLAUDE.md — chronomax-kits

Este arquivo orienta o Claude Code quando trabalhando neste projeto. Sempre leia antes de agir.

---

## 🛑 Workflow obrigatório

**Antes de fazer QUALQUER mudança de código, configuração, migração de banco, deploy ou ação irreversível:**

1. **Criar uma lista de tarefas** usando `TaskCreate` descrevendo o que vai fazer, passo a passo.
2. **Apresentar a lista pro usuário** em PT-BR e perguntar `OK? topa? confirma?`.
3. **Esperar aprovação explícita** antes de começar.
4. **Marcar cada tarefa `in_progress`/`completed`** conforme executa.

Exceções (NÃO precisa aprovação):
- Ler arquivos, listar pastas, buscar com grep/glob
- Rodar comandos de leitura (`git status`, `git log`, etc.)
- Mostrar/abrir arquivos no Edge

Se a pergunta do usuário tiver mais de um caminho possível, **pergunte antes** com `AskUserQuestion` — não escolha sozinho.

---

## Idioma

**Responda sempre em PT-BR** (regra geral do usuário em memória).

---

## Stack

- **Next.js 16** com **Turbopack** (`next dev` / `next start`) — ver AGENTS.md acima sobre breaking changes
- **TypeScript**, App Router (`app/`)
- **better-sqlite3** — banco local em `data/chronomax.db`
- **Playwright** (chromium) — scraping do Gestão (precisa browsers; descarta serverless puro)
- **iron-session** — autenticação por cookie
- **Tailwind** — CSS
- **Cheerio** — parsing HTML

⚠️ **Next.js 16 convenções:** `middleware.ts` virou `proxy.ts`. Antes de assumir nomes/APIs, ler `node_modules/next/dist/docs`.

---

## Estrutura

```
app/
  (app)/               # rotas autenticadas
    page.tsx           # home: Convocações + sync com barra de progresso
    tecnicos/          # técnicos + aba Entregas/Mês
    produtos/
    alugados/
    bases/             # estoque por base (PoA, SP, RJ, Aracaju)
    celulares-chip/
    eventos/[id]/      # detalhe + /book (book de KIT, não confundir com book de prova)
    importar/
    config/
  api/
    sync/              # POST: scrape Gestão → DB
    sync/progress/     # GET: polling do progresso do sync
    sync-equipe/       # POST: scrape /squads (telefones/CPF)
    eventos/, produtos/, alugados/, bases/, ...
  login/               # tela de login (iron-session)
lib/
  db.ts                # schema + migrações ALTER TABLE (padrão colExiste)
  parser.ts            # HTML do evento Gestão → EventoExtraido
  scraper.ts           # Playwright: login + coletar links + extrair evento
  scraper-equipe.ts    # /squads (técnicos com tel/email/cidade/CPF)
  sync-progress.ts     # singleton em-memória de progresso (fase + %)
  config.ts            # config.json em data/
  semana.ts, telefone.ts, ...
proxy.ts               # middleware Next.js 16 (auth + redirect /login)
data/
  chronomax.db         # SQLite (gitignored)
  debug/               # screenshots + HTMLs do scraper (gitignored)
```

---

## Banco — tabelas principais

- **`eventos`** — id, numero, nome, data, cidade, uf, qtd_atletas, qtd_celulares, dias_entrega, qtd_totens, qtd_notebooks, nivel, url_gestao, **local_prova**, **url_site_oficial**, briefing_data/hora, datas_horarios_retirada, endereco_retirada, avisos_retirada, obs_retirada, cronograma_evento, passo_a_passo_kits, entrega_locais_separados, base1_ok/em, base_final_ok/em, tem_kit, status, links_evento, usuarios_evento
- **`tecnicos`** — id, nome, telefone, email, cidade, cpf_prefixo (com índice), ultima_sync_gestao
- **`produtos`** — id, nome, quantidade_estoque
- **`evento_tecnicos`** — N:N
- **`evento_produtos`** — N:N + quantidade
- **`evento_itens_gestao`** — itens contratados do Gestão (nome, quantidade, unidade) → consumido pelo book de prova do chronomax-grupos-wa
- **`evento_equipe_gestao`** — equipe convocada com função (apurador/staff/suporte/null) + cpf_prefixo
- **`bases`** — Porto Alegre/RS, São Paulo/SP, Rio/RJ, Aracaju/SE
- **`estoque_base`** — base_id, produto_id, quantidade (PK composta)
- **`equipamentos_alugados`** — equipamento, quantidade, fornecedor, status...
- **`celulares_chip`** — apelido, numero, operadora, identificador, quantidade, base_id/evento_id, observacao
- **`sync_logs`** — histórico de syncs

Migrações: padrão `colExiste("tabela", "coluna")` em `lib/db.ts` antes do `ALTER TABLE ADD COLUMN`. Idempotente.

---

## Sync do Gestão

Fluxo: `POST /api/sync` → `scrapeGestao()` → `parseEventoHTML()` → upsert.

**`lib/scraper.ts`** abre Chromium (Playwright), loga no Gestão, coleta links de convocações por janela de semanas, e pra cada link:
1. Visita o evento
2. `page.content()` → HTML inteiro
3. `parseEventoHTML(html)` extrai dados

**`lib/parser.ts`:**
- Texto extraído via cheerio (`extrairTexto`)
- Regex em linhas pra: número, nome, data, cidade/UF, qtd atletas, nível, qtd_celulares, dias_entrega, qtd_totens, qtd_notebooks
- **Inputs HTML (form values):** `extrairValorAposLabel()` pega `<input value="...">` do HTML bruto — usado pra `local_prova` e `url_site_oficial`. Formularios HTML NÃO entram no texto extraído pelo cheerio.
- Equipe: regex `^([\d.]{8,})\s+NOME\s*(\([^)]+\))?$`
- Itens contratados: linha com qty + unidade, usa linha anterior como nome

---

## Sync de Equipe (`/squads`)

`lib/scraper-equipe.ts` lê `/squads` paginada (clica "Próximo" até desabilitar, dedup por cpf_prefixo). Captura nome + telefone + email + cidade + CPF.

Modal de detalhe: regex `/^Celular\s*\*?\s*$/` (asterisco aceito; idem outros campos).

---

## Sync — Progresso visível

Estado compartilhado em `lib/sync-progress.ts` (singleton em-memória).

API:
- `iniciarSync()`, `setProgresso({...})`, `finalizarSync()`, `getProgresso()`
- `GET /api/sync/progress` — endpoint pro frontend pollar

Fases (estimativa):
- 0–10%: login + navegação
- 10–15%: coletar links
- 15–90%: processar eventos (proporcional `(i+1)/total`)
- 90–100%: salvar no banco

Frontend (`app/(app)/page.tsx`): polling cada 500ms enquanto `sincronizando=true`. Botão mostra `⟳ 45%`, e `<BarraProgresso>` aparece com fase + atual/total + barra azul.

---

## Autenticação

`proxy.ts` (antigo `middleware.ts`) intercepta rotas, redireciona pra `/login` se não autenticado.
Sessão em cookie (iron-session). Senha do Gestão em `config.json` em `data/` (gitignored).

---

## Páginas / Features

- **Home (Convocações):** eventos agrupados por semana, botões sync + sync equipe, widget usoPorBase
- **Tecnicos:** lista + aba "Entregas/Mês" (`<input type="month">`, seções verde/amarela por status)
- **Bases:** PUT aceita `estoque[]` (`{produto_id, quantidade}` — qty 0 deleta linha)
- **Eventos/[id]:** detalhes editáveis (12+ colunas), botão `📘 Gerar book` → `/eventos/[id]/book` (book de KIT)
- **Eventos/[id]/book:** layout dark estilo apresentação (5+ páginas), `wa.me/55<dig>` links, modo print

---

## Patterns do código

- **API routes:** `app/api/.../route.ts` exportam `GET`/`POST`. `import db from "@/lib/db"` direto.
- **Migrações:** `colExiste()` antes de `ALTER TABLE` (idempotente).
- **Erros do scraper:** salva HTML + stack em `data/debug/evento-<numero>.html` quando parser falha.
- **Match de técnicos:** prioridade `cpf_prefixo` > `nome` (case-insensitive).
- **Bug histórico:** `buscarQuantidadeApos` quebrava com regex composto. Fix: encapsular em `(?:...)` + guard `m && m[1]`.

---

## Helper scripts e debug

- **`data/debug/`** — screenshots PNG + HTML por evento + log. Útil pra debugar parser.
- **`scripts/test-parser.ts`** — roda `parseEventoHTML` em todos `data/debug/evento-*.html`.
- **`scripts/migrate-book-tables.mjs`** — repopula `evento_itens_gestao` + `evento_equipe_gestao` a partir dos HTMLs salvos.

---

## Pendências conhecidas

- **Hospedagem / deploy** — Playwright precisa de browsers (descarta Vercel serverless puro). SQLite precisa volume persistente. `proxy.ts` com iron-session.
- **Fase 2 do book de kit** — uploads de imagem (TIPO DE KITS / LOGAR / SINCRONIZAR / LINKS+USUÁRIOS) ainda manual.

---

## Relação com chronomax-grupos-wa

Outro projeto (`C:\Users\CHRONOMAX_1\Projetos\chronomax-grupos-wa`) lê este banco em **readonly** pra:
- Criar grupos WhatsApp dos eventos da semana (via Baileys)
- Gerar **books de prova** (.pptx via JSZip) e enviar pro Caio

⚠️ **Não confundir:**
- **Book de kit** — gerado AQUI em `/eventos/[id]/book` (HTML/print pra entrega de kit)
- **Book de prova** — gerado em chronomax-grupos-wa (pptx pra cronometragem da prova)

Campos `evento_itens_gestao` e `evento_equipe_gestao` são populados aqui, consumidos lá. Mudar schema dessas tabelas exige cuidado — comunicar/atualizar o outro projeto também.
