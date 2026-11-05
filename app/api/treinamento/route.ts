import { NextRequest, NextResponse } from "next/server";
import { dbAll, dbGet, dbRun, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { lerVideo } from "@/lib/treinamento";
import { SQL_TECNICOS_COM_ACESSO, listarVideos } from "@/lib/treinamento-db";

async function admin() {
  const s = await getSession();
  return s.isLoggedIn && s.role === "admin";
}

// GET — vídeos + quem assistiu cada um (e quantos técnicos têm acesso ao portal)
export async function GET() {
  await initDB();
  if (!(await admin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const [videos, assistidos, tecnicos] = await Promise.all([
    listarVideos(),
    dbAll<{ video_id: number; tecnico_id: number; nome: string; assistido_em: string }>(
      `SELECT a.video_id, a.tecnico_id, t.nome, a.assistido_em
         FROM treinamento_assistidos a JOIN tecnicos t ON t.id = a.tecnico_id
        ORDER BY a.assistido_em DESC`
    ),
    dbGet<{ n: number }>(`SELECT COUNT(*) AS n FROM (${SQL_TECNICOS_COM_ACESSO})`),
  ]);
  return NextResponse.json({
    totalTecnicos: Number(tecnicos?.n ?? 0),
    videos: videos.map((v) => ({
      ...v,
      assistidos: assistidos
        .filter((a) => Number(a.video_id) === v.id)
        .map((a) => ({ tecnico_id: Number(a.tecnico_id), nome: a.nome, assistido_em: a.assistido_em })),
    })),
  });
}

// POST { titulo, descricao?, categoria?, url } — entra no fim da lista
export async function POST(req: NextRequest) {
  await initDB();
  if (!(await admin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const v = lerVideo(await req.json().catch(() => null));
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });
  const prox = await dbGet<{ n: number }>("SELECT COALESCE(MAX(ordem), 0) + 1 AS n FROM treinamento_videos");
  const r = await dbRun(
    "INSERT INTO treinamento_videos (titulo, descricao, categoria, url, ordem) VALUES (?, ?, ?, ?, ?)",
    v.titulo,
    v.descricao,
    v.categoria,
    v.url,
    Number(prox?.n ?? 1)
  );
  return NextResponse.json({ ok: true, id: Number(r.lastInsertRowid) });
}
