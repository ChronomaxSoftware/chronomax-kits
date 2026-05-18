import { NextResponse } from "next/server";
import { dbRun, initDB } from "@/lib/db";

export async function POST() {
  await initDB();
  const r = await dbRun("DELETE FROM eventos");
  return NextResponse.json({ ok: true, removidos: r.changes });
}
