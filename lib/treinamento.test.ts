import { describe, expect, it } from "vitest";
import { agruparPorCategoria, lerVideo, playerDoLink } from "./treinamento";

const ID = "dQw4w9WgXcQ";
const EMBED = `https://www.youtube-nocookie.com/embed/${ID}?rel=0`;

describe("playerDoLink", () => {
  it("aceita os formatos de link do YouTube", () => {
    for (const l of [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}&t=42s`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}?si=abc`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube.com/live/${ID}`,
      `youtu.be/${ID}`,
    ]) {
      expect(playerDoLink(l), l).toEqual({ origem: "youtube", id: ID, embed: EMBED });
    }
  });

  it("aceita os formatos de link do Google Drive", () => {
    const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz";
    const embed = `https://drive.google.com/file/d/${id}/preview`;
    for (const l of [
      `https://drive.google.com/file/d/${id}/view?usp=sharing`,
      `https://drive.google.com/file/d/${id}/view`,
      `https://drive.google.com/file/u/0/d/${id}/view`,
      `https://drive.google.com/open?id=${id}`,
      `https://drive.google.com/uc?id=${id}&export=download`,
    ]) {
      expect(playerDoLink(l), l).toEqual({ origem: "drive", id, embed });
    }
  });

  it("recusa outros links", () => {
    expect(playerDoLink("")).toBeNull();
    expect(playerDoLink("https://vimeo.com/123")).toBeNull();
    expect(playerDoLink("https://www.youtube.com/watch?v=curto")).toBeNull();
    expect(playerDoLink("https://www.youtube.com/@canal")).toBeNull();
    expect(playerDoLink("https://drive.google.com/drive/folders/abc")).toBeNull();
    expect(playerDoLink("não é link")).toBeNull();
    expect(playerDoLink("https://evil.com/watch?v=" + ID)).toBeNull();
  });
});

describe("agruparPorCategoria", () => {
  it("agrupa na ordem e põe sem categoria em Geral", () => {
    const g = agruparPorCategoria([
      { id: 1, ordem: 2, categoria: "Telão" },
      { id: 2, ordem: 1, categoria: "Entrega de kit" },
      { id: 3, ordem: 3, categoria: null },
      { id: 4, ordem: 4, categoria: "Entrega de kit" },
    ]);
    expect(g.map((c) => [c.categoria, c.videos.map((v) => v.id)])).toEqual([
      ["Entrega de kit", [2, 4]],
      ["Telão", [1]],
      ["Geral", [3]],
    ]);
  });
});

describe("lerVideo", () => {
  it("valida título e link", () => {
    expect(lerVideo({ titulo: "", url: `https://youtu.be/${ID}` })).toEqual({ ok: false, erro: "Informe o título do vídeo" });
    expect(lerVideo({ titulo: "Abertura", url: "https://vimeo.com/1" }).ok).toBe(false);
    expect(lerVideo({ titulo: " Abertura ", descricao: " ", categoria: " Kit ", url: ` https://youtu.be/${ID} ` })).toEqual({
      ok: true,
      titulo: "Abertura",
      descricao: null,
      categoria: "Kit",
      url: `https://youtu.be/${ID}`,
    });
  });
});
