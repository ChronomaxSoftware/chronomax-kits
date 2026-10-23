"use client";

import { useEffect, useMemo, useState } from "react";
import { fimSemana, formatBR, inicioSemana } from "@/lib/semana";
import { estoqueDaSemana, type EventoUso, type ProdutoEstoque } from "@/lib/estoque-semana";

// Cores validadas para o fundo escuro (slate-800), inclusive daltonismo
const COR_ALOCADO = "#3b82f6";
const COR_DISPONIVEL = "#059669";
const COR_FALTA = "#ef4444";

/**
 * Gráfico do estoque na semana escolhida: cada produto numa barra (100% = o maior entre
 * o que tenho e o que foi alocado), dividida em alocado / disponível / falta.
 */
export default function GraficoEstoque({ produtos }: { produtos: ProdutoEstoque[] }) {
  const [semana, setSemana] = useState<Date>(() => inicioSemana(new Date()));
  const [eventos, setEventos] = useState<EventoUso[] | null>(null);

  useEffect(() => {
    fetch("/api/eventos")
      .then((r) => (r.ok ? r.json() : []))
      .then(setEventos)
      .catch(() => setEventos([]));
  }, []);

  const linhas = useMemo(() => estoqueDaSemana(produtos, eventos || [], semana), [produtos, eventos, semana]);

  function mudarSemana(dias: number) {
    const d = new Date(semana);
    d.setDate(d.getDate() + dias);
    setSemana(inicioSemana(d));
  }

  return (
    <section className="bg-slate-800 rounded-xl p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-white">Estoque × alocado na semana</h2>
          <p className="text-xs text-slate-400">Alocado = soma do card Produtos das provas da semana.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => mudarSemana(-7)}
            aria-label="Semana anterior"
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm"
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
            className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            →
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-300 mb-3" aria-hidden="true">
        <Legenda cor={COR_ALOCADO} texto="Alocado" />
        <Legenda cor={COR_DISPONIVEL} texto="Disponível" />
        <Legenda cor={COR_FALTA} texto="Falta" />
      </div>

      {eventos === null ? (
        <p className="text-sm text-slate-400">Carregando…</p>
      ) : linhas.length === 0 ? (
        <p className="text-sm text-slate-400">Cadastre abaixo quantos itens você tem de cada produto.</p>
      ) : (
        <ul className="space-y-3">
          {linhas.map((l) => {
            const escala = Math.max(l.total, l.alocado) || 1;
            const usadoDoEstoque = Math.min(l.alocado, l.total);
            const segs = [
              { v: usadoDoEstoque, cor: COR_ALOCADO, rotulo: `${usadoDoEstoque} alocado(s)` },
              { v: l.disponivel, cor: COR_DISPONIVEL, rotulo: `${l.disponivel} disponível(is)` },
              { v: l.falta, cor: COR_FALTA, rotulo: `faltam ${l.falta}` },
            ].filter((s) => s.v > 0);
            const resumo = `${l.nome}: tenho ${l.total}, alocado ${l.alocado}, disponível ${l.disponivel}${
              l.falta ? `, faltam ${l.falta}` : ""
            }`;
            return (
              <li key={l.id} className="grid grid-cols-1 sm:grid-cols-[9rem_1fr_13rem] gap-1 sm:gap-3 sm:items-center">
                <span className="text-sm text-white truncate">{l.nome}</span>
                <div role="img" aria-label={resumo} className="flex h-4 gap-0.5 rounded bg-slate-900/60">
                  {segs.map((s, i) => (
                    <div
                      key={i}
                      title={`${l.nome}: ${s.rotulo}`}
                      style={{ width: `${(s.v / escala) * 100}%`, backgroundColor: s.cor }}
                      className="h-full first:rounded-l last:rounded-r"
                    />
                  ))}
                </div>
                <span className="text-xs text-slate-300 sm:text-right">
                  <strong className="text-white">{l.alocado}</strong> alocado ·{" "}
                  <strong className="text-white">{l.disponivel}</strong> disp. / {l.total}
                  {l.falta > 0 && <span className="block text-red-300">⚠ faltam {l.falta}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cor }} />
      {texto}
    </span>
  );
}
