import { NextRequest, NextResponse } from "next/server";
import { dbGet, initDB } from "@/lib/db";
import { getStaffSession } from "@/lib/staff-auth";

type DeviceRow = {
  id: number;
  uuid: string;
  secure_token: string;
  nome: string;
  patrimonio: string | null;
  modelo: string | null;
  telefone: string | null;
  imei: string | null;
  observacoes: string | null;
  status: string;
};

// POST /api/staff/scan — valida o QR (uuid + secure_token) e devolve o aparelho + vínculo aberto.
export async function POST(req: NextRequest) {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const b = await req.json();
  let uuid: string | undefined = b.uuid;
  let token: string | undefined = b.secureToken ?? b.secure_token;
  if (b.payload) {
    try {
      const p = JSON.parse(b.payload);
      uuid = p.uuid;
      token = p.secureToken ?? p.secure_token;
    } catch {
      return NextResponse.json({ error: "QR ilegível" }, { status: 400 });
    }
  }
  if (!uuid || !token) return NextResponse.json({ error: "QR inválido" }, { status: 400 });

  const device = await dbGet<DeviceRow>("SELECT * FROM staff_devices WHERE uuid = ?", uuid);
  // Proteção contra QR falsificado: UUID precisa existir E o token bater exatamente.
  if (!device || device.secure_token !== token) {
    return NextResponse.json({ error: "QR não reconhecido ou inválido" }, { status: 404 });
  }
  if (device.status === "inativo") {
    return NextResponse.json({ error: "Este aparelho está inativo" }, { status: 400 });
  }

  const atual = await dbGet(
    "SELECT id, colaborador, funcao, observacao, inicio, event_id FROM staff_assignments WHERE device_id = ? AND fim IS NULL",
    device.id
  );

  return NextResponse.json({
    device: {
      id: device.id,
      uuid: device.uuid,
      nome: device.nome,
      patrimonio: device.patrimonio,
      modelo: device.modelo,
      telefone: device.telefone,
      imei: device.imei,
      status: device.status,
    },
    atual: atual || null,
  });
}
