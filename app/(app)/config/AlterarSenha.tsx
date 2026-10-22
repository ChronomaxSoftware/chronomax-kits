"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AlterarSenha() {
  const router = useRouter();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setOk(false);
    if (nova !== confirma) {
      setErro("A confirmação não confere com a nova senha.");
      return;
    }
    setSalvando(true);
    try {
      const r = await fetch("/api/auth/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaAtual: atual, novaSenha: nova }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.error || "Não foi possível trocar a senha.");
        return;
      }
      setOk(true);
      setAtual("");
      setNova("");
      setConfirma("");
      router.refresh(); // some o aviso de senha inicial
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setSalvando(false);
    }
  }

  const campo = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white";

  return (
    <form id="minha-senha" onSubmit={salvar} className="bg-slate-800 rounded-xl p-6 space-y-4 mt-6 scroll-mt-6">
      <div>
        <h2 className="font-semibold">Minha senha</h2>
        <p className="text-xs text-slate-400 mt-1">Senha de acesso a este sistema (mínimo de 10 caracteres).</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="senha-atual" className="block text-xs text-slate-400 mb-1">Senha atual</label>
          <input id="senha-atual" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} className={campo} required />
        </div>
        <div>
          <label htmlFor="senha-nova" className="block text-xs text-slate-400 mb-1">Nova senha</label>
          <input id="senha-nova" type="password" autoComplete="new-password" minLength={10} value={nova} onChange={(e) => setNova(e.target.value)} className={campo} required />
        </div>
        <div>
          <label htmlFor="senha-confirma" className="block text-xs text-slate-400 mb-1">Confirmar nova senha</label>
          <input id="senha-confirma" type="password" autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} className={campo} required />
        </div>
      </div>
      {erro && <p className="text-red-400 text-sm">{erro}</p>}
      <div className="flex items-center gap-3">
        <button disabled={salvando} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg">
          {salvando ? "Salvando..." : "Trocar senha"}
        </button>
        {ok && <span className="text-green-400 text-sm">✓ Senha alterada</span>}
      </div>
    </form>
  );
}
