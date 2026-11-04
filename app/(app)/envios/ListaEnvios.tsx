"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { linkWhatsApp } from "@/lib/convite-texto";
import {
  OBS_ENVIO_MAX,
  agruparEnvios,
  linkMapa,
  materialSeparado,
  rotuloDataEnvio,
  situacaoEnvio,
  type EtapaEnvio,
} from "@/lib/envios";
import { BotaoEtapa } from "../telao/ListaTelao";

type Tecnico = {
  id: number;
  nome: string;
  telefone: string | null;
  cidade: string | null;
  funcao: string | null;
  endereco_entrega: string | null;
};

type Prova = {
  id: number;
  numero: string;
  nome: string;
  data: string | null;
  cidade: string | null;
  uf: string | null;
  local_prova: string | null;
  data_envio: string | null;
  endereco: string | null;
  material_em: string | null;
  material_por: string | null;
  numeros_em: string | null;
  numeros_por: string | null;
  devolvido_em: string | null;
  devolvido_por: string | null;
  obs: string | null;
  obs_em: string | null;
  obs_por: string | null;
  tecnicos: Tecnico[];
  produtos: { nome: string; quantidade: number }[];
  equipamentos: { tipo: string; patrimonio: string; numero_chip: string | null }[];
  /** Quantidades do card "📘 Book — Equipamentos" */
  book: { nome: string; quantidade: number }[];
};

const quando = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const SELO: Record<ReturnType<typeof situacaoEnvio>, { txt: string; cls: string }> = {
  pendente: { txt: "A enviar", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  parcial: { txt: "Enviado em parte", cls: "bg-blue-500/15 text-blue-300 border-blue-500/40" },
  enviado: { txt: "↩️ Aguardando devolução", cls: "bg-violet-500/15 text-violet-300 border-violet-500/40" },
  devolvido: { txt: "✅ Devolvido", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
};

function tituloDia(dia: Date, hoje: Date): string {
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  const diff = Math.round((dia.getTime() - h) / 86_400_000);
  const dd = `${String(dia.getDate()).padStart(2, "0")}/${String(dia.getMonth() + 1).padStart(2, "0")}`;
  const nome = diff === 0 ? "Hoje" : diff === 1 ? "Amanhã" : DIAS[dia.getDay()][0].toUpperCase() + DIAS[dia.getDay()].slice(1);
  return `${nome}, ${dd}`;
}

export default function ListaEnvios({ podeAbrirProva }: { podeAbrirProva: boolean }) {
  const [provas, setProvas] = useState<Prova[] | null>(null);
  const [erro, setErro] = useState("");
  const [soPendentes, setSoPendentes] = useState(true);
  const [busca, setBusca] = useState("");
  const [verConcluidas, setVerConcluidas] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/envios");
      const d = await r.json().catch(() => null);
      if (!r.ok) return setErro(d?.error || "Não foi possível carregar os envios.");
      setErro("");
      setProvas(d);
    } catch {
      setErro("Falha de conexão.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const hoje = useMemo(() => new Date(), []);
  const grupos = useMemo(
    () => agruparEnvios(provas ?? [], { hoje, soPendentes, busca }),
    [provas, soPendentes, busca, hoje]
  );

  const atualizar = (p: Prova) => setProvas((lista) => (lista ?? []).map((x) => (x.id === p.id ? p : x)));

  if (!provas && !erro) return <p className="text-slate-400 text-sm">Carregando…</p>;

  const vazio =
    grupos.atrasadas.length === 0 &&
    grupos.dias.length === 0 &&
    grupos.semData.length === 0 &&
    grupos.aguardandoDevolucao.length === 0;
  const card = (p: Prova) => <CardEnvio key={p.id} prova={p} podeAbrirProva={podeAbrirProva} onSalvo={atualizar} />;

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

      {vazio && !erro && (
        <p className="text-slate-400 text-sm">
          {soPendentes ? "Nenhum envio pendente. 🎉" : "Nenhuma prova na lista de envios."}
          {podeAbrirProva && " Para incluir, abra a prova e use o card 📦 Envio."}
        </p>
      )}

      {grupos.atrasadas.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-red-300 mb-2">⚠️ Atrasados (a data de envio já passou)</h2>
          <div className="space-y-3">{grupos.atrasadas.map(card)}</div>
        </section>
      )}

      {grupos.dias.map((g) => (
        <section key={g.chave}>
          <h2 className="text-sm font-semibold text-slate-300 mb-2">
            Enviar {tituloDia(g.dia, hoje)}{" "}
            <span className="text-slate-500 font-normal">· {g.provas.length} prova{g.provas.length === 1 ? "" : "s"}</span>
          </h2>
          <div className="space-y-3">{g.provas.map(card)}</div>
        </section>
      ))}

      {grupos.semData.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Sem data de envio</h2>
          <div className="space-y-3">{grupos.semData.map(card)}</div>
        </section>
      )}

      {grupos.aguardandoDevolucao.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-violet-300 mb-2">↩️ Aguardando devolução do material</h2>
          <div className="space-y-3">{grupos.aguardandoDevolucao.map(card)}</div>
        </section>
      )}

      {grupos.concluidas.length > 0 && (
        <section>
          <button onClick={() => setVerConcluidas((v) => !v)} className="text-sm text-slate-400 hover:text-white">
            {verConcluidas ? "▾" : "▸"} Concluídas — material devolvido ({grupos.concluidas.length})
          </button>
          {verConcluidas && <div className="space-y-3 mt-3">{grupos.concluidas.map(card)}</div>}
        </section>
      )}
    </div>
  );
}

