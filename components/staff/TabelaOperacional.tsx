"use client";

import { useEffect, useState } from "react";
import { formatDuracao, labelStatusDevice } from "@/lib/staff";

export type LinhaOperacional = {
  id: number;
  colaborador: string;
  funcao: string | null;
  inicio: string;
  device_nome: string;
  patrimonio: string | null;
  status: string;
  evento_nome?: string | null;
};

export default function TabelaOperacional({ linhas }: { linhas: LinhaOperacional[] }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (linhas.length === 0) {
    return <p className="text-slate-400 text-sm p-4">Nenhum aparelho em uso no momento.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[680px]">
        <thead className="bg-slate-900 text-left text-xs text-slate-400 uppercase">
          <tr>
            <th className="px-3 py-2">Aparelho</th>
            <th className="px-3 py-2">Responsável atual</th>
            <th className="px-3 py-2">Função</th>
            <th className="px-3 py-2">Início</th>
            <th className="px-3 py-2">Tempo de uso</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const ini = Date.parse(l.inicio);
            const seg = isNaN(ini) ? null : Math.round((Date.now() - ini) / 1000);
            return (
              <tr key={l.id} className="border-t border-slate-700">
                <td className="px-3 py-2 text-white">
                  {l.device_nome}
                  {l.patrimonio ? <span className="text-slate-500"> · {l.patrimonio}</span> : null}
                </td>
                <td className="px-3 py-2 text-slate-200">{l.colaborador}</td>
                <td className="px-3 py-2 text-slate-300">{l.funcao || "—"}</td>
                <td className="px-3 py-2 text-slate-400 whitespace-nowrap">
                  {new Date(l.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-3 py-2 text-blue-300 whitespace-nowrap">{formatDuracao(seg)}</td>
                <td className="px-3 py-2">
                  <span className="bg-amber-600 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
                    {labelStatusDevice(l.status)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
