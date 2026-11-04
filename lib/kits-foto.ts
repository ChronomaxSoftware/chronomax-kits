/**
 * Tipos de kit da prova (card "📘 Book — Tipos de Kit"): fotos guardadas no banco
 * (evento_kits.imagem_dados), porque o disco da Vercel não guarda arquivos.
 * O nome do kit vem do nome do arquivo da foto.
 */

/** Foto já reduzida no navegador; acima disso o upload é recusado. */
export const FOTO_KIT_MAX_BYTES = 2 * 1024 * 1024;
export const TIPOS_FOTO_KIT = ["image/jpeg", "image/png", "image/webp"] as const;
export const NOME_KIT_MAX = 120;
export const DESCRICAO_KIT_MAX = 1000;

export function ehTipoFotoKit(t: unknown): t is (typeof TIPOS_FOTO_KIT)[number] {
  return typeof t === "string" && (TIPOS_FOTO_KIT as readonly string[]).includes(t);
}

/** Nomes que câmera/WhatsApp dão sozinhos: não dizem nada sobre o kit. */
const GENERICO = [
  /^img[\s_-]?\d/i,
  /^dsc[\s_-]?\w?\d/i,
  /^pxl[\s_-]?\d/i,
  /^photo[\s_-]?\d/i,
  /^foto[\s_-]?\d/i,
  /^image[\s_-]?\d*$/i,
  /^imagem[\s_-]?\d*$/i,
  /^whatsapp[\s_-]image/i,
  /^screenshot/i,
  /^captura de tela/i,
  /^\d{6,}/, // 20261104_153000, 1730745600123
  /^[0-9a-f]{8}-[0-9a-f]{4}-/i, // uuid
];

/**
 * "01 - INSCRICAO-ESSENCIAL.jpg" → "INSCRICAO ESSENCIAL".
 * Nome genérico (IMG_1234, WhatsApp Image…) → "" (o usuário preenche).
 */
export function nomeKitDoArquivo(arquivo: string): string {
  let s = String(arquivo || "").split(/[\\/]/).pop() || "";
  s = s.replace(/\.[a-z0-9]{2,5}$/i, ""); // extensão
  s = s.replace(/\s*\(\d+\)$/, ""); // "kit (1)" de download repetido
  s = s.trim();
  if (!s || GENERICO.some((r) => r.test(s))) return "";
  s = s.replace(/^\d{1,3}\s*[-_.)]\s*/, ""); // numeração na frente: "01 - ", "1_", "2."
  s = s.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!/[a-zà-ú]/i.test(s)) return ""; // sobrou só número/símbolo
  return s.toLocaleUpperCase("pt-BR").slice(0, NOME_KIT_MAX);
}
