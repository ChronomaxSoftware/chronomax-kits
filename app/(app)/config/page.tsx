"use client";

import { useEffect, useState } from "react";

export default function ConfigPage() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaDefinida, setSenhaDefinida] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [semanas, setSemanas] = useState(100);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setUsuario(d.gestao_usuario || "");
        setSenhaDefinida(d.gestao_senha_definida);
        setBaseUrl(d.gestao_base_url || "");
        setSemanas(d.gestao_semanas_a_buscar || 8);
      });
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setSalvo(false);
    const body: Record<string, unknown> = {
      gestao_usuario: usuario,
      gestao_base_url: baseUrl,
      gestao_semanas_a_buscar: semanas,
    };
    if (senha) body.gestao_senha = senha;
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSalvando(false);
    setSalvo(true);
    setSenha("");
    if (senha) setSenhaDefinida(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Configurações</h1>
      <p className="text-slate-400 text-sm mb-6">
        Credenciais do Gestão usadas para sincronização automática. A senha é salva criptografada no banco local.
      </p>

      <form onSubmit={salvar} className="bg-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">URL do Gestão</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
            placeholder="https://gestao.chronomax.com.br"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Usuário do Gestão (e-mail)</label>
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
            placeholder="seu@email.com"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Senha do Gestão {senhaDefinida && <span className="text-green-400">(✓ já cadastrada)</span>}
          </label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
            placeholder={senhaDefinida ? "Deixe em branco para manter a atual" : "Senha"}
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Quantas semanas buscar (a partir de hoje)</label>
          <input
            type="number"
            min={1}
            max={20}
            value={semanas}
            onChange={(e) => setSemanas(parseInt(e.target.value) || 8)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            disabled={salvando}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
          {salvo && <span className="text-green-400 text-sm">✓ Salvo</span>}
        </div>
      </form>
    </div>
  );
}
