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

export type TecnicoNovo = { nome: string; cpf_prefixo: string | null };

/**
 * Enfileira um técnico novo do sync sem duplicar a pessoa no MESMO lote.
 * O Gestão manda a mesma pessoa às vezes com CPF (ficha) e às vezes só com o
 * nome (equipe da prova). Antes a chave era "CPF ou nome", então as duas formas
 * viravam duas linhas (ex.: KLEBER 217/219, criados no mesmo segundo).
 * Agora casa por CPF OU por nome normalizado, e completa o CPF se faltava.
 */
export function enfileirarTecnicoNovo(lista: TecnicoNovo[], tec: TecnicoNovo): void {
  const cpf = (tec.cpf_prefixo || "").trim() || null;
  const nome = normalizarNome(tec.nome);
  const existente = lista.find(
    (t) => (cpf && (t.cpf_prefixo || "").trim() === cpf) || normalizarNome(t.nome) === nome
  );
  if (!existente) {
    lista.push({ nome: tec.nome, cpf_prefixo: cpf });
  } else if (!existente.cpf_prefixo && cpf) {
    existente.cpf_prefixo = cpf;
  }
}

export type TecnicoCadastro = {
  id: number;
  nome: string;
  cpf_prefixo: string | null;
  telefone: string | null;
  login: string | null;
  senha_hash: string | null;
};

const vazio = (s: string | null | undefined) => !s || !String(s).trim();

/** Cadastro "casca": criado pelo sync só com o nome (sem CPF, telefone nem acesso). */
export function ehCascaVazia(t: TecnicoCadastro): boolean {
  return vazio(t.cpf_prefixo) && vazio(t.telefone) && vazio(t.login) && vazio(t.senha_hash);
}

/**
 * Plano de mescla de técnicos duplicados pelo nome: para cada nome (normalizado)
 * com mais de um cadastro, as cascas vazias são mescladas no ÚNICO cadastro que
 * tem dados. Se houver 2+ cadastros com dados (ex.: mesmo nome, CPFs/telefones
 * diferentes) ou nenhum, não mexe — é ambíguo e fica pra conferência manual.
 */
export function planejarMesclaPorNome(tecnicos: TecnicoCadastro[]): { keeper: number; dup: number }[] {
  const porNome = new Map<string, TecnicoCadastro[]>();
  for (const t of tecnicos) {
    const n = normalizarNome(t.nome);
    if (!n) continue;
    const arr = porNome.get(n) ?? [];
    arr.push(t);
    porNome.set(n, arr);
  }
  const plano: { keeper: number; dup: number }[] = [];
  for (const grupo of porNome.values()) {
    if (grupo.length < 2) continue;
    const comDados = grupo.filter((t) => !ehCascaVazia(t));
    if (comDados.length !== 1) continue;
    for (const t of grupo) if (t.id !== comDados[0].id) plano.push({ keeper: comDados[0].id, dup: t.id });
  }
  return plano;
}
