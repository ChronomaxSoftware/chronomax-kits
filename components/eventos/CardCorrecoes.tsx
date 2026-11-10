"use client";

import { useEffect, useState } from "react";
import type { Correcao } from "@/lib/correcoes";

function quando(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * "✏️ Correções de quantidade": pedidos dos técnicos para mudar "quantos vieram" de um item.
 * Só ao aprovar a quantidade é gravada. Some quando a prova não tem nenhum pedido.
 */
export default function CardCorrecoes({ eventoId, onDecidido }: { eventoId: number; onDecidido?: () => void }) {
  const [lista, setLista] = useState<Correcao[]>([]);
  const [recusando, setRecusando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  async function carregar() {
    try {
      const r = await fetch(`/api/eventos/${eventoId}/correcoes`);
      if (r.ok) setLista(await r.json());
    } catch {
      // sem conexão: mantém a lista
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId]);

  async function decidir(c: Correcao, acao: "aprovar" | "recusar") {
    setOcupado(c.id);
    setErro("");
    try {
      const r = await fetch(`/api/eventos/${eventoId}/correcoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correcao_id: c.id, acao, motivo: acao === "recusar" ? motivo : undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErro(d.error || "Não foi possível salvar.");
      setRecusando(null);
      setMotivo("");
      await carregar();
      if (r.ok) onDecidido?.();
    } finally {
      setOcupado(null);
    }
  }

  if (lista.length === 0) return null;
  const pendentes = lista.filter((c) => c.status === "pendente");
  const decididos = lista.filter((c) => c.status !== "pendente");

  return (
    <div className={`rounded-xl p-4 ${pendentes.length ? "bg-amber-950/40 border border-amber-500/50" : "bg-slate-800"}`}>
      <h2 className="font-bold mb-3 text-white">
        ✏️ Correções de quantidade {pendentes.length > 0 && <span className="text-amber-300">({pendentes.length} esperando você)</span>}
      </h2>
      {erro && <p className="mb-2 text-sm text-red-400">{erro}</p>}
      <ul className="space-y-3">
        {pendentes.map((c) => (
          <li key={c.id} className="rounded-lg border border-amber-500/40 bg-slate-900 p-3 text-sm space-y-2">
            <p className="text-white">
              <b>{c.produto || "Item"}</b>: {c.qtd_antes} → <b className="text-amber-300">{c.qtd_pedida}</b>
              <span className="block text-xs text-slate-400">
                {c.tecnico || "Técnico"} · {quando(c.criado_em)}
              </span>
            </p>
            <p className="whitespace-pre-wrap rounded bg-amber-500/10 border border-amber-500/30 px-2 py-1 text-xs text-amber-100">
              📝 {c.explicacao}
            </p>
            {recusando === c.id ? (
              <div className="space-y-2">
                <input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={500}
                  autoFocus
                  placeholder="Motivo da recusa (opcional, o técnico vê)"
                  className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => decidir(c, "recusar")}
                    disabled={ocupado === c.id}
                    className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded"
                  >
                    Confirmar recusa
                  </button>
                  <button onClick={() => setRecusando(null)} className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded">
                    Voltar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => decidir(c, "aprovar")}
                  disabled={ocupado === c.id}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded"
                >
                  ✅ Aprovar
                </button>
                <button
                  onClick={() => {
                    setRecusando(c.id);
                    setMotivo("");
                  }}
                  disabled={ocupado === c.id}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded"
                >
                  ❌ Recusar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {decididos.length > 0 && (
        <details className="mt-3 text-xs text-slate-400" open={pendentes.length === 0}>
          <summary className="cursor-pointer">Histórico ({decididos.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {decididos.map((c) => (
              <li key={c.id}>
                {c.status === "aprovado" ? "✅" : "❌"} {c.produto}: {c.qtd_antes} → {c.qtd_pedida} · {c.tecnico} · {quando(c.decidido_em)}
                <span className="block text-slate-500">📝 {c.explicacao}{c.motivo ? ` — recusa: ${c.motivo}` : ""}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
