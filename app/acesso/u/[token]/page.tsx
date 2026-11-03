"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { destinoDoRole } from "@/lib/perfil-usuario";

/** Link de senha do usuário do escritório: uso único, vale 24h. Cria a senha nova e já entra. */
export default function AcessoUsuarioPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [info, setInfo] = useState<{ nome: string; username: string } | null>(null);
  const [invalido, setInvalido] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch(`/api/auth/convite-usuario?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (r.ok) setInfo(d);
        else setInvalido(d.error || "Link inválido.");
      })
      .catch(() => setInvalido("Sem conexão. Tente abrir o link de novo."));
  }, [token]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (senha.length < 10) return setErro("A senha deve ter pelo menos 10 caracteres.");
    if (senha !== senha2) return setErro("As duas senhas não são iguais.");
    setEnviando(true);
    try {
      const r = await fetch("/api/auth/convite-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, senha }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 410) setInvalido(d.error);
        else setErro(d.error || "Não foi possível salvar a senha.");
        return;
      }
      router.push(destinoDoRole(d.role));
      router.refresh();
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const caixa = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white mb-4 focus:outline-none focus:border-blue-500";

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-1">ChronoMax Kits</h1>
        <p className="text-slate-400 text-sm mb-6">Criar senha de acesso</p>

        {invalido ? (
          <>
            <p className="text-amber-300 text-sm mb-4">{invalido}</p>
            <a href="/login" className="block text-center w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg">
              Ir para o login
            </a>
          </>
        ) : !info ? (
          <p className="text-slate-400 text-sm">Carregando…</p>
        ) : (
          <form onSubmit={criar}>
            <p className="text-white mb-1">Olá, {info.nome.split(" ")[0]}!</p>
            <p className="text-slate-400 text-sm mb-5">
              Crie a sua senha. Depois, para entrar, use o login <strong className="text-slate-200">{info.username}</strong> e
              essa senha.
            </p>
            <label htmlFor="login" className="block text-sm text-slate-300 mb-1">
              Login
            </label>
            <input id="login" value={info.username} readOnly autoComplete="username" className={`${caixa} text-slate-400`} />
            <label htmlFor="senha" className="block text-sm text-slate-300 mb-1">
              Nova senha (mínimo 10 caracteres)
            </label>
            <input id="senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={caixa} autoFocus />
            <label htmlFor="senha2" className="block text-sm text-slate-300 mb-1">
              Repita a senha
            </label>
            <input id="senha2" type="password" autoComplete="new-password" value={senha2} onChange={(e) => setSenha2(e.target.value)} className={caixa} />
            {erro && <p className="text-red-400 text-sm mb-3">{erro}</p>}
            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-medium py-2.5 rounded-lg"
            >
              {enviando ? "Salvando…" : "Criar senha e entrar"}
            </button>
            <p className="text-xs text-slate-500 mt-4">Este link vale por 24 horas e funciona uma vez só.</p>
          </form>
        )}
      </div>
    </div>
  );
}
