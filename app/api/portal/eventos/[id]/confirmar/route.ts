import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbRun, initDB } from "@/lib/db";
import { SQL_QTD_OFICIAL, atualizarConfirmacao } from "@/lib/correcoes-db";
import { getSession } from "@/lib/session";
import { parseDataBR } from "@/lib/semana";
import { situacaoProva } from "@/lib/portal-situacao";
import { criarAlerta } from "@/lib/alertas";

/**
 * POST /api/portal/eventos/[id]/confirmar
 * { tudo?: true }                     → recebeu todo o material (qtd recebida = esperada)
 * { itens?: [{produto_id, recebido}] } → confirmação item a item (qtd_recebida do técnico é ignorada)
 * { observacao?: string }             → observação do técnico (vazia apaga)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "tecnico" || !session.tecnicoId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;

  // Garante que o técnico logado está atribuído a este evento
  const link = await dbGet(
    "SELECT 1 AS ok FROM evento_tecnicos WHERE evento_id = ? AND tecnico_id = ?",
    id,
    session.tecnicoId
  );
  if (!link) {
    return NextResponse.json({ error: "Você não está atribuído a este evento" }, { status: 403 });
  }

  const ev = await dbGet<{ data: string }>("SELECT data FROM eventos WHERE id = ?", id);
  const situacao = situacaoProva(parseDataBR(ev?.data));
  if (situacao === "finalizada") {
    return NextResponse.json({ error: "Prova finalizada — não dá mais para alterar." }, { status: 409 });
  }
  if (situacao === "em_breve") {
    return NextResponse.json({ error: "Esta prova libera para confirmar na semana dela." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const { itens, tudo } = body;
  if (itens !== undefined && !Array.isArray(itens)) {
    return NextResponse.json({ error: "Itens inválidos" }, { status: 400 });
  }

  // A quantidade ("quantos vieram") NÃO vem do técnico: vale a esperada ou a última correção
  // aprovada pelo escritório. Para mudar, o técnico pede correção (/correcao) com explicação.
  const agora = new Date().toISOString();
  if (tudo === true) {
    await dbRun(
      `UPDATE evento_produtos SET recebido = 1, qtd_recebida = ${SQL_QTD_OFICIAL}, recebido_em = ? WHERE evento_id = ?`,
      agora,
      id
    );
  } else if (Array.isArray(itens)) {
    for (const it of itens) {
      const recebido = it.recebido ? 1 : 0;
      await dbRun(
        `UPDATE evento_produtos SET recebido = ?, qtd_recebida = ${SQL_QTD_OFICIAL}, recebido_em = ?
         WHERE evento_id = ? AND produto_id = ?`,
        recebido,
        recebido ? agora : null,
        id,
        it.produto_id
      );
    }
  }

  if (typeof body.observacao === "string") {
    const obs = body.observacao.trim().slice(0, 2000) || null;
    await dbRun(
      "UPDATE evento_tecnicos SET obs_recebimento = ?, obs_em = ? WHERE evento_id = ? AND tecnico_id = ?",
      obs,
      obs ? agora : null,
      id,
      session.tecnicoId
    );
  }

  // Marca (ou desmarca) que ESTE técnico confirmou tudo: todos os itens recebidos na quantidade esperada
  let completo = false;
  if (tudo === true || Array.isArray(itens)) {
    const r = await atualizarConfirmacao(id, session.tecnicoId, agora);
    completo = r.completo;
    if (r.novo) {
      await criarAlerta("recebimento", id, session.tecnicoId, typeof body.observacao === "string" ? body.observacao : null);
    }
  }

  return NextResponse.json({ ok: true, completo });
}
