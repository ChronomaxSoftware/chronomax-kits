"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { hojeBR } from "@/lib/conferencia-diaria";
import {
  DIAS_A_FRENTE,
  filaBase,
  filtrarFila,
  textoDias,
  type EventoBase,
  type FiltroBase,
  type Urgencia,
} from "@/lib/fila-base";

const ESTILO: Record<Urgencia, string> = {
  vermelho: "border-red-500/60 bg-red-500/10",
  amarelo: "border-amber-500/60 bg-amber-500/10",
  normal: "border-slate-700 bg-slate-800",
  feito: "border-emerald-600/50 bg-emerald-500/5 opacity-75",
};
const ICONE: Record<Urgencia, string> = { vermelho: "🔴", amarelo: "🟡", normal: "⚪", feito: "✅" };

const FILTROS: { v: FiltroBase; r: string }[] = [
  { v: "pendentes", r: "Pendentes" },
  { v: "falta_final", r: "Só falta a final" },
  { v: "todas", r: "Todas" },
];

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "2026-11-25" → "qua 25/11" */
function rotuloData(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${SEMANA[new Date(y, m - 1, d).getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function quando(isoDataHora: string | null): string {
  return isoDataHora ? new Date(isoDataHora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
}

/** Aba "Subir base": prioridade da Base 1 / Base final pela data da entrega de kit. */
export default function SubirBasePage() {
  const [eventos, setEventos] = useState<EventoBase[] | null>(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<FiltroBase>("pendentes");

  useEffect(() => {
    fetch("/api/eventos")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setEventos)
      .catch(() => setErro("Não consegui carregar as provas."));
  }, []);

  const fila = useMemo(() => (eventos ? filaBase(eventos, hojeBR()) : []), [eventos]);
  const lista = filtrarFila(fila, filtro);
  const contagem = {
    pendentes: filtrarFila(fila, "pendentes").length,
    falta_final: filtrarFila(fila, "falta_final").length,
    todas: fila.length,
  };

  async function alternar(e: EventoBase, campo: "base1_ok" | "base_final_ok") {
    const novo = e[campo] ? 0 : 1;
    const campoEm = campo === "base1_ok" ? "base1_ok_em" : "base_final_ok_em";
    const trocar = (x: EventoBase) => setEventos((l) => (l ? l.map((y) => (y.id === x.id ? x : y)) : l));
    trocar({ ...e, [campo]: novo, [campoEm]: novo ? new Date().toISOString() : null });
    try {
      const r = await fetch(`/api/eventos/${e.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: novo }),
      });
      if (!r.ok) trocar(e);
    } catch {
      trocar(e);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Subir base</h1>
      <p className="text-slate-400 text-sm mb-4">
        Ordem de prioridade pela data da <strong className="text-slate-200">entrega de kit</strong> (próximos {DIAS_A_FRENTE}{" "}
        dias). Marque <strong className="text-slate-200">Base 1</strong> e <strong className="text-slate-200">Base final</strong>{" "}
        quando subir — é o mesmo botão das Convocações.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {FILTROS.map((f) => (
          <button
            key={f.v}
            onClick={() => setFiltro(f.v)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              filtro === f.v ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
            }`}
          >
            {f.r} ({contagem[f.v]})
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500 mb-4">
        🔴 entrega hoje, amanhã ou já começou · 🟡 até 3 dias · ⚪ mais adiante · ✅ as duas bases feitas
      </p>

      {erro && <p className="text-red-400">{erro}</p>}
      {!eventos && !erro && <p className="text-slate-400">Carregando...</p>}
      {eventos && lista.length === 0 && (
        <p className="text-slate-400">
          {filtro === "pendentes" ? "Nenhuma base pendente nos próximos dias. 🎉" : "Nenhuma prova nesse filtro."}
        </p>
      )}

      <ol className="space-y-2">
        {lista.map((item, i) => {
          const e = item.evento;
          const pos = i + 1; // posição na fila que está na tela (1, 2, 3…)
          return (
            <li key={e.id} className={`rounded-xl border p-3 ${ESTILO[item.urgencia]}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-lg font-bold text-slate-400 w-7 text-right flex-shrink-0">{pos}</span>
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="mr-1">{ICONE[item.urgencia]}</span>
                      <strong className="text-white">
                        {rotuloData(item.entrega)}
                        {!item.semEntrega && e.hora_entrega ? ` ${e.hora_entrega.replace(":00", "h").replace(":", "h")}` : ""}
                      </strong>
                      <span className="text-slate-400"> · {textoDias(item.dias)}</span>
                      {item.semEntrega && <span className="text-amber-300 text-xs"> · sem data de entrega (data da prova)</span>}
                    </p>
                    <Link href={`/eventos/${e.id}`} className="block text-slate-100 hover:text-blue-300 truncate">
                      <span className="text-slate-400">#{e.numero}</span> {e.nome}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {[e.cidade && `${e.cidade}${e.uf ? "/" + e.uf : ""}`, `prova ${e.data}`, e.qtd_atletas ? `${e.qtd_atletas} atletas` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 sm:flex-shrink-0 pl-10 sm:pl-0">
                  {(
                    [
                      ["base1_ok", "Base 1", e.base1_ok_em],
                      ["base_final_ok", "Base final", e.base_final_ok_em],
                    ] as const
                  ).map(([campo, rotulo, em]) => (
                    <button
                      key={campo}
                      onClick={() => alternar(e, campo)}
                      title={e[campo] && em ? `Marcado em ${quando(em)}` : "Marcar como subida"}
                      className={`px-3 py-1.5 rounded-lg text-sm border min-w-24 ${
                        e[campo]
                          ? "bg-emerald-600 border-emerald-500 text-white"
                          : "bg-slate-900 border-slate-600 text-slate-200 hover:border-blue-500"
                      }`}
                    >
                      {e[campo] ? `✓ ${rotulo}` : rotulo}
                      {e[campo] && em ? <span className="block text-[10px] opacity-90">{quando(em)}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
