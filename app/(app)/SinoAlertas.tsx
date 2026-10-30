"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Alerta = {
  id: number;
  tipo: "recebimento" | "devolucao" | "retorno_pendente";
  evento_id: number | null;
  mensagem: string;
  criado_em: string;
  lido_em: string | null;
};

/** Sino do escritório: técnico confirmou recebimento/devolução do material. Atualiza a cada minuto. */
export default function SinoAlertas() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [naoLidos, setNaoLidos] = useState(0);
  const [aberto, setAberto] = useState(false);

  async function carregar() {
    try {
      const r = await fetch("/api/alertas");
      if (!r.ok) return;
      const d = await r.json();
      setAlertas(d.alertas || []);
      setNaoLidos(d.nao_lidos || 0);
    } catch {
      // sem conexão: tenta de novo no próximo ciclo
    }
  }

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60_000);
    return () => clearInterval(t);
  }, []);

  async function abrir() {
    setAberto(true);
    if (naoLidos > 0) {
      setNaoLidos(0);
      await fetch("/api/alertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lidos: true }),
      }).catch(() => {});
    }
  }

  function fechar() {
    setAberto(false);
    carregar();
  }

  return (
    <>
      <button
        onClick={abrir}
        aria-label={naoLidos > 0 ? `Alertas: ${naoLidos} novo${naoLidos > 1 ? "s" : ""}` : "Alertas"}
        className="relative p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {naoLidos > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold leading-[18px] text-center">
            {naoLidos > 99 ? "99+" : naoLidos}
          </span>
        )}
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-16" onClick={fechar}>
          <div
            role="dialog"
            aria-label="Alertas"
            className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl p-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white">🔔 Alertas</h2>
              <button onClick={fechar} aria-label="Fechar" className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            {alertas.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum alerta ainda.</p>
            ) : (
              <ul className="space-y-2">
                {alertas.map((a) => (
                  <li
                    key={a.id}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      a.lido_em ? "border-slate-700 bg-slate-900/40 text-slate-300" : "border-blue-500/40 bg-blue-500/10 text-white"
                    }`}
                  >
                    <p>
                      {a.tipo === "recebimento" ? "📦 " : a.tipo === "devolucao" ? "↩ " : "⏳ "}
                      {a.mensagem}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                      <span>{new Date(a.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                      {a.tipo === "retorno_pendente" ? (
                        <Link href="/equipamentos/pendentes" onClick={fechar} className="text-blue-400 hover:text-blue-300">
                          Conferir retorno →
                        </Link>
                      ) : a.evento_id && (
                        <Link href={`/eventos/${a.evento_id}`} onClick={fechar} className="text-blue-400 hover:text-blue-300">
                          Abrir prova →
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
