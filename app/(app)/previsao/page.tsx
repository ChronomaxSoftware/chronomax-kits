"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import type { Celula, Previsao } from "@/lib/previsao-estoque";

const ESTILO: Record<Celula["situacao"], string> = {
  falta: "bg-red-500/20 border-red-500/50 text-red-200",
  abastecido: "bg-sky-500/15 border-sky-500/40 text-sky-200",
  limite: "bg-amber-500/15 border-amber-500/40 text-amber-200",
  sobra: "bg-emerald-500/10 border-emerald-500/30 text-emerald-200",
  vazio: "border-transparent text-slate-600",
};
const ICONE: Record<Celula["situacao"], string> = { falta: "🔴", abastecido: "🔵", limite: "🟡", sobra: "🟢", vazio: "" };

/** Texto curto da célula: o que acontece com o pedido da semana. */
function textoSaldo(c: Celula, sigla: string): string {
  if (c.situacao === "abastecido") return `${c.doAbastecedor} vêm de ${sigla}`;
  if (c.situacao === "falta") return c.doAbastecedor > 0 ? `${sigla} manda ${c.doAbastecedor} · faltam ${c.faltaReal}` : `faltam ${c.faltaReal}`;
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

  const { semanas, blocos, faltas, plano, abastecedor } = dados;
  const sigla = abastecedor ? abastecedor.split("/").pop()! : "";
  const semanasComAcao = plano
    .map((p, i) => ({ ...p, i }))
    .filter((p) => p.envios.length > 0 || p.faltas.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">📊 Previsão de estoque</h1>
        <p className="text-slate-400 text-sm">
          Soma dos <strong className="text-slate-200">Produtos</strong> preenchidos nas provas de cada semana × estoque da base
          (a prova entra na base da UF dela). O material volta depois da prova, então cada semana é comparada com o estoque cheio.
          {abastecedor && (
            <>
              {" "}
              <strong className="text-slate-200">{abastecedor}</strong> abastece as outras bases (e as provas de estado sem base)
              com a sobra da semana — prova mais próxima primeiro.
            </>
          )}{" "}
          Só entram provas com Produtos preenchidos. <strong className="text-slate-200">Nada é movido no inventário</strong>: é só
          o plano.
        </p>
      </div>

      <section
        className={`rounded-xl p-4 border ${faltas.length ? "bg-red-500/10 border-red-500/40" : "bg-emerald-500/10 border-emerald-500/30"}`}
      >
        <h2 className="font-semibold">
          {faltas.length
            ? `🔴 ${faltas.length} falta(s) real(is) nas próximas ${semanas.length} semanas`
            : `🟢 Nenhuma falta nas próximas ${semanas.length} semanas`}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {faltas.length
            ? `O que nem ${abastecedor ? sigla : "o estoque"} consegue cobrir: precisa alugar, comprar ou ajustar o pedido da prova.`
            : abastecedor
              ? `Com os envios de ${sigla} abaixo, todas as provas ficam atendidas.`
              : "Todas as provas ficam atendidas com o estoque das bases."}
        </p>
        {faltas.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {faltas.map((f, i) => (
              <li key={i} className="text-slate-200">
                <span className="text-slate-400">{f.semana}</span> · {f.bloco} · <strong>{f.produto}</strong>:{" "}
                <span className="text-red-300">faltam {f.falta}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {abastecedor && (
        <section className="bg-slate-800 rounded-xl p-4">
          <h2 className="font-semibold mb-1">🚚 O que fazer — semana a semana</h2>
          <p className="text-xs text-slate-400 mb-3">
            Envios de {abastecedor} para cobrir as outras bases. Não considera o tempo de viagem: material enviado numa semana
            pode não voltar a tempo de uma prova de {sigla} no começo da semana seguinte.
          </p>
          {semanasComAcao.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum envio necessário: cada base se vira com o próprio estoque.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {semanasComAcao.map((p) => (
                <div
                  key={p.semana}
                  className={`rounded-lg border p-3 text-sm ${p.faltas.length ? "border-red-500/40 bg-red-500/5" : "border-slate-700 bg-slate-900/50"}`}
                >
                  <p className="font-semibold text-white mb-1.5">
                    {p.i === 0 ? "Esta semana" : "Semana"} {p.semana}
                  </p>
                  {p.envios.length > 0 && (
                    <ul className="space-y-0.5 mb-1.5">
                      {p.envios.map((e, k) => (
                        <li key={k} className="text-sky-200">
                          🚚 Enviar <strong className="text-white">{e.quantidade} {e.produto}</strong> de {sigla} →{" "}
                          {e.para.replace(" (prova em estado sem base)", "")}
                        </li>
                      ))}
                    </ul>
                  )}
                  {p.faltas.map((f, k) => (
                    <p key={k} className="text-red-300">
                      🔴 Faltam <strong>{f.falta} {f.produto}</strong> em {f.bloco.replace(" (prova em estado sem base)", "")} —
                      alugar, comprar ou ajustar
                    </p>
                  ))}
                  {p.sobraAbastecedor.length > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      Fica em {sigla} depois dos envios:{" "}
                      {p.sobraAbastecedor.map((s) => `${s.produto} ${Math.max(0, s.sobra)}`).join(" · ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-slate-300">
        <span>🔴 Falta real</span>
        {abastecedor && <span>🔵 Faltava, mas {sigla} cobre</span>}
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
            <h2 className={`font-semibold ${b.semBase ? "text-amber-300" : "text-blue-300"}`}>
              📍 {b.titulo} {b.abastecedor && <span className="text-xs font-normal text-sky-300">· abastece as outras bases</span>}
            </h2>
            {b.semBase && (
              <p className="text-xs text-slate-400">
                {abastecedor ? `Sem estoque próprio: tudo vem de ${sigla}.` : "Estoque = soma de todas as bases."}
              </p>
            )}
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
                                  <span className="block text-[10px] opacity-80 whitespace-nowrap">{textoSaldo(c, sigla)}</span>
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      {l.enviado && l.enviado.some((n) => n > 0) && (
                        <tr className="text-xs">
                          <td className="px-2 pb-1 text-slate-400 sticky left-0 bg-slate-800 whitespace-nowrap">↳ enviado p/ outras bases</td>
                          <td />
                          {l.enviado.map((n, i) => {
                            const sobra = l.estoque - l.celulas[i].pedido - n;
                            return (
                              <td key={i} className="px-2 pb-1 text-center whitespace-nowrap">
                                {n > 0 ? (
                                  <>
                                    <span className="text-sky-300">🚚 {n}</span>
                                    <span className={`block text-[10px] ${sobra > 0 ? "text-slate-500" : "text-amber-300"}`}>
                                      fica {Math.max(0, sobra)}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-slate-600">–</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      )}
                      {celAberta && (
                        <tr>
                          <td colSpan={semanas.length + 2} className="px-2 pb-2">
                            <div className="rounded-lg bg-slate-900 border border-slate-700 p-3 text-xs space-y-2">
                              <p className="text-slate-300">
                                <strong className="text-white">{l.nome}</strong> · {semanas[iAberta].rotulo} · pedido{" "}
                                {celAberta.pedido}, estoque próprio {l.estoque} — {textoSaldo(celAberta, sigla)}
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
                              {celAberta.doAbastecedor > 0 && (
                                <p className="text-sky-300">
                                  🚚 {abastecedor} manda {celAberta.doAbastecedor}.
                                </p>
                              )}
                              {celAberta.faltaReal > 0 &&
                                (celAberta.cobertura.length > 0 ? (
                                  <p className="text-emerald-300">
                                    Sugestão para os {celAberta.faltaReal} que faltam:{" "}
                                    {celAberta.cobertura.map((c) => `${c.base} tem ${c.sobra} sobrando`).join(" · ")}
                                  </p>
                                ) : (
                                  <p className="text-red-300">
                                    Nenhuma base tem sobra nesta semana: alugar, comprar ou ajustar o pedido.
                                  </p>
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
