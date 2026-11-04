import { NextResponse } from "next/server";
import { dbAll, dbGet } from "./db";
import type { CategoriaFoto } from "./kits-foto";

export type KitProva = {
  id: number;
  evento_id: number;
  nome: string;
  descricao: string | null;
  ordem: number | null;
  categoria: CategoriaFoto;
  /** Endereço da foto (null = kit sem foto). */
  foto_url: string | null;
};

type Linha = Omit<KitProva, "foto_url"> & { tem_foto: number; imagem_path: string | null };

/**
 * Kits da prova sem carregar a foto em si. `para` define de qual rota a foto vem:
 * escritório (/api/eventos/…) ou técnico (/api/portal/…, que confere a escala).
 */
export async function listarKits(
  eventoIds: number[],
  para: "escritorio" | "portal",
  categoria?: CategoriaFoto
): Promise<KitProva[]> {
  if (eventoIds.length === 0) return [];
  const linhas = await dbAll<Linha>(
    `SELECT id, evento_id, nome, descricao, ordem, COALESCE(categoria, 'kit') AS categoria, imagem_path,
            (imagem_dados IS NOT NULL) AS tem_foto
     FROM evento_kits WHERE evento_id IN (${eventoIds.map(() => "?").join(",")})
     ${categoria ? "AND COALESCE(categoria, 'kit') = ?" : ""}
     ORDER BY evento_id, ordem, id`,
    ...eventoIds,
    ...(categoria ? [categoria] : [])
  );
  return linhas.map(({ tem_foto, imagem_path, ...k }) => ({
    ...k,
    foto_url: tem_foto
      ? para === "portal"
        ? `/api/portal/kits/${k.id}/foto`
        : `/api/eventos/${k.evento_id}/kits/${k.id}/foto`
      : // legado: foto gravada em disco (só existe rodando local)
        imagem_path && para === "escritorio"
        ? `/api/uploads/${imagem_path}`
        : null,
  }));
}

/** Resposta com a imagem do kit (404 se não tem foto no banco). */
export async function respostaFotoKit(kitId: number, eventoId?: number): Promise<NextResponse> {
  const row = await dbGet<{ evento_id: number; imagem_dados: ArrayBuffer | Uint8Array | null; imagem_tipo: string | null }>(
    "SELECT evento_id, imagem_dados, imagem_tipo FROM evento_kits WHERE id = ?",
    kitId
  );
  if (!row || !row.imagem_dados || (eventoId !== undefined && Number(row.evento_id) !== eventoId)) {
    return new NextResponse("Não encontrado", { status: 404 });
  }
  const dados = row.imagem_dados instanceof Uint8Array ? row.imagem_dados : new Uint8Array(row.imagem_dados);
  return new NextResponse(new Uint8Array(dados), {
    status: 200,
    headers: {
      "Content-Type": row.imagem_tipo || "image/jpeg",
      // a foto de um kit não muda (trocar = apagar e subir de novo, com outro id)
      "Cache-Control": "private, max-age=86400",
    },
  });
}
