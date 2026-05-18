"use client";

import { useEffect, useState } from "react";

type Produto = { id: number; nome: string; ativo: number; quantidade_estoque: number };

export default function ProdutosPage() {
  const [lista, setLista] = useState<Produto[]>([]);
  const [nome, setNome] = useState("");
  const [estoque, setEstoque] = useState(0);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [erro, setErro] = useState("");

  async function carregar() {
    const r = await fetch("/api/produtos");
    setLista(await r.json());
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!nome.trim()) return;
    if (editando) {
      await fetch(`/api/produtos/${editando.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, ativo: 1, quantidade_estoque: estoque }),
      });
      setEditando(null);
    } else {
      const r = await fetch("/api/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, quantidade_estoque: estoque }),
      });
      if (!r.ok) {
        const data = await r.json();
        setErro(data.error || "Erro");
        return;
      }
    }
    setNome("");
    setEstoque(0);
    carregar();
  }

  async function atualizarEstoque(p: Produto, novoEstoque: number) {
    await fetch(`/api/produtos/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: p.nome, ativo: 1, quantidade_estoque: novoEstoque }),
    });
    carregar();
  }

  async function remover(id: number) {
    if (!confirm("Remover este produto?")) return;
    await fetch(`/api/produtos/${id}`, { method: "DELETE" });
    carregar();
  }

  function editar(p: Produto) {
    setEditando(p);
    setNome(p.nome);
    setEstoque(p.quantidade_estoque || 0);
  }

  function cancelar() {
    setEditando(null);
    setNome("");
    setEstoque(0);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Produtos & Estoque</h1>
      <p className="text-slate-400 text-sm mb-6">
        Cadastre os produtos e diga quantos você tem de cada. Isso é o que aparece em "estoque" no resumo da semana.
      </p>

      <form onSubmit={salvar} className="bg-slate-800 rounded-xl p-4 mb-6 flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs text-slate-400 mb-1">Nome do produto</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            placeholder="Ex: Notebook, Régua de energia..."
          />
        </div>
        <div className="w-32">
          <label className="block text-xs text-slate-400 mb-1">Quantos tenho</label>
          <input
            type="number"
            min={0}
            value={estoque}
            onChange={(e) => setEstoque(parseInt(e.target.value) || 0)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-right"
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

      {erro && <p className="text-red-400 text-sm mb-3">{erro}</p>}

      <div className="bg-slate-800 rounded-xl overflow-hidden">
        {lista.length === 0 ? (
          <p className="p-6 text-center text-slate-400">Nenhum produto cadastrado</p>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-900 text-left text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3 w-32 text-right">Quantos tenho</th>
                <th className="px-4 py-3 w-32">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} className="border-t border-slate-700">
                  <td className="px-4 py-3 text-white">{p.nome}</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      min={0}
                      value={p.quantidade_estoque || 0}
                      onChange={(e) => atualizarEstoque(p, parseInt(e.target.value) || 0)}
                      className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-right"
                    />
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    <button onClick={() => editar(p)} className="text-blue-400 hover:text-blue-300 text-sm">
                      Editar
                    </button>
                    <button onClick={() => remover(p.id)} className="text-red-400 hover:text-red-300 text-sm">
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
