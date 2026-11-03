/**
 * Perfil do usuário do escritório (users.perfil):
 * - "total": acesso a tudo (o padrão de sempre);
 * - "telao": só a aba Telão (cobrar a arte do cliente e dar o ok do telão pronto);
 * - "envios": só a aba Envios (quem manda o material e os números para o técnico, ex.: Rio).
 * O perfil vira o role da sessão: total → "admin", telao → "telao", envios → "envios".
 */

export type PerfilUsuario = "total" | "telao" | "envios";
export type PerfilRestrito = Exclude<PerfilUsuario, "total">;

export const ROTULO_PERFIL: Record<PerfilUsuario, string> = {
  total: "Acesso total",
  telao: "Só Telão",
  envios: "Só Envios",
};

export function ehPerfilValido(p: unknown): p is PerfilUsuario {
  return p === "total" || p === "telao" || p === "envios";
}

export function normalizarPerfil(p: unknown): PerfilUsuario {
  return ehPerfilValido(p) ? p : "total";
}

export function roleDoPerfil(p: unknown): "admin" | PerfilRestrito {
  const n = normalizarPerfil(p);
  return n === "total" ? "admin" : n;
}

/** Perfil (users.perfil) que a sessão precisa ter para continuar valendo. */
export function perfilDoRole(role: string | undefined): PerfilUsuario {
  return role === "telao" || role === "envios" ? role : "total";
}

/** É um perfil que só enxerga a própria aba? */
export function ehRoleRestrito(role: string | undefined): role is PerfilRestrito {
  return role === "telao" || role === "envios";
}

/** Para onde vai quem entra (login, link, app instalado). */
export function destinoDoRole(role: string | undefined): string {
  if (role === "tecnico") return "/portal";
  if (role === "telao") return "/telao";
  if (role === "envios") return "/envios";
  return "/";
}

/** Caminhos que um perfil restrito pode abrir: a aba dele e as APIs dela (o proxy bloqueia o resto). */
export function restritoPodeAcessar(role: PerfilRestrito, pathname: string): boolean {
  const aba = `/${role}`;
  return pathname === aba || pathname.startsWith(`${aba}/`) || pathname.startsWith(`/api${aba}`) || pathname === "/abrir";
}

export function telaoPodeAcessar(pathname: string): boolean {
  return restritoPodeAcessar("telao", pathname);
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
  if (novo !== "total" && alvoEhTotalAtivo && totaisAtivos <= 1) {
    return "Precisa ficar pelo menos um usuário ativo com acesso total";
  }
  return null;
}
