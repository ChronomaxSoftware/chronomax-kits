/**
 * Alertas para o escritório (sino no menu): técnico confirmou que recebeu
 * ou que devolveu todo o material de uma prova.
 */

import { dbGet, dbRun } from "./db";

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
