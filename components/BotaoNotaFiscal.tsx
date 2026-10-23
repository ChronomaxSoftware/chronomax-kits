"use client";

import { useState } from "react";
import { formatBR } from "@/lib/semana";
import { textoNotaFiscalSemana, type EventoNota } from "@/lib/nota-fiscal";

/** Botão da semana: abre o TXT da nota fiscal (técnico, prova e equipamentos indo) pra copiar ou baixar. */
export default function BotaoNotaFiscal({ inicio, fim, eventos }: { inicio: Date; fim: Date; eventos: EventoNota[] }) {
  const [texto, setTexto] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // sem permissão de clipboard: o texto continua selecionável na caixa
    }
  }

  function baixar() {
    if (!texto) return;
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `nota-fiscal_${formatBR(inicio).replace(/\//g, "-")}_a_${formatBR(fim).replace(/\//g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setTexto(textoNotaFiscalSemana(inicio, fim, eventos))}
        className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded whitespace-nowrap"
      >
        📄 TXT nota fiscal
      </button>

      {texto !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setTexto(null)}
        >
          <div
            role="dialog"
            aria-label="Texto para nota fiscal"
            className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">Nota fiscal — semana</h2>
              <button onClick={() => setTexto(null)} aria-label="Fechar" className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <textarea
              readOnly
              value={texto}
              onFocus={(e) => e.target.select()}
              rows={16}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
            />
            <div className="flex justify-end gap-2">
              <button onClick={baixar} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-3 py-2 rounded-lg">
                Baixar .txt
              </button>
              <button onClick={copiar} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">
                {copiado ? "✓ Copiado" : "Copiar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
