"use client";

import { useState } from "react";
import InstalarApp from "../../(portal)/InstalarApp";
import type { PublicoApp } from "@/lib/instalar-app";

/**
 * Perfis Só Telão / Só Envios: card "Instale o app" no topo (some quando já é o app
 * instalado ou depois de "não mostrar mais") e, no fim da aba, o link para rever o passo a passo.
 */
export function CardInstalarTelao() {
  return <InstalarApp publico="telao" />;
}

export function ComoInstalarApp({ publico }: { publico: PublicoApp }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="mt-6">
      <button onClick={() => setAberto((v) => !v)} className="text-sm text-blue-400 hover:text-blue-300">
        📲 Como instalar o app {aberto ? "▾" : "▸"}
      </button>
      {aberto && (
        <div className="mt-3">
          <InstalarApp publico={publico} forcar />
        </div>
      )}
    </div>
  );
}

export function ComoInstalarTelao() {
  return <ComoInstalarApp publico="telao" />;
}
