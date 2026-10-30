"use client";

import { useState } from "react";
import Link from "next/link";
import { faltou } from "@/lib/retorno-acessorios";
import { Aviso, campo } from "@/components/equipamentos/ui";

export type ProvaAcessoriosTela = {
  evento_id: number;
  numero: string;
  nome: string;
  data: string;
  uf: string | null;
  atrasada: boolean;
  itens: { produto_id: number; nome: string; quantidade: number }[];
  base: { id: number; nome: string } | null;
};

/** Conferência do retorno dos acessórios de uma prova: quantos voltaram de cada item. */
export default function ConferenciaAcessorios({
  prova,
  onConcluido,
}: {
  prova: ProvaAcessoriosTela;
  onConcluido: (msg: string) => void;
}) {
  const [voltou, setVoltou] = useState<Record<number, number>>(() =>
    Object.fromEntries(prova.itens.map((i) => [i.produto_id, i.quantidade]))
  );
  const [descontar, setDescontar] = useState(true);
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const totalFalta = prova.itens.reduce((s, i) => s + faltou(i.quantidade, voltou[i.produto_id] ?? 0), 0);

  async function registrar() {
    setSalvando(true);
    setErro("");
    try {
      const r = await fetch("/api/acessorios/retorno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento_id: prova.evento_id,
          itens: prova.itens.map((i) => ({ produto_id: i.produto_id, qtd_devolvida: voltou[i.produto_id] ?? 0 })),
          descontar,
          observacao: obs,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(`${d.error || "Não foi possível registrar."} Nada foi alterado.`);
        return;
      }
      onConcluido(
        `Retorno dos acessórios registrado — ${prova.nome}` +
          (d.descontados ? ` · ${d.descontados} descontado(s) do estoque de ${d.base}` : "")
      );
    } catch {
      setErro("Sem conexão. Nada foi alterado.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className={`bg-slate-800 rounded-xl overflow-hidden border ${prova.atrasada ? "border-amber-500/40" : "border-transparent"}`}>
      <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">
            <Link href={`/eventos/${prova.evento_id}`} className="hover:underline">
              #{prova.numero} · {prova.nome}
            </Link>
          </h3>
          <p className="text-xs text-slate-400">
            Prova em {prova.data}
            {prova.uf ? ` · ${prova.uf}` : ""} · base: {prova.base ? prova.base.nome : "nenhuma (UF sem base)"}
          </p>
        </div>
        {prova.atrasada && (
          <span className="text-xs rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2 py-0.5 self-start">
            Prova já passou
          </span>
        )}
      </div>

      <ul className="divide-y divide-slate-700">
        {prova.itens.map((i) => {
          const v = voltou[i.produto_id] ?? 0;
          const f = faltou(i.quantidade, v);
          return (
            <li key={i.produto_id} className="px-4 py-3 flex items-center gap-3">
              <span className="flex-1 min-w-0 text-sm">
                {i.nome} <span className="text-xs text-slate-400">· foram {i.quantidade}</span>
              </span>
              <label className="text-xs text-slate-400 flex items-center gap-2">
                voltaram
                <input
                  type="number"
                  min={0}
                  value={v}
                  onChange={(e) => setVoltou((m) => ({ ...m, [i.produto_id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                  aria-label={`Quantos ${i.nome} voltaram`}
                  className="w-20 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-right"
                />
              </label>
              <span className={`w-24 text-right text-xs ${f > 0 ? "text-amber-300" : "text-emerald-400"}`}>
                {f > 0 ? `faltam ${f}` : "✓ completo"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="p-4 border-t border-slate-700 space-y-3">
        {erro && <Aviso tipo="erro" texto={erro} onFechar={() => setErro("")} />}
        {totalFalta > 0 && (
          <>
            {prova.base ? (
              <label className="flex items-start gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={descontar} onChange={(e) => setDescontar(e.target.checked)} className="mt-1 accent-blue-600" />
                <span>
                  Descontar o que faltou ({totalFalta}) do estoque de <strong>{prova.base.nome}</strong>
                </span>
              </label>
            ) : (
              <p className="text-xs text-amber-300">
                A UF da prova não tem base cadastrada: o que faltou fica só anotado (ajuste o estoque na aba Acessórios).
              </p>
            )}
            <input
              className={`${campo} text-sm`}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Observação (ex.: 1 extensão queimada, mouse ficou com o cliente)"
              maxLength={500}
              aria-label="Observação do retorno dos acessórios"
            />
          </>
        )}
        <button
          onClick={registrar}
          disabled={salvando}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg"
        >
          {salvando ? "Registrando…" : "Registrar retorno dos acessórios"}
        </button>
      </div>
    </section>
  );
}
