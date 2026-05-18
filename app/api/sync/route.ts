import { NextRequest, NextResponse } from "next/server";
import { dbRun, dbGet, dbAll, initDB } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { scrapeGestao } from "@/lib/scraper";
import { iniciarSync, setProgresso, finalizarSync } from "@/lib/sync-progress";

export const maxDuration = 300;

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

  async function getOuCriaProduto(nome: string): Promise<number> {
    const existe = await dbGet<{ id: number }>("SELECT id FROM produtos WHERE LOWER(nome) = LOWER(?)", nome);
    if (existe) return existe.id;
    const ins = await dbRun("INSERT INTO produtos (nome, quantidade_estoque) VALUES (?, 0)", nome);
    return ins.lastInsertRowid as unknown as number;
  }

  async function getOuCriaTecnico(nome: string, cpf_prefixo: string | null): Promise<number> {
    if (cpf_prefixo) {
      const exCpf = await dbGet<{ id: number }>("SELECT id FROM tecnicos WHERE cpf_prefixo = ?", cpf_prefixo);
      if (exCpf) {
        await dbRun("UPDATE tecnicos SET nome = ? WHERE id = ?", nome, exCpf.id);
        return exCpf.id;
      }
    }
    const existe = await dbGet<{ id: number }>("SELECT id FROM tecnicos WHERE LOWER(nome) = LOWER(?)", nome);
    if (existe) {
      if (cpf_prefixo) {
        await dbRun("UPDATE tecnicos SET cpf_prefixo = ? WHERE id = ? AND (cpf_prefixo IS NULL OR cpf_prefixo = '')", cpf_prefixo, existe.id);
      }
      return existe.id;
    }
    const ins = await dbRun("INSERT INTO tecnicos (nome, cpf_prefixo) VALUES (?, ?)", nome, cpf_prefixo);
    return ins.lastInsertRowid as unknown as number;
  }

  async function ligarProduto(eventoId: number, produtoId: number, qtd: number) {
    await dbRun(
      `INSERT INTO evento_produtos (evento_id, produto_id, quantidade) VALUES (?, ?, ?)
       ON CONFLICT(evento_id, produto_id) DO UPDATE SET quantidade = MAX(quantidade, excluded.quantidade)`,
      eventoId, produtoId, qtd
    );
  }

  async function ligarTecnico(eventoId: number, tecnicoId: number) {
    await dbRun(
      `INSERT INTO evento_tecnicos (evento_id, tecnico_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
      eventoId, tecnicoId
    );
  }

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
        ev.nome,
        ev.data,
        ev.cidade,
        ev.uf,
        ev.qtd_celulares,
        ev.dias_entrega,
        ev.qtd_atletas,
        ev.nivel,
        ev.url,
        temKit,
        ev.local_prova,
        ev.url_site_oficial,
        ev.tipo_kit,
        existente.id
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

    if (ev.qtd_celulares > 0) await ligarProduto(eid, await getOuCriaProduto("Celular"), ev.qtd_celulares);
    if (ev.qtd_totens > 0) await ligarProduto(eid, await getOuCriaProduto("Totem"), ev.qtd_totens);
    if (ev.qtd_notebooks > 0) await ligarProduto(eid, await getOuCriaProduto("Notebook"), ev.qtd_notebooks);

    for (const tec of ev.tecnicos_gestao || []) {
      const tecnicoExistia = tec.cpf_prefixo
        ? await dbGet("SELECT id FROM tecnicos WHERE cpf_prefixo = ? OR LOWER(nome) = LOWER(?)", tec.cpf_prefixo, tec.nome)
        : await dbGet("SELECT id FROM tecnicos WHERE LOWER(nome) = LOWER(?)", tec.nome);
      const tid = await getOuCriaTecnico(tec.nome, tec.cpf_prefixo);
      if (!tecnicoExistia) tecnicosNovos++;
      // Só liga em evento_tecnicos quem é da entrega de kit (E.K > 0).
      // Apurador/staff/suporte da prova ficam só em evento_equipe_gestao.
      if (tec.is_entrega_kit) await ligarTecnico(eid, tid);
    }

    // Salva snapshot de itens contratados e equipe (com função) pro book de evento
    await dbRun("DELETE FROM evento_itens_gestao WHERE evento_id = ?", eid);
    for (const it of ev.itens_brutos || []) {
      await dbRun(
        "INSERT INTO evento_itens_gestao (evento_id, nome, quantidade, unidade) VALUES (?, ?, ?, ?)",
        eid, it.nome, it.quantidade, it.unidade
      );
    }

    await dbRun("DELETE FROM evento_equipe_gestao WHERE evento_id = ?", eid);
    for (const tec of ev.tecnicos_gestao || []) {
      await dbRun(
        "INSERT INTO evento_equipe_gestao (evento_id, nome, funcao, cpf_prefixo, is_entrega_kit, cache_ek) VALUES (?, ?, ?, ?, ?, ?)",
        eid, tec.nome, tec.funcao, tec.cpf_prefixo, tec.is_entrega_kit ? 1 : 0, tec.cache_ek || 0
      );
    }

    processados++;
    const pctSalvando = 92 + Math.round((processados / r.eventos.length) * 8);
    setProgresso({ fase: `Salvando evento ${processados}/${r.eventos.length}`, porcentagem: pctSalvando, atual: processados });
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
