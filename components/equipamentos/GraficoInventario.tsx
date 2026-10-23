"use client";

import { useMemo, useState } from "react";
import { fimSemana, formatBR, inicioSemana } from "@/lib/semana";
import {
  resumoInventario,
  type BaseResumo,
  type EquipResumo,
  type EventoPedido,
  type FiltroBase,
} from "@/lib/inventario-resumo";
import { campo } from "@/components/equipamentos/ui";

// Validadas no fundo escuro (slate-800); a quantidade também vai em texto ao lado
const SEGMENTOS = [
  { chave: "disponivel", rotulo: "Disponível", cor: "#059669" },
  { chave: "alocado", rotulo: "Alocado (separado + em campo)", cor: "#3b82f6" },
  { chave: "manutencao", rotulo: "Manutenção", cor: "#d97706" },
] as const;

/**
 * Gráfico do inventário por tipo: quantos tenho, alocados, em manutenção e disponíveis
 * (situação atual), filtrável por base, com o pedido das provas da semana escolhida.
 */
export default function GraficoInventario({
  equipamentos,
  eventos,
  bases,
}: {
  equipamentos: EquipResumo[];
  eventos: EventoPedido[];
  bases: (BaseResumo & { nome: string })[];
}) {
  const [filtro, setFiltro] = useState<FiltroBase>("todas");
  const [semana, setSemana] = useState<Date>(() => inicioSemana(new Date()));

  const linhas = useMemo(
    () => resumoInventario(equipamentos, eventos, bases, filtro, semana),
    [equipamentos, eventos, bases, filtro, semana]
  );
  const escala = Math.max(1, ...linhas.map((l) => Math.max(l.total, l.pedido)));

  function mudarSemana(dias: number) {
    const d = new Date(semana);
    d.setDate(d.getDate() + dias);
    setSemana(inicioSemana(d));
  }

  return (
    <section className="bg-slate-800 rounded-xl p-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-white">Quanto tenho × alocado × disponível</h2>
          <p className="text-xs text-slate-400">
            Situação atual dos patrimônios. A linha branca é o pedido das provas da semana (card Produtos).
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            aria-label="Filtrar por base"
            className={`${campo} sm:w-48`}
            value={String(filtro)}
            onChange={(e) => {
              const v = e.target.value;
              setFiltro(v === "todas" || v === "sem_base" ? v : Number(v));
            }}
          >
            <option value="todas">Todas as bases</option>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}/{b.uf}
              </option>
            ))}
            <option value="sem_base">Sem base</option>
          </select>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => mudarSemana(-7)}
              aria-label="Semana anterior"
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm"
            >
              ←
            </button>
            <span className="text-sm text-slate-200 whitespace-nowrap">
              {formatBR(semana)} – {formatBR(fimSemana(semana))}
            </span>
            <button
              type="button"
              onClick={() => mudarSemana(7)}
              aria-label="Próxima semana"
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-300 mb-3" aria-hidden="true">
        {SEGMENTOS.map((s) => (
          <span key={s.chave} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.cor }} />
            {s.rotulo}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5 bg-white" />
          Pedido da semana
        </span>
      </div>

      {linhas.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum equipamento cadastrado{filtro === "todas" ? "" : " nesta base"}.</p>
      ) : (
        <ul className="space-y-3">
          {linhas.map((l) => {
            const utilizavel = l.total - l.manutencao;
            const falta = Math.max(0, l.pedido - utilizavel);
            const resumo = `${l.tipo}: tenho ${l.total}, alocado ${l.alocado}, disponível ${l.disponivel}, manutenção ${l.manutencao}, pedido da semana ${l.pedido}`;
            return (
              <li key={l.tipo} className="grid grid-cols-1 sm:grid-cols-[7rem_1fr_15rem] gap-1 sm:gap-3 sm:items-center">
                <span className="text-sm text-white">{l.tipo}</span>
                <div role="img" aria-label={resumo} className="relative h-4 rounded bg-slate-900/60">
                  <div className="flex h-full gap-0.5" style={{ width: `${(l.total / escala) * 100}%` }}>
                    {SEGMENTOS.map((s) => {
                      const v = l[s.chave];
                      if (!v) return null;
                      return (
                        <div
                          key={s.chave}
                          title={`${l.tipo}: ${v} ${s.rotulo.toLowerCase()}`}
                          style={{ width: `${(v / l.total) * 100}%`, backgroundColor: s.cor }}
                          className="h-full first:rounded-l last:rounded-r"
                        />
                      );
                    })}
                  </div>
                  {l.pedido > 0 && (
                    <div
                      title={`Pedido da semana: ${l.pedido}`}
                      className="absolute -top-1 -bottom-1 w-0.5 bg-white"
                      style={{ left: `calc(${(l.pedido / escala) * 100}% - 1px)` }}
                    />
                  )}
                </div>
                <span className="text-xs text-slate-300 sm:text-right">
                  tenho <strong className="text-white">{l.total}</strong> · alocado{" "}
                  <strong className="text-white">{l.alocado}</strong> · disp.{" "}
                  <strong className="text-white">{l.disponivel}</strong>
                  {l.manutencao > 0 && <> · manut. {l.manutencao}</>}
                  <span className="block text-slate-400">
                    pedido na semana: {l.pedido}
                    {falta > 0 && <span className="text-red-300"> · ⚠ faltam {falta}</span>}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
