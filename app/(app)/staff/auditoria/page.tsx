"use client";

import { useEffect, useState } from "react";

type Log = {
  id: number;
  usuario: string | null;
  acao: string;
  detalhes: string | null;
  ip: string | null;
  navegador: string | null;
  data_hora: string;
};

function quando(iso: string): string {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default function AuditoriaPage() {
  const [rows, setRows] = useState<Log[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch("/api/staff/audit")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setRows(d))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      {carregando ? (
        <p className="p-6 text-center text-slate-400">Carregando...</p>
      ) : rows.length === 0 ? (
        <p className="p-6 text-center text-slate-400">Nenhum registro de auditoria ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-slate-900 text-left text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-3 py-2">Data/Hora</th>
                <th className="px-3 py-2">Usuário</th>
                <th className="px-3 py-2">Ação</th>
                <th className="px-3 py-2">Detalhes</th>
                <th className="px-3 py-2">IP</th>
                <th className="px-3 py-2">Navegador</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-t border-slate-700">
                  <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{quando(l.data_hora)}</td>
                  <td className="px-3 py-2 text-slate-200">{l.usuario || "—"}</td>
                  <td className="px-3 py-2 text-white">{l.acao}</td>
                  <td className="px-3 py-2 text-slate-400">{l.detalhes || "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{l.ip || "—"}</td>
                  <td className="px-3 py-2 text-slate-500 max-w-[200px] truncate" title={l.navegador || ""}>
                    {l.navegador || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
