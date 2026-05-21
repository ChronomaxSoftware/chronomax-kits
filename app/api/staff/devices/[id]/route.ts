import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbRun, initDB } from "@/lib/db";
import { getStaffSession } from "@/lib/staff-auth";
import { registrarAuditoria } from "@/lib/staff-audit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Apenas administradores" }, { status: 403 });
  const { id } = await params;
  const device = await dbGet("SELECT * FROM staff_devices WHERE id = ?", id);
  if (!device) return NextResponse.json({ error: "Aparelho não encontrado" }, { status: 404 });
  return NextResponse.json(device);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Apenas administradores" }, { status: 403 });
  const { id } = await params;
  const b = await req.json();

  const campos: Record<string, unknown> = {};
  for (const c of ["nome", "patrimonio", "modelo", "telefone", "imei", "observacoes"]) {
    if (c in b) campos[c] = typeof b[c] === "string" ? b[c].trim() || null : b[c];
  }
  if ("status" in b && (b.status === "disponivel" || b.status === "inativo" || b.status === "em_uso")) {
    campos.status = b.status;
  }

  const keys = Object.keys(campos);
  if (keys.length === 0) return NextResponse.json({ ok: true });

  const setSql = keys.map((k) => `${k} = ?`).join(", ");
  try {
    await dbRun(
      `UPDATE staff_devices SET ${setSql}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      ...keys.map((k) => campos[k]),
      id
    );
  } catch {
    return NextResponse.json({ error: "Já existe um aparelho com esse patrimônio" }, { status: 400 });
  }
  await registrarAuditoria(req, s.usuario, "Editou aparelho", `Aparelho #${id}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Apenas administradores" }, { status: 403 });
  const { id } = await params;

  // Nunca apagar histórico: só permite excluir aparelho sem movimentações.
  const hist = await dbGet<{ n: number }>("SELECT COUNT(*) AS n FROM staff_assignments WHERE device_id = ?", id);
  if (hist && Number(hist.n) > 0) {
    return NextResponse.json(
      { error: "Este aparelho possui histórico. Inative-o em vez de excluir (o histórico não pode ser apagado)." },
      { status: 400 }
    );
  }
  const dev = await dbGet<{ nome: string }>("SELECT nome FROM staff_devices WHERE id = ?", id);
  await dbRun("DELETE FROM staff_devices WHERE id = ?", id);
  await registrarAuditoria(req, s.usuario, "Excluiu aparelho", dev?.nome || `#${id}`);
  return NextResponse.json({ ok: true });
}
