import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST() {
  const r = db.prepare("DELETE FROM eventos").run();
  return NextResponse.json({ ok: true, removidos: r.changes });
}
