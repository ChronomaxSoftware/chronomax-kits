import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const TIPOS: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  // Sanitização: nada de ".." nem barra inicial
  const limpo = parts.map((p) => p.replace(/[^\w.\-]/g, ""));
  const cheio = path.join(process.cwd(), "data", "uploads", ...limpo);
  try {
    const buf = await fs.readFile(cheio);
    const ext = (limpo[limpo.length - 1].split(".").pop() || "").toLowerCase();
    const tipo = TIPOS[ext] || "application/octet-stream";
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": tipo,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Não encontrado", { status: 404 });
  }
}
