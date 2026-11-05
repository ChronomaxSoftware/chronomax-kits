/**
 * Aba Treinamento: vídeos hospedados no YouTube (pode ser "Não listado") ou no Google Drive
 * ("Qualquer pessoa com o link"). O site guarda só o link e mostra o player embutido.
 */

export const TITULO_MAX = 120;
export const DESCRICAO_MAX = 2000;
export const CATEGORIA_MAX = 60;
export const SEM_CATEGORIA = "Geral";

export type Player = { origem: "youtube" | "drive"; id: string; embed: string };

/** Link do YouTube/Drive → player embutido; outro link → null. */
export function playerDoLink(link: string | null | undefined): Player | null {
  const bruto = String(link || "").trim();
  if (!bruto) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const partes = u.pathname.split("/").filter(Boolean);

  // YouTube: watch?v=, youtu.be/ID, /shorts/ID, /embed/ID, /live/ID
  let yt: string | null = null;
  if (host === "youtu.be") yt = partes[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    if (partes[0] === "watch") yt = u.searchParams.get("v");
    else if (["shorts", "embed", "live", "v"].includes(partes[0] ?? "")) yt = partes[1] ?? null;
  }
  if (yt !== null) {
    if (!/^[\w-]{11}$/.test(yt)) return null;
    return { origem: "youtube", id: yt, embed: `https://www.youtube-nocookie.com/embed/${yt}?rel=0` };
  }

  // Drive: /file/d/ID/view, open?id=ID, uc?id=ID
  if (host === "drive.google.com" || host === "docs.google.com") {
    let id: string | null = null;
    const iFile = partes.indexOf("d");
    if (partes.includes("file") && iFile >= 0) id = partes[iFile + 1] ?? null;
    else if (partes[0] === "open" || partes[0] === "uc") id = u.searchParams.get("id");
    if (!id || !/^[\w-]{10,}$/.test(id)) return null;
    return { origem: "drive", id, embed: `https://drive.google.com/file/d/${id}/preview` };
  }
  return null;
}

export type VideoTreinamento = {
  id: number;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  url: string;
  ordem: number;
};

/** Agrupa por categoria, mantendo a ordem do 1º vídeo de cada uma; sem categoria → "Geral". */
export function agruparPorCategoria<T extends Pick<VideoTreinamento, "categoria" | "ordem" | "id">>(
  videos: T[]
): { categoria: string; videos: T[] }[] {
  const ordenados = [...videos].sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  const mapa = new Map<string, T[]>();
  for (const v of ordenados) {
    const c = (v.categoria || "").trim() || SEM_CATEGORIA;
    if (!mapa.has(c)) mapa.set(c, []);
    mapa.get(c)!.push(v);
  }
  return [...mapa.entries()].map(([categoria, videos]) => ({ categoria, videos }));
}

/** Valida o corpo do cadastro/edição. */
export function lerVideo(body: unknown):
  | { ok: true; titulo: string; descricao: string | null; categoria: string | null; url: string }
  | { ok: false; erro: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const titulo = String(b.titulo ?? "").trim().slice(0, TITULO_MAX);
  const descricao = String(b.descricao ?? "").trim().slice(0, DESCRICAO_MAX) || null;
  const categoria = String(b.categoria ?? "").trim().slice(0, CATEGORIA_MAX) || null;
  const url = String(b.url ?? "").trim();
  if (!titulo) return { ok: false, erro: "Informe o título do vídeo" };
  if (!playerDoLink(url)) return { ok: false, erro: "Link inválido: use um link do YouTube ou do Google Drive" };
  return { ok: true, titulo, descricao, categoria, url };
}
