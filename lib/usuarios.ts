/**
 * Regras dos usuários do escritório (tabela users, acesso total). Técnicos ficam em
 * tecnicos e entram pelo telefone — por isso o login de usuário precisa começar com
 * letra: assim nunca colide com um telefone de técnico.
 */

export type ResultadoUsername = { ok: true; username: string } | { ok: false; erro: string };

export function validarUsername(u: unknown): ResultadoUsername {
  const username = String(u ?? "").trim().toLowerCase();
  if (!/^[a-z][a-z0-9._-]{2,29}$/.test(username)) {
    return {
      ok: false,
      erro: "Login inválido: 3 a 30 caracteres, começando com letra (letras, números, ponto, hífen ou _)",
    };
  }
  return { ok: true, username };
}

export function validarNomeUsuario(n: unknown): string | null {
  const nome = String(n ?? "").trim();
  return nome.length >= 2 && nome.length <= 80 ? nome : null;
}

/**
 * Pode desativar? Não deixa o usuário se desativar nem desativar o último usuário ativo
 * (senão ninguém mais entra no sistema).
 */
export function podeDesativar(alvoId: number, meuId: number | undefined, ativosRestantes: number): string | null {
  if (alvoId === meuId) return "Você não pode desativar o seu próprio usuário";
  if (ativosRestantes <= 1) return "Não é possível desativar o último usuário ativo";
  return null;
}
