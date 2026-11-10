import { NextRequest, NextResponse } from "next/server";
import { ENDERECO_MAX } from "@/lib/envios";
import bcrypt from "bcryptjs";
import { dbAll, dbRun, initDB } from "@/lib/db";
import { resolverLoginTecnico, validarSenhaTecnico } from "@/lib/login-tecnico";
import { proximasEntregasPorTecnico } from "@/lib/tecnicos-alocados";
import { hojeBR } from "@/lib/conferencia-diaria";

export async function GET(req: NextRequest) {
  await initDB();
  // Por padrão só técnicos ativos (seletores/atribuição); ?incluirInativos=1 para a tela de gestão.
  const incluirInativos = req.nextUrl.searchParams.get("incluirInativos") === "1";
  const rows = await dbAll(
    `SELECT id, nome, telefone, endereco, ativo, login,
            (senha_hash IS NOT NULL AND senha_hash != '') AS tem_senha
     FROM tecnicos ${incluirInativos ? "" : "WHERE ativo = 1"} ORDER BY nome`
  );
  // ?comEntregas=1 (aba Técnicos): junta as próximas entregas em que cada um está alocado
  if (req.nextUrl.searchParams.get("comEntregas") !== "1") return NextResponse.json(rows);
  const alocacoes = await dbAll<{
    tecnico_id: number;
    evento_id: number;
    numero: string;
    nome: string;
    data: string;
    cidade: string | null;
    uf: string | null;
  }>(
    `SELECT et.tecnico_id, e.id AS evento_id, e.numero, e.nome, e.data, e.cidade, e.uf
       FROM evento_tecnicos et JOIN eventos e ON e.id = et.evento_id`
  );
  const porTecnico = proximasEntregasPorTecnico(alocacoes, hojeBR());
  return NextResponse.json(
    rows.map((t) => ({ ...t, proximas_entregas: porTecnico.get(Number((t as { id: number }).id)) ?? [] }))
  );
}

export async function POST(req: NextRequest) {
  await initDB();
  const { nome, telefone, endereco, login, senha } = await req.json();
  if (!nome?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  const erroSenha = validarSenhaTecnico(senha);
  if (erroSenha) return NextResponse.json({ error: erroSenha }, { status: 400 });
  // Sem login manual, o telefone (só dígitos) vira o login do portal
  const loginVal = resolverLoginTecnico(login, telefone, !!senha);
  if (senha && !loginVal) {
    return NextResponse.json(
      { error: "Informe um login ou um telefone válido (DDD + número) para o acesso ao portal" },
      { status: 400 }
    );
  }
  const senhaHash = senha ? bcrypt.hashSync(senha, 10) : null;
  try {
    const r = await dbRun(
      "INSERT INTO tecnicos (nome, telefone, endereco, login, senha_hash) VALUES (?, ?, ?, ?, ?)",
      nome.trim(),
      String(telefone ?? "").trim() || null,
      String(endereco ?? "").trim().slice(0, ENDERECO_MAX) || null,
      loginVal,
      senhaHash
    );
    return NextResponse.json({ id: r.lastInsertRowid });
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return NextResponse.json({ error: "Esse login (ou telefone) já está em uso por outro técnico" }, { status: 409 });
    }
    console.error("[tecnicos] erro ao cadastrar", err);
    return NextResponse.json({ error: "Não foi possível cadastrar o técnico" }, { status: 500 });
  }
}
