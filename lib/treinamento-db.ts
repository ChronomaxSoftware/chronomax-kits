import { dbAll } from "./db";
import type { VideoTreinamento } from "./treinamento";

const CAMPOS = "id, titulo, descricao, categoria, url, ordem";

export async function listarVideos(): Promise<VideoTreinamento[]> {
  const rows = await dbAll<VideoTreinamento>(`SELECT ${CAMPOS} FROM treinamento_videos ORDER BY ordem, id`);
  return rows.map((r) => ({ ...r, id: Number(r.id), ordem: Number(r.ordem ?? 0) }));
}

/** Técnicos com acesso ao portal (ativos e com senha) — base do "X de Y assistiram". */
export const SQL_TECNICOS_COM_ACESSO =
  "SELECT id, nome FROM tecnicos WHERE ativo = 1 AND senha_hash IS NOT NULL AND senha_hash != ''";
