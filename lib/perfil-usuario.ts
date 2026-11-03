/**
 * Perfil do usuário do escritório (users.perfil):
 * - "total": acesso a tudo (o padrão de sempre);
 * - "telao": só a aba Telão (cobrar a arte do cliente e dar o ok do telão pronto).
 * O perfil vira o role da sessão: total → "admin", telao → "telao".
 */

export type PerfilUsuario = "total" | "telao";

export const ROTULO_PERFIL: Record<PerfilUsuario, string> = {
  total: "Acesso total",
  telao: "Só Telão",
};

export function normalizarPerfil(p: unknown): PerfilUsuario {
  return p === "telao" ? "telao" : "total";
}

export function ehPerfilValido(p: unknown): p is PerfilUsuario {
  return p === "total" || p === "telao";
}

export function roleDoPerfil(p: unknown): "admin" | "telao" {
  return normalizarPerfil(p) === "telao" ? "telao" : "admin";
}

/** Para onde vai quem entra (login, link, app instalado). */
export function destinoDoRole(role: string | undefined): string {
  if (role === "tecnico") return "/portal";
  if (role === "telao") return "/telao";
  return "/";
}

/** Caminhos que o perfil Só Telão pode abrir (o proxy bloqueia o resto). */
export function telaoPodeAcessar(pathname: string): boolean {
  return (
    pathname === "/telao" ||
    pathname.startsWith("/telao/") ||
    pathname.startsWith("/api/telao") ||
    pathname === "/abrir"
  );
}

/**
 * Pode mudar o perfil? Não deixa mudar o próprio (para não se trancar fora) nem
 * deixar o sistema sem nenhum usuário ativo de acesso total.
 */
export function podeMudarPerfil(
  alvoId: number,
  meuId: number | undefined,
  novo: PerfilUsuario,
  alvoEhTotalAtivo: boolean,
  totaisAtivos: number
): string | null {
  if (alvoId === meuId) return "Você não pode mudar o perfil do seu próprio usuário";
  if (novo === "telao" && alvoEhTotalAtivo && totaisAtivos <= 1) {
    return "Precisa ficar pelo menos um usuário ativo com acesso total";
  }
  return null;
}
