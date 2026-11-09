"use client";

import { useEffect, useState } from "react";
import {
  chegadaPrimeiroDia,
  converterTextoColado,
  ehDia,
  formatarLinhas,
  lerLinhas,
  separarTextoColado,
  textoChegada,
  type LinhaRetirada,
} from "@/lib/datas-retirada";

const campo = "bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-sm";

/**
 * "Datas e horários" da retirada: uma linha por dia (data, início, fim). Salva como texto
 * ("06/11/2026 das 12h00 às 21h00", uma por linha) e mostra a chegada da equipe no 1º dia.
 */
export default function EditorDatasRetirada({
  value,
  onChange,
  localAtual,
  onLocal,
}: {
  value: string;
  onChange: (texto: string) => void;
  /** Local de entrega atual: o local que vier no texto colado vai para lá */
  localAtual?: string;
  onLocal?: (local: string) => void;
}) {
  const [linhas, setLinhas] = useState<LinhaRetirada[]>(() => lerLinhas(value));
  const [colando, setColando] = useState(false);
  const [colado, setColado] = useState("");
  const [avisoColar, setAvisoColar] = useState("");
  /** Local do texto colado, diferente do endereço já preenchido: espera o ok para trocar */
  const [localPendente, setLocalPendente] = useState<string | null>(null);

  // valor carregado de fora (abrir a prova) → refaz as linhas; o que o próprio editor gerou não mexe
  useEffect(() => {
    if (value !== formatarLinhas(linhas)) setLinhas(lerLinhas(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function mudar(novas: LinhaRetirada[]) {
    setLinhas(novas);
    onChange(formatarLinhas(novas));
  }

  function alterar(i: number, campo: "data" | "inicio" | "fim", v: string) {
    mudar(linhas.map((l, j) => (j === i && ehDia(l) ? { ...l, [campo]: v } : l)));
  }

  function maisUmDia() {
    // sugere o dia seguinte ao último, com o mesmo horário
    const ultimo = [...linhas].reverse().find(ehDia);
    let data = "";
    if (ultimo?.data) {
      const [a, m, d] = ultimo.data.split("-").map(Number);
      const prox = new Date(a, m - 1, d + 1);
      data = `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, "0")}-${String(prox.getDate()).padStart(2, "0")}`;
    }
    mudar([...linhas, { data, inicio: ultimo?.inicio || "", fim: ultimo?.fim || "" }]);
  }

  function transformar() {
    const { linhas: novas, local } = separarTextoColado(colado);
    const dias = novas.filter(ehDia).length;
    if (dias === 0) {
      setAvisoColar("Não achei nenhuma data (dd/mm) no texto.");
      return;
    }
    mudar(novas);
    setColado("");
    setColando(false);
    const fora = novas.length - dias;
    let msgLocal = "";
    setLocalPendente(null);
    if (local && onLocal) {
      const atual = (localAtual || "").trim();
      if (!atual) {
        onLocal(local);
        msgLocal = " Local colocado no Local de entrega.";
      } else if (atual !== local.trim()) {
        setLocalPendente(local);
      }
    }
    setAvisoColar(
      `${dias} dia${dias > 1 ? "s" : ""} transformado${dias > 1 ? "s" : ""}.` +
        (fora ? ` ${fora} linha${fora > 1 ? "s" : ""} sem data ficou como texto — confira.` : "") +
        msgLocal
    );
  }

  const chegada = chegadaPrimeiroDia(formatarLinhas(linhas));

  return (
    <div className="space-y-2">
      {linhas.length === 0 && <p className="text-xs text-slate-500">Nenhum dia ainda.</p>}
      {linhas.map((l, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          {ehDia(l) ? (
            <>
              <input
                type="date"
                value={l.data}
                onChange={(e) => alterar(i, "data", e.target.value)}
                aria-label={`Data do dia ${i + 1}`}
                className={campo}
              />
              <span className="text-xs text-slate-400">das</span>
              <input
                type="time"
                value={l.inicio}
                onChange={(e) => alterar(i, "inicio", e.target.value)}
                aria-label={`Abertura do dia ${i + 1}`}
                className={campo}
              />
              <span className="text-xs text-slate-400">às</span>
              <input
                type="time"
                value={l.fim}
                onChange={(e) => alterar(i, "fim", e.target.value)}
                aria-label={`Fechamento do dia ${i + 1}`}
                className={campo}
              />
            </>
          ) : (
            <input
              value={l.texto}
              onChange={(e) => mudar(linhas.map((x, j) => (j === i ? { texto: e.target.value } : x)))}
              aria-label={`Linha ${i + 1} (texto)`}
              title="Linha fora do formato data/horário — fica como texto"
              className={`${campo} flex-1 min-w-0`}
            />
          )}
          <button
            type="button"
            onClick={() => mudar(linhas.filter((_, j) => j !== i))}
            title="Tirar este dia"
            className="text-red-400 hover:text-red-300 text-sm px-1"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-4">
        <button type="button" onClick={maisUmDia} className="text-xs text-blue-400 hover:text-blue-300">
          + dia
        </button>
        <button
          type="button"
          onClick={() => {
            setColando((v) => !v);
            setAvisoColar("");
          }}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          📋 Colar datas e horários
        </button>
      </div>
      {colando && (
        <div className="rounded-lg border border-blue-500/40 bg-blue-500/5 p-2 space-y-2">
          <textarea
            value={colado}
            onChange={(e) => setColado(e.target.value)}
            rows={4}
            autoFocus
            aria-label="Texto com as datas e horários"
            placeholder={"Cole aqui, do jeito que veio. Ex.:\nDATAS E HORÁRIOS:\n06/11/2026 das 12h00 às 21h00\n07/11/2026 das 10h00 às 21h00"}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={transformar}
              disabled={!colado.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded"
            >
              Transformar
            </button>
            <span className="text-[11px] text-slate-500">Substitui os dias acima.</span>
          </div>
        </div>
      )}
      {avisoColar && <p className="text-[11px] text-slate-300">{avisoColar}</p>}
      {localPendente && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs space-y-1.5">
          <p className="text-amber-200">O texto colado tem um local diferente do Local de entrega atual. Trocar?</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] uppercase text-slate-500">Atual</p>
              <p className="whitespace-pre-line text-slate-300">{localAtual}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500">Do texto colado</p>
              <p className="whitespace-pre-line text-white">{localPendente}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onLocal?.(localPendente);
                setLocalPendente(null);
                setAvisoColar("Local de entrega trocado pelo do texto colado.");
              }}
              className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1 rounded"
            >
              Trocar
            </button>
            <button type="button" onClick={() => setLocalPendente(null)} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded">
              Manter o atual
            </button>
          </div>
        </div>
      )}
      {chegada && <p className="text-xs text-amber-300">⏰ {textoChegada(chegada)}</p>}
    </div>
  );
}
