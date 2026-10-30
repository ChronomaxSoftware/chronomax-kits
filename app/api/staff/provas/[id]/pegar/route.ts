import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbRun, initDB } from "@/lib/db";
import { getStaffSession } from "@/lib/staff-auth";
import { registrarAuditoria } from "@/lib/staff-audit";

/**
 * POST /api/staff/provas/[id]/pegar  { equipamentos: number[], acao: "pegar" | "soltar" }
 * Prova com mais de um técnico: cada um marca os celulares que pegou (um técnico por celular).
 * Técnico pega só os livres e solta só os seus; o escritório pode soltar qualquer um.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const eventoId = Number((await params).id);

  const b = await req.json().catch(() => ({}));
  const ids: number[] = Array.isArray(b.equipamentos) ? b.equipamentos.map(Number).filter((n: number) => n > 0) : [];
  if (ids.length === 0) return NextResponse.json({ error: "Escolha pelo menos um celular" }, { status: 400 });

  if (b.acao === "pegar") {
    if (s.role !== "tecnico" || !s.tecnicoId) {
      return NextResponse.json({ error: "Só o técnico da prova marca os celulares que pegou" }, { status: 403 });
    }
    const escalado = await dbGet(
      "SELECT 1 AS ok FROM evento_tecnicos WHERE evento_id = ? AND tecnico_id = ?",
      eventoId,
      s.tecnicoId
    );
    if (!escalado) return NextResponse.json({ error: "Você não está nesta prova" }, { status: 403 });

    const agora = new Date().toISOString();
    const pegos: number[] = [];
    const deOutro: number[] = [];
    for (const id of ids) {
      const daProva = await dbGet("SELECT 1 AS ok FROM equipamentos WHERE id = ? AND evento_id = ? AND tipo = 'Celular'", id, eventoId);
      if (!daProva) continue;
      // Só pega se ninguém pegou (corrida entre dois técnicos: o primeiro fica)
      const r = await dbRun(
        `INSERT INTO staff_celular_tecnico (evento_id, equipamento_id, tecnico_id, pego_em) VALUES (?, ?, ?, ?)
         ON CONFLICT(evento_id, equipamento_id) DO NOTHING`,
        eventoId,
        id,
        s.tecnicoId,
        agora
      );
      if (r.changes > 0) pegos.push(id);
      else {
        const dono = await dbGet<{ tecnico_id: number }>(
          "SELECT tecnico_id FROM staff_celular_tecnico WHERE evento_id = ? AND equipamento_id = ?",
          eventoId,
          id
        );
        if (dono && dono.tecnico_id !== s.tecnicoId) deOutro.push(id);
      }
    }
    if (pegos.length) {
      await registrarAuditoria(req, s.usuario, "Pegou celulares da prova", `prova ${eventoId}: ${pegos.length} celular(es)`);
    }
    return NextResponse.json({ ok: true, pegos: pegos.length, de_outro: deOutro.length });
  }

  if (b.acao === "soltar") {
    let soltos = 0;
    for (const id of ids) {
      const r =
        s.role === "tecnico"
          ? await dbRun(
              "DELETE FROM staff_celular_tecnico WHERE evento_id = ? AND equipamento_id = ? AND tecnico_id = ?",
              eventoId,
              id,
              s.tecnicoId
            )
          : await dbRun("DELETE FROM staff_celular_tecnico WHERE evento_id = ? AND equipamento_id = ?", eventoId, id);
      soltos += r.changes;
    }
    if (soltos) await registrarAuditoria(req, s.usuario, "Soltou celulares da prova", `prova ${eventoId}: ${soltos} celular(es)`);
    return NextResponse.json({ ok: true, soltos });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
