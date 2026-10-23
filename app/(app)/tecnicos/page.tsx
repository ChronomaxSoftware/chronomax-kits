"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BotaoConviteTecnico from "@/components/BotaoConviteTecnico";
import { normalizarNome } from "@/lib/tecnico-match";

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
  const [busca, setBusca] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const senhaRef = useRef<HTMLInputElement>(null);

  // Busca por nome (sem acento) ou por dígitos do telefone — filtra a tabela e alimenta as sugestões
  const filtrados = useMemo(() => {
    const q = normalizarNome(busca);
    const dig = busca.replace(/\D/g, "");
    if (!q) return lista;
    return lista.filter(
      (t) => normalizarNome(t.nome).includes(q) || (dig.length >= 3 && (t.telefone || "").replace(/\D/g, "").includes(dig))
    );
  }, [lista, busca]);

  function selecionar(t: Tecnico) {
    editar(t);
    setBusca("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => senhaRef.current?.focus(), 50);
  }

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
    if (senha && senha.length < 8) {
      setErro("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    const body ={ nome, telefone, login, ...(senha ? { senha } : {}), ativo: 1 };
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
        Cadastre os técnicos. Definindo uma <strong>senha</strong>, o técnico entra no portal usando o{" "}
        <strong>telefone</strong> como login (ou um login manual, se você informar) e confirma o recebimento do
        material dos eventos atribuídos a ele.
      </p>

      <div className="relative mb-4">
        <label htmlFor="busca-tecnico" className="block text-xs text-slate-400 mb-1">
          🔍 Buscar técnico para definir a senha
        </label>
        <input
          id="busca-tecnico"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          autoComplete="off"
          placeholder="Nome ou telefone"
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
        />
        {busca.trim() && (
          <ul className="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
            {filtrados.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">Nenhum técnico encontrado</li>
            ) : (
              filtrados.slice(0, 10).map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => selecionar(t)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-700"
                  >
                    <span className="min-w-0">
                      <span className={t.ativo ? "text-white" : "text-slate-500"}>{t.nome}</span>
                      <span className="block text-xs text-slate-400">{t.telefone || "sem telefone"}</span>
                    </span>
                    <span className={`text-xs shrink-0 ${t.tem_senha ? "text-green-400" : "text-slate-500"}`}>
                      {t.tem_senha ? "✓ tem acesso" : "sem acesso"}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <form ref={formRef} onSubmit={salvar} className="bg-slate-800 rounded-xl p-4 mb-6 space-y-3 scroll-mt-4">
        {editando && (
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 rounded-lg bg-blue-500/10 border border-blue-500/30 px-3 py-2">
            <p className="text-sm text-blue-200">
              Editando <strong>{editando.nome}</strong> — digite a senha e clique em Atualizar, ou mande o link.
            </p>
            {editando.ativo ? <BotaoConviteTecnico tecnico={editando} /> : null}
          </div>
        )}
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
            <label className="block text-xs text-slate-400 mb-1">Login do portal (em branco = telefone)</label>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="off"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="Automático pelo telefone"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Senha do portal
              {editando && editando.tem_senha ? <span className="text-green-400"> (já cadastrada)</span> : null}
            </label>
            <input
              ref={senhaRef}
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder={editando && editando.tem_senha ? "Deixe em branco para manter" : "Mínimo de 8 caracteres"}
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
              {filtrados.map((t) => (
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
                    {t.ativo ? (
                      <div className="mt-1">
                        <BotaoConviteTecnico tecnico={t} />
                      </div>
                    ) : null}
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
