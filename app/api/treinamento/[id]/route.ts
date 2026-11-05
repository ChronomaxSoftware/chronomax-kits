import { NextRequest, NextResponse } from "next/server";
import { dbBatch, dbGet, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { lerVideo } from "@/lib/treinamento";

async function admin() {
  const s = await getSession();
  return s.isLoggedIn && s.role === "admin";
}

type Ctx = { params: Promise<{ id: string }> };

// PUT { titulo, descricao?, categoria?, url } edita; PUT { mover: "cima" | "baixo" } troca de lugar com o vizinho
export async function PUT(req: NextRequest, { params }: Ctx) {
  await initDB();
  if (!(await admin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const id = Number((await params).id);
  const atual = await dbGet<{ id: number; ordem: number }>("SELECT id, ordem FROM treinamento_videos WHERE id = ?", id);
  if (!atual) return NextResponse.json({ error: "Vídeo não encontrado" }, { status: 404 });
  const body = await req.json().catch(() => null);

  if (body && (body.mover === "cima" || body.mover === "baixo")) {
    const cima = body.mover === "cima";
    const ordem = Number(atual.ordem ?? 0);
    const vizinho = await dbGet<{ id: number; ordem: number }>(
      cima
        ? "SELECT id, ordem FROM treinamento_videos WHERE ordem < ? OR (ordem = ? AND id < ?) ORDER BY ordem DESC, id DESC LIMIT 1"
        : "SELECT id, ordem FROM treinamento_videos WHERE ordem > ? OR (ordem = ? AND id > ?) ORDER BY ordem, id LIMIT 1",
      ordem,
      ordem,
      id
    );
    if (!vizinho) return NextResponse.json({ ok: true });
    let ov = Number(vizinho.ordem ?? 0);
    let oa = ordem;
    if (ov === oa) {
      // ordens iguais (legado): abre espaço
      oa = cima ? ov - 1 : ov + 1;
    } else [oa, ov] = [ov, oa];
    await dbBatch([
      { sql: "UPDATE treinamento_videos SET ordem = ? WHERE id = ?", args: [oa, id] },
      { sql: "UPDATE treinamento_videos SET ordem = ? WHERE id = ?", args: [ov, Number(vizinho.id)] },
    ]);
    return NextResponse.json({ ok: true });
  }

  const v = lerVideo(body);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });
  await dbBatch([
    {
      sql: "UPDATE treinamento_videos SET titulo = ?, descricao = ?, categoria = ?, url = ? WHERE id = ?",
      args: [v.titulo, v.descricao, v.categoria, v.url, id],
    },
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  await initDB();
  if (!(await admin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const id = Number((await params).id);
  await dbBatch([
    { sql: "DELETE FROM treinamento_assistidos WHERE video_id = ?", args: [id] },
    { sql: "DELETE FROM treinamento_videos WHERE id = ?", args: [id] },
  ]);
  return NextResponse.json({ ok: true });
}
