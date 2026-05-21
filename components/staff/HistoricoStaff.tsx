"use client";

import { useCallback, useEffect, useState } from "react";
import { FUNCOES_STAFF, formatDuracao } from "@/lib/staff";

type Row = {
  id: number;
  colaborador: string;
  funcao: string | null;
  inicio: string;
  fim: string | null;
  tempo_total: number | null;
  created_by: string | null;
  device_nome: string;
  patrimonio: string | null;
  evento_nome: string | null;
};

type Opt = {
  devices: { id: number; nome: string; patrimonio: string | null }[];
  eventos: { id: number; numero?: string; nome: string }[];
};

const FILTROS_INICIAIS = {
  evento: "",
  aparelho: "",
  colaborador: "",
  funcao: "",
  data_inicial: "",
  data_final: "",
  status: "",
};

function dataHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function HistoricoStaff({ podeExportar }: { podeExportar: boolean }) {
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [rows, setRows] = useState<Row[]>([]);
  const [opt, setOpt] = useState<Opt>({ devices: [], eventos: [] });
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    fetch("/api/staff/options")
      .then((r) => (r.ok ? r.json() : { devices: [], eventos: [] }))
      .then((d) => setOpt({ devices: d.devices || [], eventos: d.eventos || [] }))
      .catch(() => {});
  }, []);

  const qs = useCallback(() => {
    const p = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => {
      if (v) p.set(k, v);
    });
    return p.toString();
  }, [filtros]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/staff/history?${qs()}`);
      if (r.ok) setRows(await r.json());
    } finally {
      setCarregando(false);
    }
  }, [qs]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const set = (k: keyof typeof FILTROS_INICIAIS, v: string) => setFiltros((f) => ({ ...f, [k]: v }));
  const sel = "bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm";

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select value={filtros.evento} onChange={(e) => set("evento", e.target.value)} className={sel}>
          <option value="">Todos os eventos</option>
          {opt.eventos.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.numero ? `#${ev.numero} - ` : ""}
              {ev.nome}
            </option>
          ))}
        </select>
        <select value={filtros.aparelho} onChange={(e) => set("aparelho", e.target.value)} className={sel}>
          <option value="">Todos os aparelhos</option>
          {opt.devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nome}
              {d.patrimonio ? ` (${d.patrimonio})` : ""}
            </option>
          ))}
        </select>
        <select value={filtros.funcao} onChange={(e) => set("funcao", e.target.value)} className={sel}>
          <option value="">Todas as funções</option>
          {FUNCOES_STAFF.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select value={filtros.status} onChange={(e) => set("status", e.target.value)} className={sel}>
          <option value="">Todos os status</option>
          <option value="em_uso">Em uso</option>
          <option value="finalizado">Finalizado</option>
        </select>
        <input
          value={filtros.colaborador}
          onChange={(e) => set("colaborador", e.target.value)}
          placeholder="Colaborador"
          className={sel}
        />
        <label className="text-xs text-slate-400 flex items-center gap-2">
          De
          <input type="date" value={filtros.data_inicial} onChange={(e) => set("data_inicial", e.target.value)} className={`${sel} flex-1`} />
        </label>
        <label className="text-xs text-slate-400 flex items-center gap-2">
          Até
          <input type="date" value={filtros.data_final} onChange={(e) => set("data_final", e.target.value)} className={`${sel} flex-1`} />
        </label>
        <div className="flex gap-2">
          <button onClick={() => setFiltros(FILTROS_INICIAIS)} className="text-sm text-slate-400 hover:text-white px-3 py-2">
            Limpar
          </button>
          {podeExportar && (
            <a
              href={`/api/staff/export?${qs()}`}
              className="bg-green-700 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg"
            >
              ⬇ Exportar Excel
            </a>
          )}
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl overflow-hidden">
        {carregando ? (
          <p className="p-6 text-center text-slate-400">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-slate-400">Nenhuma movimentação encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-slate-900 text-left text-xs text-slate-400 uppercase">
                <tr>
                  <th className="px-3 py-2">Início</th>
                  <th className="px-3 py-2">Fim</th>
                  <th className="px-3 py-2">Aparelho</th>
                  <th className="px-3 py-2">Colaborador</th>
                  <th className="px-3 py-2">Função</th>
                  <th className="px-3 py-2">Responsável</th>
                  <th className="px-3 py-2">Tempo</th>
                  <th className="px-3 py-2">Evento</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-700">
                    <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{dataHora(r.inicio)}</td>
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{dataHora(r.fim)}</td>
                    <td className="px-3 py-2 text-white">
                      {r.device_nome}
                      {r.patrimonio ? <span className="text-slate-500"> · {r.patrimonio}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-slate-200">{r.colaborador}</td>
                    <td className="px-3 py-2 text-slate-300">{r.funcao || "—"}</td>
                    <td className="px-3 py-2 text-slate-400">{r.created_by || "—"}</td>
                    <td className="px-3 py-2 text-blue-300 whitespace-nowrap">{formatDuracao(r.tempo_total)}</td>
                    <td className="px-3 py-2 text-slate-400">{r.evento_nome || "—"}</td>
                    <td className="px-3 py-2">
                      {r.fim ? (
                        <span className="text-slate-400 text-xs">Finalizado</span>
                      ) : (
                        <span className="bg-amber-600 text-white text-xs px-2 py-0.5 rounded">Em uso</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
