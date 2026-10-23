/**
 * Link de acesso do técnico: um código aleatório que ele abre para criar a própria senha.
 * Guardamos só o hash (sha256) — quem ler o banco não consegue usar o link. Vale 7 dias,
 * uma vez só; gerar outro cancela o anterior. (Só servidor: usa crypto.)
 */

import { createHash, randomBytes } from "crypto";
import { VALIDADE_CONVITE_DIAS } from "./convite-texto";

export function gerarTokenConvite(): string {
  return randomBytes(32).toString("base64url");
}

export function hashTokenConvite(token: string): string {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function expiracaoConvite(agora = new Date()): string {
  return new Date(agora.getTime() + VALIDADE_CONVITE_DIAS * 86_400_000).toISOString();
}

export type ConviteRow = { usado_em: string | null; expira_em: string };

/** null = válido; senão a mensagem para o técnico. */
export function motivoConviteInvalido(c: ConviteRow | undefined, agora = new Date()): string | null {
  if (!c) return "Link inválido. Peça um novo link para a equipe Chronomax.";
  if (c.usado_em) return "Este link já foi usado. Entre com o seu telefone e senha, ou peça um novo link.";
  if (new Date(c.expira_em).getTime() <= agora.getTime()) return "Este link expirou. Peça um novo link para a equipe Chronomax.";
  return null;
}
