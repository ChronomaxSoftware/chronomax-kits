import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbGet, dbTransaction, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ehErroPatrimonioDuplicado, idOuNull, validarCadastro } from "@/lib/equipamentos";
import { ErroEquipamento, alocarNaProva, garantirBase, liberarDaProva, mudarStatus } from "@/lib/equipamentos-db";

type Params = { params: Promise<{ id: string }> };

function respostaErro(err: unknown, contexto: string) {
  if (err instanceof ErroEquipamento) return NextResponse.json({ error: err.message }, { status: err.status });
  if (ehErroPatrimonioDuplicado(err)) {
    return NextResponse.json({ error: "Esse patrimônio já está cadastrado em outro equipamento" }, { status: 409 });
  }
  console.error(`[equipamentos] ${contexto}`, err);
  return NextResponse.json({ error: "Erro inesperado ao salvar o equipamento" }, { status: 500 });
}

// GET /api/equipamentos/:id — equipamento + histórico de alocações/manutenção
export async function GET(_req: NextRequest, { params }: Params) {
  await initDB();
  const id = idOuNull((await params).id);
  if (!id) return NextResponse.json({ error: "Equipamento inválido" }, { status: 400 });
  const equipamento = await dbGet(
    `SELECT e.*, b.nome AS base_nome, b.uf AS base_uf, v.numero AS evento_numero, v.nome AS evento_nome, v.data AS evento_data
     FROM equipamentos e LEFT JOIN bases b ON b.id = e.base_id LEFT JOIN eventos v ON v.id = e.evento_id
     WHERE e.id = ?`,
    id
  );
  if (!equipamento) return NextResponse.json({ error: "Equipamento não encontrado" }, { status: 404 });
  const historico = await dbAll(
    `SELECT h.id, h.acao, h.observacao, h.usuario, h.criado_em, h.evento_id,
            COALESCE(h.evento_ref, '#' || v.numero || ' · ' || v.nome) AS evento_ref
     FROM equipamento_historico h LEFT JOIN eventos v ON v.id = h.evento_id
     WHERE h.equipamento_id = ? ORDER BY h.id DESC LIMIT 200`,
    id
  );
  return NextResponse.json({ equipamento, historico });
}

/**
 * PUT /api/equipamentos/:id
 * - Campos cadastrais (tipo, patrimônio, chip, série, base, status, observação): só se `tipo` vier no body.
 * - Alocação: se `evento_id` vier no body (número = alocar, null/"" = liberar). Transferência direta
 *   entre provas é bloqueada (409) — precisa liberar antes.
 * Tudo numa transação: ou aplica tudo, ou nada.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  await initDB();
  const id = idOuNull((await params).id);
  if (!id) return NextResponse.json({ error: "Equipamento inválido" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const usuario = (await getSession()).name || null;

  const temCadastro = "tipo" in body;
  const v = temCadastro ? validarCadastro(body) : null;
  if (v && !v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });

  const mexeAlocacao = "evento_id" in body;
  const novoEvento = mexeAlocacao ? idOuNull(body.evento_id) : null;
  if (mexeAlocacao && body.evento_id !== null && body.evento_id !== "" && novoEvento === null) {
    return NextResponse.json({ error: "Prova inválida" }, { status: 400 });
  }

  try {
    await dbTransaction(async (tx) => {
      const atual = await tx.execute({ sql: "SELECT evento_id FROM equipamentos WHERE id = ?", args: [id] });
      if (atual.rows.length === 0) throw new ErroEquipamento("Equipamento não encontrado", 404);
      const eventoAtual = atual.rows[0].evento_id == null ? null : Number(atual.rows[0].evento_id);

      // 1) Liberar primeiro (permite "liberar + mandar para manutenção" no mesmo salvamento)
      if (mexeAlocacao && novoEvento === null && eventoAtual !== null) {
        await liberarDaProva(tx, id, usuario);
      }
      if (mexeAlocacao && novoEvento !== null && eventoAtual !== null && novoEvento !== eventoAtual) {
        throw new ErroEquipamento("Este equipamento já está alocado a outra prova. Libere-o antes de transferir.", 409);
      }

      // 2) Cadastro + status
      if (v && v.ok) {
        const d = v.dados;
        await garantirBase(tx, d.base_id);
        await tx.execute({
          sql: `UPDATE equipamentos SET tipo = ?, patrimonio = ?, numero_chip = ?, operadora = ?, numero_serie = ?,
                base_id = ?, observacao = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          args: [d.tipo, d.patrimonio, d.numero_chip, d.operadora, d.numero_serie, d.base_id, d.observacao, id],
        });
        await mudarStatus(tx, id, d.status, usuario);
      }

      // 3) Alocar por último (já com o status final conhecido)
      if (mexeAlocacao && novoEvento !== null && eventoAtual === null) {
        await alocarNaProva(tx, novoEvento, [id], usuario);
      }
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return respostaErro(err, "erro ao atualizar");
  }
}

// DELETE /api/equipamentos/:id — só equipamentos livres (alocado precisa ser liberado antes)
export async function DELETE(_req: NextRequest, { params }: Params) {
  await initDB();
  const id = idOuNull((await params).id);
  if (!id) return NextResponse.json({ error: "Equipamento inválido" }, { status: 400 });
  try {
    await dbTransaction(async (tx) => {
      const r = await tx.execute({ sql: "SELECT patrimonio, evento_id, status FROM equipamentos WHERE id = ?", args: [id] });
      if (r.rows.length === 0) throw new ErroEquipamento("Equipamento não encontrado", 404);
      if (r.rows[0].status === "em_campo") {
        throw new ErroEquipamento(`Patrimônio ${r.rows[0].patrimonio} está em campo. Registre o retorno antes de excluir.`, 409);
      }
      if (r.rows[0].evento_id != null) {
        throw new ErroEquipamento(`Patrimônio ${r.rows[0].patrimonio} está alocado a uma prova. Libere-o antes de excluir.`, 409);
      }
      // Turso não força FK: apaga o histórico à mão
      await tx.execute({ sql: "DELETE FROM equipamento_historico WHERE equipamento_id = ?", args: [id] });
      await tx.execute({
        sql: "DELETE FROM equipamentos WHERE id = ? AND evento_id IS NULL AND status <> 'em_campo'",
        args: [id],
      });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return respostaErro(err, "erro ao excluir");
  }
}
