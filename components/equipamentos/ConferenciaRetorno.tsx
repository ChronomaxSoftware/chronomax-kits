"use client";

import { FormEvent, useRef, useState } from "react";
import { normalizarPatrimonio } from "@/lib/equipamentos";
import { Aviso, EVENTO_EQUIPAMENTOS_MUDOU, botaoPrimario, campo, diasDesde, formatarDataHora } from "./ui";

export type ItemEmCampo = {
  id: number;
  tipo: string;
  patrimonio: string;
  numero_chip: string | null;
  numero_serie: string | null;
  saida_em: string | null;
  saida_por?: string | null;
  /** Só na aba de pendentes (lista de várias provas). */
  evento_ref?: string | null;
};

type Marca = { resultado: "ok" | "defeito"; observacao: string };

/**
 * Conferência do material que voltou: bipe/digite o patrimônio (marca como OK) ou
 * marque na lista. Defeito vai para manutenção. O que não for marcado continua em campo.
 */
export default function ConferenciaRetorno({
  itens,
  mostrarProva = false,
  onConcluido,
}: {
  itens: ItemEmCampo[];
  mostrarProva?: boolean;
  onConcluido: (msg: string) => void | Promise<void>;
}) {
  const [marcas, setMarcas] = useState<Map<number, Marca>>(new Map());
  const [leitura, setLeitura] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const leituraRef = useRef<HTMLInputElement>(null);

  function marcar(id: number, m: Marca | null) {
    setMarcas((atual) => {
      const n = new Map(atual);
      if (m) n.set(id, m);
      else n.delete(id);
      return n;
    });
  }

  function lerPatrimonio(ev: FormEvent) {
    ev.preventDefault();
    const alvo = normalizarPatrimonio(leitura);
    if (!alvo) return;
    const item = itens.find((i) => normalizarPatrimonio(i.patrimonio) === alvo || i.numero_chip === leitura.trim());
    if (!item) {
      setErro(`Patrimônio ${alvo} não está na lista de equipamentos em campo.`);
    } else {
      setErro("");
      marcar(item.id, { resultado: marcas.get(item.id)?.resultado ?? "ok", observacao: marcas.get(item.id)?.observacao ?? "" });
    }
    setLeitura("");
    leituraRef.current?.focus();
  }

  async function registrar() {
    setErro("");
    setSalvando(true);
    try {
      const corpo = [...marcas.entries()].map(([id, m]) => ({ id, resultado: m.resultado, observacao: m.observacao }));
      const r = await fetch("/api/equipamentos/retorno", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itens: corpo }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(`${d.error || "Não foi possível registrar o retorno."} Nada foi alterado.`);
        return;
      }
      setMarcas(new Map());
      window.dispatchEvent(new Event(EVENTO_EQUIPAMENTOS_MUDOU));
      const faltam = itens.length - corpo.length;
      await onConcluido(
        `Retorno registrado: ${d.retornaram} aparelho(s)` +
          (d.paraManutencao ? `, ${d.paraManutencao} para manutenção` : "") +
          (faltam > 0 ? `. ${faltam} continua(m) em campo.` : ". Tudo conferido.")
      );
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setSalvando(false);
    }
  }

  const qtdOk = [...marcas.values()].filter((m) => m.resultado === "ok").length;
  const qtdDefeito = marcas.size - qtdOk;

  return (
    <div>
      <form onSubmit={lerPatrimonio} className="p-4 flex flex-col sm:flex-row gap-2 border-b border-slate-700">
        <input
          ref={leituraRef}
          aria-label="Bipar ou digitar patrimônio que voltou"
          className={`${campo} sm:max-w-sm uppercase`}
          value={leitura}
          onChange={(e) => setLeitura(e.target.value)}
          placeholder="Bipe ou digite o patrimônio e tecle Enter"
          autoComplete="off"
        />
        <button type="button" onClick={() => setMarcas(new Map(itens.map((i) => [i.id, { resultado: "ok", observacao: "" }])))} className="text-sm text-slate-300 hover:text-white px-2">
          Marcar todos como OK
        </button>
        {marcas.size > 0 && (
          <button type="button" onClick={() => setMarcas(new Map())} className="text-sm text-slate-400 hover:text-white px-2">
            Limpar marcações
          </button>
        )}
      </form>

      {erro && (
        <div className="px-4 pt-3">
          <Aviso tipo="erro" texto={erro} onFechar={() => setErro("")} />
        </div>
      )}

      <ul className="divide-y divide-slate-700">
        {itens.map((i) => {
          const m = marcas.get(i.id);
          const dias = diasDesde(i.saida_em);
          return (
            <li key={i.id} className={`px-4 py-3 ${m?.resultado === "ok" ? "bg-emerald-500/5" : m?.resultado === "defeito" ? "bg-amber-500/5" : ""}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <span className="font-mono font-semibold">{i.patrimonio}</span>
                  <span className="text-xs text-slate-400 ml-2">
                    {i.tipo}
                    {i.numero_chip || i.numero_serie ? ` · ${i.numero_chip || i.numero_serie}` : ""}
                  </span>
                  <div className="text-xs text-slate-500">
                    {mostrarProva && i.evento_ref ? `${i.evento_ref} · ` : ""}
                    Saiu em {formatarDataHora(i.saida_em)}
                    {dias !== null && dias > 0 ? ` (há ${dias} dia${dias > 1 ? "s" : ""})` : ""}
                    {i.saida_por ? ` · por ${i.saida_por}` : ""}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0" role="group" aria-label={`Conferência de ${i.patrimonio}`}>
                  <button
                    type="button"
                    onClick={() => marcar(i.id, m?.resultado === "ok" ? null : { resultado: "ok", observacao: "" })}
                    className={`text-xs px-3 py-1.5 rounded-lg border ${m?.resultado === "ok" ? "bg-emerald-600 border-emerald-500 text-white" : "border-slate-600 text-slate-300 hover:bg-slate-700"}`}
                  >
                    ✓ Voltou OK
                  </button>
                  <button
                    type="button"
                    onClick={() => marcar(i.id, m?.resultado === "defeito" ? null : { resultado: "defeito", observacao: m?.observacao ?? "" })}
                    className={`text-xs px-3 py-1.5 rounded-lg border ${m?.resultado === "defeito" ? "bg-amber-600 border-amber-500 text-white" : "border-slate-600 text-slate-300 hover:bg-slate-700"}`}
                  >
                    ⚠ Com defeito
                  </button>
                </div>
              </div>
              {m?.resultado === "defeito" && (
                <input
                  aria-label={`Defeito de ${i.patrimonio}`}
                  className={`${campo} mt-2 text-xs`}
                  value={m.observacao}
                  onChange={(e) => marcar(i.id, { resultado: "defeito", observacao: e.target.value })}
                  placeholder="Descreva o defeito (vai para manutenção)"
                  maxLength={500}
                />
              )}
            </li>
          );
        })}
      </ul>

      <div className="p-4 border-t border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <span className="text-sm text-slate-400">
          {marcas.size === 0
            ? "Nada marcado — o que não for marcado continua em campo."
            : `${qtdOk} OK${qtdDefeito ? ` · ${qtdDefeito} com defeito` : ""} · ${itens.length - marcas.size} continua(m) em campo`}
        </span>
        <button onClick={registrar} disabled={marcas.size === 0 || salvando} className={botaoPrimario}>
          {salvando ? "Registrando…" : `Registrar retorno (${marcas.size})`}
        </button>
      </div>
    </div>
  );
}
