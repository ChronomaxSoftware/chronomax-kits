import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbRun, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ENDERECO_MAX, OBS_ENVIO_MAX, normalizarDataEnvio } from "@/lib/envios";

/** Card "📦 Envio" da prova (só escritório com acesso total). */
async function admin() {
  const s = await getSession();
  return s.isLoggedIn && s.role === "admin" ? s : null;
}

async function ler(id: number) {
  return (await dbGet("SELECT * FROM envio_status WHERE evento_id = ?", id)) ?? null;
}

// GET — o envio da prova (null = não está na aba Envios)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  if (!(await admin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json(await ler(Number((await params).id)));
}

// PUT { data_envio?, endereco?, obs? } — inclui a prova na aba (se ainda não está) e salva os campos
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  const s = await admin();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const id = Number((await params).id);
  const ev = await dbGet<{ id: number }>("SELECT id FROM eventos WHERE id = ?", id);
  if (!ev) return NextResponse.json({ error: "Prova não encontrada" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const quem = s.name || s.username || null;
  const agora = new Date().toISOString();

  const sets: string[] = [];
  const vals: unknown[] = [];
  if ("data_envio" in body) {
    const d = normalizarDataEnvio(body.data_envio);
    if (d === undefined) return NextResponse.json({ error: "Data de envio inválida" }, { status: 400 });
    sets.push("data_envio = ?");
    vals.push(d);
  }
  if ("endereco" in body) {
    sets.push("endereco = ?");
    vals.push(String(body.endereco ?? "").trim().slice(0, ENDERECO_MAX) || null);
  }
  if ("obs" in body) {
    const obs = String(body.obs ?? "").trim().slice(0, OBS_ENVIO_MAX);
    sets.push("obs = ?", "obs_em = ?", "obs_por = ?");
    vals.push(obs || null, obs ? agora : null, obs ? quem : null);
  }

  await dbRun("INSERT OR IGNORE INTO envio_status (evento_id, criado_em, criado_por) VALUES (?, ?, ?)", id, agora, quem);
  if (sets.length) await dbRun(`UPDATE envio_status SET ${sets.join(", ")} WHERE evento_id = ?`, ...vals, id);
  return NextResponse.json(await ler(id));
}

// DELETE — tira a prova da aba Envios (apaga as marcações dela)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  if (!(await admin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  await dbRun("DELETE FROM envio_status WHERE evento_id = ?", Number((await params).id));
  return NextResponse.json({ ok: true });
}
