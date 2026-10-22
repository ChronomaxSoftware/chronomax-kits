"use client";

import { useMemo, useState } from "react";
import type { TipoEquipamento } from "@/lib/equipamentos";
import { normalizarNome } from "@/lib/tecnico-match";
import { EVENTO_EQUIPAMENTOS_MUDOU, botaoPrimario, campo } from "@/components/equipamentos/ui";

export type EquipamentoResumo = {
  id: number;
  tipo: string;
  patrimonio: string;
  numero_chip: string | null;
  numero_serie: string | null;
  status: string;
  evento_id: number | null;
  base_nome: string | null;
};

function infoEquip(e: EquipamentoResumo) {
  return [e.numero_chip || e.numero_serie, e.base_nome].filter(Boolean).join(" · ");
}

/**
 * Escolha dos patrimônios dentro do card "Produtos" do evento: mostra o que já está
 * separado para a prova (pedido × separado) e permite separar/tirar na hora, usando
 * as mesmas APIs transacionais da página "Equipamentos da prova".
 */
export default function SeletorEquipamentosProduto({
  eventoId,
  tipo,
  quantidade,
  lista,
  onMudou,
}: {
  eventoId: number;
  tipo: TipoEquipamento;
  quantidade: number;
  lista: EquipamentoResumo[];
  onMudou: () => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const daProva = useMemo(() => lista.filter((e) => e.tipo === tipo && e.evento_id === eventoId), [lista, tipo, eventoId]);
  const disponiveis = useMemo(() => {
    const q = normalizarNome(busca);
    return lista.filter(
      (e) =>
        e.tipo === tipo &&
        e.status === "disponivel" &&
        e.evento_id === null &&
        (!q || [e.patrimonio, e.numero_chip, e.numero_serie, e.base_nome].some((v) => normalizarNome(v).includes(q)))
    );
  }, [lista, tipo, busca]);

  const total = daProva.length + marcados.size;
  const cor =
    total === quantidade ? "text-emerald-300" : total > quantidade ? "text-amber-300" : "text-slate-400";

  async function chamar(url: string, init: RequestInit) {
    setErro("");
    setOcupado(true);
    try {
      const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErro(d.error || "Não foi possível concluir.");
      else window.dispatchEvent(new Event(EVENTO_EQUIPAMENTOS_MUDOU));
      await onMudou();
      return r.ok;
    } catch {
      setErro("Falha de conexão.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function separar() {
    const ok = await chamar(`/api/eventos/${eventoId}/equipamentos`, {
      method: "POST",
      body: JSON.stringify({ equipamento_ids: [...marcados] }),
    });
    if (ok) {
      setMarcados(new Set());
      setBusca("");
      setAberto(false);
    }
  }

  async function tirar(e: EquipamentoResumo) {
    if (!confirm(`Tirar o patrimônio ${e.patrimonio} desta prova?`)) return;
    await chamar(`/api/equipamentos/${e.id}`, { method: "PUT", body: JSON.stringify({ evento_id: null }) });
  }

  function alternar(idEq: number, marcar: boolean) {
    setMarcados((s) => {
      const n = new Set(s);
      if (marcar) n.add(idEq);
      else n.delete(idEq);
      return n;
    });
  }

  return (
    <div className="mt-2 pt-2 border-t border-slate-700/60 space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={cor}>
          {tipo === "Roteador" ? "Roteadores" : `${tipo}s`} selecionados: {daProva.length}/{quantidade}
          {daProva.length > quantidade && " · acima do pedido"}
        </span>
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          className="text-blue-400 hover:text-blue-300 whitespace-nowrap"
        >
          {aberto ? "Fechar" : `+ Escolher ${tipo.toLowerCase()}`}
        </button>
      </div>

      {daProva.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {daProva.map((e) => (
            <span
              key={e.id}
              title={infoEquip(e) || undefined}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-mono ${
                e.status === "em_campo"
                  ? "border-sky-500/30 bg-sky-500/15 text-sky-300"
                  : "border-violet-500/30 bg-violet-500/15 text-violet-200"
              }`}
            >
              {e.patrimonio}
              {e.status === "em_campo" ? (
                <span className="font-sans text-[10px]">em campo</span>
              ) : (
                <button
                  type="button"
                  onClick={() => tirar(e)}
                  disabled={ocupado}
                  aria-label={`Tirar ${e.patrimonio} da prova`}
                  className="text-violet-300 hover:text-red-300 disabled:opacity-50"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {erro && <p className="text-xs text-red-300">{erro}</p>}

      {aberto && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/60">
          <div className="p-2">
            <input
              type="search"
              autoFocus
              aria-label={`Buscar ${tipo.toLowerCase()} disponível`}
              className={campo}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Patrimônio, chip, série ou base"
            />
          </div>
          {disponiveis.length === 0 ? (
            <p className="px-3 pb-3 text-xs text-slate-400">Nenhum {tipo.toLowerCase()} disponível com esse filtro.</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto divide-y divide-slate-700/60">
              {disponiveis.map((e) => (
                <li key={e.id}>
                  <label className="flex items-center gap-3 px-3 py-2 hover:bg-slate-700/40 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-blue-600"
                      checked={marcados.has(e.id)}
                      onChange={(ev) => alternar(e.id, ev.target.checked)}
                    />
                    <span className="font-mono text-sm font-semibold text-white">{e.patrimonio}</span>
                    <span className="text-xs text-slate-400 truncate">{infoEquip(e)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="p-2 border-t border-slate-700 flex items-center justify-between gap-2">
            <span className={`text-xs ${cor}`}>
              {total}/{quantidade}
              {total > quantidade && " ⚠ acima do pedido"}
            </span>
            <button type="button" onClick={separar} disabled={marcados.size === 0 || ocupado} className={botaoPrimario}>
              {ocupado ? "Separando…" : `Separar (${marcados.size})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
