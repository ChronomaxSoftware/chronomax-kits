import { NextRequest, NextResponse } from "next/server";
import { randomUUID, randomBytes } from "crypto";
import { dbAll, dbGet, dbRun, initDB } from "@/lib/db";
import { getStaffSession } from "@/lib/staff-auth";
import { registrarAuditoria } from "@/lib/staff-audit";

// GET /api/staff/devices — lista aparelhos (admin). Inclui o vínculo aberto, se houver.
export async function GET() {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Apenas administradores" }, { status: 403 });

  const rows = await dbAll(
    `SELECT d.*,
            a.colaborador AS atual_colaborador,
            a.funcao AS atual_funcao,
            a.inicio AS atual_inicio
     FROM staff_devices d
     LEFT JOIN staff_assignments a ON a.device_id = d.id AND a.fim IS NULL
     ORDER BY d.nome`
  );
  return NextResponse.json(rows);
}

// POST /api/staff/devices — cria aparelho (admin). Gera UUID v4 + token seguro.
export async function POST(req: NextRequest) {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Apenas administradores" }, { status: 403 });

  const b = await req.json();
  if (!b.nome?.trim()) return NextResponse.json({ error: "Nome do aparelho obrigatório" }, { status: 400 });

  const patrimonio = b.patrimonio?.trim() || null;
  if (patrimonio) {
    const ex = await dbGet("SELECT id FROM staff_devices WHERE patrimonio = ?", patrimonio);
    if (ex) return NextResponse.json({ error: "Já existe um aparelho com esse patrimônio" }, { status: 400 });
  }

  const uuid = randomUUID();
  const secure_token = randomBytes(32).toString("hex");
  const r = await dbRun(
    `INSERT INTO staff_devices (uuid, secure_token, nome, patrimonio, modelo, telefone, imei, observacoes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    uuid,
    secure_token,
    b.nome.trim(),
    patrimonio,
    b.modelo?.trim() || null,
    b.telefone?.trim() || null,
    b.imei?.trim() || null,
    b.observacoes?.trim() || null,
    b.status === "inativo" ? "inativo" : "disponivel"
  );
  await registrarAuditoria(req, s.usuario, "Criou aparelho", `${b.nome} (patrimônio ${patrimonio || "-"})`);
  return NextResponse.json({ id: r.lastInsertRowid, uuid });
}
