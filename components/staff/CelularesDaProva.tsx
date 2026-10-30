"use client";

import { useCallback, useEffect, useState } from "react";
import ModalVinculo, { type AcaoVinculo, type DadosVinculo } from "@/components/staff/ModalVinculo";
import ConferenciaDoDia from "@/components/staff/ConferenciaDoDia";
import { provaPadrao } from "@/lib/staff-prova";

type Prova = { id: number; numero: string; nome: string; data: string; cidade: string | null; uf: string | null; celulares: number };
type Celular = {
  equipamento_id: number;
  tipo: string;
  patrimonio: string;
  numero_chip: string | null;
  device_id: number | null;
  vinculo_id: number | null;
  colaborador: string | null;
  funcao: string | null;
  inicio: string | null;
  com_tecnico_id: number | null;
  com_tecnico: string | null;
};
type Eu = { role: "tecnico"; tecnico_id: number } | { role: "admin" };

const LABEL: Record<AcaoVinculo, string> = {
  vincular: "Colaborador vinculado",
  trocar: "Responsável trocado",
  finalizar: "Utilização finalizada",
};

/**
 * Celulares alocados à prova (Inventário) prontos para vincular ao colaborador — sem bipar QR.
 * O aparelho entra no cadastro do Staff sozinho, pelo patrimônio, no primeiro vínculo.
 * Prova com mais de um técnico: cada técnico marca os celulares que pegou e vê "os meus".
 */
