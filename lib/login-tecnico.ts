/**
 * Login do técnico no portal. Quando não há login manual, o telefone vira o
 * login — sempre no mesmo formato canônico (DDD + número, só dígitos), pra que
 * "(51) 99999-0000", "51999990000" e "+55 51 99999-0000" entrem igual.
 */

export const SENHA_MINIMA_TECNICO = 8;

/** Telefone → login canônico (só dígitos, sem DDI 55 e sem 0 de operadora). null se não parecer telefone. */
export function loginDeTelefone(telefone: unknown): string | null {
  let d = String(telefone ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if ((d.length === 11 || d.length === 12) && d.startsWith("0")) d = d.slice(1); // 0 + DDD + número
  return d.length >= 10 && d.length <= 11 ? d : null;
}

/**
 * Login a gravar: o manual (se informado) ou o derivado do telefone quando há
 * senha sendo definida. Login manual que parece telefone também é canonizado.
 */
export function resolverLoginTecnico(login: unknown, telefone: unknown, temSenha: boolean): string | null {
  const manual = String(login ?? "").trim();
  if (manual) return loginDeTelefone(manual) ?? manual;
  return temSenha ? loginDeTelefone(telefone) : null;
}

/** Candidatos a procurar na tabela `tecnicos.login` para o que o usuário digitou. */
export function candidatosLogin(digitado: string): string[] {
  const exato = digitado.trim();
  const tel = loginDeTelefone(exato);
  return tel && tel !== exato ? [exato, tel] : [exato];
}

export function validarSenhaTecnico(senha: unknown): string | null {
  if (!senha) return null;
  return String(senha).length < SENHA_MINIMA_TECNICO
    ? `A senha deve ter pelo menos ${SENHA_MINIMA_TECNICO} caracteres`
    : null;
}
