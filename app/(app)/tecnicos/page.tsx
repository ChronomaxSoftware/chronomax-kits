"use client";

import { useEffect, useState } from "react";

type Tecnico = { id: number; nome: string; telefone: string | null; ativo: number };

export default function TecnicosPage() {
  const [lista, setLista] = useState<Tecnico[]>([]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [editando, setEditando] = useState<Tecnico | null>(null);

  async function carregar() {
    const r = await fetch("/api/tecnicos");
    setLista(await r.json());
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    if (editando) {
      await fetch(`/api/tecnicos/${editando.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, telefone, ativo: 1 }),
      });
      setEditando(null);
    } else {
      await fetch("/api/tecnicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, telefone }),
      });
    }
    setNome("");
    setTelefone("");
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
  }

  function cancelar() {
    setEditando(null);
    setNome("");
    setTelefone("");
  }

  return (
    <div className="max-w-3xl">
      <form onSubmit={salvar} className="bg-slate-800 rounded-xl p-4 mb-6 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs text-slate-400 mb-1">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            placeholder="Nome do técnico"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-slate-400 mb-1">Telefone (opcional)</label>
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            placeholder="(11) 99999-9999"
          />
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
          {editando ? "Atualizar" : "Adicionar"}
        </button>
        {editando && (
          <button type="button" onClick={cancelar} className="text-slate-400 px-3 py-2 hover:text-slate-200">
            Cancelar
          </button>
        )}
      </form>

      <div className="bg-slate-800 rounded-xl overflow-hidden">
        {lista.length === 0 ? (
          <p className="p-6 text-center text-slate-400">Nenhum técnico cadastrado</p>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-900 text-left text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3 w-32">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((t) => (
                <tr key={t.id} className="border-t border-slate-700">
                  <td className="px-4 py-3 text-white">{t.nome}</td>
                  <td className="px-4 py-3 text-slate-300">{t.telefone || "-"}</td>
                  <td className="px-4 py-3 space-x-2">
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
        )}
      </div>
    </div>
  );
}
