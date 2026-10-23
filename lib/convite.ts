/**
 * Link de acesso do técnico: um código aleatório e permanente (não vence).
 * - antes da senha existir: o técnico abre e cria a própria senha (uma vez só);
 * - depois: o mesmo link abre o login com o telefone dele preenchido (atalho).
 * Recriar a senha pelo link não é permitido — senão quem recebesse o link encaminhado
 * poderia tomar a conta. Guardamos só o hash (sha256); gerar outro link cancela o anterior.
 * (Só servidor: usa crypto.)
 */

import { createHash, randomBytes } from "crypto";

/** O link não vence; a coluna expira_em (NOT NULL) recebe esta data "sem fim". */
export const SEM_VALIDADE = "9999-12-31T23:59:59.000Z";

export function gerarTokenConvite(): string {
  return randomBytes(32).toString("base64url");
}

export function hashTokenConvite(token: string): string {
  return createHash("sha256").update(String(token)).digest("hex");
}

export type ConviteRow = { usado_em: string | null; ativo: number; tem_senha: number };

export type EstadoConvite = { modo: "criar_senha" | "login" } | { modo: "invalido"; erro: string };

export function estadoConvite(c: ConviteRow | undefined): EstadoConvite {
  if (!c) return { modo: "invalido", erro: "Link inválido. Peça um novo link para a equipe Chronomax." };
  if (!c.ativo) return { modo: "invalido", erro: "Seu cadastro está inativo. Fale com a equipe Chronomax." };
  if (!c.usado_em) return { modo: "criar_senha" };
  if (!c.tem_senha) return { modo: "invalido", erro: "Seu acesso foi removido. Fale com a equipe Chronomax." };
  return { modo: "login" };
}
