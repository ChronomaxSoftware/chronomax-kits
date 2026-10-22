"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TIPOS_EQUIPAMENTO } from "@/lib/equipamentos";
import { normalizarNome } from "@/lib/tecnico-match";
import { Aviso, Indicador, botaoPrimario, campo } from "@/components/equipamentos/ui";

type Equipamento = {
  id: number;
  tipo: string;
  patrimonio: string;
  numero_chip: string | null;
  numero_serie: string | null;
  status: string;
  evento_id: number | null;
  base_nome: string | null;
};
type Evento = { id: number; numero: string; nome: string; data: string; cidade: string | null; uf: string | null };

export default function EquipamentosDaProvaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const eventoId = Number(id);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [lista, setLista] = useState<Equipamento[]>([]);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [rEv, rEq] = await Promise.all([fetch(`/api/eventos/${id}`), fetch("/api/equipamentos")]);
      if (rEv.status === 404) {
        setNaoEncontrado(true);
        return;
      }
      if (rEv.ok) setEvento(await rEv.json());
      if (rEq.ok) setLista(await rEq.json());
    } catch {
      setErro("Não foi possível carregar os dados. Recarregue a página.");
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const alocados = useMemo(() => lista.filter((e) => e.evento_id === eventoId), [lista, eventoId]);
  const disponiveis = useMemo(() => {
    const q = normalizarNome(busca);
    return lista.filter(
      (e) =>
        e.evento_id === null &&
        e.status !== "manutencao" &&
        (!tipo || e.tipo === tipo) &&
        (!q || [e.patrimonio, e.numero_chip, e.numero_serie, e.base_nome].some((v) => normalizarNome(v).includes(q)))
    );
  }, [lista, tipo, busca]);

  function alternar(idEq: number, marcar: boolean) {
    setSelecionados((s) => {
      const n = new Set(s);
      if (marcar) n.add(idEq);
      else n.delete(idEq);
      return n;
    });
  }

  function alternarTodos(marcar: boolean) {
    setSelecionados(marcar ? new Set(disponiveis.map((e) => e.id)) : new Set());
  }

  async function alocar() {
    setErro("");
    setOk("");
    setOcupado(true);
    try {
      const r = await fetch(`/api/eventos/${id}/equipamentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipamento_ids: [...selecionados] }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        // Lote é tudo ou nada: nada foi alocado
        setErro(`${d.error || "Não foi possível alocar."} Nenhum equipamento foi alocado.`);
      } else {
        setOk(`${d.alocados} equipamento(s) alocado(s) à prova.`);
        setSelecionados(new Set());
      }
      await carregar();
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setOcupado(false);
    }
  }

  async function liberar(e: Equipamento) {
    if (!confirm(`Liberar o patrimônio ${e.patrimonio} desta prova?`)) return;
    setErro("");
    setOk("");
    const r = await fetch(`/api/equipamentos/${e.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evento_id: null }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setOk(`Patrimônio ${e.patrimonio} liberado.`);
    else setErro(d.error || "Não foi possível liberar o equipamento.");
    await carregar();
  }

  if (naoEncontrado) {
    return (
      <div className="max-w-5xl">
        <Link href="/" className="text-sm text-slate-400 hover:text-white">
          ← Voltar
        </Link>
        <p className="mt-4 text-slate-300">Prova não encontrada. Ela pode ter sido removida pelo sync do Gestão.</p>
      </div>
    );
  }
  if (!evento) return <p className="text-slate-400">Carregando prova…</p>;

  const todosMarcados = disponiveis.length > 0 && disponiveis.every((e) => selecionados.has(e.id));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href={`/eventos/${id}`} className="text-sm text-slate-400 hover:text-white">
          ← Voltar para a prova
        </Link>
        <p className="text-sm text-slate-400 mt-2">
          #{evento.numero} · {evento.data} · {evento.cidade}
          {evento.uf ? "/" + evento.uf : ""}
        </p>
        <h1 className="text-2xl font-bold">Equipamentos da prova</h1>
        <p className="text-slate-300">{evento.nome}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {TIPOS_EQUIPAMENTO.map((t) => (
          <Indicador key={t} titulo={t} valor={alocados.filter((e) => e.tipo === t).length} />
        ))}
      </div>

      {erro && <Aviso tipo="erro" texto={erro} onFechar={() => setErro("")} />}
      {ok && <Aviso tipo="ok" texto={ok} onFechar={() => setOk("")} />}

      <section className="bg-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h2 className="font-semibold">Alocados nesta prova ({alocados.length})</h2>
        </div>
        {alocados.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">Nenhum equipamento alocado ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-700">
            {alocados.map((e) => (
              <li key={e.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-mono font-semibold">{e.patrimonio}</span>
                  <span className="text-xs text-slate-400 ml-2">
                    {e.tipo}
                    {e.numero_chip || e.numero_serie ? ` · ${e.numero_chip || e.numero_serie}` : ""}
                  </span>
                </div>
                <button onClick={() => liberar(e)} className="text-sm text-red-400 hover:text-red-300 shrink-0">
                  Liberar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold">Adicionar equipamentos</h2>
            <p className="text-xs text-slate-400">Só aparecem os disponíveis (fora de outras provas e fora de manutenção).</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="search"
              aria-label="Buscar equipamento disponível"
              className={`${campo} sm:w-64`}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Patrimônio, chip, série ou base"
            />
            <select aria-label="Filtrar por tipo" className={`${campo} sm:w-36`} value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos os tipos</option>
              {TIPOS_EQUIPAMENTO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {disponiveis.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">
            Nenhum equipamento disponível com esse filtro.{" "}
            <Link href="/equipamentos" className="text-blue-400 hover:underline">
              Cadastrar no inventário
            </Link>
          </p>
        ) : (
          <div className="max-h-[440px] overflow-y-auto">
            <label className="flex items-center gap-3 px-4 py-2 bg-slate-900/60 text-xs text-slate-400 sticky top-0">
              <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={todosMarcados} onChange={(e) => alternarTodos(e.target.checked)} />
              Selecionar todos ({disponiveis.length})
            </label>
            <ul className="divide-y divide-slate-700">
              {disponiveis.map((e) => (
                <li key={e.id}>
                  <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/40 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-blue-600"
                      checked={selecionados.has(e.id)}
                      onChange={(ev) => alternar(e.id, ev.target.checked)}
                    />
                    <span className="font-mono font-semibold">{e.patrimonio}</span>
                    <span className="text-xs text-slate-400 truncate">
                      {e.tipo}
                      {e.numero_chip || e.numero_serie ? ` · ${e.numero_chip || e.numero_serie}` : ""}
                      {e.base_nome ? ` · ${e.base_nome}` : ""}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="p-4 border-t border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-sm text-slate-400">{selecionados.size} selecionado(s)</span>
          <button onClick={alocar} disabled={selecionados.size === 0 || ocupado} className={botaoPrimario}>
            {ocupado ? "Alocando…" : "Alocar selecionados"}
          </button>
        </div>
      </section>
    </div>
  );
}
