"use client";

import { useEffect, useState } from "react";
import InstalarApp, { useInstalacao } from "./InstalarApp";

/**
 * Para quem já tinha acessado antes da troca de nome/ícone: aviso com o botão "Atualizar agora".
 * Nenhum site troca o ícone da tela inicial sozinho — o botão faz o que dá:
 * - Chrome/Android que libera a instalação: abre a janela "Instalar Kits Gestão";
 * - Android sem essa janela (app antigo instalado): recarrega o app, o que faz o Chrome conferir
 *   o nome/ícone novos e trocar por conta própria;
 * - iPhone e demais: mostra o passo a passo (remover o antigo e adicionar de novo).
 * Senão mostra o conteúdo normal (children).
 */
export default function AvisoAtualizarApp({ children }: { children: React.ReactNode }) {
  const [aviso, setAviso] = useState(false);
  const [passos, setPassos] = useState(false);
  const [msg, setMsg] = useState("");
  const { plat, podeInstalar, instalar } = useInstalacao();

  useEffect(() => {
    fetch("/api/portal/conta")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAviso(!!d?.avisoApp))
      .catch(() => {});
  }, []);

  async function marcarVisto() {
    await fetch("/api/portal/conta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "aviso_app_visto" }),
    }).catch(() => {});
  }

  async function atualizar() {
    if (podeInstalar) {
      if (await instalar()) {
        await marcarVisto();
        setMsg("✓ Pronto! Abra pelo ícone novo Kits Gestão e apague o antigo, se ainda estiver na tela.");
        setTimeout(() => setAviso(false), 4000);
      }
      return;
    }
    if (plat === "android") {
      setMsg("Atualizando… o Chrome troca o nome e o ícone sozinho (pode pedir para confirmar).");
      await marcarVisto();
      window.location.replace("/abrir");
      return;
    }
    setPassos(true);
  }

  async function feito() {
    setAviso(false);
    await marcarVisto();
  }

  if (!aviso) return <>{children}</>;

  return (
    <div role="alert" className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 space-y-3">
      <div>
        <p className="font-semibold text-white">🔄 O app mudou: agora se chama Kits Gestão</p>
        <p className="text-sm text-slate-200 mt-1">Tem ícone novo (azul, escrito KITS). Toque para atualizar:</p>
      </div>

      {!passos && (
        <button
          onClick={atualizar}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg"
        >
          🔄 Atualizar agora
        </button>
      )}
      {msg && <p className="text-sm text-green-300">{msg}</p>}

      {passos && (
        <>
          <p className="text-sm text-slate-200">
            Neste celular a troca é manual: <strong>apague o ícone antigo</strong> (segure o dedo nele → Remover) e
            instale de novo:
          </p>
          <InstalarApp forcar />
        </>
      )}

      <button onClick={feito} className="w-full text-slate-300 hover:text-white text-sm py-2">
        ✓ Já atualizei / não tinha instalado
      </button>
    </div>
  );
}
