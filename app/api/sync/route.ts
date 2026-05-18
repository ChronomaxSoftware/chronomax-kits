import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getConfig } from "@/lib/config";
import { scrapeGestao } from "@/lib/scraper";
import { iniciarSync, setProgresso, finalizarSync } from "@/lib/sync-progress";

export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const cfg = getConfig();
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

  const logIns = db
    .prepare("INSERT INTO sync_logs (status, mensagem) VALUES ('em_andamento', 'Iniciando sincronização')")
    .run();
  const logId = logIns.lastInsertRowid as number;

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
    db.prepare(
      "UPDATE sync_logs SET status = 'erro', mensagem = ?, finalizado_em = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(r.erro || "Erro desconhecido", logId);
    finalizarSync(false, r.erro || "Erro");
    return NextResponse.json({ error: r.erro, diagnostico: r.diagnostico }, { status: 500 });
  }

  function getOuCriaProduto(nome: string): number {
    const existe = db.prepare("SELECT id FROM produtos WHERE LOWER(nome) = LOWER(?)").get(nome) as
      | { id: number }
      | undefined;
    if (existe) return existe.id;
    const ins = db.prepare("INSERT INTO produtos (nome, quantidade_estoque) VALUES (?, 0)").run(nome);
    return ins.lastInsertRowid as number;
  }

  function getOuCriaTecnico(nome: string, cpf_prefixo: string | null): number {
    if (cpf_prefixo) {
      const exCpf = db.prepare("SELECT id FROM tecnicos WHERE cpf_prefixo = ?").get(cpf_prefixo) as
        | { id: number }
        | undefined;
      if (exCpf) {
        db.prepare("UPDATE tecnicos SET nome = ? WHERE id = ?").run(nome, exCpf.id);
        return exCpf.id;
      }
    }
    const existe = db.prepare("SELECT id FROM tecnicos WHERE LOWER(nome) = LOWER(?)").get(nome) as
      | { id: number }
      | undefined;
    if (existe) {
      if (cpf_prefixo) {
        db.prepare("UPDATE tecnicos SET cpf_prefixo = ? WHERE id = ? AND (cpf_prefixo IS NULL OR cpf_prefixo = '')").run(cpf_prefixo, existe.id);
      }
      return existe.id;
    }
    const ins = db.prepare("INSERT INTO tecnicos (nome, cpf_prefixo) VALUES (?, ?)").run(nome, cpf_prefixo);
    return ins.lastInsertRowid as number;
  }

  function ligarProduto(eventoId: number, produtoId: number, qtd: number) {
    db.prepare(
      `INSERT INTO evento_produtos (evento_id, produto_id, quantidade) VALUES (?, ?, ?)
       ON CONFLICT(evento_id, produto_id) DO UPDATE SET quantidade = MAX(quantidade, excluded.quantidade)`
    ).run(eventoId, produtoId, qtd);
  }

  function ligarTecnico(eventoId: number, tecnicoId: number) {
    db.prepare(
      `INSERT INTO evento_tecnicos (evento_id, tecnico_id) VALUES (?, ?) ON CONFLICT DO NOTHING`
    ).run(eventoId, tecnicoId);
  }

  setProgresso({ fase: `Salvando ${r.eventos.length} eventos no banco`, porcentagem: 92, atual: 0, total: r.eventos.length });
  let importados = 0;
  let atualizados = 0;
  let tecnicosNovos = 0;
  let processados = 0;
  for (const ev of r.eventos) {
    if (!ev.numero || !ev.nome || !ev.data) continue;
    const temKit = ev.tem_entrega_kit ? 1 : 0;
    const existente = db.prepare("SELECT id FROM eventos WHERE numero = ?").get(ev.numero) as
      | { id: number }
      | undefined;

    let eid: number;
    if (existente) {
      db.prepare(
        `UPDATE eventos SET nome = ?, data = ?, cidade = ?, uf = ?, qtd_celulares = ?, dias_entrega = ?, qtd_atletas = ?, nivel = ?, url_gestao = ?, tem_kit = ?, local_prova = ?, url_site_oficial = ?, tipo_kit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(
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
      const ins = db
        .prepare(
          `INSERT INTO eventos (numero, nome, data, cidade, uf, qtd_celulares, dias_entrega, qtd_atletas, nivel, url_gestao, tem_kit, local_prova, url_site_oficial, tipo_kit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(ev.numero, ev.nome, ev.data, ev.cidade, ev.uf, ev.qtd_celulares, ev.dias_entrega, ev.qtd_atletas, ev.nivel, ev.url, temKit, ev.local_prova, ev.url_site_oficial, ev.tipo_kit);
      eid = ins.lastInsertRowid as number;
      importados++;
    }

    if (ev.qtd_celulares > 0) ligarProduto(eid, getOuCriaProduto("Celular"), ev.qtd_celulares);
    if (ev.qtd_totens > 0) ligarProduto(eid, getOuCriaProduto("Totem"), ev.qtd_totens);
    if (ev.qtd_notebooks > 0) ligarProduto(eid, getOuCriaProduto("Notebook"), ev.qtd_notebooks);

    for (const tec of ev.tecnicos_gestao || []) {
      const tecnicoExistia = tec.cpf_prefixo
        ? db.prepare("SELECT id FROM tecnicos WHERE cpf_prefixo = ? OR LOWER(nome) = LOWER(?)").get(tec.cpf_prefixo, tec.nome)
        : db.prepare("SELECT id FROM tecnicos WHERE LOWER(nome) = LOWER(?)").get(tec.nome);
      const tid = getOuCriaTecnico(tec.nome, tec.cpf_prefixo);
      if (!tecnicoExistia) tecnicosNovos++;
      // Só liga em evento_tecnicos quem é da entrega de kit (E.K > 0).
      // Apurador/staff/suporte da prova ficam só em evento_equipe_gestao.
      if (tec.is_entrega_kit) ligarTecnico(eid, tid);
    }

    // Salva snapshot de itens contratados e equipe (com função) pro book de evento
    db.prepare("DELETE FROM evento_itens_gestao WHERE evento_id = ?").run(eid);
    const insItem = db.prepare(
      "INSERT INTO evento_itens_gestao (evento_id, nome, quantidade, unidade) VALUES (?, ?, ?, ?)"
    );
    for (const it of ev.itens_brutos || []) {
      insItem.run(eid, it.nome, it.quantidade, it.unidade);
    }

    db.prepare("DELETE FROM evento_equipe_gestao WHERE evento_id = ?").run(eid);
    const insEquipe = db.prepare(
      "INSERT INTO evento_equipe_gestao (evento_id, nome, funcao, cpf_prefixo, is_entrega_kit, cache_ek) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (const tec of ev.tecnicos_gestao || []) {
      insEquipe.run(eid, tec.nome, tec.funcao, tec.cpf_prefixo, tec.is_entrega_kit ? 1 : 0, tec.cache_ek || 0);
    }

    processados++;
    const pctSalvando = 92 + Math.round((processados / r.eventos.length) * 8);
    setProgresso({ fase: `Salvando evento ${processados}/${r.eventos.length}`, porcentagem: pctSalvando, atual: processados });
  }

  db.prepare(
    `UPDATE sync_logs SET status = 'sucesso', mensagem = ?, eventos_encontrados = ?, eventos_kit = ?, eventos_importados = ?, finalizado_em = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(
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
  const ultimos = db
    .prepare("SELECT * FROM sync_logs ORDER BY id DESC LIMIT 10")
    .all();
  return NextResponse.json(ultimos);
}
