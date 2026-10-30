"use client";

import { useEffect, useState } from "react";
import { passosInstalar, plataforma, type Plataforma } from "@/lib/instalar-app";

/** Evento do Chrome/Android que permite instalar com 1 toque. */
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const OCULTO = "chronomax_instalar_oculto";

/**
 * Card "Instale o app no celular": botão de 1 toque no Android (quando o Chrome deixa)
 * ou o passo a passo (iPhone/Safari e demais). Some quando já está aberto como app.
 */
export default function InstalarApp({ forcar = false }: { forcar?: boolean }) {
  const [plat, setPlat] = useState<Plataforma | null>(null);
  const [instalado, setInstalado] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [evento, setEvento] = useState<EventoInstalar | null>(null);

  useEffect(() => {
    setPlat(plataforma(navigator.userAgent));
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalado(standalone);
    try {
      setOculto(localStorage.getItem(OCULTO) === "1");
    } catch {
      // sem armazenamento: mostra normalmente
    }
    const antes = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    const depois = () => setInstalado(true);
    window.addEventListener("beforeinstallprompt", antes);
    window.addEventListener("appinstalled", depois);
    return () => {
      window.removeEventListener("beforeinstallprompt", antes);
      window.removeEventListener("appinstalled", depois);
    };
  }, []);

  if (!plat || instalado || (oculto && !forcar)) return null;

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === "accepted") setInstalado(true);
    setEvento(null);
  }

  function esconder() {
    setOculto(true);
    try {
      localStorage.setItem(OCULTO, "1");
    } catch {
      // ignora
    }
  }

  return (
    <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-4">
      <p className="font-semibold text-white">📲 Instale o app no celular</p>
      <p className="text-xs text-slate-300 mt-1">
        Fica um ícone Chronomax na tela inicial: abre direto nas suas provas, sem precisar do link.
      </p>

      {evento ? (
        <button
          onClick={instalar}
          className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg"
        >
          Instalar app
        </button>
      ) : (
        <ol className="mt-3 space-y-1.5 text-sm text-slate-200 list-decimal list-inside">
          {passosInstalar(plat).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      )}

      {!forcar && (
        <button onClick={esconder} className="mt-3 text-xs text-slate-400 hover:text-slate-200 underline">
          Já instalei / não mostrar mais
        </button>
      )}
    </div>
  );
}
