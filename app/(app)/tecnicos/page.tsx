"use client";

import { useEffect, useState } from "react";

type Tecnico = {
  id: number;
  nome: string;
  telefone: string | null;
  ativo: number;
  login: string | null;
  tem_senha?: number;
};

export default function TecnicosPage() {
  const [lista, setLista] = useState<Tecnico[]>([]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [editando, setEditando] = useState<Tecnico | null>(null);
  const [erro, setErro] = useState("");

  async function carregar() {
    // tela de gestão precisa ver inativos (pra reativar/editar)
    const r = await fetch("/api/tecnicos?incluirInativos=1");
    setLista(await r.json());
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) return;
    const body = { nome, telefone, login, ...(senha ? { senha } : {}), ativo: 1 };
    const r = editando
      ? await fetch(`/api/tecnicos/${editando.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/tecnicos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      setErro(data.error || "Erro ao salvar");
      return;
    }
    cancelar();
    carregar();
  }

  async function remover(id: number) {
    if (!confirm("Remover este técnico?")) return;
    await fetch(`/api/tecnicos/${id}`, { method: "DELETE" });
    carregar();
  }

  function editar(t: Tecnico) {
    setEditando(t);
    setNome(t.nome);
    setTelefone(t.telefone || "");
    setLogin(t.login || "");
    setSenha("");
    setErro("");
  }

  function cancelar() {
    setEditando(null);
    setNome("");
    setTelefone("");
    setLogin("");
    setSenha("");
    setErro("");
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Técnicos</h1>
      <p className="text-slate-400 text-sm mb-6">
        Cadastre os técnicos. Definindo <strong>login e senha</strong>, o técnico pode entrar no portal dele
        (pela tela de login) e confirmar o recebimento do material dos eventos atribuídos a ele.
      </p>

      <form onSubmit={salvar} className="bg-slate-800 rounded-xl p-4 mb-6 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="Nome do técnico"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Telefone (opcional)</label>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="(11) 99999-9999"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Login do portal (opcional)</label>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="off"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="ex: joao.silva"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Senha do portal
              {editando && editando.tem_senha ? <span className="text-green-400"> (já cadastrada)</span> : null}
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder={editando && editando.tem_senha ? "Deixe em branco para manter" : "Defina uma senha"}
            />
          </div>
        </div>

        {erro && <p className="text-red-400 text-sm">{erro}</p>}

        <div className="flex gap-3">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
            {editando ? "Atualizar" : "Adicionar"}
          </button>
          {editando && (
            <button type="button" onClick={cancelar} className="text-slate-400 px-3 py-2 hover:text-slate-200">
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="bg-slate-800 rounded-xl overflow-hidden">
        {lista.length === 0 ? (
          <p className="p-6 text-center text-slate-400">Nenhum técnico cadastrado</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 text-left text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Acesso ao portal</th>
                <th className="px-4 py-3 w-32">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((t) => (
                <tr key={t.id} className="border-t border-slate-700">
                  <td className="px-4 py-3 text-white">{t.nome}</td>
                  <td className="px-4 py-3 text-slate-300">{t.telefone || "-"}</td>
                  <td className="px-4 py-3">
                    {t.login && t.tem_senha ? (
                      <span className="text-green-400 text-sm">✓ {t.login}</span>
                    ) : t.login ? (
                      <span className="text-amber-400 text-sm">{t.login} (sem senha)</span>
                    ) : (
                      <span className="text-slate-500 text-sm">sem acesso</span>
                    )}
                  </td>
                  <td className="px-4 py-3 space-x-2 whitespace-nowrap">
                    <button onClick={() => editar(t)} className="text-blue-400 hover:text-blue-300 text-sm">
                      Editar
                    </button>
                    <button onClick={() => remover(t.id)} className="text-red-400 hover:text-red-300 text-sm">
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
