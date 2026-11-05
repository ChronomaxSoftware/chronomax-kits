"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import PlayerVideo from "@/components/treinamento/PlayerVideo";
import { agruparPorCategoria, type VideoTreinamento } from "@/lib/treinamento";

type VideoPortal = VideoTreinamento & { assistido_em: string | null };

/** Aba Treinamento do técnico: vídeos por categoria + "marquei como assistido". */
export default function PortalTreinamentoPage() {
  const [videos, setVideos] = useState<VideoPortal[] | null>(null);
  const [erro, setErro] = useState("");
  const [marcando, setMarcando] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/portal/treinamento");
      if (!r.ok) throw new Error();
      setVideos(await r.json());
    } catch {
      setErro("Não foi possível carregar os vídeos. Recarregue a página.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const grupos = useMemo(() => agruparPorCategoria(videos ?? []), [videos]);

  async function marcar(v: VideoPortal) {
    const assistido = !v.assistido_em;
    setMarcando(v.id);
    setErro("");
    try {
      const r = await fetch("/api/portal/treinamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: v.id, assistido }),
      });
      if (!r.ok) throw new Error();
      setVideos((lista) =>
        (lista ?? []).map((x) => (x.id === v.id ? { ...x, assistido_em: assistido ? new Date().toISOString() : null } : x))
      );
    } catch {
      setErro("Não foi possível salvar. Tente de novo.");
    } finally {
      setMarcando(null);
    }
  }

  if (videos === null && !erro) return <p className="text-slate-400">Carregando…</p>;
  const total = videos?.length ?? 0;
  const vistos = (videos ?? []).filter((v) => v.assistido_em).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">🎓 Treinamento</h1>
        {total > 0 && (
          <div className="mt-2">
            <p className="text-sm text-slate-300">
              {vistos === total ? "✓ Você assistiu todos os vídeos!" : `${vistos} de ${total} vídeo(s) assistido(s)`}
            </p>
            <div className="mt-1 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(vistos / total) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {erro && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 px-3 py-2 text-sm">
          {erro}
        </div>
      )}

      {total === 0 && !erro && (
        <div className="bg-slate-800 rounded-xl p-6 text-sm text-slate-400">Nenhum vídeo de treinamento por enquanto.</div>
      )}

      {grupos.map((g) => (
        <section key={g.categoria} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{g.categoria}</h2>
          {g.videos.map((v) => (
            <article
              key={v.id}
              className={`bg-slate-800 rounded-xl p-3 sm:p-4 space-y-3 border ${
                v.assistido_em ? "border-emerald-500/30" : "border-transparent"
              }`}
            >
              <PlayerVideo url={v.url} titulo={v.titulo} />
              <div>
                <h3 className="font-semibold break-words">{v.titulo}</h3>
                {v.descricao && <p className="text-sm text-slate-400 whitespace-pre-line break-words mt-1">{v.descricao}</p>}
              </div>
              <button
                onClick={() => marcar(v)}
                disabled={marcando === v.id}
                className={`w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                  v.assistido_em
                    ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30"
                    : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {v.assistido_em ? "✓ Assistido (toque para desmarcar)" : "Marquei como assistido"}
              </button>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
