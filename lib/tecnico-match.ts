/**
 * Identidade de técnico — usado para casar/deduplicar técnicos vindos das duas
 * sincronizações (eventos e equipe) de forma consistente.
 */

/**
 * Normaliza o nome para comparação: minúsculas, sem acentos, espaços colapsados, trim.
 * Evita criar duplicados ou sobrescrever dados por causa de acento/espaço/caixa.
 */
export function normalizarNome(nome: string | null | undefined): string {
  if (!nome) return "";
  return String(nome)
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // remove marcas de acento (combinantes)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Chave canônica de identidade: usa o CPF (prefixo de 9 dígitos) quando houver
 * — identificador forte da pessoa — e cai no nome normalizado quando não houver.
 * Os prefixos "cpf:"/"nome:" evitam colisão entre as duas formas.
 */
export function chaveTecnico(cpf_prefixo: string | null | undefined, nome: string | null | undefined): string {
  const cpf = (cpf_prefixo || "").trim();
  if (cpf) return "cpf:" + cpf;
  return "nome:" + normalizarNome(nome);
}
