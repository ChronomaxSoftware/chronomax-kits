"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TutorialPortal from "./TutorialPortal";

export default function PortalHeader({ name }: { name: string }) {
  const router = useRouter();
  const [tutorial, setTutorial] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(false);

  // Primeiro acesso: abre o tutorial sozinho
  useEffect(() => {
    fetch("/api/portal/conta")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && !d.tutorialVisto && setTutorial(true))
      .catch(() => {});
  }, []);

  function fecharTutorial() {
    setTutorial(false);
    fetch("/api/portal/conta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "tutorial_visto" }),
    }).catch(() => {});
  }

  async function sair() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
        <div className="leading-tight min-w-0">
          <p className="text-base font-bold text-white">ChronoMax · Técnico</p>
          <p className="text-xs text-slate-400 truncate">{name}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-sm">
          <button onClick={() => setTutorial(true)} className="text-slate-300 hover:text-white">
            Como usar
          </button>
          <button onClick={() => setTrocandoSenha(true)} className="text-slate-300 hover:text-white">
            Minha senha
          </button>
          <button onClick={sair} className="text-red-400 hover:text-red-300">
            Sair
          </button>
        </div>
      </header>
      {tutorial && <TutorialPortal onFechar={fecharTutorial} />}
      {trocandoSenha && <MinhaSenha onFechar={() => setTrocandoSenha(false)} />}
    </>
  );
}

function MinhaSenha({ onFechar }: { onFechar: () => void }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [nova2, setNova2] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (nova.length < 8) return setErro("A nova senha deve ter pelo menos 8 caracteres.");
    if (nova !== nova2) return setErro("As duas senhas novas não são iguais.");
    setEnviando(true);
    try {
      const r = await fetch("/api/portal/conta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "senha", senhaAtual: atual, novaSenha: nova }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setOk(true);
      else setErro(d.error || "Não foi possível trocar a senha.");
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const caixa = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white mb-3";
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onFechar}>
      <div role="dialog" aria-label="Minha senha" className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">Minha senha</h2>
        {ok ? (
          <>
            <p className="text-green-400 text-sm mb-4">✓ Senha alterada. Use a nova senha no próximo acesso.</p>
            <button onClick={onFechar} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg">
              Fechar
            </button>
          </>
        ) : (
          <form onSubmit={salvar}>
            <label htmlFor="s-atual" className="block text-sm text-slate-300 mb-1">Senha atual</label>
            <input id="s-atual" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} className={caixa} autoFocus />
            <label htmlFor="s-nova" className="block text-sm text-slate-300 mb-1">Nova senha (mínimo 8)</label>
            <input id="s-nova" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} className={caixa} />
            <label htmlFor="s-nova2" className="block text-sm text-slate-300 mb-1">Repita a nova senha</label>
            <input id="s-nova2" type="password" autoComplete="new-password" value={nova2} onChange={(e) => setNova2(e.target.value)} className={caixa} />
            {erro && <p className="text-red-400 text-sm mb-3">{erro}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onFechar} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm">
                Cancelar
              </button>
              <button disabled={enviando || !atual} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm">
                {enviando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
