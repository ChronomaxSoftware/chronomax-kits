import { NextRequest, NextResponse } from "next/server";
import { dbRun, dbGet, initDB } from "@/lib/db";
import { parseEventoHTML } from "@/lib/parser";

export async function POST(req: NextRequest) {
  await initDB();
  const { html, url, salvar } = await req.json();
  if (!html) return NextResponse.json({ error: "HTML obrigatório" }, { status: 400 });

  const dados = parseEventoHTML(html);

  if (salvar) {
    if (!dados.numero || !dados.nome || !dados.data) {
      return NextResponse.json({ error: "Não consegui extrair número/nome/data do evento", dados }, { status: 400 });
    }
    if (!dados.tem_entrega_kit) {
      return NextResponse.json({ error: "Este evento não tem entrega de kit", dados }, { status: 400 });
    }

    const existente = await dbGet<{ id: number }>("SELECT id FROM eventos WHERE numero = ?", dados.numero);

    if (existente) {
      await dbRun(
        `UPDATE eventos SET nome = ?, data = ?, cidade = ?, uf = ?, qtd_celulares = ?, dias_entrega = ?, qtd_atletas = ?, nivel = ?, url_gestao = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        dados.nome,
        dados.data,
        dados.cidade,
        dados.uf,
        dados.qtd_celulares,
        dados.dias_entrega,
        dados.qtd_atletas,
        dados.nivel,
        url || null,
        existente.id
      );
      return NextResponse.json({ ok: true, id: existente.id, atualizado: true, dados });
    } else {
      const r = await dbRun(
        `INSERT INTO eventos (numero, nome, data, cidade, uf, qtd_celulares, dias_entrega, qtd_atletas, nivel, url_gestao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        dados.numero,
        dados.nome,
        dados.data,
        dados.cidade,
        dados.uf,
        dados.qtd_celulares,
        dados.dias_entrega,
        dados.qtd_atletas,
        dados.nivel,
        url || null
      );

      if (dados.qtd_totens > 0) {
        const totem = await dbGet<{ id: number }>("SELECT id FROM produtos WHERE LOWER(nome) = 'totem'");
        if (totem) {
          await dbRun("INSERT INTO evento_produtos (evento_id, produto_id, quantidade) VALUES (?, ?, ?)",
            r.lastInsertRowid,
            totem.id,
            dados.qtd_totens
          );
        }
      }

      if (dados.qtd_celulares > 0) {
        const cel = await dbGet<{ id: number }>("SELECT id FROM produtos WHERE LOWER(nome) = 'celular'");
        if (cel) {
          await dbRun("INSERT INTO evento_produtos (evento_id, produto_id, quantidade) VALUES (?, ?, ?)",
            r.lastInsertRowid,
            cel.id,
            dados.qtd_celulares
          );
        }
      }

      return NextResponse.json({ ok: true, id: r.lastInsertRowid, criado: true, dados });
    }
  }

  return NextResponse.json({ ok: true, dados, preview: true });
}
