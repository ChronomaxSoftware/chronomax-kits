import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getConfig } from "@/lib/config";
import { scrapeEquipe } from "@/lib/scraper-equipe";

export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const cfg = getConfig();
  if (!cfg.usuario || !cfg.senha) {
    return NextResponse.json({ error: "Cadastre usuário e senha do Gestão em Configurações" }, { status: 400 });
  }

  let visivel = false;
  let limite: number | undefined = undefined;
  try {
    const body = await req.json();
    visivel = !!body?.visivel;
    if (typeof body?.limite === "number") limite = body.limite;
  } catch {
    /* sem body */
  }

  const r = await scrapeEquipe({
    baseUrl: cfg.baseUrl,
    usuario: cfg.usuario,
    senha: cfg.senha,
    visivel,
    debug: true,
    limite,
  });

  if (!r.ok) {
    return NextResponse.json({ error: r.erro, diagnostico: r.diagnostico, totalCards: r.totalCards }, { status: 500 });
  }

  let inseridos = 0;
  let atualizados = 0;
  const agora = new Date().toISOString();

  for (const t of r.tecnicos) {
    if (!t.nome) continue;
    let existe: { id: number } | undefined;
    if (t.cpf_prefixo) {
      existe = db.prepare("SELECT id FROM tecnicos WHERE cpf_prefixo = ?").get(t.cpf_prefixo) as
        | { id: number }
        | undefined;
    }
    if (!existe) {
      existe = db.prepare("SELECT id FROM tecnicos WHERE LOWER(nome) = LOWER(?)").get(t.nome) as
        | { id: number }
        | undefined;
    }

    if (existe) {
      db.prepare(
        `UPDATE tecnicos SET
           nome = ?,
           cpf_prefixo = COALESCE(?, cpf_prefixo),
           telefone = COALESCE(?, telefone),
           email = COALESCE(?, email),
           cidade = COALESCE(?, cidade),
           ultima_sync_gestao = ?
         WHERE id = ?`
      ).run(t.nome, t.cpf_prefixo, t.telefone, t.email, t.cidade, agora, existe.id);
      atualizados++;
    } else {
      db.prepare(
        `INSERT INTO tecnicos (nome, cpf_prefixo, telefone, email, cidade, ultima_sync_gestao)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(t.nome, t.cpf_prefixo, t.telefone, t.email, t.cidade, agora);
      inseridos++;
    }
  }

  return NextResponse.json({
    ok: true,
    totalCards: r.totalCards,
    extraidos: r.tecnicos.length,
    inseridos,
    atualizados,
    diagnostico: r.diagnostico,
  });
}
