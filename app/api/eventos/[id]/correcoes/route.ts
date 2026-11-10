import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbRun, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { atualizarConfirmacao, listarCorrecoes } from "@/lib/correcoes-db";

async function admin() {
  const s = await getSession();
  return s.isLoggedIn && s.role === "admin";
}

// GET /api/eventos/[id]/correcoes — pedidos de correção de quantidade da prova (mais novos primeiro)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  if (!(await admin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json(await listarCorrecoes(id));
}

// POST /api/eventos/[id]/correcoes  { correcao_id, acao: "aprovar" | "recusar", motivo? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initDB();
  if (!(await admin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const acao = body.acao;
  if (acao !== "aprovar" && acao !== "recusar") return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  const motivo = typeof body.motivo === "string" ? body.motivo.trim().slice(0, 500) || null : null;

  const c = await dbGet<{ id: number; tecnico_id: number; produto_id: number; qtd_pedida: number; status: string }>(
    "SELECT id, tecnico_id, produto_id, qtd_pedida, status FROM correcoes_quantidade WHERE id = ? AND evento_id = ?",
    body.correcao_id,
    id
  );
  if (!c) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  if (c.status !== "pendente") return NextResponse.json({ error: "Este pedido já foi decidido." }, { status: 409 });

  const agora = new Date().toISOString();
  const r = await dbRun(
    "UPDATE correcoes_quantidade SET status = ?, motivo = ?, decidido_em = ? WHERE id = ? AND status = 'pendente'",
    acao === "aprovar" ? "aprovado" : "recusado",
    motivo,
    agora,
    c.id
  );
  if (r.changes === 0) return NextResponse.json({ error: "Este pedido já foi decidido." }, { status: 409 });

  if (acao === "aprovar") {
    await dbRun(
      "UPDATE evento_produtos SET qtd_recebida = ?, recebido = 1, recebido_em = COALESCE(recebido_em, ?) WHERE evento_id = ? AND produto_id = ?",
      c.qtd_pedida,
      agora,
      id,
      c.produto_id
    );
    await atualizarConfirmacao(id, Number(c.tecnico_id), agora);
  }
  return NextResponse.json({ ok: true });
}
