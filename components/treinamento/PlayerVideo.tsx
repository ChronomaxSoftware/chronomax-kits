"use client";

import { playerDoLink } from "@/lib/treinamento";

/** Player embutido (16:9) do YouTube/Drive; link inválido mostra aviso. */
export default function PlayerVideo({ url, titulo }: { url: string; titulo: string }) {
  const p = playerDoLink(url);
  if (!p) {
    return (
      <div className="aspect-video w-full rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-sm text-slate-400 p-4 text-center">
        Link inválido — use um link do YouTube ou do Google Drive.
      </div>
    );
  }
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
      <iframe
        src={p.embed}
        title={titulo}
        className="h-full w-full"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
