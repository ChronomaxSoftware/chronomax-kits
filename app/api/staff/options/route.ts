import { NextResponse } from "next/server";
import { dbAll, initDB } from "@/lib/db";
import { getStaffSession } from "@/lib/staff-auth";
import { FUNCOES_STAFF } from "@/lib/staff";

// GET /api/staff/options — dados para filtros e seletores (admin + técnico)
export async function GET() {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const devices = await dbAll(
    "SELECT id, nome, patrimonio, status FROM staff_devices ORDER BY nome"
  );
  // Sem limite: o dropdown precisa de todos os eventos disponíveis.
  const eventos = await dbAll(
    "SELECT id, numero, nome, data FROM eventos ORDER BY id DESC"
  );

  return NextResponse.json({ devices, eventos, funcoes: FUNCOES_STAFF });
}
