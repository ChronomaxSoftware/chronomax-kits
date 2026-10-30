"use client";

import { useEffect, useState } from "react";

/** Reenvia o aviso "O app mudou: Kits Gestão" do portal para os técnicos que já acessaram. */
export default function ReenviarAvisoApp() {
  const [info, setInfo] = useState<{ reenviado_em: string | null; pendentes: number } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch("/api/aviso-app")
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => {});
  }, []);

  async function reenviar() {
    if (!confirm("Reenviar o aviso do app? Ele volta a aparecer no portal para todos os técnicos que já acessaram, inclusive quem já confirmou.")) return;
    setEnviando(true);
    setErro("");
    try {
      const r = await fetch("/api/aviso-app", { method: "POST" });
      if (r.ok) setInfo(await r.json());
      else setErro("Não foi possível reenviar. Tente de novo.");
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="bg-slate-800 rounded-xl p-4 sm:p-6 mt-6">
      <h2 className="font-semibold text-white">📲 Aviso do app para os técnicos</h2>
      <p className="text-sm text-slate-400 mt-1">
        O aviso &quot;🔄 O app mudou: agora se chama Kits Gestão&quot;, com o botão Atualizar agora, aparece no topo do portal
        até o técnico tocar em &quot;Já atualizei&quot;.
      </p>
      {info && (
        <p className="text-sm text-slate-200 mt-3">
          <strong className="text-white">{info.pendentes}</strong> técnico{info.pendentes === 1 ? "" : "s"} ainda vai
          {info.pendentes === 1 ? "" : "o"} ver o aviso
          {info.reenviado_em && (
            <span className="text-slate-400">
              {" "}· último reenvio em{" "}
              {new Date(info.reenviado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            </span>
          )}
        </p>
      )}
      <button
        onClick={reenviar}
        disabled={enviando}
        className="mt-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg"
      >
        {enviando ? "Reenviando..." : "Reenviar aviso do app para os técnicos"}
      </button>
      {erro && <p className="mt-2 text-sm text-red-400">{erro}</p>}
    </section>
  );
}
