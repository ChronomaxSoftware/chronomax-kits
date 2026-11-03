"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatBR } from "@/lib/semana";
import { OBS_TELAO_MAX, ROTULO_TELAO, agruparTelao, situacaoTelao, type EtapaTelao, type TipoTelao } from "@/lib/telao";

type Prova = {
  id: number;
  numero: string;
  nome: string;
  data: string | null;
  cidade: string | null;
  uf: string | null;
  local_prova: string | null;
  url_site_oficial: string | null;
  tipos: TipoTelao[];
  arte_cobrada_em: string | null;
  arte_cobrada_por: string | null;
  pronto_em: string | null;
  pronto_por: string | null;
  obs: string | null;
  obs_em: string | null;
  obs_por: string | null;
};

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";

const SELO: Record<ReturnType<typeof situacaoTelao>, { txt: string; cls: string }> = {
  cobrar_arte: { txt: "Cobrar arte", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  aguardando_pronto: { txt: "Arte cobrada", cls: "bg-blue-500/15 text-blue-300 border-blue-500/40" },
  pronto: { txt: "Telão pronto", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
};

export default function ListaTelao({ podeAbrirProva }: { podeAbrirProva: boolean }) {
  const [provas, setProvas] = useState<Prova[] | null>(null);
  const [erro, setErro] = useState("");
  const [soPendentes, setSoPendentes] = useState(true);
  const [busca, setBusca] = useState("");
  const [verPassadas, setVerPassadas] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/telao");
      const d = await r.json().catch(() => null);
      if (!r.ok) return setErro(d?.error || "Não foi possível carregar as provas.");
      setErro("");
      setProvas(d);
    } catch {
      setErro("Falha de conexão.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const grupos = useMemo(
    () => agruparTelao(provas ?? [], { hoje: new Date(), soPendentes, busca }),
    [provas, soPendentes, busca]
  );

  const atualizar = (p: Prova) => setProvas((lista) => (lista ?? []).map((x) => (x.id === p.id ? p : x)));

  if (!provas && !erro) return <p className="text-slate-400 text-sm">Carregando…</p>;

  const nadaFuturo = grupos.semanas.length === 0 && grupos.semData.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-700 overflow-hidden text-sm self-start">
          <button
            onClick={() => setSoPendentes(true)}
            className={`px-3 py-1.5 ${soPendentes ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}
          >
            Pendentes
          </button>
          <button
            onClick={() => setSoPendentes(false)}
            className={`px-3 py-1.5 ${!soPendentes ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}
          >
            Todas
          </button>
        </div>
        <input
          aria-label="Buscar prova"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nome ou nº da prova"
          className="w-full sm:w-72 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm"
        />
      </div>

      {erro && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      {nadaFuturo && !erro && (
        <p className="text-slate-400 text-sm">
          {soPendentes ? "Nenhuma prova pendente de telão daqui pra frente. 🎉" : "Nenhuma prova com telão daqui pra frente."}
        </p>
      )}

      {grupos.semanas.map((s) => {
        const fim = new Date(s.inicio);
        fim.setDate(fim.getDate() + 6);
        return (
          <section key={s.chave}>
            <h2 className="text-sm font-semibold text-slate-300 mb-2">
              Semana {formatBR(s.inicio).slice(0, 5)} a {formatBR(fim).slice(0, 5)}{" "}
              <span className="text-slate-500 font-normal">· {s.provas.length} prova{s.provas.length === 1 ? "" : "s"}</span>
            </h2>
            <div className="space-y-3">
              {s.provas.map((p) => (
                <CardTelao key={p.id} prova={p} podeAbrirProva={podeAbrirProva} onSalvo={atualizar} />
              ))}
            </div>
          </section>
        );
      })}

      {grupos.semData.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Sem data definida</h2>
          <div className="space-y-3">
            {grupos.semData.map((p) => (
              <CardTelao key={p.id} prova={p} podeAbrirProva={podeAbrirProva} onSalvo={atualizar} />
            ))}
          </div>
        </section>
      )}

      {grupos.passadas.length > 0 && (
        <section>
          <button onClick={() => setVerPassadas((v) => !v)} className="text-sm text-slate-400 hover:text-white">
            {verPassadas ? "▾" : "▸"} Provas que já passaram ({grupos.passadas.length})
          </button>
          {verPassadas && (
            <div className="space-y-3 mt-3">
              {grupos.passadas.map((p) => (
                <CardTelao key={p.id} prova={p} podeAbrirProva={podeAbrirProva} onSalvo={atualizar} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function CardTelao({
  prova: p,
  podeAbrirProva,
  onSalvo,
}: {
  prova: Prova;
  podeAbrirProva: boolean;
  onSalvo: (p: Prova) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [obs, setObs] = useState(p.obs || "");
  const [obsSalva, setObsSalva] = useState(false);
  const situacao = SELO[situacaoTelao(p)];

  async function enviar(body: unknown) {
    setErro("");
    setOcupado(true);
    try {
      const r = await fetch(`/api/telao/${p.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.error || "Não foi possível salvar.");
        return false;
      }
      onSalvo({ ...p, ...d, id: p.id });
      return true;
    } catch {
      setErro("Falha de conexão.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  function alternar(etapa: EtapaTelao, marcado: boolean) {
    if (!marcado && !confirm(etapa === "arte" ? "Desmarcar \"Arte cobrada\"?" : "Desmarcar \"Telão pronto\"?")) return;
    enviar({ etapa, marcado });
  }

  async function salvarObs() {
    if (await enviar({ obs })) {
      setObsSalva(true);
      setTimeout(() => setObsSalva(false), 2000);
    }
  }

  const local = [p.cidade, p.uf].filter(Boolean).join("/");

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium">
            {podeAbrirProva ? (
              <Link href={`/eventos/${p.id}`} className="hover:underline">
                {p.nome}
              </Link>
            ) : (
              p.nome
            )}{" "}
            <span className="text-xs text-slate-500 font-normal">nº {p.numero}</span>
          </p>
          <p className="text-sm text-slate-400">
            {p.data || "sem data"}
            {local && ` · ${local}`}
            {p.local_prova && ` · ${p.local_prova}`}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {p.tipos.map((t) => (
              <span key={t} className="text-xs rounded-full bg-slate-700 text-slate-200 px-2 py-0.5">
                {ROTULO_TELAO[t]}
              </span>
            ))}
            {p.url_site_oficial && (
              <a href={p.url_site_oficial} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline px-1 py-0.5">
                site da prova ↗
              </a>
            )}
          </div>
        </div>
        <span className={`self-start text-xs border rounded-full px-2.5 py-0.5 whitespace-nowrap ${situacao.cls}`}>{situacao.txt}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <BotaoEtapa
          rotulo="🎨 Arte cobrada"
          em={p.arte_cobrada_em}
          por={p.arte_cobrada_por}
          ocupado={ocupado}
          onClick={() => alternar("arte", !p.arte_cobrada_em)}
        />
        <BotaoEtapa
          rotulo="📺 Telão pronto"
          em={p.pronto_em}
          por={p.pronto_por}
          ocupado={ocupado}
          onClick={() => alternar("pronto", !p.pronto_em)}
        />
      </div>

      <div>
        <label htmlFor={`obs-${p.id}`} className="block text-xs text-slate-400 mb-1">
          Observação
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <textarea
            id={`obs-${p.id}`}
            rows={2}
            maxLength={OBS_TELAO_MAX}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Ex.: cliente vai mandar a arte até quinta"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          />
          <button
            onClick={salvarObs}
            disabled={ocupado || obs.trim() === (p.obs || "")}
            className="self-end sm:self-stretch bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg"
          >
            {obsSalva ? "✓ Salvo" : "Salvar"}
          </button>
        </div>
        {p.obs && p.obs_em && (
          <p className="text-[11px] text-slate-500 mt-1">
            Última edição: {p.obs_por || "—"} em {quando(p.obs_em)}
          </p>
        )}
      </div>

      {erro && <p className="text-sm text-red-400">{erro}</p>}
    </div>
  );
}

function BotaoEtapa({
  rotulo,
  em,
  por,
  ocupado,
  onClick,
}: {
  rotulo: string;
  em: string | null;
  por: string | null;
  ocupado: boolean;
  onClick: () => void;
}) {
  const feito = !!em;
  return (
    <button
      onClick={onClick}
      disabled={ocupado}
      aria-pressed={feito}
      className={`text-left rounded-lg border px-3 py-2 disabled:opacity-60 transition-colors ${
        feito
          ? "border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20"
          : "border-slate-600 bg-slate-900 hover:border-blue-500"
      }`}
    >
      <span className={`block text-sm font-medium ${feito ? "text-emerald-300" : "text-white"}`}>
        {feito ? "✓ " : "○ "}
        {rotulo}
      </span>
      <span className="block text-[11px] text-slate-400">
        {feito ? `${por || "—"} · ${quando(em)}` : "Toque para marcar"}
      </span>
    </button>
  );
}
