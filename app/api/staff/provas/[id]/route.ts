import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomUUID } from "crypto";
import { dbAll, dbGet, dbRun, initDB } from "@/lib/db";
import { getStaffSession, type StaffSession } from "@/lib/staff-auth";
import { registrarAuditoria } from "@/lib/staff-audit";
import { nomeAparelhoStaff } from "@/lib/staff-prova";

/** Técnico só mexe nas provas em que está escalado; escritório em todas. */
async function podeVer(s: StaffSession, eventoId: number): Promise<boolean> {
  if (s.role !== "tecnico") return true;
  return !!(await dbGet(
    "SELECT 1 AS ok FROM evento_tecnicos WHERE evento_id = ? AND tecnico_id = ?",
    eventoId,
    s.tecnicoId
  ));
}

// GET /api/staff/provas/[id] — celulares da prova (Inventário) + aparelho do Staff e vínculo aberto
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const eventoId = Number((await params).id);
  if (!(await podeVer(s, eventoId))) return NextResponse.json({ error: "Você não está nesta prova" }, { status: 403 });

  const prova = await dbGet("SELECT id, numero, nome, data, cidade, uf FROM eventos WHERE id = ?", eventoId);
  if (!prova) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  // Aparelho do Staff casado pelo patrimônio (sem diferenciar maiúsculas); vínculo aberto, se houver
  const celulares = await dbAll(
    `SELECT e.id AS equipamento_id, e.tipo, e.patrimonio, e.numero_chip, e.status,
            d.id AS device_id, d.status AS device_status,
            a.id AS vinculo_id, a.colaborador, a.funcao, a.inicio
     FROM equipamentos e
     LEFT JOIN staff_devices d ON UPPER(TRIM(d.patrimonio)) = UPPER(TRIM(e.patrimonio))
     LEFT JOIN staff_assignments a ON a.device_id = d.id AND a.fim IS NULL
     WHERE e.evento_id = ? AND e.tipo = 'Celular'
     ORDER BY e.patrimonio`,
    eventoId
  );
  // Nomes da equipe convocada no Gestão, para sugerir ao vincular
  const equipe = (
    await dbAll<{ nome: string }>("SELECT DISTINCT nome FROM evento_equipe_gestao WHERE evento_id = ? ORDER BY nome", eventoId)
  ).map((r) => r.nome);

  return NextResponse.json({ prova, celulares, equipe });
}

// POST /api/staff/provas/[id] { equipamento_id } — garante o aparelho no cadastro do Staff (pelo patrimônio)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const eventoId = Number((await params).id);
  if (!(await podeVer(s, eventoId))) return NextResponse.json({ error: "Você não está nesta prova" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const eq = await dbGet<{ tipo: string; patrimonio: string; numero_chip: string | null }>(
    "SELECT tipo, patrimonio, numero_chip FROM equipamentos WHERE id = ? AND evento_id = ?",
    Number(b.equipamento_id),
    eventoId
  );
  if (!eq) return NextResponse.json({ error: "Celular não está nesta prova" }, { status: 404 });

  const existente = await dbGet<{ id: number; status: string }>(
    "SELECT id, status FROM staff_devices WHERE UPPER(TRIM(patrimonio)) = UPPER(TRIM(?))",
    eq.patrimonio
  );
  if (existente) {
    if (existente.status === "inativo") {
      return NextResponse.json({ error: "Este aparelho está inativo no Controle de Staff" }, { status: 400 });
    }
    return NextResponse.json({ device_id: existente.id });
  }

  const nome = nomeAparelhoStaff(eq.tipo, eq.patrimonio);
  const r = await dbRun(
    `INSERT INTO staff_devices (uuid, secure_token, nome, patrimonio, telefone, status)
     VALUES (?, ?, ?, ?, ?, 'disponivel')`,
    randomUUID(),
    randomBytes(32).toString("hex"),
    nome,
    eq.patrimonio,
    eq.numero_chip
  );
  await registrarAuditoria(req, s.usuario, "Criou aparelho (da prova)", `${nome} — pelo Inventário`);
  return NextResponse.json({ device_id: r.lastInsertRowid });
}
