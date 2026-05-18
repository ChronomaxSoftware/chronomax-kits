"use client";

import { useEffect, useState } from "react";

type Produto = { id: number; nome: string };
type EstoqueItem = { produto_id: number; produto_nome: string; quantidade: number };
type Base = { id: number; nome: string; uf: string; ordem: number; estoque: EstoqueItem[] };

export default function BasesPage() {
  const [bases, setBases] = useState<Base[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novoUf, setNovoUf] = useState("");
  const [salvandoId, setSalvandoId] = useState<number | null>(null);

  async function carregar() {
    const [b, p] = await Promise.all([
      fetch("/api/bases").then((r) => r.json()),
      fetch("/api/produtos").then((r) => r.json()),
    ]);
    setBases(b);
    setProdutos(p);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!novoNome.trim() || !novoUf.trim()) return;
    await fetch("/api/bases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoNome, uf: novoUf }),
    });
    setNovoNome("");
    setNovoUf("");
    carregar();
  }

  async function remover(id: number) {
    if (!confirm("Remover esta base e todo o estoque dela?")) return;
    await fetch(`/api/bases/${id}`, { method: "DELETE" });
    carregar();
  }

  function quantidadeAtual(base: Base, produto_id: number): number {
    return base.estoque.find((e) => e.produto_id === produto_id)?.quantidade || 0;
  }

  function setQuantidadeLocal(baseId: number, produto_id: number, qtd: number) {
    setBases((bs) =>
      bs.map((b) => {
        if (b.id !== baseId) return b;
        const existe = b.estoque.find((e) => e.produto_id === produto_id);
        const produto_nome = produtos.find((p) => p.id === produto_id)?.nome || "";
        const novoEstoque = existe
          ? b.estoque.map((e) => (e.produto_id === produto_id ? { ...e, quantidade: qtd } : e))
          : [...b.estoque, { produto_id, produto_nome, quantidade: qtd }];
        return { ...b, estoque: novoEstoque };
      })
    );
  }

  async function salvarEstoque(base: Base) {
    setSalvandoId(base.id);
    await fetch(`/api/bases/${base.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estoque: produtos.map((p) => ({ produto_id: p.id, quantidade: quantidadeAtual(base, p.id) })),
      }),
    });
    setSalvandoId(null);
    setTimeout(() => setSalvandoId(null), 1500);
    carregar();
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Estoque por base</h1>
      <p className="text-slate-400 text-sm mb-6">
        Defina a quantidade de cada produto disponível em cada base. Quando um evento acontece num estado com base
        cadastrada, o consumo sai do estoque dessa base — não do total.
      </p>

      <form onSubmit={adicionar} className="bg-slate-800 rounded-xl p-4 mb-6 flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-slate-400 mb-1">Nome da base</label>
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
            placeholder="ex: Belo Horizonte"
          />
        </div>
        <div className="w-24">
          <label className="block text-xs text-slate-400 mb-1">UF</label>
          <input
            value={novoUf}
            onChange={(e) => setNovoUf(e.target.value.toUpperCase())}
            maxLength={2}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white uppercase"
            placeholder="MG"
          />
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">+ Adicionar base</button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {bases.map((b) => (
          <div key={b.id} className="bg-slate-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {b.nome} <span className="text-sm text-slate-400 font-normal">/{b.uf}</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Total: {b.estoque.reduce((s, e) => s + e.quantidade, 0)} itens
                </p>
              </div>
              <button onClick={() => remover(b.id)} className="text-red-400 hover:text-red-300 text-xs">
                Remover
              </button>
            </div>

            <div className="space-y-2">
              {produtos.map((p) => {
                const qtd = quantidadeAtual(b, p.id);
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-slate-200">{p.nome}</span>
                    <input
                      type="number"
                      min={0}
                      value={qtd}
                      onChange={(e) => setQuantidadeLocal(b.id, p.id, parseInt(e.target.value) || 0)}
                      className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-right"
                    />
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => salvarEstoque(b)}
              disabled={salvandoId === b.id}
              className="mt-3 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-3 py-2 rounded-lg text-sm"
            >
              {salvandoId === b.id ? "Salvando..." : "Salvar estoque"}
            </button>
          </div>
        ))}
      </div>

      {bases.length === 0 && (
        <p className="bg-slate-800/50 rounded-xl p-8 text-center text-slate-400">
          Nenhuma base cadastrada. Adicione a primeira acima.
        </p>
      )}
    </div>
  );
}
