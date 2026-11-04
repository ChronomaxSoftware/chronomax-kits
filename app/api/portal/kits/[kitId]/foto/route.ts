import { NextRequest, NextResponse } from "next/server";
import { dbGet, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { respostaFotoKit } from "@/lib/kits-foto-db";

// GET — foto do kit para o técnico: só de prova em que ele está escalado
export async function GET(_req: NextRequest, { params }: { params: Promise<{ kitId: string }> }) {
  await initDB();
  const s = await getSession();
  if (!s.isLoggedIn || s.role !== "tecnico" || !s.tecnicoId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const kitId = Number((await params).kitId);
  const escalado = await dbGet(
    `SELECT 1 FROM evento_kits k JOIN evento_tecnicos et ON et.evento_id = k.evento_id
     WHERE k.id = ? AND et.tecnico_id = ?`,
    kitId,
    s.tecnicoId
  );
  if (!escalado) return new NextResponse("Não encontrado", { status: 404 });
  return respostaFotoKit(kitId);
}
