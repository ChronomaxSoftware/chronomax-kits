/**
 * Retorno dos acessórios (extensão, régua, mouse… — tudo do card Produtos que não é
 * equipamento com patrimônio): depois da prova confere-se quantos voltaram; o que faltou
 * pode ser descontado do estoque da base da prova (pela UF).
 */

import { tipoDeProduto } from "./equipamentos";
import { parseDataBR } from "./semana";

/** Só provas a partir desta data entram na conferência (o histórico antigo não vira pendência). */
export const RETORNO_ACESSORIOS_DESDE = "26/10/2026";

export type LinhaAcessorio = {
  evento_id: number;
  evento_numero: string;
  evento_nome: string;
  evento_data: string;
  evento_uf: string | null;
  produto_id: number;
  produto_nome: string;
  quantidade: number;
  devolucao_em: string | null;
};

export type ProvaAcessorios = {
  evento_id: number;
  numero: string;
  nome: string;
  data: string;
  uf: string | null;
  /** a prova já passou (dia seguinte em diante) */
  atrasada: boolean;
  itens: { produto_id: number; nome: string; quantidade: number }[];
};

/** Provas do dia em diante (até hoje) com acessório ainda não conferido. */
export function acessoriosPendentes(linhas: LinhaAcessorio[], agora: Date = new Date()): ProvaAcessorios[] {
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const desde = parseDataBR(RETORNO_ACESSORIOS_DESDE)!;
  const provas = new Map<number, ProvaAcessorios>();
  for (const l of linhas) {
    const d = parseDataBR(l.evento_data);
    if (!d || d < desde || d > hoje) continue;
    if (l.devolucao_em || tipoDeProduto(l.produto_nome) || !(Number(l.quantidade) > 0)) continue;
    if (!provas.has(l.evento_id)) {
      provas.set(l.evento_id, {
        evento_id: l.evento_id,
        numero: l.evento_numero,
        nome: l.evento_nome,
        data: l.evento_data,
        uf: l.evento_uf,
        atrasada: d < hoje,
        itens: [],
      });
    }
    provas.get(l.evento_id)!.itens.push({ produto_id: l.produto_id, nome: l.produto_nome, quantidade: Number(l.quantidade) });
  }
  return [...provas.values()].sort(
    (a, b) => (parseDataBR(a.data)?.getTime() ?? 0) - (parseDataBR(b.data)?.getTime() ?? 0)
  );
}

/** Quanto faltou (nunca negativo; voltar a mais não aumenta o estoque). */
export function faltou(enviado: number, voltou: number): number {
  return Math.max(0, (Number(enviado) || 0) - Math.max(0, Number(voltou) || 0));
}

export function textoAlertaAcessorios(p: ProvaAcessorios): string {
  const itens = p.itens.map((i) => `${i.nome} ${i.quantidade}`).join(", ");
  return `Conferir retorno dos acessórios — ${p.nome} (#${p.numero}), ${p.data}${p.uf ? ` · ${p.uf}` : ""} (${itens})`;
}
