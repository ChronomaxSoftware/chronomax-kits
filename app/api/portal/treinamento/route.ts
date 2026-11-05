import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbGet, dbRun, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { listarVideos } from "@/lib/treinamento-db";

async function tecnicoLogado() {
  const s = await getSession();
  return s.isLoggedIn && s.role === "tecnico" && s.tecnicoId ? s.tecnicoId : null;
}

// GET — vídeos do treinamento com o que o técnico logado já marcou como assistido
export async function GET() {
  await initDB();
  const tid = await tecnicoLogado();
  if (!tid) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const [videos, meus] = await Promise.all([
    listarVideos(),
    dbAll<{ video_id: number; assistido_em: string }>(
      "SELECT video_id, assistido_em FROM treinamento_assistidos WHERE tecnico_id = ?",
      tid
    ),
  ]);
  const mapa = new Map(meus.map((m) => [Number(m.video_id), m.assistido_em]));
  return NextResponse.json(videos.map((v) => ({ ...v, assistido_em: mapa.get(v.id) ?? null })));
}

// POST { video_id, assistido: boolean } — marca/desmarca só para o próprio técnico
export async function POST(req: NextRequest) {
  await initDB();
  const tid = await tecnicoLogado();
  if (!tid) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const videoId = Number(body?.video_id);
  if (!Number.isInteger(videoId) || videoId <= 0) return NextResponse.json({ error: "Vídeo inválido" }, { status: 400 });
  const existe = await dbGet("SELECT id FROM treinamento_videos WHERE id = ?", videoId);
  if (!existe) return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 });
  if (body?.assistido) {
    await dbRun(
      "INSERT OR IGNORE INTO treinamento_assistidos (video_id, tecnico_id) VALUES (?, ?)",
      videoId,
      tid
    );
  } else {
    await dbRun("DELETE FROM treinamento_assistidos WHERE video_id = ? AND tecnico_id = ?", videoId, tid);
  }
  return NextResponse.json({ ok: true });
}
