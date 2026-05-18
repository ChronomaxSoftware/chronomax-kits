import { NextRequest, NextResponse } from "next/server";
import { dbRun, dbGet, initDB } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { scrapeEquipe } from "@/lib/scraper-equipe";

export const maxDuration = 600;

export async function POST(req: NextRequest) {
  await initDB();
  const cfg = await getConfig();
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
      existe = await dbGet<{ id: number }>("SELECT id FROM tecnicos WHERE cpf_prefixo = ?", t.cpf_prefixo);
    }
    if (!existe) {
      existe = await dbGet<{ id: number }>("SELECT id FROM tecnicos WHERE LOWER(nome) = LOWER(?)", t.nome);
    }

    if (existe) {
      await dbRun(
        `UPDATE tecnicos SET
           nome = ?,
           cpf_prefixo = COALESCE(?, cpf_prefixo),
           telefone = COALESCE(?, telefone),
           email = COALESCE(?, email),
           cidade = COALESCE(?, cidade),
           ultima_sync_gestao = ?
         WHERE id = ?`,
        t.nome, t.cpf_prefixo, t.telefone, t.email, t.cidade, agora, existe.id
      );
      atualizados++;
    } else {
      await dbRun(
        `INSERT INTO tecnicos (nome, cpf_prefixo, telefone, email, cidade, ultima_sync_gestao)
         VALUES (?, ?, ?, ?, ?, ?)`,
        t.nome, t.cpf_prefixo, t.telefone, t.email, t.cidade, agora
      );
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
