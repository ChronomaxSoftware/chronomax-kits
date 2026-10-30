/**
 * Alertas para o escritório (sino no menu): técnico confirmou que recebeu
 * ou que devolveu todo o material de uma prova.
 */

import { dbAll, dbGet, dbRun } from "./db";
import { parseDataBR } from "./semana";
import { acessoriosPendentes, textoAlertaAcessorios, type LinhaAcessorio } from "./retorno-acessorios";

export type TipoAlerta = "recebimento" | "devolucao";

export function textoAlerta(tipo: TipoAlerta, tecnico: string, prova: string, observacao?: string | null): string {
  const quem = tecnico.trim() || "Técnico";
  const acao = tipo === "recebimento" ? "confirmou que RECEBEU todo o material" : "confirmou que DEVOLVEU todo o material";
  const obs = observacao?.trim() ? ` — obs.: ${observacao.trim().slice(0, 200)}` : "";
  return `${quem} ${acao} — ${prova}${obs}`;
}

export async function criarAlerta(
  tipo: TipoAlerta,
  eventoId: number | string,
  tecnicoId: number,
  observacao?: string | null
): Promise<void> {
  const t = await dbGet<{ nome: string }>("SELECT nome FROM tecnicos WHERE id = ?", tecnicoId);
  const e = await dbGet<{ nome: string; numero: string }>("SELECT nome, numero FROM eventos WHERE id = ?", eventoId);
  const prova = e ? `${e.nome} (#${e.numero})` : `prova ${eventoId}`;
  await dbRun(
    "INSERT INTO alertas (tipo, evento_id, tecnico_id, mensagem, criado_em) VALUES (?, ?, ?, ?, ?)",
    tipo,
    eventoId,
    tecnicoId,
    textoAlerta(tipo, t?.nome || "", prova, observacao),
    new Date().toISOString()
  );
}

export type EquipPendente = {
  tipo: string;
  base_id: number | null;
  base_nome: string | null;
  base_uf: string | null;
  evento_id: number;
  evento_numero: string;
  evento_nome: string;
  evento_data: string;
  evento_uf: string | null;
};

export type PendenciaRetorno = { chave: string; evento_id: number; mensagem: string };

/**
 * Patrimônios alocados/em campo numa prova que já passou (a partir do dia seguinte) e ainda
 * sem retorno: um alerta por prova + base, avisando quando foi para outro estado.
 */
export function pendenciasRetorno(itens: EquipPendente[], agora: Date = new Date()): PendenciaRetorno[] {
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const grupos = new Map<string, EquipPendente[]>();
  for (const e of itens) {
    const d = parseDataBR(e.evento_data);
    if (!d || d >= hoje) continue;
    const chave = `retorno:${e.evento_id}:${e.base_id ?? "sem_base"}`;
    grupos.set(chave, [...(grupos.get(chave) || []), e]);
  }
  return [...grupos].map(([chave, lista]) => {
    const e = lista[0];
    const porTipo = new Map<string, number>();
    for (const x of lista) porTipo.set(x.tipo, (porTipo.get(x.tipo) || 0) + 1);
    const tipos = [...porTipo].map(([t, n]) => `${t} ${n}`).join(", ");
    const base = e.base_nome ? `da base ${e.base_nome}${e.base_uf ? "/" + e.base_uf : ""}` : "sem base";
    const ufProva = (e.evento_uf || "").trim().toUpperCase();
    const outroEstado = !!e.base_uf && !!ufProva && e.base_uf.trim().toUpperCase() !== ufProva;
    const n = lista.length;
    return {
      chave,
      evento_id: e.evento_id,
      mensagem:
        `Falta${n > 1 ? "m" : ""} voltar ${n} patrimônio${n > 1 ? "s" : ""} ${base} (${tipos}) — ` +
        `${e.evento_nome} (#${e.evento_numero}), ${e.evento_data}${ufProva ? ` · ${ufProva}` : ""}` +
        (outroEstado ? " · está em OUTRO ESTADO" : ""),
    };
  });
}

/** Cria (uma vez só, pela chave) os alertas de retorno pendente. */
export async function gerarAlertasRetorno(): Promise<void> {
  const itens = await dbAll<EquipPendente>(
    `SELECT e.tipo, e.base_id, b.nome AS base_nome, b.uf AS base_uf,
            v.id AS evento_id, v.numero AS evento_numero, v.nome AS evento_nome, v.data AS evento_data, v.uf AS evento_uf
     FROM equipamentos e
     JOIN eventos v ON v.id = e.evento_id
     LEFT JOIN bases b ON b.id = e.base_id
     WHERE e.status IN ('alocado', 'em_campo')`
  );
  const pend = pendenciasRetorno(itens);

  // Acessórios (por quantidade) ainda não conferidos depois da prova
  const linhas = await dbAll<LinhaAcessorio>(
    `SELECT v.id AS evento_id, v.numero AS evento_numero, v.nome AS evento_nome, v.data AS evento_data,
            v.uf AS evento_uf, p.id AS produto_id, p.nome AS produto_nome, ep.quantidade, ep.devolucao_em
     FROM evento_produtos ep JOIN eventos v ON v.id = ep.evento_id JOIN produtos p ON p.id = ep.produto_id
     WHERE ep.devolucao_em IS NULL AND ep.quantidade > 0`
  );
  for (const p of acessoriosPendentes(linhas).filter((x) => x.atrasada)) {
    pend.push({ chave: `retorno_acess:${p.evento_id}`, evento_id: p.evento_id, mensagem: textoAlertaAcessorios(p) });
  }
  if (pend.length === 0) return;
  const ja = new Set(
    (await dbAll<{ chave: string }>("SELECT chave FROM alertas WHERE chave IS NOT NULL")).map((r) => r.chave)
  );
  const agora = new Date().toISOString();
  for (const p of pend) {
    if (ja.has(p.chave)) continue;
    await dbRun(
      "INSERT INTO alertas (tipo, evento_id, mensagem, criado_em, chave) VALUES ('retorno_pendente', ?, ?, ?, ?)",
      p.evento_id,
      p.mensagem,
      agora,
      p.chave
    );
  }
}