export default function CelularesDaProva() {
  const [provas, setProvas] = useState<Prova[] | null>(null);
  const [provaId, setProvaId] = useState<number | null>(null);
  const [celulares, setCelulares] = useState<Celular[]>([]);
  const [equipe, setEquipe] = useState<string[]>([]);
  const [eu, setEu] = useState<Eu>({ role: "admin" });
  const [soMeus, setSoMeus] = useState(true);
  const [selecionando, setSelecionando] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [aberto, setAberto] = useState<{ cel: Celular; deviceId: number } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/staff/provas")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: Prova[]) => {
        setProvas(lista);
        setProvaId(provaPadrao(lista)?.id ?? null);
      })
      .catch(() => setProvas([]));
  }, []);

  const carregar = useCallback(async (id: number) => {
    const r = await fetch(`/api/staff/provas/${id}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErro(d.error || "Não foi possível carregar os celulares.");
      return;
    }
    setCelulares(d.celulares || []);
    setEquipe(d.equipe || []);
    if (d.eu) setEu(d.eu);
  }, []);

  useEffect(() => {
    if (provaId) {
      setSel(new Set());
      setSelecionando(false);
      carregar(provaId);
    }
  }, [provaId, carregar]);

  function aviso(texto: string) {
    setMsg(texto);
    setTimeout(() => setMsg(""), 3500);
  }

  async function abrir(cel: Celular) {
    setErro("");
    if (cel.device_id) {
      setAberto({ cel, deviceId: cel.device_id });
      return;
    }
    const r = await fetch(`/api/staff/provas/${provaId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ equipamento_id: cel.equipamento_id }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErro(d.error || "Não foi possível preparar o aparelho.");
      return;
    }
    setAberto({ cel, deviceId: Number(d.device_id) });
  }

  async function confirmar(action: AcaoVinculo, dados: DadosVinculo) {
    if (!aberto || !provaId) return;
    setSalvando(true);
    setErro("");
    try {
      const r = await fetch("/api/staff/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, device_id: aberto.deviceId, ...dados, event_id: provaId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.error || "Erro ao salvar");
        return;
      }
      aviso(`${LABEL[action]} — ${aberto.cel.patrimonio}`);
      setAberto(null);
      await carregar(provaId);
    } finally {
      setSalvando(false);
    }
  }

  async function pegarOuSoltar(acao: "pegar" | "soltar", ids: number[]) {
    if (!provaId || ids.length === 0) return;
    setErro("");
    const r = await fetch(`/api/staff/provas/${provaId}/pegar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao, equipamentos: ids }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErro(d.error || "Não foi possível salvar.");
      return;
    }
    if (acao === "pegar") {
      aviso(
        `${d.pegos} celular(es) marcado(s) como seus` +
          (d.de_outro ? ` · ${d.de_outro} já estava(m) com outro técnico` : "")
      );
      setSoMeus(true);
    } else aviso(`${d.soltos} celular(es) liberado(s)`);
    setSel(new Set());
    setSelecionando(false);
    await carregar(provaId);
  }

  if (provas === null) return <p className="text-slate-400 text-sm">Carregando…</p>;
  if (provas.length === 0) {
    return (
      <p className="bg-slate-800 rounded-xl p-4 text-sm text-slate-400">
        Nenhuma prova com celular alocado (de 7 dias atrás até 30 dias à frente).
      </p>
    );
  }

  const prova = provas.find((p) => p.id === provaId) || null;
  const tecnico = eu.role === "tecnico" ? eu.tecnico_id : null;
  const meus = tecnico ? celulares.filter((c) => c.com_tecnico_id === tecnico) : [];
  const livres = celulares.filter((c) => !c.com_tecnico_id);
  const lista = tecnico && soMeus && meus.length > 0 && !selecionando ? meus : celulares;
  const emUso = celulares.filter((c) => c.vinculo_id).length;

  // Resumo por técnico (para o escritório e para quem divide a prova)
  const porTecnico = new Map<string, number>();
  for (const c of celulares) {
    const k = c.com_tecnico || "Sem técnico";
    porTecnico.set(k, (porTecnico.get(k) || 0) + 1);
  }

  function alternar(id: number) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-3">
      <select
        aria-label="Prova"
        value={provaId ?? ""}
        onChange={(e) => setProvaId(Number(e.target.value))}
        className="w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
      >
        {provas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.data} · #{p.numero} {p.nome} ({p.celulares} cel.)
          </option>
        ))}
      </select>

      {msg && <p className="text-green-400 text-sm">✓ {msg}</p>}
      {erro && <p className="text-red-400 text-sm">{erro}</p>}

      {tecnico && provaId && <ConferenciaDoDia key={`${provaId}:${celulares.map((c) => c.com_tecnico_id).join()}`} eventoId={provaId} />}

      <p className="text-xs text-slate-400">
        {celulares.length} celular{celulares.length === 1 ? "" : "es"} · {emUso} em uso ·{" "}
        {[...porTecnico].map(([n, q]) => `${n}: ${q}`).join(" · ")}
      </p>

      {tecnico && (
        <div className="flex flex-wrap items-center gap-2">
          {!selecionando ? (
            <>
              {livres.length > 0 && (
                <button
                  onClick={() => setSelecionando(true)}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-3 py-2 rounded-lg"
                >
                  🙋 Marcar os celulares que peguei
                </button>
              )}
              {meus.length > 0 && (
                <div className="flex rounded-lg border border-slate-700 overflow-hidden text-sm">
                  <button onClick={() => setSoMeus(true)} className={`px-3 py-1.5 ${soMeus ? "bg-slate-700 text-white" : "text-slate-400"}`}>
                    Meus ({meus.length})
                  </button>
                  <button onClick={() => setSoMeus(false)} className={`px-3 py-1.5 ${!soMeus ? "bg-slate-700 text-white" : "text-slate-400"}`}>
                    Todos ({celulares.length})
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <span className="text-sm text-slate-300">Toque nos celulares que você pegou:</span>
              <button
                onClick={() => setSel(new Set(livres.map((c) => c.equipamento_id)))}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Todos os livres ({livres.length})
              </button>
              <button
                onClick={() => pegarOuSoltar("pegar", [...sel])}
                disabled={sel.size === 0}
                className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm px-3 py-2 rounded-lg"
              >
                Confirmar ({sel.size})
              </button>
              <button
                onClick={() => {
                  setSelecionando(false);
                  setSel(new Set());
                }}
                className="text-sm text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      )}

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {lista.map((c) => {
          const meu = tecnico !== null && c.com_tecnico_id === tecnico;
          const deOutro = tecnico !== null && !!c.com_tecnico_id && !meu;
          const livreDeTecnico = !c.com_tecnico_id;
          const marcado = sel.has(c.equipamento_id);
          return (
            <li
              key={c.equipamento_id}
              className={`rounded-xl border ${
                marcado
                  ? "border-emerald-500 bg-emerald-500/10"
                  : c.vinculo_id
                  ? "border-blue-500/50 bg-blue-500/10"
                  : "border-slate-700 bg-slate-800"
              } ${deOutro ? "opacity-60" : ""}`}
            >
              <button
                onClick={() => (selecionando ? livreDeTecnico && alternar(c.equipamento_id) : !deOutro && abrir(c))}
                disabled={(selecionando && !livreDeTecnico) || (!selecionando && deOutro)}
                className="w-full text-left p-3 disabled:cursor-not-allowed"
              >
                <span className="font-mono font-semibold text-white">
                  {selecionando && livreDeTecnico ? (marcado ? "☑ " : "☐ ") : ""}
                  {c.patrimonio}
                </span>
                {c.numero_chip && <span className="text-xs text-slate-400"> · {c.numero_chip}</span>}
                <span className="block text-sm mt-1">
                  {c.vinculo_id ? (
                    <span className="text-blue-200">
                      👤 {c.colaborador}
                      {c.funcao ? ` (${c.funcao})` : ""}
                      {c.inicio && (
                        <span className="text-xs text-slate-400">
                          {" "}· desde {new Date(c.inicio).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-400">{deOutro ? "Livre" : "Livre — toque para vincular"}</span>
                  )}
                </span>
              </button>
              <div className="flex items-center justify-between gap-2 px-3 pb-2 text-xs">
                <span className={meu ? "text-emerald-300" : "text-slate-400"}>
                  {meu ? "🙋 Comigo" : c.com_tecnico ? `📱 Com ${c.com_tecnico}` : "Sem técnico"}
                </span>
                {(meu || (eu.role === "admin" && c.com_tecnico_id)) && !selecionando && (
                  <button
                    onClick={() => pegarOuSoltar("soltar", [c.equipamento_id])}
                    className="text-slate-400 hover:text-white underline"
                  >
                    {meu ? "não está comigo" : "liberar"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {aberto && prova && (
        <ModalVinculo
          device={{ id: aberto.deviceId, nome: `${aberto.cel.tipo} ${aberto.cel.patrimonio}`, patrimonio: aberto.cel.patrimonio, status: aberto.cel.vinculo_id ? "em_uso" : "disponivel" }}
          atual={
            aberto.cel.vinculo_id
              ? { id: aberto.cel.vinculo_id, colaborador: aberto.cel.colaborador || "", funcao: aberto.cel.funcao, inicio: aberto.cel.inicio || "" }
              : null
          }
          eventos={[]}
          eventoFixo={{ id: prova.id, numero: prova.numero, nome: prova.nome }}
          sugestoes={equipe}
          salvando={salvando}
          onConfirm={confirmar}
          onClose={() => setAberto(null)}
        />
      )}
    </div>
  );
}
