"use client";

import { parseDataBR } from "@/lib/semana";
import { labelStatusEquipamento } from "@/lib/equipamentos";

// Estilos compartilhados das telas de inventário (mesmo padrão escuro do resto do sistema)
export const campo =
  "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500";
export const rotulo = "block text-xs text-slate-400 mb-1";
export const botaoPrimario =
  "bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg";
export const botaoSecundario = "bg-slate-700 hover:bg-slate-600 text-slate-100 text-sm px-3 py-2 rounded-lg";

/** Disparado (window) após saída/retorno, pra atualizar o contador da aba "Pendentes". */
export const EVENTO_EQUIPAMENTOS_MUDOU = "equipamentos-mudou";

export type EventoOpcao ={ id: number; numero: string; nome: string; data: string; cidade: string | null; uf: string | null };

export function StatusBadge({ status }: { status: string }) {
  const cor =
    status === "manutencao"
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : status === "alocado"
        ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
        : status === "em_campo"
          ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
          : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cor}`}>
      {labelStatusEquipamento(status)}
    </span>
  );
}

export function Aviso({ texto, tipo, onFechar }: { texto: string; tipo: "erro" | "ok"; onFechar?: () => void }) {
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
        tipo === "erro"
          ? "border-red-500/40 bg-red-500/10 text-red-300"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      }`}
    >
      <span>{texto}</span>
      {onFechar && (
        <button onClick={onFechar} aria-label="Fechar aviso" className="opacity-70 hover:opacity-100">
          ✕
        </button>
      )}
    </div>
  );
}

export function Indicador({ titulo, valor, cor = "text-white" }: { titulo: string; valor: number; cor?: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3">
      <div className="text-xs text-slate-400">{titulo}</div>
      <div className={`text-2xl font-bold ${cor}`}>{valor}</div>
    </div>
  );
}

/**
 * Provas para os seletores de alocação: da semana passada em diante, por data.
 * Provas antigas não aparecem (não faz sentido alocar equipamento nelas).
 */
export function provasParaAlocar(eventos: EventoOpcao[]): EventoOpcao[] {
  const corte = new Date();
  corte.setHours(0, 0, 0, 0);
  corte.setDate(corte.getDate() - 7);
  return eventos
    .map((e) => ({ e, d: parseDataBR(e.data) }))
    .filter((x) => x.d === null || x.d >= corte)
    .sort((a, b) => (a.d?.getTime() ?? Infinity) - (b.d?.getTime() ?? Infinity))
    .map((x) => x.e);
}

/** CURRENT_TIMESTAMP do SQLite vem em UTC "yyyy-mm-dd hh:mm:ss" → Date. */
export function dataDoBanco(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? null : d;
}

export function formatarDataHora(s: string | null | undefined): string {
  const d = dataDoBanco(s);
  return d ? d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

/** Dias inteiros desde a data (0 = hoje). */
export function diasDesde(s: string | null | undefined): number | null {
  const d = dataDoBanco(s);
  return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000)) : null;
}

export function rotuloProva(e: { numero: string; nome: string; data?: string | null }) {
  return `#${e.numero} · ${e.nome}${e.data ? ` · ${e.data}` : ""}`;
}
