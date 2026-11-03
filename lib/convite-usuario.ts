/**
 * Link de senha do usuário do escritório (admin, líder, Só Telão…): uso único e vale
 * 24h — a pessoa abre, cria a senha nova e entra. Diferente do link do técnico (que é
 * permanente), porque esses usuários têm mais acesso. Guardamos só o hash (sha256);
 * gerar outro link cancela o anterior. (Só servidor: usa crypto via lib/convite.)
 */

export { gerarTokenConvite, hashTokenConvite } from "./convite";

export const VALIDADE_CONVITE_USUARIO_HORAS = 24;

export function expiraConviteUsuario(agora: Date = new Date()): string {
  return new Date(agora.getTime() + VALIDADE_CONVITE_USUARIO_HORAS * 3600_000).toISOString();
}

export type ConviteUsuarioRow = { usado_em: string | null; expira_em: string; ativo: number };

export type EstadoConviteUsuario = { ok: true } | { ok: false; erro: string };

export function estadoConviteUsuario(c: ConviteUsuarioRow | undefined, agora: Date = new Date()): EstadoConviteUsuario {
  if (!c) return { ok: false, erro: "Link inválido. Peça um novo link para o administrador." };
  if (!c.ativo) return { ok: false, erro: "Seu usuário está desativado. Fale com o administrador." };
  if (c.usado_em) return { ok: false, erro: "Este link já foi usado. Entre com a sua senha ou peça um novo link." };
  const exp = new Date(c.expira_em).getTime();
  if (isNaN(exp) || exp <= agora.getTime()) return { ok: false, erro: "Este link venceu (vale 24 horas). Peça um novo link." };
  return { ok: true };
}
