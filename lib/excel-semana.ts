/**
 * Planilha da semana: todas as provas e todos os convocados de cada uma
 * (equipe do Gestão + técnicos atribuídos aqui), com telefone e CPF do cadastro.
 */
import { normalizarNome } from "./tecnico-match";
import { parseDataBR } from "./semana";
import { formatarCpf } from "./nota-fiscal";

export type ProvaPlanilha = { id: number; numero: string; nome: string; data: string; cidade: string | null; uf: string | null };
export type ConvocadoBruto = { evento_id: number; nome: string; funcao: string | null; cpf_prefixo: string | null };
export type TecnicoCadastro = { nome: string; cpf_prefixo: string | null; telefone: string | null; cpf: string | null };

export type LinhaPlanilha = {
  data: string;
  prova: string;
  numero: string;
  local: string;
  nome: string;
  funcao: string;
  telefone: string;
  cpf: string;
};

/** "65.080.948 DANIEL SANTOS" → "DANIEL SANTOS" (nome que veio com o CPF na frente). */
export function limparNome(nome: string): string {
  return nome.replace(/^\s*(?:\d{2,3}\.){2}\d{2,3}(?:-\d{2})?\s+/, "").trim();
}

/** Junta equipe do Gestão + atribuídos sem repetir a pessoa (mesmo CPF-prefixo ou mesmo nome). */
export function convocadosDaProva(lista: ConvocadoBruto[]): ConvocadoBruto[] {
  const out: ConvocadoBruto[] = [];
  for (const c of lista) {
    const nome = limparNome(c.nome);
    const cpf = (c.cpf_prefixo || "").trim() || null;
    const igual = out.find(
      (o) => (cpf && (o.cpf_prefixo || "") === cpf) || normalizarNome(o.nome) === normalizarNome(nome)
    );
    if (igual) {
      if (!igual.funcao && c.funcao) igual.funcao = c.funcao;
      if (!igual.cpf_prefixo && cpf) igual.cpf_prefixo = cpf;
      continue;
    }
    out.push({ ...c, nome, cpf_prefixo: cpf });
  }
  return out;
}

export function montarLinhas(
  provas: ProvaPlanilha[],
  convocados: ConvocadoBruto[],
  cadastro: TecnicoCadastro[]
): LinhaPlanilha[] {
  const porCpf = new Map<string, TecnicoCadastro>();
  const porNome = new Map<string, TecnicoCadastro>();
  for (const t of cadastro) {
    if (t.cpf_prefixo && !porCpf.has(t.cpf_prefixo)) porCpf.set(t.cpf_prefixo, t);
    const n = normalizarNome(limparNome(t.nome));
    // prefere o cadastro que tem telefone/CPF
    const atual = porNome.get(n);
    if (!atual || (!atual.cpf && t.cpf) || (!atual.telefone && t.telefone)) porNome.set(n, t);
  }

  const ordenadas = [...provas].sort(
    (a, b) =>
      (parseDataBR(a.data)?.getTime() ?? Infinity) - (parseDataBR(b.data)?.getTime() ?? Infinity) ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );

  const linhas: LinhaPlanilha[] = [];
  for (const p of ordenadas) {
    const base = {
      data: p.data || "",
      prova: p.nome,
      numero: String(p.numero ?? ""),
      local: [p.cidade, p.uf].filter(Boolean).join("/"),
    };
    const lista = convocadosDaProva(convocados.filter((c) => Number(c.evento_id) === Number(p.id))).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR")
    );
    if (lista.length === 0) {
      linhas.push({ ...base, nome: "(sem convocados)", funcao: "", telefone: "", cpf: "" });
      continue;
    }
    for (const c of lista) {
      const cad = (c.cpf_prefixo && porCpf.get(c.cpf_prefixo)) || porNome.get(normalizarNome(c.nome));
      linhas.push({
        ...base,
        nome: c.nome,
        funcao: c.funcao || "",
        telefone: cad?.telefone || "",
        cpf: formatarCpf(cad?.cpf) || "não cadastrado",
      });
    }
  }
  return linhas;
}

/** Resumo: uma linha por prova com a quantidade e os nomes. */
export function resumoPorProva(linhas: LinhaPlanilha[]) {
  const m = new Map<string, { data: string; prova: string; numero: string; local: string; nomes: string[] }>();
  for (const l of linhas) {
    const k = `${l.numero}|${l.prova}|${l.data}`;
    if (!m.has(k)) m.set(k, { data: l.data, prova: l.prova, numero: l.numero, local: l.local, nomes: [] });
    if (l.nome !== "(sem convocados)") m.get(k)!.nomes.push(l.nome);
  }
  return [...m.values()].map((r) => ({ ...r, quantidade: r.nomes.length, nomes: r.nomes.join(", ") }));
}
