import { NextResponse } from "next/server";
import { dbAll, initDB } from "@/lib/db";
import { getSession } from "@/lib/session";
import { enderecoEntrega } from "@/lib/envios";

type Linha = {
  id: number;
  numero: string;
  nome: string;
  data: string | null;
  cidade: string | null;
  uf: string | null;
  local_prova: string | null;
  data_envio: string | null;
  endereco: string | null;
  material_em: string | null;
  material_por: string | null;
  numeros_em: string | null;
  numeros_por: string | null;
  obs: string | null;
  obs_em: string | null;
  obs_por: string | null;
};

type Tec = {
  evento_id: number;
  id: number;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  funcao: string | null;
};
type Prod = { evento_id: number; nome: string; quantidade: number };
type Equip = { evento_id: number; tipo: string; patrimonio: string; numero_chip: string | null };

/** Tira o evento_id (só serviu para juntar com a prova). */
function semEvento<T extends { evento_id: number }>(x: T): Omit<T, "evento_id"> {
  const { evento_id, ...resto } = x;
  void evento_id;
  return resto;
}

// GET /api/envios — provas incluídas na aba Envios, com técnico (endereço/telefone) e o material.
// Escritório (acesso total) ou Só Envios.
export async function GET() {
  await initDB();
  const s = await getSession();
  if (!s.isLoggedIn || (s.role !== "admin" && s.role !== "envios")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const provas = await dbAll<Linha>(
    `SELECT e.id, e.numero, e.nome, e.data, e.cidade, e.uf, e.local_prova,
            v.data_envio, v.endereco, v.material_em, v.material_por, v.numeros_em, v.numeros_por,
            v.obs, v.obs_em, v.obs_por
     FROM envio_status v JOIN eventos e ON e.id = v.evento_id`
  );
  if (provas.length === 0) return NextResponse.json([]);

  // Uma consulta por tabela para todas as provas (evita N+1 no Turso)
  const ids = provas.map((p) => p.id);
  const ph = ids.map(() => "?").join(",");
  const [tecs, prods, equips] = await Promise.all([
    dbAll<Tec>(
      `SELECT et.evento_id, t.id, t.nome, t.telefone, t.endereco, t.cidade, et.funcao
       FROM evento_tecnicos et JOIN tecnicos t ON t.id = et.tecnico_id
       WHERE et.evento_id IN (${ph}) ORDER BY t.nome`,
      ...ids
    ),
    dbAll<Prod>(
      `SELECT ep.evento_id, p.nome, ep.quantidade
       FROM evento_produtos ep JOIN produtos p ON p.id = ep.produto_id
       WHERE ep.evento_id IN (${ph}) AND ep.quantidade > 0 ORDER BY p.nome`,
      ...ids
    ),
    dbAll<Equip>(
      `SELECT evento_id, tipo, patrimonio, numero_chip FROM equipamentos
       WHERE evento_id IN (${ph}) ORDER BY tipo, patrimonio`,
      ...ids
    ),
  ]);

  const result = provas.map((p) => ({
    ...p,
    tecnicos: tecs
      .filter((t) => t.evento_id === p.id)
      .map((t) => ({ ...semEvento(t), endereco_entrega: enderecoEntrega(p.endereco, t.endereco) })),
    produtos: prods.filter((x) => x.evento_id === p.id).map(semEvento),
    equipamentos: equips.filter((x) => x.evento_id === p.id).map(semEvento),
  }));
  return NextResponse.json(result);
}
