"use client";

import { useEffect, useState } from "react";
import TabelaOperacional, { LinhaOperacional } from "./TabelaOperacional";

type Cards = {
  total: number;
  disponiveis: number;
  em_uso: number;
  inativos: number;
  colaboradores_ativos: number;
  movimentacoes_hoje: number;
  trocas_hoje: number;
};

function CardNum({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <p className={`text-3xl font-bold ${cor}`}>{valor}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}

export default function DashboardStaff() {
  const [cards, setCards] = useState<Cards | null>(null);
  const [op, setOp] = useState<LinhaOperacional[]>([]);

  useEffect(() => {
    let on = true;
    const load = async () => {
      try {
        const r = await fetch("/api/staff/dashboard");
        if (r.ok) {
          const d = await r.json();
          if (on) {
            setCards(d.cards);
            setOp(d.operacional || []);
          }
        }
      } catch {
        /* ignora */
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, []);

  const c = cards;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <CardNum label="Total de aparelhos" valor={c?.total ?? 0} cor="text-white" />
        <CardNum label="Disponíveis" valor={c?.disponiveis ?? 0} cor="text-green-400" />
        <CardNum label="Em uso" valor={c?.em_uso ?? 0} cor="text-amber-400" />
        <CardNum label="Colaboradores ativos" valor={c?.colaboradores_ativos ?? 0} cor="text-blue-400" />
        <CardNum label="Trocas hoje" valor={c?.trocas_hoje ?? 0} cor="text-purple-400" />
        <CardNum label="Movimentações hoje" valor={c?.movimentacoes_hoje ?? 0} cor="text-slate-200" />
      </div>

      <div className="bg-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-slate-200">Em uso agora</h3>
          <span className="text-xs text-slate-500">atualiza automaticamente</span>
        </div>
        <TabelaOperacional linhas={op} />
      </div>
    </div>
  );
}
