"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PlayerVideo from "@/components/treinamento/PlayerVideo";
import { Aviso } from "@/components/equipamentos/ui";
import { CATEGORIA_MAX, DESCRICAO_MAX, TITULO_MAX, SEM_CATEGORIA, playerDoLink, type VideoTreinamento } from "@/lib/treinamento";

type Assistido = { tecnico_id: number; nome: string; assistido_em: string };
type VideoAdmin = VideoTreinamento & { assistidos: Assistido[] };
type Form = { titulo: string; descricao: string; categoria: string; url: string };

const VAZIO: Form = { titulo: "", descricao: "", categoria: "", url: "" };

/** "2026-11-05 14:30:00" (UTC do SQLite) → "05/11/2026 11:30" no horário local */
function dataHora(s: string): string {
  const d = new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function FormVideo({
  inicial,
  categorias,
  salvando,
  onSalvar,
  onCancelar,
  rotulo,
}: {
  inicial: Form;
  categorias: string[];
  salvando: boolean;
  onSalvar: (f: Form) => void;
  onCancelar?: () => void;
  rotulo: string;
}) {
  const [f, setF] = useState<Form>(inicial);
  const linkOk = !!playerDoLink(f.url);
  const campo = "w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-blue-500";
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSalvar(f);
      }}
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-slate-300">Título *</span>
          <input className={campo} value={f.titulo} maxLength={TITULO_MAX} onChange={(e) => setF({ ...f, titulo: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="text-slate-300">Categoria</span>
          <input
            className={campo}
            value={f.categoria}
            maxLength={CATEGORIA_MAX}
            list="categorias-treinamento"
            placeholder={`ex.: Entrega de kit (vazio = ${SEM_CATEGORIA})`}
            onChange={(e) => setF({ ...f, categoria: e.target.value })}
          />
          <datalist id="categorias-treinamento">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-slate-300">Link do vídeo (YouTube ou Google Drive) *</span>
        <input
          className={campo}
          value={f.url}
          placeholder="https://youtu.be/… ou https://drive.google.com/file/d/…"
          onChange={(e) => setF({ ...f, url: e.target.value })}
        />
        {f.url.trim() && !linkOk && (
          <span className="text-xs text-red-300">Link não reconhecido — use um link de vídeo do YouTube ou do Google Drive.</span>
        )}
      </label>
      <label className="block text-sm">
        <span className="text-slate-300">Descrição</span>
        <textarea
          className={`${campo} min-h-20`}
          value={f.descricao}
          maxLength={DESCRICAO_MAX}
          placeholder="O que o técnico vai aprender neste vídeo"
          onChange={(e) => setF({ ...f, descricao: e.target.value })}
        />
      </label>
      {linkOk && (
        <div className="max-w-md">
          <p className="text-xs text-slate-400 mb-1">Prévia</p>
          <PlayerVideo url={f.url} titulo={f.titulo || "Prévia"} />
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={salvando || !f.titulo.trim() || !linkOk}
          className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm font-medium"
        >
          {salvando ? "Salvando…" : rotulo}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

export default function GerenciarTreinamento() {
  const [dados, setDados] = useState<{ totalTecnicos: number; videos: VideoAdmin[] } | null>(null);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [novoKey, setNovoKey] = useState(0);
  const [editando, setEditando] = useState<number | null>(null);
  const [vendoQuem, setVendoQuem] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/treinamento");
      if (!r.ok) throw new Error();
      setDados(await r.json());
    } catch {
      setErro("Não foi possível carregar os vídeos. Recarregue a página.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const categorias = useMemo(
    () => [...new Set((dados?.videos ?? []).map((v) => (v.categoria || "").trim()).filter(Boolean))].sort(),
    [dados]
  );

  async function enviar(url: string, method: string, body?: unknown): Promise<boolean> {
    setErro("");
    setOk("");
    setSalvando(true);
    try {
      const r = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(j.error || "Não foi possível salvar.");
        return false;
      }
      await carregar();
      return true;
    } catch {
      setErro("Falha de conexão. Tente de novo.");
      return false;
    } finally {
      setSalvando(false);
    }
  }

  if (!dados && !erro) return <p className="text-slate-400">Carregando…</p>;
  const videos = dados?.videos ?? [];
  const total = dados?.totalTecnicos ?? 0;

  return (
    <div className="space-y-5">
      {erro && <Aviso tipo="erro" texto={erro} onFechar={() => setErro("")} />}
      {ok && <Aviso tipo="ok" texto={ok} onFechar={() => setOk("")} />}

      <section className="bg-slate-800 rounded-xl p-4">
        <h2 className="font-semibold mb-3">➕ Adicionar vídeo</h2>
        <FormVideo
          key={novoKey}
          inicial={VAZIO}
          categorias={categorias}
          salvando={salvando}
          rotulo="Adicionar vídeo"
          onSalvar={async (f) => {
            if (await enviar("/api/treinamento", "POST", f)) {
              setNovoKey((k) => k + 1);
              setOk("Vídeo adicionado — já aparece no portal dos técnicos.");
            }
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">
          Vídeos ({videos.length}){" "}
          <span className="text-xs font-normal text-slate-400">· {total} técnico(s) com acesso ao portal</span>
        </h2>
        {videos.length === 0 && (
          <div className="bg-slate-800 rounded-xl p-6 text-sm text-slate-400">Nenhum vídeo ainda. Adicione o primeiro acima.</div>
        )}
        {videos.map((v, i) => (
          <article key={v.id} className="bg-slate-800 rounded-xl p-4">
            {editando === v.id ? (
              <FormVideo
                inicial={{ titulo: v.titulo, descricao: v.descricao ?? "", categoria: v.categoria ?? "", url: v.url }}
                categorias={categorias}
                salvando={salvando}
                rotulo="Salvar alterações"
                onCancelar={() => setEditando(null)}
                onSalvar={async (f) => {
                  if (await enviar(`/api/treinamento/${v.id}`, "PUT", f)) {
                    setEditando(null);
                    setOk("Vídeo atualizado.");
                  }
                }}
              />
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="sm:w-64 shrink-0">
                  <PlayerVideo url={v.url} titulo={v.titulo} />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <span className="text-xs rounded-full bg-slate-700 px-2 py-0.5 text-slate-300">
                      {v.categoria || SEM_CATEGORIA}
                    </span>
                    <h3 className="font-semibold mt-1 break-words">{v.titulo}</h3>
                    {v.descricao && <p className="text-sm text-slate-400 whitespace-pre-line break-words">{v.descricao}</p>}
                  </div>
                  <button
                    onClick={() => setVendoQuem(vendoQuem === v.id ? null : v.id)}
                    className="text-sm text-sky-300 hover:underline"
                  >
                    👁️ {v.assistidos.length} de {total} assistiram {vendoQuem === v.id ? "▲" : "▼"}
                  </button>
                  {vendoQuem === v.id && (
                    <ul className="text-sm text-slate-300 bg-slate-900 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                      {v.assistidos.length === 0 && <li className="text-slate-500">Ninguém marcou ainda.</li>}
                      {v.assistidos.map((a) => (
                        <li key={a.tecnico_id} className="flex justify-between gap-3">
                          <span className="truncate">✓ {a.nome}</span>
                          <span className="text-slate-500 text-xs whitespace-nowrap">{dataHora(a.assistido_em)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      disabled={salvando || i === 0}
                      onClick={() => enviar(`/api/treinamento/${v.id}`, "PUT", { mover: "cima" })}
                      className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 px-3 py-1 text-sm"
                      aria-label="Subir"
                    >
                      ↑
                    </button>
                    <button
                      disabled={salvando || i === videos.length - 1}
                      onClick={() => enviar(`/api/treinamento/${v.id}`, "PUT", { mover: "baixo" })}
                      className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 px-3 py-1 text-sm"
                      aria-label="Descer"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => setEditando(v.id)}
                      className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1 text-sm"
                    >
                      ✏️ Editar
                    </button>
                    <ExcluirVideo
                      onExcluir={async () => {
                        if (await enviar(`/api/treinamento/${v.id}`, "DELETE")) setOk("Vídeo removido.");
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

/** Excluir em dois cliques (sem confirm() do navegador). */
function ExcluirVideo({ onExcluir }: { onExcluir: () => void }) {
  const [certeza, setCerteza] = useState(false);
  if (!certeza) {
    return (
      <button onClick={() => setCerteza(true)} className="rounded-lg bg-slate-700 hover:bg-red-700 px-3 py-1 text-sm">
        🗑️ Remover
      </button>
    );
  }
  return (
    <span className="flex gap-2">
      <button onClick={onExcluir} className="rounded-lg bg-red-600 hover:bg-red-500 px-3 py-1 text-sm">
        Remover mesmo
      </button>
      <button onClick={() => setCerteza(false)} className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1 text-sm">
        Não
      </button>
    </span>
  );
}
