import { NextResponse } from "next/server";
import { dbAll, initDB } from "@/lib/db";
import { getStaffSession } from "@/lib/staff-auth";
import { provaNaJanelaStaff } from "@/lib/staff-prova";

// GET /api/staff/provas — provas (7 dias atrás → 30 à frente) com celular alocado.
// Técnico: só as provas em que está escalado.
export async function GET() {
  await initDB();
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const filtroTecnico =
    s.role === "tecnico" ? "AND v.id IN (SELECT evento_id FROM evento_tecnicos WHERE tecnico_id = ?)" : "";
  const provas = await dbAll<{ id: number; numero: string; nome: string; data: string; cidade: string | null; uf: string | null; celulares: number }>(
    `SELECT v.id, v.numero, v.nome, v.data, v.cidade, v.uf, COUNT(e.id) AS celulares
     FROM eventos v JOIN equipamentos e ON e.evento_id = v.id AND e.tipo = 'Celular'
     WHERE 1 = 1 ${filtroTecnico}
     GROUP BY v.id`,
    ...(s.role === "tecnico" ? [s.tecnicoId] : [])
  );
  return NextResponse.json(provas.filter((p) => provaNaJanelaStaff(p.data)));
}
