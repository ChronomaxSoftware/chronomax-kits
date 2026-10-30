"use client";

import { useCallback, useEffect, useState } from "react";
import { diaCurto } from "@/lib/conferencia-diaria";

type Cel = { equipamento_id: number; patrimonio: string; numero_chip: string | null };
type Registro = { data: string; equipamento_id: number; status: "ok" | "problema"; obs: string | null; em: string };
type Marca = { status: "ok" | "problema"; obs: string };

/**
 * Técnico: conferência do fim do dia (quando o escritório ativou na prova).
 * ✅ "Está comigo" ou ⚠ "Problema" (com descrição) em cada celular dele; pode reenviar.
 */
export default function ConferenciaDoDia({ eventoId }: { eventoId: number }) {
  const [ativa, setAtiva] = useState(false);
  const [hoje, setHoje] = useState("");
  const [celulares, setCelulares] = useState<Cel[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [aberta, setAberta] = useState(false);
  const [marcas, setMarcas] = useState<Record<number, Marca>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/staff/conferencia/${eventoId}`);
    if (!r.ok) return;
    const d = await r.json();
    setAtiva(d.ativa);
    setHoje(d.hoje);
    setCelulares(d.celulares || []);
    setRegistros(d.registros || []);
  }, [eventoId]);

  useEffect(() => {
    setAberta(false);
    carregar();
  }, [carregar]);

  if (!ativa || celulares.length === 0) return null;

  const deHoje = registros.filter((r) => r.data === hoje && celulares.some((c) => c.equipamento_id === r.equipamento_id));
  const enviada = deHoje.length > 0;
  const ultima = deHoje.reduce((m, r) => (r.em > m ? r.em : m), "");

  function abrir() {
    // Começa com o que já foi enviado hoje; o resto em branco
    setMarcas(Object.fromEntries(deHoje.map((r) => [r.equipamento_id, { status: r.status, obs: r.obs || "" }])));
    setErro("");
    setAberta(true);
  }

  function marcar(id: number, status: "ok" | "problema") {
    setMarcas((m) => ({ ...m, [id]: { status, obs: m[id]?.obs || "" } }));
  }

  async function enviar() {
    setSalvando(true);
    setErro("");
    try {
      const r = await fetch(`/api/staff/conferencia/${eventoId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens: Object.entries(marcas).map(([id, m]) => ({ equipamento_id: Number(id), status: m.status, obs: m.obs })),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.error || "Não foi possível enviar.");
        return;
      }
      setAberta(false);
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  const faltam = celulares.filter((c) => !marcas[c.equipamento_id]).length;

  return (
    <div className={`rounded-xl border p-3 ${enviada ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/50 bg-amber-500/10"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-white">
          📋 <strong>Conferência do dia {hoje && diaCurto(hoje)}</strong>
          {enviada ? (
            <span className="text-emerald-300">
              {" "}· enviada às {new Date(ultima).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ({deHoje.length}/
              {celulares.length})
            </span>
          ) : (
            <span className="text-amber-200"> · no fim do dia, confira cada celular que está com você</span>
          )}
        </p>
        {!aberta && (
          <button onClick={abrir} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-lg">
            {enviada ? "Refazer" : "Fazer conferência"}
          </button>
        )}
      </div>

      {aberta && (
        <div className="mt-3 space-y-2">
          <div className="flex justify-end">
            <button
              onClick={() => setMarcas(Object.fromEntries(celulares.map((c) => [c.equipamento_id, { status: "ok", obs: "" }])))}
              className="text-xs text-blue-300 hover:text-white"
            >
              Todos estão comigo
            </button>
          </div>
          <ul className="space-y-2">
            {celulares.map((c) => {
              const m = marcas[c.equipamento_id];
              return (
                <li key={c.equipamento_id} className="rounded-lg bg-slate-900/60 border border-slate-700 p-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 font-mono text-sm text-white">
                      {c.patrimonio}
                      {c.numero_chip && <span className="text-xs text-slate-400"> · {c.numero_chip}</span>}
                    </span>
                    <button
                      onClick={() => marcar(c.equipamento_id, "ok")}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border ${m?.status === "ok" ? "bg-emerald-600 border-emerald-500 text-white" : "border-slate-600 text-slate-300"}`}
                    >
                      ✅ Está comigo
                    </button>
                    <button
                      onClick={() => marcar(c.equipamento_id, "problema")}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border ${m?.status === "problema" ? "bg-amber-600 border-amber-500 text-white" : "border-slate-600 text-slate-300"}`}
                    >
                      ⚠ Problema
                    </button>
                  </div>
                  {m?.status === "problema" && (
                    <input
                      value={m.obs}
                      onChange={(e) => setMarcas((x) => ({ ...x, [c.equipamento_id]: { status: "problema", obs: e.target.value } }))}
                      placeholder="O que aconteceu? (sumiu, quebrou, ficou com o staff…)"
                      aria-label={`Problema do ${c.patrimonio}`}
                      maxLength={300}
                      className="mt-2 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {erro && <p className="text-sm text-red-400">{erro}</p>}
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setAberta(false)} className="text-sm text-slate-400 hover:text-white">
              Cancelar
            </button>
            <button
              onClick={enviar}
              disabled={salvando || Object.keys(marcas).length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              {salvando ? "Enviando…" : faltam > 0 ? `Enviar (faltam ${faltam})` : "Enviar conferência"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
