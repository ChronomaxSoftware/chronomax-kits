"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TIPOS_EQUIPAMENTO, TipoEquipamento, tipoDeProduto } from "@/lib/equipamentos";
import { normalizarNome } from "@/lib/tecnico-match";
import ConferenciaRetorno from "@/components/equipamentos/ConferenciaRetorno";
import { Aviso, EVENTO_EQUIPAMENTOS_MUDOU, botaoPrimario, campo } from "@/components/equipamentos/ui";

type Equipamento = {
  id: number;
  tipo: string;
  patrimonio: string;
  numero_chip: string | null;
  numero_serie: string | null;
  status: string;
  evento_id: number | null;
  base_nome: string | null;
  saida_em: string | null;
  saida_por: string | null;
};
type Evento = {
  id: number;
  numero: string;
  nome: string;
  data: string;
  cidade: string | null;
  uf: string | null;
  produtos: { id: number; nome: string; quantidade: number }[];
};

function Secao({ titulo, subtitulo, children, acao }: { titulo: string; subtitulo?: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="bg-slate-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold">{titulo}</h2>
          {subtitulo && <p className="text-xs text-slate-400">{subtitulo}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

function infoEquip(e: Equipamento) {
  return `${e.tipo}${e.numero_chip || e.numero_serie ? ` · ${e.numero_chip || e.numero_serie}` : ""}`;
}

export default function EquipamentosDaProvaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const eventoId = Number(id);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [lista, setLista] = useState<Equipamento[]>([]);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [paraAdicionar, setParaAdicionar] = useState<Set<number>>(new Set());
  const [paraSair, setParaSair] = useState<Set<number>>(new Set());
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

  const daProva = useMemo(() => lista.filter((e) => e.evento_id === eventoId), [lista, eventoId]);
  const separados = useMemo(() => daProva.filter((e) => e.status === "alocado"), [daProva]);
  const emCampo = useMemo(() => daProva.filter((e) => e.status === "em_campo"), [daProva]);
  const disponiveis = useMemo(() => {
    const q = normalizarNome(busca);
    return lista.filter(
      (e) =>
        e.status === "disponivel" &&
        e.evento_id === null &&
        (!tipo || e.tipo === tipo) &&
        (!q || [e.patrimonio, e.numero_chip, e.numero_serie, e.base_nome].some((v) => normalizarNome(v).includes(q)))
    );
  }, [lista, tipo, busca]);

  // Pedido (card "Produtos" do evento, por quantidade) × separado (patrimônios desta prova)
  const resumo = useMemo(() => {
    const pedido = new Map<TipoEquipamento, number>();
    for (const p of evento?.produtos || []) {
      const t = tipoDeProduto(p.nome);
      if (t) pedido.set(t, (pedido.get(t) || 0) + (p.quantidade || 0));
    }
    return TIPOS_EQUIPAMENTO.map((t) => ({
      tipo: t,
      pedido: pedido.get(t) || 0,
      separado: daProva.filter((e) => e.tipo === t).length,
      emCampo: emCampo.filter((e) => e.tipo === t).length,
      selecionado: disponiveis.filter((e) => e.tipo === t && paraAdicionar.has(e.id)).length,
    })).filter((r) => r.pedido > 0 || r.separado > 0);
  }, [evento, daProva, emCampo, disponiveis, paraAdicionar]);

  const acimaDoPedido = resumo.filter((r) => r.pedido > 0 && r.separado + r.selecionado > r.pedido);

  function alternar(set: Set<number>, idEq: number, marcar: boolean) {
    const n = new Set(set);
    if (marcar) n.add(idEq);
    else n.delete(idEq);
    return n;
  }

  async function chamar(url: string, init: RequestInit, sucesso: (d: Record<string, number>) => string) {
    setErro("");
    setOk("");
    setOcupado(true);
    try {
      const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErro(d.error || "Não foi possível concluir.");
      else {
        setOk(sucesso(d));
        window.dispatchEvent(new Event(EVENTO_EQUIPAMENTOS_MUDOU));
      }
      await carregar();
      return r.ok;
    } catch {
      setErro("Falha de conexão.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function adicionar() {
    const ok = await chamar(
      `/api/eventos/${id}/equipamentos`,
      { method: "POST", body: JSON.stringify({ equipamento_ids: [...paraAdicionar] }) },
      (d) => `${d.alocados} equipamento(s) separado(s) para a prova.`
    );
    if (ok) setParaAdicionar(new Set());
    else setErro((e) => `${e} Nenhum equipamento foi separado.`);
  }

  async function registrarSaida() {
    const ok = await chamar(
      `/api/eventos/${id}/equipamentos/saida`,
      { method: "POST", body: JSON.stringify({ equipamento_ids: [...paraSair] }) },
      (d) => `Saída registrada: ${d.sairam} equipamento(s) em campo.`
    );
    if (ok) setParaSair(new Set());
  }

  async function remover(e: Equipamento) {
    if (!confirm(`Tirar o patrimônio ${e.patrimonio} desta prova?`)) return;
    await chamar(`/api/equipamentos/${e.id}`, { method: "PUT", body: JSON.stringify({ evento_id: null }) }, () => `Patrimônio ${e.patrimonio} voltou a ficar disponível.`);
    setParaSair((s) => alternar(s, e.id, false));
  }

  if (naoEncontrado) {
    return (
      <div className="max-w-5xl">
        <Link href="/" className="text-sm text-slate-400 hover:text-white">
          ← Voltar
        </Link>
        <p className="mt-4 text-slate-300">
          Prova não encontrada. Ela pode ter sido removida pelo sync do Gestão — aparelhos que estavam em campo continuam em{" "}
          <Link href="/equipamentos/pendentes" className="text-blue-400 hover:underline">
            Pendentes de retorno
          </Link>
          .
        </p>
      </div>
    );
  }
  if (!evento) return <p className="text-slate-400">Carregando prova…</p>;

  const todosSair = separados.length > 0 && separados.every((e) => paraSair.has(e.id));
  const todosAdicionar = disponiveis.length > 0 && disponiveis.every((e) => paraAdicionar.has(e.id));

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

      {/* 1. Pedido × separado */}
      {resumo.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-400">
          Nenhuma quantidade de equipamento pedida para esta prova. Defina no card{" "}
          <Link href={`/eventos/${id}`} className="text-blue-400 hover:underline">
            Produtos
          </Link>{" "}
          do evento (ex.: Celular 5, Roteador 2) para acompanhar aqui.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {resumo.map((r) => {
            const cor =
              r.pedido === 0 || r.separado > r.pedido
                ? "border-amber-500/40"
                : r.separado === r.pedido
                  ? "border-emerald-500/40"
                  : "border-slate-700";
            return (
              <div key={r.tipo} className={`bg-slate-800 border ${cor} rounded-xl px-4 py-3`}>
                <div className="text-xs text-slate-400">{r.tipo}</div>
                <div className="text-2xl font-bold">
                  {r.separado}
                  <span className="text-base text-slate-400">/{r.pedido}</span>
                </div>
                <div className="text-xs">
                  {r.pedido === 0 ? (
                    <span className="text-amber-300">não pedido</span>
                  ) : r.separado === r.pedido ? (
                    <span className="text-emerald-300">✓ completo</span>
                  ) : r.separado > r.pedido ? (
                    <span className="text-amber-300">{r.separado - r.pedido} acima do pedido</span>
                  ) : (
                    <span className="text-slate-400">faltam {r.pedido - r.separado}</span>
                  )}
                  {r.emCampo > 0 && <span className="text-sky-300"> · {r.emCampo} em campo</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {erro && <Aviso tipo="erro" texto={erro} onFechar={() => setErro("")} />}
      {ok && <Aviso tipo="ok" texto={ok} onFechar={() => setOk("")} />}

      {/* 2. Separados → saída */}
      <Secao
        titulo={`Separados — aguardando saída (${separados.length})`}
        subtitulo="Marque o que está saindo agora e registre a saída."
      >
        {separados.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">Nenhum equipamento separado aguardando saída.</p>
        ) : (
          <>
            <label className="flex items-center gap-3 px-4 py-2 bg-slate-900/60 text-xs text-slate-400">
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={todosSair}
                onChange={(e) => setParaSair(e.target.checked ? new Set(separados.map((x) => x.id)) : new Set())}
              />
              Selecionar todos ({separados.length})
            </label>
            <ul className="divide-y divide-slate-700">
              {separados.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-blue-600"
                      checked={paraSair.has(e.id)}
                      onChange={(ev) => setParaSair((s) => alternar(s, e.id, ev.target.checked))}
                    />
                    <span className="font-mono font-semibold">{e.patrimonio}</span>
                    <span className="text-xs text-slate-400 truncate">{infoEquip(e)}</span>
                  </label>
                  <button onClick={() => remover(e)} disabled={ocupado} className="text-xs text-red-400 hover:text-red-300 shrink-0 disabled:opacity-50">
                    Tirar da prova
                  </button>
                </li>
              ))}
            </ul>
            <div className="p-4 border-t border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-sm text-slate-400">{paraSair.size} marcado(s) para sair</span>
              <button onClick={registrarSaida} disabled={paraSair.size === 0 || ocupado} className={botaoPrimario}>
                {ocupado ? "Registrando…" : `Registrar saída (${paraSair.size})`}
              </button>
            </div>
          </>
        )}
      </Secao>

      {/* 3. Em campo → conferência de retorno */}
      <Secao
        titulo={`Em campo — conferir retorno (${emCampo.length})`}
        subtitulo="Quando o material voltar, bipe/digite o patrimônio ou marque na lista e dê entrada."
      >
        {emCampo.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">Nenhum equipamento desta prova está em campo.</p>
        ) : (
          <ConferenciaRetorno
            itens={emCampo}
            onConcluido={async (msg) => {
              setOk(msg);
              setErro("");
              await carregar();
            }}
          />
        )}
      </Secao>

      {/* 4. Adicionar disponíveis */}
      <Secao
        titulo="Separar equipamentos para a prova"
        subtitulo="Só aparecem os disponíveis (fora de outras provas e fora de manutenção)."
        acao={
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
        }
      >
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
              <input
                type="checkbox"
                className="h-4 w-4 accent-blue-600"
                checked={todosAdicionar}
                onChange={(e) => setParaAdicionar(e.target.checked ? new Set(disponiveis.map((x) => x.id)) : new Set())}
              />
              Selecionar todos ({disponiveis.length})
            </label>
            <ul className="divide-y divide-slate-700">
              {disponiveis.map((e) => (
                <li key={e.id}>
                  <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/40 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-blue-600"
                      checked={paraAdicionar.has(e.id)}
                      onChange={(ev) => setParaAdicionar((s) => alternar(s, e.id, ev.target.checked))}
                    />
                    <span className="font-mono font-semibold">{e.patrimonio}</span>
                    <span className="text-xs text-slate-400 truncate">
                      {infoEquip(e)}
                      {e.base_nome ? ` · ${e.base_nome}` : ""}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="p-4 border-t border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-sm text-slate-400">
            {paraAdicionar.size} selecionado(s)
            {acimaDoPedido.length > 0 && (
              <span className="block text-amber-300">
                ⚠ Acima do pedido: {acimaDoPedido.map((r) => `${r.tipo} ${r.separado + r.selecionado}/${r.pedido}`).join(", ")}
              </span>
            )}
          </span>
          <button onClick={adicionar} disabled={paraAdicionar.size === 0 || ocupado} className={botaoPrimario}>
            {ocupado ? "Separando…" : `Separar para a prova (${paraAdicionar.size})`}
          </button>
        </div>
      </Secao>
    </div>
  );
}
