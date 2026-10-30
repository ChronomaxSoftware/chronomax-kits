import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbGet, dbRun, initDB } from "@/lib/db";
import { getStaffSession } from "@/lib/staff-auth";
import { registrarAuditoria } from "@/lib/staff-audit";
import { celularesDoTecnico, hojeBR, textoAlertaConferencia, type StatusConferencia } from "@/lib/conferencia-diaria";

type Cel = { equipamento_id: number; patrimonio: string; numero_chip: string | null; com_tecnico_id: number | null; com_tecnico: string | null };

async function celularesDaProva(eventoId: number): Promise<Cel[]> {
  return dbAll<Cel>(
    `SELECT e.id AS equipamento_id, e.patrimonio, e.numero_chip, ct.tecnico_id AS com_tecnico_id, t.nome AS com_tecnico
     FROM equipamentos e
     LEFT JOIN staff_celular_tecnico ct ON ct.evento_id = e.evento_id AND ct.equipamento_id = e.id
     LEFT JOIN tecnicos t ON t.id = ct.tecnico_id
     WHERE e.evento_id = ? AND e.tipo = 'Celular' ORDER BY e.patrimonio`,
    eventoId
  );
}

// GET /api/staff/conferencia/[id] — se a conferência está ativa, celulares (técnico: os dele) e os registros
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const eventoId = Number((await params).id);
  if (s.role === "tecnico") {
    const esc = await dbGet("SELECT 1 AS ok FROM evento_tecnicos WHERE evento_id = ? AND tecnico_id = ?", eventoId, s.tecnicoId);
    if (!esc) return NextResponse.json({ error: "Você não está nesta prova" }, { status: 403 });
  }
  const ev = await dbGet<{ conferencia_diaria: number | null }>("SELECT conferencia_diaria FROM eventos WHERE id = ?", eventoId);
  if (!ev) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const todos = await celularesDaProva(eventoId);
  const celulares = s.role === "tecnico" && s.tecnicoId ? celularesDoTecnico(todos, s.tecnicoId) : todos;
  const registros = await dbAll(
    `SELECT c.data, c.equipamento_id, c.status, c.obs, c.em, t.nome AS tecnico
     FROM staff_conferencia c LEFT JOIN tecnicos t ON t.id = c.tecnico_id
     WHERE c.evento_id = ? ORDER BY c.data`,
    eventoId
  );
  return NextResponse.json({ ativa: !!ev.conferencia_diaria, hoje: hojeBR(), celulares, registros });
}

/**
 * POST /api/staff/conferencia/[id]
 * escritório: { ativa: boolean }  → liga/desliga a conferência diária da prova
 * técnico:    { itens: [{ equipamento_id, status: "ok"|"problema", obs? }] } → conferência de hoje
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const eventoId = Number((await params).id);
  const b = await req.json().catch(() => ({}));

  if (s.role !== "tecnico") {
    if (typeof b.ativa !== "boolean") return NextResponse.json({ error: "Informe ativa: true/false" }, { status: 400 });
    await dbRun("UPDATE eventos SET conferencia_diaria = ? WHERE id = ?", b.ativa ? 1 : 0, eventoId);
    await registrarAuditoria(req, s.usuario, b.ativa ? "Ativou conferência diária" : "Desativou conferência diária", `prova ${eventoId}`);
    return NextResponse.json({ ok: true, ativa: b.ativa });
  }

  if ("ativa" in b) return NextResponse.json({ error: "Só o escritório liga a conferência diária" }, { status: 403 });
  const esc = await dbGet("SELECT 1 AS ok FROM evento_tecnicos WHERE evento_id = ? AND tecnico_id = ?", eventoId, s.tecnicoId);
  if (!esc) return NextResponse.json({ error: "Você não está nesta prova" }, { status: 403 });
  const ev = await dbGet<{ conferencia_diaria: number | null; nome: string; numero: string }>(
    "SELECT conferencia_diaria, nome, numero FROM eventos WHERE id = ?",
    eventoId
  );
  if (!ev?.conferencia_diaria) return NextResponse.json({ error: "A conferência diária não está ativa nesta prova" }, { status: 409 });

  const meus = new Map(celularesDoTecnico(await celularesDaProva(eventoId), s.tecnicoId!).map((c) => [c.equipamento_id, c]));
  const itens: { equipamento_id: number; status: StatusConferencia; obs: string | null; patrimonio: string }[] = [];
  for (const it of Array.isArray(b.itens) ? b.itens : []) {
    const cel = meus.get(Number(it.equipamento_id));
    if (!cel || (it.status !== "ok" && it.status !== "problema")) continue;
    const obs = typeof it.obs === "string" ? it.obs.trim().slice(0, 300) || null : null;
    if (it.status === "problema" && !obs) {
      return NextResponse.json({ error: `Descreva o problema do ${cel.patrimonio}` }, { status: 400 });
    }
    itens.push({ equipamento_id: cel.equipamento_id, status: it.status, obs, patrimonio: cel.patrimonio });
  }
  if (itens.length === 0) return NextResponse.json({ error: "Confira pelo menos um celular" }, { status: 400 });

  const dia = hojeBR();
  const agora = new Date().toISOString();
  for (const it of itens) {
    await dbRun(
      `INSERT INTO staff_conferencia (evento_id, data, equipamento_id, tecnico_id, status, obs, em) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(evento_id, data, equipamento_id) DO UPDATE SET
         tecnico_id = excluded.tecnico_id, status = excluded.status, obs = excluded.obs, em = excluded.em`,
      eventoId,
      dia,
      it.equipamento_id,
      s.tecnicoId,
      it.status,
      it.obs,
      agora
    );
  }
  const mensagem = textoAlertaConferencia(s.usuario, `${ev.nome} (#${ev.numero})`, dia, itens);
  await dbRun(
    "INSERT INTO alertas (tipo, evento_id, tecnico_id, mensagem, criado_em) VALUES ('conferencia', ?, ?, ?, ?)",
    eventoId,
    s.tecnicoId,
    mensagem,
    agora
  );
  return NextResponse.json({ ok: true, dia, conferidos: itens.length, problemas: itens.filter((i) => i.status === "problema").length });
}
