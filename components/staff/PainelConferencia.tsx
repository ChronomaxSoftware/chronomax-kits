"use client";

import { useCallback, useEffect, useState } from "react";
import { diaCurto } from "@/lib/conferencia-diaria";

type Cel = { equipamento_id: number; patrimonio: string; com_tecnico: string | null };
type Registro = { data: string; equipamento_id: number; status: "ok" | "problema"; obs: string | null; em: string; tecnico: string | null };

/**
 * Escritório (página da prova): liga/desliga a conferência diária e vê a tabela dia × celular.
 */
export default function PainelConferencia({ eventoId }: { eventoId: number }) {
  const [ativa, setAtiva] = useState(false);
  const [hoje, setHoje] = useState("");
  const [celulares, setCelulares] = useState<Cel[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [carregado, setCarregado] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/staff/conferencia/${eventoId}`);
    if (!r.ok) return;
    const d = await r.json();
    setAtiva(d.ativa);
    setHoje(d.hoje);
    setCelulares(d.celulares || []);
    setRegistros(d.registros || []);
    setCarregado(true);
  }, [eventoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alternar() {
    setSalvando(true);
    await fetch(`/api/staff/conferencia/${eventoId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativa: !ativa }),
    }).catch(() => {});
    await carregar();
    setSalvando(false);
  }

  if (!carregado) return null;

  const dias = [...new Set([...registros.map((r) => r.data), ...(ativa ? [hoje] : [])])].sort();
  const reg = new Map(registros.map((r) => [`${r.data}:${r.equipamento_id}`, r]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-300">
          {ativa
            ? "Ativa: o técnico confere cada celular no fim de cada dia (✅ está comigo / ⚠ problema)."
            : "Desligada. Ative nas provas em que quer o OK diário de cada celular."}
        </p>
        <button
          onClick={alternar}
          disabled={salvando}
          aria-pressed={ativa}
          className={`text-sm px-3 py-1.5 rounded-lg font-medium ${
            ativa ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {salvando ? "…" : ativa ? "Desativar conferência" : "Ativar conferência diária"}
        </button>
      </div>

      {celulares.length === 0 ? (
        <p className="text-xs text-slate-500">Nenhum celular alocado a esta prova no Inventário.</p>
      ) : dias.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-slate-400">
                <th className="text-left font-normal py-1 pr-2">Celular</th>
                {dias.map((d) => (
                  <th key={d} className="font-normal px-1.5 whitespace-nowrap">
                    {diaCurto(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {celulares.map((c) => (
                <tr key={c.equipamento_id} className="border-t border-slate-700/60">
                  <td className="py-1 pr-2 whitespace-nowrap">
                    <span className="font-mono text-white">{c.patrimonio}</span>
                    {c.com_tecnico && <span className="text-slate-500"> · {c.com_tecnico}</span>}
                  </td>
                  {dias.map((d) => {
                    const r = reg.get(`${d}:${c.equipamento_id}`);
                    const titulo = r
                      ? `${r.status === "ok" ? "Está com o técnico" : "Problema: " + (r.obs || "")} — ${r.tecnico || ""} ${new Date(r.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                      : "Sem conferência";
                    return (
                      <td key={d} className="text-center px-1.5" title={titulo}>
                        {r ? (r.status === "ok" ? "✅" : "⚠️") : <span className="text-slate-600">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {registros.some((r) => r.status === "problema") && (
            <ul className="mt-2 space-y-1">
              {registros
                .filter((r) => r.status === "problema")
                .map((r) => (
                  <li key={`${r.data}:${r.equipamento_id}`} className="text-xs text-amber-200">
                    ⚠ {diaCurto(r.data)} · {celulares.find((c) => c.equipamento_id === r.equipamento_id)?.patrimonio}: {r.obs}
                    {r.tecnico ? ` (${r.tecnico})` : ""}
                  </li>
                ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
