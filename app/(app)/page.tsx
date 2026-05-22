"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseDataBR, inicioSemana, fimSemana, formatBR, chaveSemana, dataNaJanela, JANELA_SEMANAS } from "@/lib/semana";

type Produto = { id: number; nome: string; quantidade_estoque: number };

type EstoqueBase = { produto_id: number; produto_nome: string; quantidade: number };
type Base = { id: number; nome: string; uf: string; ordem: number; estoque: EstoqueBase[] };

type Evento = {
  id: number;
  numero: string;
  nome: string;
  data: string;
  cidade: string | null;
  uf: string | null;
  qtd_celulares: number;
  dias_entrega: number;
  qtd_atletas: number;
  nivel: string | null;
  data_entrega: string | null;
  hora_entrega: string | null;
  local_entrega: string | null;
  status: string;
  base1_ok: number;
  base_final_ok: number;
  base1_ok_em: string | null;
  base_final_ok_em: string | null;
  tem_kit: number;
  tipo_kit: "entrega" | "sistema" | null;
  tecnicos: { id: number; nome: string; funcao?: string | null }[];
  produtos: { id: number; nome: string; quantidade: number }[];
};

export default function HomePage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [semanaAtual, setSemanaAtual] = useState<Date>(inicioSemana(new Date()));
  const [sincronizando, setSincronizando] = useState(false);
  const [sincronizandoEquipe, setSincronizandoEquipe] = useState(false);
  const [resultadoSync, setResultadoSync] = useState<string | null>(null);
  const [diagnostico, setDiagnostico] = useState<string[] | null>(null);
  const [progresso, setProgresso] = useState<{ fase: string; porcentagem: number; atual: number; total: number } | null>(null);
  const [modo, setModo] = useState<"lista32" | "semana">("lista32");

  // Enquanto está sincronizando, faz polling de /api/sync/progress a cada 500ms
  useEffect(() => {
    if (!sincronizando) return;
    let cancelado = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/sync/progress");
        if (!r.ok) return;
        const p = await r.json();
        if (!cancelado) {
          setProgresso({ fase: p.fase, porcentagem: p.porcentagem, atual: p.atual, total: p.total });
        }
      } catch {/* ignora */}
    };
    tick();
    const id = setInterval(tick, 500);
    return () => { cancelado = true; clearInterval(id); };
  }, [sincronizando]);

  function recarregar() {
    Promise.all([
      fetch("/api/eventos").then((r) => r.json()),
      fetch("/api/produtos").then((r) => r.json()),
      fetch("/api/bases").then((r) => r.json()),
    ]).then(([ev, pr, bs]) => {
      setEventos((ev as Evento[]).filter((e) => e.tem_kit === 1));
      setProdutos(pr);
      setBases(bs);
      setCarregando(false);
    });
  }

  useEffect(() => {
    recarregar();
  }, []);

  async function limparTudo() {
    if (!confirm("Apagar TODOS os eventos importados? (técnicos e produtos cadastrados continuam)")) return;
    await fetch("/api/eventos/limpar", { method: "POST" });
    recarregar();
  }

  async function sincronizarEquipe(visivel = false) {
    setSincronizandoEquipe(true);
    setDiagnostico(null);
    setResultadoSync(visivel ? "Abrindo navegador visível pra Equipe..." : "Sincronizando equipe (técnicos)... pode levar alguns minutos");
    try {
      const r = await fetch("/api/sync-equipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visivel }),
      });
      const data = await r.json();
      setDiagnostico(data.diagnostico || null);
      if (!r.ok) {
        setResultadoSync(`Erro equipe: ${data.error || "falha"}`);
      } else {
        setResultadoSync(
          `Equipe: ${data.totalCards} cards · ${data.extraidos} extraídos · ${data.inseridos} novo(s) · ${data.atualizados} atualizado(s)`
        );
        recarregar();
      }
    } catch {
      setResultadoSync("Erro de conexão (equipe)");
    } finally {
      setSincronizandoEquipe(false);
    }
  }

  async function sincronizar(visivel = false) {
    setSincronizando(true);
    setDiagnostico(null);
    setResultadoSync(visivel ? "Abrindo navegador visível... aguarde" : "Sincronizando... (pode levar alguns minutos)");
    try {
      const r = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visivel }),
      });
      const data = await r.json();
      setDiagnostico(data.diagnostico || null);
      if (!r.ok) {
        setResultadoSync(`Erro: ${data.error || "falha"}`);
      } else {
        const tecMsg = data.tecnicosNovos > 0 ? ` · ${data.tecnicosNovos} técnico(s) novo(s)` : "";
        setResultadoSync(
          `${data.eventosEncontrados} eventos · ${data.eventosKit} com kit · ${data.importados} novos · ${data.atualizados} atualizados${tecMsg}`
        );
        recarregar();
      }
    } catch {
      setResultadoSync("Erro de conexão");
    } finally {
      setSincronizando(false);
      setProgresso(null);
    }
  }

  const eventosPorSemana = useMemo(() => {
    const mapa = new Map<string, Evento[]>();
    for (const e of eventos) {
      const d = parseDataBR(e.data);
      if (!d) continue;
      const k = chaveSemana(d);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(e);
    }
    return mapa;
  }, [eventos]);

  const semanas = useMemo(() => Array.from(eventosPorSemana.keys()).sort(), [eventosPorSemana]);

  // Janela das próximas 32 semanas (hoje → +224 dias), agrupada por semana e crescente.
  // Eventos com data inválida vão para um bloco "sem data" (nunca somem).
  const janela32 = useMemo(() => {
    const ref = new Date();
    const porSemana = new Map<string, Evento[]>();
    const semData: Evento[] = [];
    for (const e of eventos) {
      const d = parseDataBR(e.data);
      if (!d) {
        semData.push(e);
        continue;
      }
      if (!dataNaJanela(d, ref)) continue;
      const k = chaveSemana(d);
      if (!porSemana.has(k)) porSemana.set(k, []);
      porSemana.get(k)!.push(e);
    }
    const chaves = Array.from(porSemana.keys()).sort();
    for (const k of chaves) {
      porSemana.get(k)!.sort(
        (a, b) => (parseDataBR(a.data)?.getTime() ?? 0) - (parseDataBR(b.data)?.getTime() ?? 0)
      );
    }
    const total = chaves.reduce((n, k) => n + porSemana.get(k)!.length, 0);
    return { porSemana, chaves, semData, total };
  }, [eventos]);

  const semanaCorrente = chaveSemana(semanaAtual);
  const eventosDaSemana = eventosPorSemana.get(semanaCorrente) || [];
  const fim = fimSemana(semanaAtual);

  const usoSemanal = useMemo(() => {
    const uso = new Map<number, number>();
    for (const ev of eventosDaSemana) {
      for (const p of ev.produtos) {
        uso.set(p.id, (uso.get(p.id) || 0) + p.quantidade);
      }
    }
    return uso;
  }, [eventosDaSemana]);

  const baseDoUf = useMemo(() => {
    const m = new Map<string, Base>();
    for (const b of bases) m.set(b.uf, b);
    return m;
  }, [bases]);

  const usoPorBase = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    for (const ev of eventosDaSemana) {
      const chave = ev.uf && baseDoUf.has(ev.uf) ? `base:${baseDoUf.get(ev.uf)!.id}` : "sem_base";
      if (!map.has(chave)) map.set(chave, new Map());
      const inner = map.get(chave)!;
      for (const p of ev.produtos) {
        inner.set(p.id, (inner.get(p.id) || 0) + p.quantidade);
      }
    }
    return map;
  }, [eventosDaSemana, baseDoUf]);

  function semanaAnterior() {
    const d = new Date(semanaAtual);
    d.setDate(d.getDate() - 7);
    setSemanaAtual(inicioSemana(d));
  }
  function proximaSemana() {
    const d = new Date(semanaAtual);
    d.setDate(d.getDate() + 7);
    setSemanaAtual(inicioSemana(d));
  }

  if (carregando) return <p className="text-slate-400">Carregando...</p>;

  if (eventos.length === 0) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-2">Nenhum evento ainda</h1>
        <p className="text-slate-400 mb-6">Sincronize com o Gestão ou importe manualmente</p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={() => sincronizar(false)}
            disabled={sincronizando}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg"
          >
            {sincronizando ? "Sincronizando..." : "🔄 Sincronizar do Gestão"}
          </button>
          <button
            onClick={() => sincronizar(true)}
            disabled={sincronizando}
            className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg"
          >
            👁️ Sincronizar (modo visível)
          </button>
          <button
            onClick={() => sincronizarEquipe(false)}
            disabled={sincronizandoEquipe}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg"
          >
            {sincronizandoEquipe ? "Sincronizando equipe..." : "👥 Sincronizar Equipe"}
          </button>
          <Link href="/importar" className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg">
            Importar manual
          </Link>
        </div>
        {sincronizando && progresso && <BarraProgresso p={progresso} />}
        {resultadoSync && <p className="text-slate-300 mt-4 text-sm">{resultadoSync}</p>}
        <DiagnosticoBox diagnostico={diagnostico} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Convocações</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => sincronizar(false)}
            disabled={sincronizando}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            {sincronizando ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {progresso ? `${progresso.porcentagem}%` : "Sincronizando..."}
              </span>
            ) : "🔄 Sincronizar"}
          </button>
          <button
            onClick={() => sincronizar(true)}
            disabled={sincronizando}
            className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm"
            title="Abre o navegador visível pra você ver o que está acontecendo"
          >
            👁️ Visível
          </button>
          <button
            onClick={() => sincronizarEquipe(false)}
            disabled={sincronizandoEquipe}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm"
            title="Lê /squads (Equipe) do Gestão e atualiza telefones/emails dos técnicos"
          >
            {sincronizandoEquipe ? "Equipe..." : "👥 Equipe"}
          </button>
          <Link href="/importar" className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm">
            + Importar manual
          </Link>
          <button
            onClick={limparTudo}
            className="text-red-400 hover:text-red-300 px-2 py-2 text-sm"
            title="Apagar todos os eventos"
          >
            🗑️
          </button>
        </div>
      </div>

      {sincronizando && progresso && <BarraProgresso p={progresso} />}

      {resultadoSync && (
        <div className="bg-slate-800 border border-slate-700 text-slate-200 p-3 rounded-lg mb-4 text-sm">
          {resultadoSync}
        </div>
      )}

      <DiagnosticoBox diagnostico={diagnostico} />


      {/* Alternador de visão */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setModo("lista32")}
          className={`px-4 py-2 rounded-lg text-sm ${
            modo === "lista32" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Próximas {JANELA_SEMANAS} semanas
        </button>
        <button
          onClick={() => setModo("semana")}
          className={`px-4 py-2 rounded-lg text-sm ${
            modo === "semana" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Por semana
        </button>
      </div>

      {modo === "semana" ? (
        <>
          <div className="bg-slate-800 rounded-xl p-3 sm:p-4 mb-6 flex items-center justify-between gap-2">
            <button
              onClick={semanaAnterior}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm shrink-0"
            >
              <span className="sm:hidden">←</span>
              <span className="hidden sm:inline">← Semana anterior</span>
            </button>
            <div className="text-center min-w-0">
              <p className="text-xs sm:text-sm text-slate-400">Semana</p>
              <p className="text-base sm:text-lg font-bold whitespace-nowrap">
                {formatBR(semanaAtual)} - {formatBR(fim)}
              </p>
              <p className="text-xs text-slate-500">{eventosDaSemana.length} evento(s)</p>
            </div>
            <button
              onClick={proximaSemana}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm shrink-0"
            >
              <span className="sm:hidden">→</span>
              <span className="hidden sm:inline">Próxima semana →</span>
            </button>
          </div>

          <ResumoSemanal produtos={produtos} uso={usoSemanal} bases={bases} usoPorBase={usoPorBase} />

          {eventosDaSemana.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-800/50 rounded-xl">
              <p className="mb-3">Nenhum evento nesta semana.</p>
              {semanas.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  <span className="text-xs text-slate-500">Semanas com eventos:</span>
                  {semanas.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSemanaAtual(new Date(s))}
                      className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-200"
                    >
                      {formatBR(new Date(s))}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {eventosDaSemana.map((e) => (
                <CardEvento
                  key={e.id}
                  evento={e}
                  onAtualizar={(novo) => setEventos((lista) => lista.map((ev) => (ev.id === novo.id ? novo : ev)))}
                />
              ))}
            </div>
          )}
        </>
      ) : janela32.total === 0 && janela32.semData.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-slate-800/50 rounded-xl">
          <p>Nenhum evento de kit nas próximas {JANELA_SEMANAS} semanas.</p>
          <p className="text-xs text-slate-500 mt-2">Use &quot;Por semana&quot; para ver eventos passados.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500 mb-4">
            {janela32.total} evento(s) de hoje até {JANELA_SEMANAS} semanas à frente · ordem crescente
          </p>
          {janela32.chaves.map((k) => {
            const [y, mo, dy] = k.split("-").map(Number);
            const ini = new Date(y, mo - 1, dy);
            const fimS = fimSemana(ini);
            const lista = janela32.porSemana.get(k)!;
            return (
              <div key={k} className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-300">
                    Semana {formatBR(ini)} – {formatBR(fimS)}
                  </h3>
                  <span className="text-xs text-slate-500">{lista.length} evento(s)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {lista.map((e) => (
                    <CardEvento
                      key={e.id}
                      evento={e}
                      onAtualizar={(novo) => setEventos((l) => l.map((ev) => (ev.id === novo.id ? novo : ev)))}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {janela32.semData.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-amber-300 mb-2">
                ⚠ Sem data / verificar ({janela32.semData.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {janela32.semData.map((e) => (
                  <CardEvento
                    key={e.id}
                    evento={e}
                    onAtualizar={(novo) => setEventos((l) => l.map((ev) => (ev.id === novo.id ? novo : ev)))}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ResumoSemanal({
  produtos,
  uso,
  bases,
  usoPorBase,
}: {
  produtos: Produto[];
  uso: Map<number, number>;
  bases: Base[];
  usoPorBase: Map<string, Map<number, number>>;
}) {
  const algumUso = Array.from(uso.values()).some((v) => v > 0);
  if (produtos.length === 0) return null;

  const semBase = usoPorBase.get("sem_base");
  const basesAtivas = bases.filter((b) => usoPorBase.has(`base:${b.id}`));

  return (
    <div className="space-y-3 mb-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-200">Estoque usado nesta semana</h3>
        <div className="flex gap-3">
          <Link href="/bases" className="text-xs text-blue-400 hover:text-blue-300">
            Editar bases →
          </Link>
          <Link href="/produtos" className="text-xs text-blue-400 hover:text-blue-300">
            Editar produtos →
          </Link>
        </div>
      </div>

      {!algumUso ? (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
          <p className="text-sm text-slate-400">Nenhum produto está sendo usado nos eventos desta semana.</p>
        </div>
      ) : (
        <>
          {basesAtivas.map((b) => (
            <BaseSecao key={b.id} base={b} produtos={produtos} uso={usoPorBase.get(`base:${b.id}`)!} />
          ))}
          {semBase && semBase.size > 0 && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-amber-300">
                  Eventos sem base associada
                </h4>
                <span className="text-[10px] text-slate-500">cadastre a UF em /bases</span>
              </div>
              <ProdutoGrid produtos={produtos} uso={semBase} estoque={(p) => p.quantidade_estoque || 0} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BaseSecao({ base, produtos, uso }: { base: Base; produtos: Produto[]; uso: Map<number, number> }) {
  const estoqueDe = (produtoId: number) => base.estoque.find((e) => e.produto_id === produtoId)?.quantidade || 0;
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-blue-300">
          📍 {base.nome} <span className="text-xs text-slate-400 font-normal">/{base.uf}</span>
        </h4>
      </div>
      <ProdutoGrid produtos={produtos} uso={uso} estoque={(p) => estoqueDe(p.id)} />
    </div>
  );
}

function ProdutoGrid({
  produtos,
  uso,
  estoque,
}: {
  produtos: Produto[];
  uso: Map<number, number>;
  estoque: (p: Produto) => number;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {produtos.map((p) => {
        const usado = uso.get(p.id) || 0;
        const total = estoque(p);
        if (usado === 0 && total === 0) return null;
        const sobrando = total - usado;
        const cor =
          total === 0
            ? "text-slate-300"
            : sobrando < 0
            ? "text-red-400"
            : sobrando === 0
            ? "text-amber-400"
            : "text-green-400";
        return (
          <div key={p.id} className="bg-slate-900/70 rounded-lg p-3">
            <p className="text-xs text-slate-400 uppercase truncate">{p.nome}</p>
            <p className={`text-lg font-bold ${cor}`}>
              {usado}
              {total > 0 && <span className="text-sm text-slate-500"> / {total}</span>}
            </p>
            {total > 0 && (
              <p className="text-[10px] text-slate-500">
                {sobrando >= 0 ? `${sobrando} sobrando` : `faltam ${Math.abs(sobrando)}`}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BarraProgresso({ p }: { p: { fase: string; porcentagem: number; atual: number; total: number } }) {
  const pct = Math.max(0, Math.min(100, p.porcentagem));
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm text-slate-200">
          <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span>{p.fase || "Sincronizando..."}</span>
          {p.total > 0 && <span className="text-slate-400">· {p.atual}/{p.total}</span>}
        </div>
        <span className="text-sm font-bold text-blue-400">{pct}%</span>
      </div>
      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-blue-400 h-full transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DiagnosticoBox({ diagnostico }: { diagnostico: string[] | null }) {
  const [aberto, setAberto] = useState(false);
  if (!diagnostico || diagnostico.length === 0) return null;
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-lg mb-4 text-sm">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full text-left px-3 py-2 text-slate-300 hover:text-white"
      >
        {aberto ? "▼" : "▶"} Diagnóstico ({diagnostico.length} linhas) — clique para ver
      </button>
      {aberto && (
        <pre className="px-4 pb-3 text-xs text-slate-300 overflow-auto max-h-96 whitespace-pre-wrap">
          {diagnostico.join("\n")}
        </pre>
      )}
    </div>
  );
}

function CardEvento({ evento, onAtualizar }: { evento: Evento; onAtualizar: (e: Evento) => void }) {
  const corStatus =
    evento.status === "concluido"
      ? "bg-green-600"
      : evento.status === "em_andamento"
      ? "bg-yellow-600"
      : "bg-slate-600";

  const labelStatus =
    evento.status === "concluido" ? "Concluído" : evento.status === "em_andamento" ? "Em andamento" : "Pendente";

  const nomeLimpo = (evento.nome || "").slice(0, 80);

  async function toggleBase(campo: "base1_ok" | "base_final_ok", e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const novoValor = evento[campo] ? 0 : 1;
    const campoData = campo === "base1_ok" ? "base1_ok_em" : "base_final_ok_em";
    const optimista = {
      ...evento,
      [campo]: novoValor,
      [campoData]: novoValor ? new Date().toISOString() : null,
    };
    onAtualizar(optimista);
    try {
      const r = await fetch(`/api/eventos/${evento.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: novoValor }),
      });
      if (!r.ok) onAtualizar(evento);
    } catch {
      onAtualizar(evento);
    }
  }

  function formatarDataHora(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm} ${hh}:${mi}`;
  }

  return (
    <Link
      href={`/eventos/${evento.id}`}
      className="bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500 rounded-xl p-4 transition block"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs text-slate-400 font-mono">#{evento.numero}</span>
        <div className="flex items-center gap-1">
          {evento.tipo_kit === "entrega" && (
            <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded" title="Chronomax envia equipe pra entrega de kit">
              🎒 KIT
            </span>
          )}
          {evento.tipo_kit === "sistema" && (
            <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded" title="Chronomax fornece só o sistema de entrega de kits">
              💻 SISTEMA
            </span>
          )}
          <span className={`${corStatus} text-white text-xs px-2 py-0.5 rounded`}>{labelStatus}</span>
        </div>
      </div>

      <h3 className="font-bold text-white mb-1 text-sm leading-tight line-clamp-2">{nomeLimpo}</h3>

      <p className="text-xs text-slate-400 mb-3">
        📅 {evento.data}
        {evento.cidade && (
          <>
            {" · "}📍 {evento.cidade}
            {evento.uf ? "/" + evento.uf : ""}
          </>
        )}
      </p>

      <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-slate-700">
        <div className="text-center">
          <p className="text-xl font-bold text-blue-400">{evento.qtd_celulares}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">celulares</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-green-400">{evento.dias_entrega}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">dias</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-purple-400">{evento.tecnicos.length}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">técnicos</p>
        </div>
      </div>

      {evento.local_entrega && (
        <p className="text-xs text-amber-300 mt-2 truncate">📍 {evento.local_entrega}</p>
      )}

      {(evento.data_entrega || evento.hora_entrega) && (
        <p className="text-xs text-slate-200 mt-1">
          🕐 Entrega: {evento.data_entrega || "?"} {evento.hora_entrega || ""}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          onClick={(e) => toggleBase("base1_ok", e)}
          className={`text-xs font-semibold rounded-lg py-2 px-2 border transition leading-tight ${
            evento.base1_ok
              ? "bg-green-600 hover:bg-green-700 text-white border-green-500"
              : "bg-slate-900 hover:bg-slate-700 text-slate-300 border-slate-600"
          }`}
          title={evento.base1_ok && evento.base1_ok_em ? `Marcado em ${new Date(evento.base1_ok_em).toLocaleString("pt-BR")}` : ""}
        >
          {evento.base1_ok ? (
            <>
              <div>✓ Base 1 OK</div>
              {evento.base1_ok_em && <div className="text-[10px] font-normal opacity-90">{formatarDataHora(evento.base1_ok_em)}</div>}
            </>
          ) : (
            "Base 1"
          )}
        </button>
        <button
          onClick={(e) => toggleBase("base_final_ok", e)}
          className={`text-xs font-semibold rounded-lg py-2 px-2 border transition leading-tight ${
            evento.base_final_ok
              ? "bg-green-600 hover:bg-green-700 text-white border-green-500"
              : "bg-slate-900 hover:bg-slate-700 text-slate-300 border-slate-600"
          }`}
          title={evento.base_final_ok && evento.base_final_ok_em ? `Marcado em ${new Date(evento.base_final_ok_em).toLocaleString("pt-BR")}` : ""}
        >
          {evento.base_final_ok ? (
            <>
              <div>✓ Base final OK</div>
              {evento.base_final_ok_em && <div className="text-[10px] font-normal opacity-90">{formatarDataHora(evento.base_final_ok_em)}</div>}
            </>
          ) : (
            "Base final"
          )}
        </button>
      </div>

      {evento.tecnicos.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] text-slate-500 uppercase mb-1">Técnicos</p>
          <div className="flex flex-wrap gap-1">
            {evento.tecnicos.map((t) => (
              <span key={t.id} className="text-xs bg-purple-900/50 text-purple-200 px-2 py-0.5 rounded">
                {t.nome}
                {t.funcao ? ` · ${t.funcao}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {evento.produtos.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] text-slate-500 uppercase mb-1">Levando</p>
          <div className="flex flex-wrap gap-1">
            {evento.produtos.map((p) => (
              <span key={p.id} className="text-xs bg-slate-700 text-slate-200 px-2 py-0.5 rounded">
                {p.quantidade}× {p.nome}
              </span>
            ))}
          </div>
        </div>
      )}
    </Link>
  );
}
