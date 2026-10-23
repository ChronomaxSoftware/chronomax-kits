"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { tipoDeProduto } from "@/lib/equipamentos";

type EstoqueItem = { produto_id: number; produto_nome: string; quantidade: number };
type Base = { id: number; nome: string; uf: string; ordem: number; estoque: EstoqueItem[] };

export default function BasesPage() {
  const [bases, setBases] = useState<Base[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novoUf, setNovoUf] = useState("");

  async function carregar() {
    setBases(await fetch("/api/bases").then((r) => r.json()));
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

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Bases</h1>
      <p className="text-slate-400 text-sm mb-6">
        Cadastro das bases (a UF liga a prova à base). As quantidades são editadas no{" "}
        <Link href="/equipamentos" className="text-blue-400 hover:underline">
          Inventário
        </Link>
        : equipamentos por patrimônio e{" "}
        <Link href="/equipamentos/acessorios" className="text-blue-400 hover:underline">
          acessórios por quantidade
        </Link>
        .
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

            {b.estoque.length === 0 ? (
              <p className="text-sm text-slate-500">Nada cadastrado nesta base.</p>
            ) : (
              <ul className="space-y-1">
                {[...b.estoque]
                  .sort((x, y) => x.produto_nome.localeCompare(y.produto_nome, "pt-BR"))
                  .map((e) => (
                    <li key={e.produto_id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-200">
                        {e.produto_nome}{" "}
                        <span className="text-[10px] text-slate-500">
                          {tipoDeProduto(e.produto_nome) ? "patrimônios" : "acessório"}
                        </span>
                      </span>
                      <span className="text-white font-semibold">{e.quantidade}</span>
                    </li>
                  ))}
              </ul>
            )}
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
