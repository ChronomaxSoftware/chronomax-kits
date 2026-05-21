import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbRun, initDB } from "@/lib/db";
import { getStaffSession, getClientInfo } from "@/lib/staff-auth";
import { registrarAuditoria } from "@/lib/staff-audit";

type Aberto = { id: number; inicio: string; colaborador: string };

async function fecharAberto(deviceId: number): Promise<Aberto | null> {
  const aberto = await dbGet<Aberto>(
    "SELECT id, inicio, colaborador FROM staff_assignments WHERE device_id = ? AND fim IS NULL",
    deviceId
  );
  if (!aberto) return null;
  const fim = new Date().toISOString();
  const ini = Date.parse(aberto.inicio);
  const tempo = isNaN(ini) ? null : Math.max(0, Math.round((Date.parse(fim) - ini) / 1000));
  await dbRun(
    "UPDATE staff_assignments SET fim = ?, tempo_total = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    fim,
    tempo,
    aberto.id
  );
  return aberto;
}

// POST /api/staff/assignments — action: vincular | trocar | finalizar (admin + técnico)
export async function POST(req: NextRequest) {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const b = await req.json();
  const action: string = b.action;
  const deviceId = Number(b.device_id);
  if (!deviceId) return NextResponse.json({ error: "Aparelho não informado" }, { status: 400 });

  const device = await dbGet<{ id: number; nome: string; status: string }>(
    "SELECT id, nome, status FROM staff_devices WHERE id = ?",
    deviceId
  );
  if (!device) return NextResponse.json({ error: "Aparelho não encontrado" }, { status: 404 });
  if (device.status === "inativo") return NextResponse.json({ error: "Aparelho inativo" }, { status: 400 });

  const eventId = b.event_id ? Number(b.event_id) : null;

  if (action === "finalizar") {
    const aberto = await fecharAberto(deviceId);
    await dbRun(
      "UPDATE staff_devices SET status = 'disponivel', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      deviceId
    );
    await registrarAuditoria(
      req,
      s.usuario,
      "Finalizou utilização",
      `${device.nome} — colaborador ${aberto?.colaborador || "?"}`
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "vincular" || action === "trocar") {
    const colaborador = (b.colaborador || "").trim();
    if (!colaborador) return NextResponse.json({ error: "Nome do colaborador obrigatório" }, { status: 400 });
    const funcao = (b.funcao || "").trim() || null;
    const observacao = (b.observacao || "").trim() || null;

    const aberto = await fecharAberto(deviceId); // encerra o vínculo anterior, se houver (nunca apaga)

    const inicio = new Date().toISOString();
    const { ip, navegador } = getClientInfo(req);
    await dbRun(
      `INSERT INTO staff_assignments (event_id, device_id, colaborador, funcao, observacao, inicio, created_by, ip, navegador)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      eventId,
      deviceId,
      colaborador,
      funcao,
      observacao,
      inicio,
      s.usuario,
      ip,
      navegador
    );
    await dbRun(
      "UPDATE staff_devices SET status = 'em_uso', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      deviceId
    );

    if (aberto) {
      await registrarAuditoria(
        req,
        s.usuario,
        "Troca de responsável",
        `${device.nome}: ${aberto.colaborador} → ${colaborador}`
      );
    } else {
      await registrarAuditoria(req, s.usuario, "Vinculou colaborador", `${device.nome} → ${colaborador}`);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
