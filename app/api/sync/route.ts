import { NextRequest, NextResponse } from "next/server";
import { dbRun, dbGet, dbAll, initDB } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { scrapeGestao } from "@/lib/scraper-fetch";
import { iniciarSync, setProgresso, finalizarSync } from "@/lib/sync-progress";

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

  // Cache de IDs pra evitar SELECTs repetidos (ex: "Celular" aparece em N eventos)
  const produtoCache = new Map<string, number>();
  const tecnicoCache = new Map<string, number>();

  async function getOuCriaProduto(nome: string): Promise<number> {
    const key = nome.toLowerCase();
    if (produtoCache.has(key)) return produtoCache.get(key)!;
    const existe = await dbGet<{ id: number }>("SELECT id FROM produtos WHERE LOWER(nome) = LOWER(?)", nome);
    if (existe) { produtoCache.set(key, existe.id); return existe.id; }
    const ins = await dbRun("INSERT INTO produtos (nome, quantidade_estoque) VALUES (?, 0)", nome);
    const id = ins.lastInsertRowid as unknown as number;
    produtoCache.set(key, id);
    return id;
  }

  async function getOuCriaTecnico(nome: string, cpf_prefixo: string | null): Promise<{ id: number; isNew: boolean }> {
    const key = cpf_prefixo || nome.toLowerCase();
    if (tecnicoCache.has(key)) return { id: tecnicoCache.get(key)!, isNew: false };
    if (cpf_prefixo) {
      const exCpf = await dbGet<{ id: number }>("SELECT id FROM tecnicos WHERE cpf_prefixo = ?", cpf_prefixo);
      if (exCpf) {
        await dbRun("UPDATE tecnicos SET nome = ? WHERE id = ?", nome, exCpf.id);
        tecnicoCache.set(key, exCpf.id);
        return { id: exCpf.id, isNew: false };
      }
    }
    const existe = await dbGet<{ id: number }>("SELECT id FROM tecnicos WHERE LOWER(nome) = LOWER(?)", nome);
    if (existe) {
      if (cpf_prefixo) await dbRun("UPDATE tecnicos SET cpf_prefixo = ? WHERE id = ? AND (cpf_prefixo IS NULL OR cpf_prefixo = '')", cpf_prefixo, existe.id);
      tecnicoCache.set(key, existe.id);
      return { id: existe.id, isNew: false };
    }
    const ins = await dbRun("INSERT INTO tecnicos (nome, cpf_prefixo) VALUES (?, ?)", nome, cpf_prefixo);
    const id = ins.lastInsertRowid as unknown as number;
    tecnicoCache.set(key, id);
    return { id, isNew: true };
  }

  // Pré-cachear produtos comuns (1 query)
  const produtosExistentes = await dbAll<{ id: number; nome: string }>("SELECT id, nome FROM produtos");
  for (const p of produtosExistentes) produtoCache.set(p.nome.toLowerCase(), p.id);

  setProgresso({ fase: `Salvando ${r.eventos.length} eventos no banco`, porcentagem: 92, atual: 0, total: r.eventos.length });
  let importados = 0;
  let atualizados = 0;
  let tecnicosNovos = 0;
  let processados = 0;
  for (const ev of r.eventos) {
    if (!ev.numero || !ev.nome || !ev.data) continue;
    const temKit = ev.tem_entrega_kit ? 1 : 0;
    const existente = await dbGet<{ id: number }>("SELECT id FROM eventos WHERE numero = ?", ev.numero);

    let eid: number;
    if (existente) {
      await dbRun(
        `UPDATE eventos SET nome = ?, data = ?, cidade = ?, uf = ?, qtd_celulares = ?, dias_entrega = ?, qtd_atletas = ?, nivel = ?, url_gestao = ?, tem_kit = ?, local_prova = ?, url_site_oficial = ?, tipo_kit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        ev.nome, ev.data, ev.cidade, ev.uf, ev.qtd_celulares, ev.dias_entrega, ev.qtd_atletas, ev.nivel, ev.url, temKit, ev.local_prova, ev.url_site_oficial, ev.tipo_kit, existente.id
      );
      atualizados++;
      eid = existente.id;
    } else {
      const ins = await dbRun(
        `INSERT INTO eventos (numero, nome, data, cidade, uf, qtd_celulares, dias_entrega, qtd_atletas, nivel, url_gestao, tem_kit, local_prova, url_site_oficial, tipo_kit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ev.numero, ev.nome, ev.data, ev.cidade, ev.uf, ev.qtd_celulares, ev.dias_entrega, ev.qtd_atletas, ev.nivel, ev.url, temKit, ev.local_prova, ev.url_site_oficial, ev.tipo_kit
      );
      eid = ins.lastInsertRowid as unknown as number;
      importados++;
    }

    if (ev.qtd_celulares > 0) await dbRun(`INSERT INTO evento_produtos (evento_id, produto_id, quantidade) VALUES (?, ?, ?) ON CONFLICT(evento_id, produto_id) DO UPDATE SET quantidade = MAX(quantidade, excluded.quantidade)`, eid, await getOuCriaProduto("Celular"), ev.qtd_celulares);
    if (ev.qtd_totens > 0) await dbRun(`INSERT INTO evento_produtos (evento_id, produto_id, quantidade) VALUES (?, ?, ?) ON CONFLICT(evento_id, produto_id) DO UPDATE SET quantidade = MAX(quantidade, excluded.quantidade)`, eid, await getOuCriaProduto("Totem"), ev.qtd_totens);
    if (ev.qtd_notebooks > 0) await dbRun(`INSERT INTO evento_produtos (evento_id, produto_id, quantidade) VALUES (?, ?, ?) ON CONFLICT(evento_id, produto_id) DO UPDATE SET quantidade = MAX(quantidade, excluded.quantidade)`, eid, await getOuCriaProduto("Notebook"), ev.qtd_notebooks);

    for (const tec of ev.tecnicos_gestao || []) {
      const { id: tid, isNew } = await getOuCriaTecnico(tec.nome, tec.cpf_prefixo);
      if (isNew) tecnicosNovos++;
      if (tec.is_entrega_kit) await dbRun(`INSERT INTO evento_tecnicos (evento_id, tecnico_id) VALUES (?, ?) ON CONFLICT DO NOTHING`, eid, tid);
    }

    // Salva snapshot de itens contratados e equipe pro book
    await dbRun("DELETE FROM evento_itens_gestao WHERE evento_id = ?", eid);
    for (const it of ev.itens_brutos || []) {
      await dbRun("INSERT INTO evento_itens_gestao (evento_id, nome, quantidade, unidade) VALUES (?, ?, ?, ?)", eid, it.nome, it.quantidade, it.unidade);
    }

    await dbRun("DELETE FROM evento_equipe_gestao WHERE evento_id = ?", eid);
    for (const tec of ev.tecnicos_gestao || []) {
      await dbRun("INSERT INTO evento_equipe_gestao (evento_id, nome, funcao, cpf_prefixo, is_entrega_kit, cache_ek) VALUES (?, ?, ?, ?, ?, ?)", eid, tec.nome, tec.funcao, tec.cpf_prefixo, tec.is_entrega_kit ? 1 : 0, tec.cache_ek || 0);
    }

    processados++;
    if (processados % 20 === 0 || processados === r.eventos.length) {
      setProgresso({ fase: `Salvando evento ${processados}/${r.eventos.length}`, porcentagem: 92 + Math.round((processados / r.eventos.length) * 8), atual: processados });
    }
  }

  await dbRun(
    `UPDATE sync_logs SET status = 'sucesso', mensagem = ?, eventos_encontrados = ?, eventos_kit = ?, eventos_importados = ?, finalizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
    `${importados} novos, ${atualizados} atualizados`,
    r.eventosEncontrados,
    r.eventosKit,
    importados + atualizados,
    logId
  );

  finalizarSync(true, `${importados} novos · ${atualizados} atualizados`);
  return NextResponse.json({
    ok: true,
    eventosEncontrados: r.eventosEncontrados,
    eventosKit: r.eventosKit,
    importados,
    atualizados,
    tecnicosNovos,
    diagnostico: r.diagnostico,
  });
}

export async function GET() {
  await initDB();
  const ultimos = await dbAll("SELECT * FROM sync_logs ORDER BY id DESC LIMIT 10");
  return NextResponse.json(ultimos);
}