function CardEnvio({ prova: p, podeAbrirProva, onSalvo }: { prova: Prova; podeAbrirProva: boolean; onSalvo: (p: Prova) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [obs, setObs] = useState(p.obs || "");
  const [obsSalva, setObsSalva] = useState(false);
  const selo = SELO[situacaoEnvio(p)];

  async function enviar(body: unknown) {
    setErro("");
    setOcupado(true);
    try {
      const r = await fetch(`/api/envios/${p.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.error || "Não foi possível salvar.");
        return false;
      }
      // a resposta é a linha de envio_status: só os campos dela mudam
      onSalvo({
        ...p,
        material_em: d.material_em,
        material_por: d.material_por,
        numeros_em: d.numeros_em,
        numeros_por: d.numeros_por,
        devolvido_em: d.devolvido_em,
        devolvido_por: d.devolvido_por,
        obs: d.obs,
        obs_em: d.obs_em,
        obs_por: d.obs_por,
      });
      return true;
    } catch {
      setErro("Falha de conexão.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  function alternar(etapa: EtapaEnvio, marcado: boolean) {
    const pergunta =
      etapa === "material"
        ? p.devolvido_em
          ? 'Desmarcar "Material enviado"? A devolução também será desmarcada.'
          : 'Desmarcar "Material enviado"?'
        : etapa === "numeros"
          ? 'Desmarcar "Números enviados"?'
          : 'Desmarcar "Material devolvido"?';
    if (!marcado && !confirm(pergunta)) return;
    enviar({ etapa, marcado });
  }

  async function salvarObs() {
    if (await enviar({ obs })) {
      setObsSalva(true);
      setTimeout(() => setObsSalva(false), 2000);
    }
  }

  const local = [p.cidade, p.uf].filter(Boolean).join("/");
  const produtos = p.produtos.filter((x) => x.quantidade > 0);
  const separado = materialSeparado(p);

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
            Prova: {p.data || "sem data"}
            {local && ` · ${local}`}
            {p.local_prova && ` · ${p.local_prova}`}
          </p>
          <p className="text-sm text-slate-300">
            📦 Envio: <strong>{p.data_envio ? rotuloDataEnvio(p.data_envio) : "sem data"}</strong>
          </p>
        </div>
        <span className={`self-start text-xs border rounded-full px-2.5 py-0.5 whitespace-nowrap ${selo.cls}`}>{selo.txt}</span>
      </div>

      {/* Para quem vai */}
      <div className="space-y-2">
        {p.tecnicos.length === 0 ? (
          <p className="text-sm text-amber-300">Nenhum técnico atribuído a esta prova ainda.</p>
        ) : (
          p.tecnicos.map((t) => {
            const mapa = linkMapa(t.endereco_entrega);
            const wa = linkWhatsApp(t.telefone, `Olá ${t.nome.split(/\s+/)[0]}! Sobre o material e os números da prova ${p.nome}:`);
            return (
              <div key={t.id} className="rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2">
                <p className="text-sm text-white">
                  👤 {t.nome}
                  {t.funcao && <span className="text-slate-400"> · {t.funcao}</span>}
                </p>
                {t.endereco_entrega ? (
                  <a href={mapa!} target="_blank" rel="noreferrer" className="block text-sm text-blue-300 hover:underline break-words">
                    📍 {t.endereco_entrega}
                  </a>
                ) : (
                  <p className="text-sm text-amber-300">📍 Sem endereço cadastrado{t.cidade ? ` (cidade: ${t.cidade})` : ""}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs">
                  {t.telefone && <span className="text-slate-400">{t.telefone}</span>}
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" className="bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded">
                      WhatsApp
                    </a>
                  )}
                  {mapa && (
                    <a href={mapa} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">
                      Abrir no mapa ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Material para entregar ao técnico (sempre aberto) */}
      <div className="rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">📦 Material para entregar ao técnico</p>
        {!separado && (
          <p className="text-xs text-amber-300">⚠️ Material ainda não separado no escritório.</p>
        )}
        {produtos.length > 0 && (
          <ul className="space-y-0.5">
            {produtos.map((x) => (
              <li key={x.nome} className="flex justify-between gap-3 text-slate-200">
                <span>{x.nome}</span>
                <span className="text-white font-medium">{x.quantidade}×</span>
              </li>
            ))}
          </ul>
        )}
        {p.equipamentos.length > 0 && (
          <div>
            <p className="text-[11px] uppercase text-slate-500 mb-0.5">Celulares / patrimônios ({p.equipamentos.length})</p>
            <ul className="flex flex-wrap gap-1.5">
              {p.equipamentos.map((e) => (
                <li key={`${e.tipo}-${e.patrimonio}`} className="text-xs rounded bg-slate-700 text-slate-200 px-2 py-0.5">
                  {e.tipo} {e.patrimonio}
                  {e.numero_chip ? ` · ${e.numero_chip}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        {p.book.length > 0 && (
          <div>
            <p className="text-[11px] uppercase text-slate-500 mb-0.5">Equipamentos (book da prova)</p>
            <ul className="space-y-0.5">
              {p.book.map((x) => (
                <li key={x.nome} className="flex justify-between gap-3 text-slate-200">
                  <span>{x.nome}</span>
                  <span className="text-white font-medium">{x.quantidade}×</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="flex justify-between gap-3 text-slate-200 border-t border-slate-700 pt-1.5">
          <span>🔢 Números de peito</span>
          <span className={p.numeros_em ? "text-emerald-300" : "text-slate-500"}>{p.numeros_em ? "enviados ✓" : "enviar junto"}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <BotaoEtapa
          rotulo="📦 Material enviado"
          em={p.material_em}
          por={p.material_por}
          ocupado={ocupado}
          onClick={() => alternar("material", !p.material_em)}
        />
        <BotaoEtapa
          rotulo="🔢 Números enviados"
          em={p.numeros_em}
          por={p.numeros_por}
          ocupado={ocupado}
          onClick={() => alternar("numeros", !p.numeros_em)}
        />
        {/* Devolução: só depois que o material foi enviado */}
        {p.material_em && (
          <div className="sm:col-span-2">
            <BotaoEtapa
              rotulo="↩️ Material devolvido"
              em={p.devolvido_em}
              por={p.devolvido_por}
              ocupado={ocupado}
              onClick={() => alternar("devolvido", !p.devolvido_em)}
            />
          </div>
        )}
      </div>

      <div>
        <label htmlFor={`obs-envio-${p.id}`} className="block text-xs text-slate-400 mb-1">
          Observação
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <textarea
            id={`obs-envio-${p.id}`}
            rows={2}
            maxLength={OBS_ENVIO_MAX}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Ex.: entregue na portaria, faltou 1 caixa de números"
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
