"use client";

import { useEffect } from "react";

/** Foto em tela cheia (toque fora ou Esc fecha). Usado também no portal do técnico. */
export default function FotoAmpliada({ kit, onFechar }: { kit: { nome: string; foto_url: string | null }; onFechar: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);
  return (
    <div
      role="dialog"
      aria-label={kit.nome}
      onClick={onFechar}
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={kit.foto_url!} alt={kit.nome} className="max-w-full max-h-[85vh] object-contain rounded" />
      <p className="text-white font-semibold mt-3 text-center">{kit.nome}</p>
      <p className="text-xs text-slate-400 mt-1">Toque para fechar</p>
    </div>
  );
}
