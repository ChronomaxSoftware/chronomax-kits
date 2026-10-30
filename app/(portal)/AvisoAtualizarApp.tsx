"use client";

import { useEffect, useState } from "react";
import InstalarApp from "./InstalarApp";

/**
 * Para quem já tinha acessado antes da troca de nome/ícone: aviso para apagar o ícone antigo
 * e instalar de novo, até tocar em "Já atualizei". Senão mostra o conteúdo normal (children).
 */
export default function AvisoAtualizarApp({ children }: { children: React.ReactNode }) {
  const [aviso, setAviso] = useState(false);

  useEffect(() => {
    fetch("/api/portal/conta")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAviso(!!d?.avisoApp))
      .catch(() => {});
  }, []);

  async function feito() {
    setAviso(false);
    await fetch("/api/portal/conta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "aviso_app_visto" }),
    }).catch(() => {});
  }

  if (!aviso) return <>{children}</>;

  return (
    <div role="alert" className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 space-y-3">
      <div>
        <p className="font-semibold text-white">🔄 O app mudou: agora se chama Kits Gestão</p>
        <p className="text-sm text-slate-200 mt-1">
          Tem ícone novo (azul, escrito KITS). Se você já tinha instalado, <strong>apague o ícone antigo</strong> da tela
          inicial (segure o dedo nele → Remover) e instale de novo:
        </p>
      </div>
      <InstalarApp forcar />
      <button onClick={feito} className="w-full bg-slate-700 hover:bg-slate-600 text-white text-sm py-2.5 rounded-lg">
        ✓ Já atualizei / não tinha instalado
      </button>
    </div>
  );
}
