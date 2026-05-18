"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    setCarregando(false);
    if (!res.ok) {
      setErro(data.error || "Erro ao entrar");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <form onSubmit={entrar} className="bg-slate-800 p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-2">ChronoMax Kits</h1>
        <p className="text-slate-400 text-sm mb-6">Gestão de entregas</p>

        <label className="block text-sm text-slate-300 mb-1">Usuário</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white mb-4 focus:outline-none focus:border-blue-500"
          autoFocus
        />

        <label className="block text-sm text-slate-300 mb-1">Senha</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white mb-4 focus:outline-none focus:border-blue-500"
        />

        {erro && <p className="text-red-400 text-sm mb-3">{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium py-2 rounded-lg transition"
        >
          {carregando ? "Entrando..." : "Entrar"}
        </button>

        <p className="text-xs text-slate-500 mt-6 text-center">
          Usuários iniciais: <strong>admin</strong> e <strong>lider</strong> — senha: <strong>chronomax</strong>
        </p>
      </form>
    </div>
  );
}
