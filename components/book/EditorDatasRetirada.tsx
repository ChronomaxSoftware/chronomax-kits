"use client";

import { useEffect, useState } from "react";
import { chegadaPrimeiroDia, ehDia, formatarLinhas, lerLinhas, textoChegada, type LinhaRetirada } from "@/lib/datas-retirada";

const campo = "bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-sm";

/**
 * "Datas e horários" da retirada: uma linha por dia (data, início, fim). Salva como texto
 * ("06/11/2026 das 12h00 às 21h00", uma por linha) e mostra a chegada da equipe no 1º dia.
 */
export default function EditorDatasRetirada({ value, onChange }: { value: string; onChange: (texto: string) => void }) {
  const [linhas, setLinhas] = useState<LinhaRetirada[]>(() => lerLinhas(value));

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
      <button type="button" onClick={maisUmDia} className="text-xs text-blue-400 hover:text-blue-300">
        + dia
      </button>
      {chegada && <p className="text-xs text-amber-300">⏰ {textoChegada(chegada)}</p>}
    </div>
  );
}
