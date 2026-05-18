import { NextResponse } from "next/server";
import { getProgresso } from "@/lib/sync-progress";

export async function GET() {
  return NextResponse.json(getProgresso());
}
