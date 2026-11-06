"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import type { Celula, Previsao } from "@/lib/previsao-estoque";

const ESTILO: Record<Celula["situacao"], string> = {
  falta: "bg-red-500/20 border-red-500/50 text-red-200",
  limite: "bg-amber-500/15 border-amber-500/40 text-amber-200",
  sobra: "bg-emerald-500/10 border-emerald-500/30 text-emerald-200",
  vazio: "border-transparent text-slate-600",
};
const ICONE: Record<Celula["situacao"], string> = { falta: "🔴", limite: "🟡", sobra: "🟢", vazio: "" };

function textoSaldo(c: Celula): string {
  if (c.situacao === "falta") return `faltam ${-c.saldo}`;
  if (c.situacao === "limite") return "no limite";
  if (c.situacao === "sobra") return `sobram ${c.saldo}`;
  return "";
}

/** Previsão de estoque: Produtos das provas × estoque das bases nas próximas 6 semanas. */
export default function PrevisaoPage() {
  const [dados, setDados] = useState<Previsao | null>(null);
  const [erro, setErro] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/previsao")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDados)
      .catch(() => setErro("Não foi possível carregar a previsão. Recarregue a página."));
  }, []);

  if (erro) return <p className="text-red-300">{erro}</p>;
  if (!dados) return <p className="text-slate-400">Carregando…</p>;

  const { semanas, blocos, faltas } = dados;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">📊 Previsão de estoque</h1>
        <p className="text-slate-400 text-sm">
          Soma dos <strong className="text-slate-200">Produtos</strong> preenchidos nas provas de cada semana × estoque da base
          (a prova entra na base da UF dela). O material volta depois da prova, então cada semana é comparada com o estoque cheio.
          Só entram provas com Produtos preenchidos.
        </p>
      </div>

      <section
        className={`rounded-xl p-4 border ${faltas.length ? "bg-red-500/10 border-red-500/40" : "bg-emerald-500/10 border-emerald-500/30"}`}
      >
        <h2 className="font-semibold">
          {faltas.length
            ? `🔴 ${faltas.length} falta(s) nas próximas ${semanas.length} semanas`
            : `🟢 Nenhuma falta nas próximas ${semanas.length} semanas`}
        </h2>
        {faltas.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {faltas.map((f, i) => (
              <li key={i} className="text-slate-200">
                <span className="text-slate-400">{f.semana}</span> · {f.bloco} · <strong>{f.produto}</strong>:{" "}
                <span className="text-red-300">faltam {f.falta}</span>{" "}
                <span className="text-slate-400">
                  (pedido {f.pedido}, estoque {f.estoque})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-4 text-xs text-slate-300">
        <span>🔴 Falta — pedido maior que o estoque</span>
        <span>🟡 No limite — usa todo o estoque</span>
        <span>🟢 Sobra</span>
        <span className="text-slate-500">Clique na célula para ver as provas</span>
      </div>

      {blocos.length === 0 && (
        <div className="bg-slate-800 rounded-xl p-6 text-sm text-slate-400">
          Nenhuma prova com Produtos preenchidos nas próximas {semanas.length} semanas.
        </div>
      )}

      {blocos.map((b) => (
        <section key={b.chave} className="bg-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h2 className={`font-semibold ${b.semBase ? "text-amber-300" : "text-blue-300"}`}>📍 {b.titulo}</h2>
            {b.semBase && <p className="text-xs text-slate-400">Estoque = soma de todas as bases.</p>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-separate border-spacing-1 min-w-[720px]">
              <thead>
                <tr className="text-xs text-slate-400">
                  <th className="text-left font-medium px-2 py-1 sticky left-0 bg-slate-800">Produto</th>
                  <th className="text-right font-medium px-2 py-1">Estoque</th>
                  {semanas.map((s, i) => (
                    <th key={s.chave} className="font-medium px-2 py-1 whitespace-nowrap">
                      {i === 0 ? "Esta semana" : s.rotulo}
                      {i === 0 && <span className="block text-[10px] text-slate-500">{s.rotulo}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.linhas.map((l) => {
                  const chaveLinha = `${b.chave}:${l.produto_id}`;
                  const iAberta = aberta?.startsWith(`${chaveLinha}:`) ? Number(aberta.split(":").pop()) : -1;
                  const celAberta = iAberta >= 0 ? l.celulas[iAberta] : null;
                  return (
                    <Fragment key={chaveLinha}>
                      <tr>
                        <td className="px-2 py-1 text-white sticky left-0 bg-slate-800 whitespace-nowrap">{l.nome}</td>
                        <td className="px-2 py-1 text-right text-slate-300">{l.estoque}</td>
                        {l.celulas.map((c, i) => {
                          const chave = `${chaveLinha}:${i}`;
                          return (
                            <td key={i} className="p-0">
                              {c.situacao === "vazio" ? (
                                <div className="text-center text-slate-600 py-1.5">–</div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setAberta(aberta === chave ? null : chave)}
                                  aria-expanded={aberta === chave}
                                  className={`w-full rounded-lg border px-2 py-1 text-center hover:brightness-125 ${ESTILO[c.situacao]} ${
                                    aberta === chave ? "ring-2 ring-white/60" : ""
                                  }`}
                                >
                                  <span className="block font-semibold">
                                    {ICONE[c.situacao]} {c.pedido}
                                  </span>
                                  <span className="block text-[10px] opacity-80 whitespace-nowrap">{textoSaldo(c)}</span>
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      {celAberta && (
                        <tr>
                          <td colSpan={semanas.length + 2} className="px-2 pb-2">
                            <div className="rounded-lg bg-slate-900 border border-slate-700 p-3 text-xs space-y-2">
                              <p className="text-slate-300">
                                <strong className="text-white">{l.nome}</strong> · {semanas[iAberta].rotulo} · pedido{" "}
                                {celAberta.pedido} de {l.estoque} em estoque — {textoSaldo(celAberta)}
                              </p>
                              <ul className="space-y-0.5">
                                {celAberta.provas.map((p) => (
                                  <li key={p.id} className="flex justify-between gap-3">
                                    <Link href={`/eventos/${p.id}`} className="text-blue-300 hover:underline truncate">
                                      #{p.numero} · {p.nome}
                                    </Link>
                                    <span className="text-slate-400 whitespace-nowrap">
                                      {p.data} · <strong className="text-white">{p.quantidade}</strong>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              {celAberta.situacao === "falta" &&
                                (celAberta.cobertura.length > 0 ? (
                                  <p className="text-emerald-300">
                                    Dá para cobrir com:{" "}
                                    {celAberta.cobertura.map((c) => `${c.base} (${c.sobra} sobrando)`).join(" · ")}
                                  </p>
                                ) : (
                                  !b.semBase && <p className="text-red-300">Nenhuma outra base tem sobra nesta semana.</p>
                                ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
