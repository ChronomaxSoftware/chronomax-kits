import { NextRequest, NextResponse } from "next/server";
import { dbRun, dbAll, initDB } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { scrapeEquipe } from "@/lib/scraper-equipe-fetch";
import { normalizarNome } from "@/lib/tecnico-match";

export const maxDuration = 60;

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

  // Carrega todos os técnicos uma vez e casa por CPF (forte) ou nome normalizado
  // (sem acento/caixa/espaço), mantendo os mapas em dia para não duplicar no mesmo run.
  const existentes = await dbAll<{ id: number; nome: string; cpf_prefixo: string | null }>(
    "SELECT id, nome, cpf_prefixo FROM tecnicos"
  );
  const porCpf = new Map<string, number>();
  const porNome = new Map<string, number>();
  for (const e of existentes) {
    if (e.cpf_prefixo) porCpf.set(e.cpf_prefixo, e.id);
    porNome.set(normalizarNome(e.nome), e.id);
  }

  for (const t of r.tecnicos) {
    if (!t.nome) continue;
    const nomeNorm = normalizarNome(t.nome);
    let id: number | undefined;
    if (t.cpf_prefixo && porCpf.has(t.cpf_prefixo)) id = porCpf.get(t.cpf_prefixo);
    else id = porNome.get(nomeNorm);

    if (id) {
      await dbRun(
        `UPDATE tecnicos SET
           nome = ?,
           cpf_prefixo = COALESCE(?, cpf_prefixo),
           telefone = COALESCE(?, telefone),
           email = COALESCE(?, email),
           cidade = COALESCE(?, cidade),
           ultima_sync_gestao = ?
         WHERE id = ?`,
        t.nome, t.cpf_prefixo, t.telefone, t.email, t.cidade, agora, id
      );
      if (t.cpf_prefixo) porCpf.set(t.cpf_prefixo, id);
      porNome.set(nomeNorm, id);
      atualizados++;
    } else {
      const ins = await dbRun(
        `INSERT INTO tecnicos (nome, cpf_prefixo, telefone, email, cidade, ultima_sync_gestao)
         VALUES (?, ?, ?, ?, ?, ?)`,
        t.nome, t.cpf_prefixo, t.telefone, t.email, t.cidade, agora
      );
      const newId = ins.lastInsertRowid as unknown as number;
      if (t.cpf_prefixo) porCpf.set(t.cpf_prefixo, newId);
      porNome.set(nomeNorm, newId);
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
