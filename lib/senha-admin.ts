/** Senha inicial criada pelo seed do initDB para os usuários admin e lider. */
export const SENHA_INICIAL_ADMIN = "chronomax";

export const SENHA_MINIMA_ADMIN = 10;

/** Valida a nova senha de um usuário admin. Devolve a mensagem de erro ou null. */
export function validarNovaSenhaAdmin(nova: unknown, atual: unknown, username: string): string | null {
  const s = String(nova ?? "");
  if (s.length < SENHA_MINIMA_ADMIN) return `A nova senha deve ter pelo menos ${SENHA_MINIMA_ADMIN} caracteres`;
  if (s.toLowerCase().includes(SENHA_INICIAL_ADMIN)) return "A nova senha não pode conter a senha inicial";
  if (username && s.toLowerCase().includes(username.toLowerCase())) return "A nova senha não pode conter o nome de usuário";
  if (s === String(atual ?? "")) return "A nova senha deve ser diferente da atual";
  return null;
}
