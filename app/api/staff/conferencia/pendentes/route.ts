import { NextResponse } from "next/server";
import { dbAll, initDB } from "@/lib/db";
import { getStaffSession } from "@/lib/staff-auth";
import { hojeBR } from "@/lib/conferencia-diaria";
import { provaNaJanelaStaff } from "@/lib/staff-prova";

// GET /api/staff/conferencia/pendentes — técnico: provas com conferência ativa sem a conferência de hoje
export async function GET() {
  await initDB();
  const s = await getStaffSession();
  if (!s || s.role !== "tecnico") return NextResponse.json([]);
  const hoje = hojeBR();
  const provas = await dbAll<{ id: number; numero: string; nome: string; data: string; enviada: number }>(
    `SELECT v.id, v.numero, v.nome, v.data,
            (SELECT COUNT(*) FROM staff_conferencia c WHERE c.evento_id = v.id AND c.data = ? AND c.tecnico_id = ?) AS enviada
     FROM eventos v JOIN evento_tecnicos et ON et.evento_id = v.id AND et.tecnico_id = ?
     WHERE v.conferencia_diaria = 1
       AND EXISTS (SELECT 1 FROM equipamentos e WHERE e.evento_id = v.id AND e.tipo = 'Celular')`,
    hoje,
    s.tecnicoId,
    s.tecnicoId
  );
  return NextResponse.json(provas.filter((p) => !p.enviada && provaNaJanelaStaff(p.data)).map(({ enviada: _e, ...p }) => p));
}
