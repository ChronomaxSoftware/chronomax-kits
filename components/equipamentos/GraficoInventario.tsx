"use client";

import { useMemo, useState } from "react";
import { fimSemana, formatBR, inicioSemana } from "@/lib/semana";
import {
  foraDaBase,
  resumoInventario,
  type BaseResumo,
  type EquipResumo,
  type EventoPedido,
  type FiltroBase,
  type LinhaInventario,
} from "@/lib/inventario-resumo";

// Validadas no fundo escuro (slate-800); a quantidade também vai em texto ao lado
const SEGMENTOS = [
  { chave: "disponivel", rotulo: "Disponível", cor: "#059669" },
  { chave: "alocado", rotulo: "Alocado na região", cor: "#3b82f6" },
  { chave: "fora", rotulo: "Fora (prova em outro estado)", cor: "#db2777" },
  { chave: "manutencao", rotulo: "Manutenção", cor: "#d97706" },
] as const;

type EquipGrafico = EquipResumo & { patrimonio?: string; prova_ref?: string | null; evento_data?: string | null };

/**
 * Gráfico do inventário: um bloco por base com quanto tem de cada tipo — disponível,
 * alocado na região, fora (em prova de outro estado, ainda sem retorno) e manutenção —
 * e o pedido das provas da semana escolhida.
 */
export default function GraficoInventario({
  equipamentos,
  eventos,
  bases,
}: {
  equipamentos: EquipGrafico[];
  eventos: EventoPedido[];
  bases: (BaseResumo & { nome: string })[];
}) {
  const [semana, setSemana] = useState<Date>(() => inicioSemana(new Date()));

  const blocos = useMemo(() => {
    const ehFora = foraDaBase(bases);
    const lista: { chave: string; titulo: string; filtro: FiltroBase }[] = [
      ...bases.map((b) => ({ chave: String(b.id), titulo: `${b.nome}/${b.uf}`, filtro: b.id as FiltroBase })),
      { chave: "sem_base", titulo: "Sem base", filtro: "sem_base" },
    ];
    return lista
      .map((b) => ({
        ...b,
        linhas: resumoInventario(equipamentos, eventos, bases, b.filtro, semana),
        fora: equipamentos.filter((e) => e.base_id === b.filtro && ehFora(e)),
      }))
      .filter((b) => b.linhas.length > 0);
  }, [equipamentos, eventos, bases, semana]);

  const escala = Math.max(1, ...blocos.flatMap((b) => b.linhas.map((l) => Math.max(l.total, l.pedido))));

  function mudarSemana(dias: number) {
    const d = new Date(semana);
    d.setDate(d.getDate() + dias);
    setSemana(inicioSemana(d));
  }

  return (
    <section className="bg-slate-800 rounded-xl p-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-white">Materiais por base</h2>
          <p className="text-xs text-slate-400">
            Situação atual dos patrimônios de cada base. A linha branca é o pedido das provas da semana (card Produtos).
          </p>
        </div>
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

      <div className="flex flex-wrap gap-4 text-xs text-slate-300 mb-4" aria-hidden="true">
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

      {blocos.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum equipamento cadastrado.</p>
      ) : (
        <div className="space-y-5">
          {blocos.map((b) => (
            <div key={b.chave} className="border-t border-slate-700 pt-3 first:border-t-0 first:pt-0">
              <h3 className="text-sm font-semibold text-white mb-2">📍 {b.titulo}</h3>
              <ul className="space-y-3">
                {b.linhas.map((l) => (
                  <Barra key={l.tipo} l={l} escala={escala} />
                ))}
              </ul>
              {b.fora.length > 0 && (
                <div className="mt-3 rounded-lg border border-pink-500/30 bg-pink-500/10 p-2.5">
                  <p className="text-xs text-pink-200 mb-1.5">
                    Fora da base — em prova de outro estado, ainda sem retorno ({b.fora.length}):
                  </p>
                  <ul className="space-y-0.5 text-xs text-slate-200">
                    {b.fora.map((e, i) => (
                      <li key={e.patrimonio || i}>
                        {e.tipo} <span className="font-mono font-semibold text-white">{e.patrimonio}</span>
                        {" → "}
                        {e.prova_ref || "prova"}
                        {e.evento_uf ? ` (${e.evento_uf}` : ""}
                        {e.evento_uf && e.evento_data ? `, ${e.evento_data})` : e.evento_uf ? ")" : ""}
                        {e.status === "em_campo" ? " · em campo" : " · separado"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Barra({ l, escala }: { l: LinhaInventario; escala: number }) {
  const utilizavel = l.total - l.manutencao;
  const falta = Math.max(0, l.pedido - utilizavel);
  const resumo = `${l.tipo}: tenho ${l.total}, disponível ${l.disponivel}, alocado na região ${l.alocado}, fora ${l.fora}, manutenção ${l.manutencao}, pedido da semana ${l.pedido}`;
  return (
    <li className="grid grid-cols-1 sm:grid-cols-[7rem_1fr_16rem] gap-1 sm:gap-3 sm:items-center">
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
        tenho <strong className="text-white">{l.total}</strong> · disp. <strong className="text-white">{l.disponivel}</strong> ·
        aloc. <strong className="text-white">{l.alocado}</strong>
        {l.fora > 0 && (
          <>
            {" "}· <span className="text-pink-300">fora <strong>{l.fora}</strong></span>
          </>
        )}
        {l.manutencao > 0 && <> · manut. {l.manutencao}</>}
        <span className="block text-slate-400">
          pedido na semana: {l.pedido}
          {falta > 0 && <span className="text-red-300"> · ⚠ faltam {falta}</span>}
        </span>
      </span>
    </li>
  );
}
