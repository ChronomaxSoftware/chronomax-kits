import { NextRequest, NextResponse } from "next/server";
import { dbRun, dbGet, dbAll, dbBatch, initDB } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { scrapeGestao } from "@/lib/scraper-fetch";
import { iniciarSync, setProgresso, finalizarSync } from "@/lib/sync-progress";
import { normalizarNome } from "@/lib/tecnico-match";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  await initDB();
  const cfg = await getConfig();
  if (!cfg.usuario || !cfg.senha) {
    return NextResponse.json({ error: "Cadastre usuário e senha do Gestão em Configurações" }, { status: 400 });
  }

  let visivel = false;
  try {
    const body = await req.json();
    visivel = !!body?.visivel;
  } catch {
    /* sem body */
  }

  const logIns = await dbRun("INSERT INTO sync_logs (status, mensagem) VALUES ('em_andamento', 'Iniciando sincronização')");
  const logId = logIns.lastInsertRowid as unknown as number;

  iniciarSync();
  const r = await scrapeGestao({
    baseUrl: cfg.baseUrl,
    usuario: cfg.usuario,
    senha: cfg.senha,
    semanas: cfg.semanas,
    visivel,
    debug: true,
    onProgress: (fase, porcentagem, atual, total) => {
      setProgresso({
        fase,
        porcentagem,
        ...(atual !== undefined ? { atual } : {}),
        ...(total !== undefined ? { total } : {}),
      });
    },
  });

  if (!r.ok) {
    await dbRun(
      "UPDATE sync_logs SET status = 'erro', mensagem = ?, finalizado_em = CURRENT_TIMESTAMP WHERE id = ?",
      r.erro || "Erro desconhecido", logId
    );
    finalizarSync(false, r.erro || "Erro");
    return NextResponse.json({ error: r.erro, diagnostico: r.diagnostico }, { status: 500 });
  }

  const tDb = Date.now();
  setProgresso({ fase: `Salvando ${r.eventos.length} eventos no banco`, porcentagem: 92, atual: 0, total: r.eventos.length });

  // ── Fase 1: resolver IDs existentes (poucas queries de leitura) ──

  // Cachear produtos
  const produtoCache = new Map<string, number>();
  const produtosExistentes = await dbAll<{ id: number; nome: string }>("SELECT id, nome FROM produtos");
  for (const p of produtosExistentes) produtoCache.set(p.nome.toLowerCase(), p.id);

  // Garantir que "Celular", "Totem", "Notebook" existem
  for (const nome of ["Celular", "Totem", "Notebook"]) {
    if (!produtoCache.has(nome.toLowerCase())) {
      const ins = await dbRun("INSERT INTO produtos (nome, quantidade_estoque) VALUES (?, 0)", nome);
      produtoCache.set(nome.toLowerCase(), ins.lastInsertRowid as unknown as number);
    }
  }

  // Cachear técnicos existentes
  const tecnicoByNome = new Map<string, number>();
  const tecnicoByCpf = new Map<string, number>();
  const tecnicosExistentes = await dbAll<{ id: number; nome: string; cpf_prefixo: string | null }>("SELECT id, nome, cpf_prefixo FROM tecnicos");
  for (const t of tecnicosExistentes) {
    tecnicoByNome.set(normalizarNome(t.nome), t.id);
    if (t.cpf_prefixo) tecnicoByCpf.set(t.cpf_prefixo, t.id);
  }

  // Cachear eventos existentes por numero
  const eventoByNumero = new Map<string, number>();
  const eventosExistentes = await dbAll<{ id: number; numero: string }>("SELECT id, numero FROM eventos");
  for (const e of eventosExistentes) eventoByNumero.set(e.numero, e.id);

  // ── Fase 2: processar eventos e montar batch de escritas ──

  let importados = 0;
  let atualizados = 0;
  let tecnicosNovos = 0;

  // Primeiro: criar técnicos novos (precisa dos IDs pra depois)
  const tecNovosToCreate: { nome: string; cpf_prefixo: string | null }[] = [];
  for (const ev of r.eventos) {
    for (const tec of ev.tecnicos_gestao || []) {
      const nomeNorm = normalizarNome(tec.nome);
      const key = tec.cpf_prefixo || nomeNorm;
      const exists = tec.cpf_prefixo
        ? tecnicoByCpf.has(tec.cpf_prefixo) || tecnicoByNome.has(nomeNorm)
        : tecnicoByNome.has(nomeNorm);
      if (!exists && !tecNovosToCreate.some((t) => (t.cpf_prefixo || normalizarNome(t.nome)) === key)) {
        tecNovosToCreate.push({ nome: tec.nome, cpf_prefixo: tec.cpf_prefixo });
      }
    }
  }

  // Criar técnicos novos em batch
  if (tecNovosToCreate.length > 0) {
    const stmts = tecNovosToCreate.map((t) => ({
      // ON CONFLICT protege contra o índice único de cpf_prefixo (caso o existente tenha escapado do match)
      sql: "INSERT INTO tecnicos (nome, cpf_prefixo) VALUES (?, ?) ON CONFLICT(cpf_prefixo) DO NOTHING",
      args: [t.nome, t.cpf_prefixo] as (string | null)[],
    }));
    await dbBatch(stmts);
    tecnicosNovos = tecNovosToCreate.length;
    // Re-cachear
    const todosT = await dbAll<{ id: number; nome: string; cpf_prefixo: string | null }>("SELECT id, nome, cpf_prefixo FROM tecnicos");
    tecnicoByNome.clear();
    tecnicoByCpf.clear();
    for (const t of todosT) {
      tecnicoByNome.set(normalizarNome(t.nome), t.id);
      if (t.cpf_prefixo) tecnicoByCpf.set(t.cpf_prefixo, t.id);
    }
  }

  function resolveTecnicoId(nome: string, cpf_prefixo: string | null): number | null {
    if (cpf_prefixo && tecnicoByCpf.has(cpf_prefixo)) return tecnicoByCpf.get(cpf_prefixo)!;
    const nomeNorm = normalizarNome(nome);
    if (tecnicoByNome.has(nomeNorm)) return tecnicoByNome.get(nomeNorm)!;
    return null;
  }

  // Montar batch de todas as escritas de eventos
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allStmts: { sql: string; args: any[] }[] = [];
  const atribuidoEm = new Date().toISOString();
  const logTec: string[] = []; // diagnóstico TEMPORÁRIO de identificação de técnicos

  // Primeiro: criar eventos novos EM LOTE (1 round-trip por chunk em vez de N inserts
  // sequenciais). O libsql batch devolve lastInsertRowid por statement, na mesma ordem,
  // então conseguimos remapear numero → id sem leitura extra.
  const novosEventos: (typeof r.eventos)[number][] = [];
  const numerosVistos = new Set<string>();
  for (const ev of r.eventos) {
    if (!ev.numero || !ev.nome || !ev.data) continue;
    if (eventoByNumero.has(ev.numero) || numerosVistos.has(ev.numero)) continue;
    numerosVistos.add(ev.numero);
    novosEventos.push(ev);
  }
  if (novosEventos.length > 0) {
    const insertStmts = novosEventos.map((ev) => ({
      sql: `INSERT INTO eventos (numero, nome, data, cidade, uf, qtd_celulares, dias_entrega, qtd_atletas, nivel, url_gestao, tem_kit, local_prova, url_site_oficial, tipo_kit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args: [ev.numero, ev.nome, ev.data, ev.cidade, ev.uf, ev.qtd_celulares, ev.dias_entrega, ev.qtd_atletas, ev.nivel, ev.url, ev.tem_entrega_kit ? 1 : 0, ev.local_prova, ev.url_site_oficial, ev.tipo_kit] as any[],
    }));
    const resultados: Awaited<ReturnType<typeof dbBatch>> = [];
    for (let i = 0; i < insertStmts.length; i += 200) {
      const res = await dbBatch(insertStmts.slice(i, i + 200));
      resultados.push(...res);
    }
    novosEventos.forEach((ev, idx) => {
      const rid = resultados[idx]?.lastInsertRowid;
      if (rid != null) eventoByNumero.set(ev.numero!, Number(rid));
    });
    importados = novosEventos.length;
  }

  // Agora montar batch de UPDATEs + INSERTs auxiliares
  for (const ev of r.eventos) {
    if (!ev.numero || !ev.nome || !ev.data) continue;
    const eid = eventoByNumero.get(ev.numero);
    if (!eid) continue;
    const temKit = ev.tem_entrega_kit ? 1 : 0;

    // Update evento (idempotente, roda pra todos — novos e existentes)
    allStmts.push({
      sql: `UPDATE eventos SET nome = ?, data = ?, cidade = ?, uf = ?, qtd_celulares = ?, dias_entrega = ?, qtd_atletas = ?, nivel = ?, url_gestao = ?, tem_kit = ?, local_prova = ?, url_site_oficial = ?, tipo_kit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [ev.nome, ev.data, ev.cidade, ev.uf, ev.qtd_celulares, ev.dias_entrega, ev.qtd_atletas, ev.nivel, ev.url, temKit, ev.local_prova, ev.url_site_oficial, ev.tipo_kit, eid],
    });

    // Produtos
    if (ev.qtd_celulares > 0) allStmts.push({ sql: `INSERT INTO evento_produtos (evento_id, produto_id, quantidade) VALUES (?, ?, ?) ON CONFLICT(evento_id, produto_id) DO UPDATE SET quantidade = MAX(quantidade, excluded.quantidade)`, args: [eid, produtoCache.get("celular")!, ev.qtd_celulares] });
    if (ev.qtd_totens > 0) allStmts.push({ sql: `INSERT INTO evento_produtos (evento_id, produto_id, quantidade) VALUES (?, ?, ?) ON CONFLICT(evento_id, produto_id) DO UPDATE SET quantidade = MAX(quantidade, excluded.quantidade)`, args: [eid, produtoCache.get("totem")!, ev.qtd_totens] });
    if (ev.qtd_notebooks > 0) allStmts.push({ sql: `INSERT INTO evento_produtos (evento_id, produto_id, quantidade) VALUES (?, ?, ?) ON CONFLICT(evento_id, produto_id) DO UPDATE SET quantidade = MAX(quantidade, excluded.quantidade)`, args: [eid, produtoCache.get("notebook")!, ev.qtd_notebooks] });

    // Técnicos de entrega de kit → evento_tecnicos (com função e data/hora da atribuição).
    // RECONCILIA: só os técnicos de kit ATUAIS ficam. Antes só inseria (ON CONFLICT DO NOTHING)
    // e nunca removia → vínculos antigos/errados (quando marcava todos) se acumulavam.
    const kitTids: number[] = [];
    for (const tec of ev.tecnicos_gestao || []) {
      if (tec.is_entrega_kit) {
        const tid = resolveTecnicoId(tec.nome, tec.cpf_prefixo);
        if (tid) {
          kitTids.push(tid);
          allStmts.push({
            sql: `INSERT INTO evento_tecnicos (evento_id, tecnico_id, funcao, atribuido_em) VALUES (?, ?, ?, ?)
                  ON CONFLICT(evento_id, tecnico_id) DO UPDATE SET funcao = excluded.funcao`,
            args: [eid, tid, tec.funcao || null, atribuidoEm],
          });
          if (logTec.length < 200)
            logTec.push(
              `  ✓ #${ev.numero} vincula: ${tec.nome}${tec.funcao ? ` (${tec.funcao})` : ""} ${tec.cpf_prefixo ? `[CPF ${tec.cpf_prefixo}]` : "[sem CPF → casou por nome]"}`
            );
        } else if (logTec.length < 200) {
          logTec.push(`  ⚠ #${ev.numero} não resolveu técnico: ${tec.nome} (verificar)`);
        }
      } else if (logTec.length < 200) {
        logTec.push(
          `  ✗ #${ev.numero} ignora (não é entrega de kit): ${tec.nome}${tec.funcao ? ` (${tec.funcao})` : ""}`
        );
      }
    }
    // Remove os vínculos que não são mais de entrega de kit (limpa o acúmulo do bug antigo)
    if (kitTids.length > 0) {
      const ph = kitTids.map(() => "?").join(",");
      allStmts.push({
        sql: `DELETE FROM evento_tecnicos WHERE evento_id = ? AND tecnico_id NOT IN (${ph})`,
        args: [eid, ...kitTids],
      });
    } else {
      allStmts.push({ sql: "DELETE FROM evento_tecnicos WHERE evento_id = ?", args: [eid] });
    }

    // Limpar e re-inserir itens e equipe
    allStmts.push({ sql: "DELETE FROM evento_itens_gestao WHERE evento_id = ?", args: [eid] });
    for (const it of ev.itens_brutos || []) {
      allStmts.push({ sql: "INSERT INTO evento_itens_gestao (evento_id, nome, quantidade, unidade) VALUES (?, ?, ?, ?)", args: [eid, it.nome, it.quantidade, it.unidade] });
    }

    allStmts.push({ sql: "DELETE FROM evento_equipe_gestao WHERE evento_id = ?", args: [eid] });
    for (const tec of ev.tecnicos_gestao || []) {
      allStmts.push({ sql: "INSERT INTO evento_equipe_gestao (evento_id, nome, funcao, cpf_prefixo, is_entrega_kit, cache_ek) VALUES (?, ?, ?, ?, ?, ?)", args: [eid, tec.nome, tec.funcao, tec.cpf_prefixo, tec.is_entrega_kit ? 1 : 0, tec.cache_ek || 0] });
    }
  }

  atualizados = r.eventos.filter((ev) => ev.numero && ev.nome && ev.data).length - importados;

  // ── Fase 3: executar batch (todas as escritas num único round-trip) ──
  setProgresso({ fase: `Executando ${allStmts.length} operações no banco`, porcentagem: 96 });

  // libsql batch tem limite, executar em chunks de 200
  const BATCH_SIZE = 200;
  for (let i = 0; i < allStmts.length; i += BATCH_SIZE) {
    await dbBatch(allStmts.slice(i, i + BATCH_SIZE));
  }

  // ── Fase 4: reconciliar — apagar eventos que não estão mais entre os APROVADOS ──
  // O Gestão é a fonte da verdade: todo evento no banco cujo número não voltou neste
  // sync (saiu de aprovado → em negociação, foi cancelado ou deletado no Gestão) é
  // removido. TRAVA DE SEGURANÇA: se vier ZERO aprovados (provável falha transitória da
  // API), NÃO apaga nada pra não zerar o banco por engano.
  const numerosAprovados = new Set(
    r.eventos.filter((ev) => ev.numero && ev.nome && ev.data).map((ev) => ev.numero as string)
  );
  let removidos = 0;
  const reconLog: string[] = [];
  if (numerosAprovados.size === 0) {
    reconLog.push("⚠️ Reconciliação PULADA: zero eventos aprovados retornados (trava de segurança — banco preservado)");
  } else {
    // eventosExistentes = snapshot do banco ANTES dos inserts deste sync; os recém-inseridos
    // são todos aprovados, então basta olhar os que já existiam.
    const staleIds = eventosExistentes.filter((e) => !numerosAprovados.has(e.numero)).map((e) => e.id);
    if (staleIds.length > 0) {
      setProgresso({ fase: `Removendo ${staleIds.length} eventos que saíram do Gestão`, porcentagem: 98 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delStmts: { sql: string; args: any[] }[] = [];
      for (let i = 0; i < staleIds.length; i += 100) {
        const chunk = staleIds.slice(i, i + 100);
        const ph = chunk.map(() => "?").join(",");
        // Filhas com cascade lógico (libsql/Turso não força FK, então apagamos à mão)
        delStmts.push({ sql: `DELETE FROM evento_tecnicos WHERE evento_id IN (${ph})`, args: [...chunk] });
        delStmts.push({ sql: `DELETE FROM evento_produtos WHERE evento_id IN (${ph})`, args: [...chunk] });
        delStmts.push({ sql: `DELETE FROM evento_itens_gestao WHERE evento_id IN (${ph})`, args: [...chunk] });
        delStmts.push({ sql: `DELETE FROM evento_equipe_gestao WHERE evento_id IN (${ph})`, args: [...chunk] });
        delStmts.push({ sql: `DELETE FROM evento_kits WHERE evento_id IN (${ph})`, args: [...chunk] });
        // Referências que só desvinculam (equivalente a ON DELETE SET NULL)
        delStmts.push({ sql: `UPDATE celulares_chip SET evento_id = NULL WHERE evento_id IN (${ph})`, args: [...chunk] });
        delStmts.push({ sql: `UPDATE equipamentos_alugados SET evento_id = NULL WHERE evento_id IN (${ph})`, args: [...chunk] });
        delStmts.push({ sql: `UPDATE staff_assignments SET event_id = NULL WHERE event_id IN (${ph})`, args: [...chunk] });
        // Por fim, o próprio evento
        delStmts.push({ sql: `DELETE FROM eventos WHERE id IN (${ph})`, args: [...chunk] });
      }
      for (let i = 0; i < delStmts.length; i += BATCH_SIZE) {
        await dbBatch(delStmts.slice(i, i + BATCH_SIZE));
      }
      removidos = staleIds.length;
      reconLog.push(`🗑️ Reconciliação: ${removidos} eventos removidos (não estão mais aprovados no Gestão)`);
    } else {
      reconLog.push("Reconciliação: nenhum evento para remover (banco já espelha os aprovados)");
    }
  }

  // ── Finalizar ──
  await dbRun(
    `UPDATE sync_logs SET status = 'sucesso', mensagem = ?, eventos_encontrados = ?, eventos_kit = ?, eventos_importados = ?, finalizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
    `${importados} novos, ${atualizados} atualizados, ${removidos} removidos`,
    r.eventosEncontrados,
    r.eventosKit,
    importados + atualizados,
    logId
  );

  finalizarSync(true, `${importados} novos · ${atualizados} atualizados · ${removidos} removidos`);
  return NextResponse.json({
    ok: true,
    eventosEncontrados: r.eventosEncontrados,
    eventosKit: r.eventosKit,
    importados,
    atualizados,
    removidos,
    tecnicosNovos,
    diagnostico: [
      ...(r.diagnostico || []),
      `⏱ banco (gravação ${allStmts.length} ops + ${importados} inserts): ${((Date.now() - tDb) / 1000).toFixed(1)}s`,
      ...reconLog,
      "── Diagnóstico de técnicos (TEMPORÁRIO) ──",
      ...logTec,
    ],
  });
}

export async function GET() {
  await initDB();
  const ultimos = await dbAll("SELECT * FROM sync_logs ORDER BY id DESC LIMIT 10");
  return NextResponse.json(ultimos);
}
