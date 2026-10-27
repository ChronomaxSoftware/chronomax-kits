"use client";

import { useState } from "react";

/** Botão da semana que abre um TXT (gerado na hora) para copiar ou baixar. */
export default function BotaoTxtSemana({
  rotulo,
  titulo,
  nomeArquivo,
  gerar,
}: {
  rotulo: string;
  titulo: string;
  nomeArquivo: string;
  gerar: () => string;
}) {
  const [texto, setTexto] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setTexto(gerar())}
        className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded whitespace-nowrap"
      >
        {rotulo}
      </button>

      {texto !== null && (
        <JanelaModal titulo={titulo} onFechar={() => setTexto(null)}>
          <CaixaTxt texto={texto} nomeArquivo={nomeArquivo} />
        </JanelaModal>
      )}
    </>
  );
}

/** Janela sobre a página (clicar fora ou no ✕ fecha). */
export function JanelaModal({
  titulo,
  onFechar,
  children,
}: {
  titulo: string;
  onFechar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onFechar}>
      <div
        role="dialog"
        aria-label={titulo}
        className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg p-4 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">{titulo}</h2>
          <button onClick={onFechar} aria-label="Fechar" className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Texto pronto com Copiar / Baixar .txt (e um botão extra opcional, ex.: Voltar). */
export function CaixaTxt({ texto, nomeArquivo, extra }: { texto: string; nomeArquivo: string; extra?: React.ReactNode }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // sem permissão de clipboard: o texto continua selecionável na caixa
    }
  }

  function baixar() {
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <textarea
        readOnly
        value={texto}
        onFocus={(e) => e.target.select()}
        rows={18}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
      />
      <div className="flex justify-end gap-2">
        {extra}
        <button onClick={baixar} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-3 py-2 rounded-lg">
          Baixar .txt
        </button>
        <button onClick={copiar} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg">
          {copiado ? "✓ Copiado" : "Copiar"}
        </button>
      </div>
    </>
  );
}
