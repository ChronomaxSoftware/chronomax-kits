import { NextRequest, NextResponse } from "next/server";
import { randomUUID, randomBytes } from "crypto";
import { dbAll, dbBatch, initDB } from "@/lib/db";
import { getStaffSession } from "@/lib/staff-auth";
import { registrarAuditoria } from "@/lib/staff-audit";

// POST /api/staff/devices/bulk — cria N aparelhos numerados (admin) e devolve uuid+token
// para o cliente gerar os QR Codes. Não pede dados do celular (cadastro só do número).
export async function POST(req: NextRequest) {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (s.role !== "admin") return NextResponse.json({ error: "Apenas administradores" }, { status: 403 });

  const b = await req.json();
  const quantidade = Math.max(1, Math.min(300, parseInt(b.quantidade) || 0));
  if (!quantidade) return NextResponse.json({ error: "Quantidade inválida" }, { status: 400 });
  const inicio = Math.max(1, parseInt(b.inicio) || 1);
  const prefixo = (b.prefixo || "").trim();
  const fim = inicio + quantidade - 1;
  const pad = String(fim).length;

  const novos: { uuid: string; secure_token: string; nome: string; numero: number }[] = [];
  for (let n = inicio; n <= fim; n++) {
    novos.push({
      uuid: randomUUID(),
      secure_token: randomBytes(32).toString("hex"),
      nome: `${prefixo}${String(n).padStart(pad, "0")}`,
      numero: n,
    });
  }

  // Insere em chunks (limite do batch do libsql)
  const stmts = novos.map((x) => ({
    sql: "INSERT INTO staff_devices (uuid, secure_token, nome, status) VALUES (?, ?, ?, 'disponivel')",
    args: [x.uuid, x.secure_token, x.nome] as string[],
  }));
  for (let i = 0; i < stmts.length; i += 200) {
    await dbBatch(stmts.slice(i, i + 200));
  }

  // Recupera os ids gerados (por uuid) para montar o payload do QR
  const idByUuid = new Map<string, number>();
  const uuids = novos.map((x) => x.uuid);
  for (let i = 0; i < uuids.length; i += 200) {
    const chunk = uuids.slice(i, i + 200);
    const ph = chunk.map(() => "?").join(",");
    const rows = await dbAll<{ id: number; uuid: string }>(
      `SELECT id, uuid FROM staff_devices WHERE uuid IN (${ph})`,
      ...chunk
    );
    for (const r of rows) idByUuid.set(r.uuid, r.id);
  }

  await registrarAuditoria(req, s.usuario, "Gerou QR em lote", `${quantidade} aparelhos (${inicio}–${fim})`);

  return NextResponse.json(
    novos.map((x) => ({
      id: idByUuid.get(x.uuid),
      uuid: x.uuid,
      secure_token: x.secure_token,
      nome: x.nome,
      numero: x.numero,
    }))
  );
}
