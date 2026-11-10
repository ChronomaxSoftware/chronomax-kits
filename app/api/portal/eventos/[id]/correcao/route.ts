import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbGet, dbRun, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { parseDataBR } from "@/lib/semana";
import { situacaoProva } from "@/lib/portal-situacao";
import { criarAlertaTexto } from "@/lib/alertas";
import { qtdAtual, textoAlertaCorrecao, validarPedido } from "@/lib/correcoes";

/**
 * POST /api/portal/eventos/[id]/correcao  { itens: [{produto_id, qtd}], explicacao }
 * O técnico pede para corrigir "quantos vieram" de cada item. Não muda nada até o escritório aprovar.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "tecnico" || !session.tecnicoId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const tid = session.tecnicoId;

  const link = await dbGet("SELECT 1 AS ok FROM evento_tecnicos WHERE evento_id = ? AND tecnico_id = ?", id, tid);
  if (!link) return NextResponse.json({ error: "Você não está atribuído a este evento" }, { status: 403 });

  const ev = await dbGet<{ data: string; nome: string; numero: string }>("SELECT data, nome, numero FROM eventos WHERE id = ?", id);
  const situacao = situacaoProva(parseDataBR(ev?.data));
  if (situacao === "finalizada") return NextResponse.json({ error: "Prova finalizada — não dá mais para alterar." }, { status: 409 });
  if (situacao === "em_breve") return NextResponse.json({ error: "Esta prova libera na semana dela." }, { status: 409 });

  const produtos = await dbAll<{ produto_id: number; nome: string; quantidade: number; qtd_recebida: number | null }>(
    `SELECT ep.produto_id, p.nome, ep.quantidade, ep.qtd_recebida
       FROM evento_produtos ep JOIN produtos p ON p.id = ep.produto_id WHERE ep.evento_id = ?`,
    id
  );
  const atuais = new Map(produtos.map((p) => [Number(p.produto_id), qtdAtual(p)]));

  const body = await req.json().catch(() => ({}));
  const v = validarPedido(body.itens, body.explicacao, atuais);
  if ("erro" in v) return NextResponse.json({ error: v.erro }, { status: 400 });

  const agora = new Date().toISOString();
  for (const it of v.itens) {
    // um pedido novo do mesmo item substitui o que ainda estava esperando
    await dbRun(
      "DELETE FROM correcoes_quantidade WHERE evento_id = ? AND tecnico_id = ? AND produto_id = ? AND status = 'pendente'",
      id,
      tid,
      it.produto_id
    );
    await dbRun(
      `INSERT INTO correcoes_quantidade (evento_id, tecnico_id, produto_id, qtd_antes, qtd_pedida, explicacao, status, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?)`,
      id,
      tid,
      it.produto_id,
      it.qtd_antes,
      it.qtd,
      v.explicacao,
      agora
    );
  }

  const t = await dbGet<{ nome: string }>("SELECT nome FROM tecnicos WHERE id = ?", tid);
  const nomes = new Map(produtos.map((p) => [Number(p.produto_id), p.nome]));
  await criarAlertaTexto(
    "correcao",
    id,
    tid,
    textoAlertaCorrecao(
      t?.nome || "",
      ev ? `${ev.nome} (#${ev.numero})` : `prova ${id}`,
      v.itens.map((i) => ({ nome: nomes.get(i.produto_id) || "item", antes: i.qtd_antes, pedida: i.qtd })),
      v.explicacao
    )
  );

  return NextResponse.json({ ok: true, pedidos: v.itens.length });
}
