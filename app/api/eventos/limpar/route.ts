import { NextResponse } from "next/server";
import { dbAll, dbBatch, initDB } from "@/lib/db";
import { statementsApagarEventos } from "@/lib/eventos-remocao";

export async function POST() {
  await initDB();
  // Apaga em lotes com o cascade completo (técnicos, produtos, itens, equipe, kits)
  // e libera os equipamentos por patrimônio, registrando no histórico.
  const ids = (await dbAll<{ id: number }>("SELECT id FROM eventos")).map((e) => Number(e.id));
  for (let i = 0; i < ids.length; i += 100) {
    await dbBatch(statementsApagarEventos(ids.slice(i, i + 100), "Todos os eventos foram limpos"));
  }
  return NextResponse.json({ ok: true, removidos: ids.length });
}
