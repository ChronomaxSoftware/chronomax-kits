import { NextResponse } from "next/server";
import { dbAll, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { tiposTelao } from "@/lib/telao";

type Linha = {
  id: number;
  numero: string;
  nome: string;
  data: string | null;
  cidade: string | null;
  uf: string | null;
  local_prova: string | null;
  url_site_oficial: string | null;
  itens: string | null;
  arte_cobrada_em: string | null;
  arte_cobrada_por: string | null;
  pronto_em: string | null;
  pronto_por: string | null;
  obs: string | null;
  obs_em: string | null;
  obs_por: string | null;
};

const SEP = "\u001f";

// GET /api/telao — provas com item de telão no pedido do Gestão + as marcações. Escritório (total ou Só Telão).
export async function GET() {
  await initDB();
  const s = await getSession();
  if (!s.isLoggedIn || (s.role !== "admin" && s.role !== "telao")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  // Pré-filtro largo no SQL (só provas com item candidato); a regra exata fica em lib/telao.ts
  const rows = await dbAll<Linha>(
    `SELECT e.id, e.numero, e.nome, e.data, e.cidade, e.uf, e.local_prova, e.url_site_oficial,
            GROUP_CONCAT(i.nome, ?) AS itens,
            t.arte_cobrada_em, t.arte_cobrada_por, t.pronto_em, t.pronto_por, t.obs, t.obs_em, t.obs_por
     FROM eventos e
     JOIN evento_itens_gestao i ON i.evento_id = e.id
     LEFT JOIN telao_status t ON t.evento_id = e.id
     WHERE lower(i.nome) LIKE '%arena%' OR lower(i.nome) LIKE '%output%'
     GROUP BY e.id`,
    SEP
  );
  const provas = rows
    .map(({ itens, ...r }) => ({ ...r, tipos: tiposTelao(String(itens || "").split(SEP)) }))
    .filter((r) => r.tipos.length > 0);
  return NextResponse.json(provas);
}
