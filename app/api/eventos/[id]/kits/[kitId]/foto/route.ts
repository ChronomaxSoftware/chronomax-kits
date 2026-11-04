import { NextRequest, NextResponse } from "next/server";
import { initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { respostaFotoKit } from "@/lib/kits-foto-db";

// GET — foto do kit (escritório)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; kitId: string }> }) {
  await initDB();
  const s = await getSession();
  if (!s.isLoggedIn || s.role !== "admin") return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id, kitId } = await params;
  return respostaFotoKit(Number(kitId), Number(id));
}
