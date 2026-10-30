import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbGet, dbTransaction, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { tipoDeProduto } from "@/lib/equipamentos";
import { acessoriosPendentes, faltou, type LinhaAcessorio } from "@/lib/retorno-acessorios";

const SQL_LINHAS = `SELECT v.id AS evento_id, v.numero AS evento_numero, v.nome AS evento_nome, v.data AS evento_data,
         v.uf AS evento_uf, p.id AS produto_id, p.nome AS produto_nome, ep.quantidade, ep.devolucao_em
  FROM evento_produtos ep
  JOIN eventos v ON v.id = ep.evento_id
  JOIN produtos p ON p.id = ep.produto_id`;

// GET /api/acessorios/retorno — provas com acessório a conferir (+ base da prova pela UF)
export async function GET() {
  await initDB();
  const provas = acessoriosPendentes(await dbAll<LinhaAcessorio>(SQL_LINHAS));
  const bases = await dbAll<{ id: number; nome: string; uf: string }>("SELECT id, nome, uf FROM bases");
  const baseDaUf = (uf: string | null) =>
    bases.find((b) => b.uf.trim().toUpperCase() === (uf || "").trim().toUpperCase()) || null;
  return NextResponse.json(provas.map((p) => ({ ...p, base: baseDaUf(p.uf) })));
}

/**
 * POST /api/acessorios/retorno
 * { evento_id, itens: [{ produto_id, qtd_devolvida }], descontar: boolean, observacao?: string }
 * Tudo ou nada. Com "descontar", o que faltou sai do estoque da base da prova (pela UF).
 */
export async function POST(req: NextRequest) {
  await initDB();
  const body = await req.json().catch(() => ({}));
  const eventoId = Number(body.evento_id);
  const itens: { produto_id: number; qtd_devolvida: number }[] = Array.isArray(body.itens)
    ? body.itens
        .map((i: { produto_id: unknown; qtd_devolvida: unknown }) => ({
          produto_id: Number(i.produto_id),
          qtd_devolvida: Math.max(0, Math.floor(Number(i.qtd_devolvida))),
        }))
        .filter((i: { produto_id: number; qtd_devolvida: number }) => i.produto_id > 0 && Number.isFinite(i.qtd_devolvida))
    : [];
  if (!eventoId || itens.length === 0) {
    return NextResponse.json({ error: "Informe quantos voltaram de cada acessório" }, { status: 400 });
  }
  const obs = typeof body.observacao === "string" ? body.observacao.trim().slice(0, 500) || null : null;
  const usuario = (await getSession()).name || null;

  const ev = await dbGet<{ uf: string | null }>("SELECT uf FROM eventos WHERE id = ?", eventoId);
  if (!ev) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });
  const base = await dbGet<{ id: number; nome: string }>(
    "SELECT id, nome FROM bases WHERE UPPER(TRIM(uf)) = UPPER(TRIM(?))",
    ev.uf || ""
  );
  const descontar = body.descontar === true && !!base;

  const agora = new Date().toISOString();
  try {
    const descontados = await dbTransaction(async (tx) => {
      let total = 0;
      for (const it of itens) {
        const r = await tx.execute({
          sql: `SELECT ep.quantidade, ep.devolucao_em, p.nome FROM evento_produtos ep JOIN produtos p ON p.id = ep.produto_id
                WHERE ep.evento_id = ? AND ep.produto_id = ?`,
          args: [eventoId, it.produto_id],
        });
        const row = r.rows[0] as unknown as { quantidade: number; devolucao_em: string | null; nome: string } | undefined;
        if (!row || tipoDeProduto(row.nome)) throw new Error("ITEM_INVALIDO");
        if (row.devolucao_em) throw new Error("JA_CONFERIDO");
        const falta = faltou(Number(row.quantidade), it.qtd_devolvida);
        const desconta = descontar && falta > 0;
        await tx.execute({
          sql: `UPDATE evento_produtos SET qtd_devolvida = ?, devolucao_em = ?, devolucao_por = ?, devolucao_obs = ?, descontado = ?
                WHERE evento_id = ? AND produto_id = ? AND devolucao_em IS NULL`,
          args: [it.qtd_devolvida, agora, usuario, obs, desconta ? falta : 0, eventoId, it.produto_id],
        });
        if (desconta) {
          const up = await tx.execute({
            sql: "UPDATE estoque_base SET quantidade = MAX(0, quantidade - ?) WHERE base_id = ? AND produto_id = ?",
            args: [falta, base!.id, it.produto_id],
          });
          if (up.rowsAffected > 0) total += falta;
        }
      }
      return total;
    });
    return NextResponse.json({ ok: true, descontados, base: descontar ? base!.nome : null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "JA_CONFERIDO") {
      return NextResponse.json({ error: "Esse retorno já foi registrado por outra pessoa. Recarregue." }, { status: 409 });
    }
    if (msg === "ITEM_INVALIDO") return NextResponse.json({ error: "Item inválido para esta prova" }, { status: 400 });
    console.error("[acessorios] erro ao registrar retorno", err);
    return NextResponse.json({ error: "Não foi possível registrar o retorno" }, { status: 500 });
  }
}
