"use client";

import { useEffect, useState } from "react";

type Alugado = {
  id: number;
  tipo: string;
  quantidade: number;
  identificador: string | null;
  fornecedor: string | null;
  evento_id: number | null;
  observacao: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  evento_numero: string | null;
  evento_nome: string | null;
  evento_data: string | null;
};

type Evento = { id: number; numero: string; nome: string; data: string };

export default function AlugadosPage() {
  const [lista, setLista] = useState<Alugado[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [editando, setEditando] = useState<Alugado | null>(null);
  const [form, setForm] = useState({
    tipo: "Celular",
    quantidade: "1",
    identificador: "",
    fornecedor: "",
    evento_id: "",
    observacao: "",
    data_inicio: "",
    data_fim: "",
  });

  async function carregar() {
    const [a, e] = await Promise.all([fetch("/api/alugados").then((r) => r.json()), fetch("/api/eventos").then((r) => r.json())]);
    setLista(a);
    setEventos(e);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      ...form,
      quantidade: Math.max(1, parseInt(form.quantidade) || 1),
      evento_id: form.evento_id ? parseInt(form.evento_id) : null,
    };
    if (editando) {
      await fetch(`/api/alugados/${editando.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/alugados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    cancelar();
    carregar();
  }

  async function remover(id: number) {
    if (!confirm("Remover este equipamento alugado?")) return;
    await fetch(`/api/alugados/${id}`, { method: "DELETE" });
    carregar();
  }

  function editar(a: Alugado) {
    setEditando(a);
    setForm({
      tipo: a.tipo,
      quantidade: String(a.quantidade || 1),
      identificador: a.identificador || "",
      fornecedor: a.fornecedor || "",
      evento_id: a.evento_id ? String(a.evento_id) : "",
      observacao: a.observacao || "",
      data_inicio: a.data_inicio || "",
      data_fim: a.data_fim || "",
    });
  }

  function cancelar() {
    setEditando(null);
    setForm({ tipo: "Celular", quantidade: "1", identificador: "", fornecedor: "", evento_id: "", observacao: "", data_inicio: "", data_fim: "" });
  }

  const totaisPorTipo = lista.reduce<Record<string, number>>((acc, a) => {
    acc[a.tipo] = (acc[a.tipo] || 0) + (a.quantidade || 1);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Equipamentos alugados</h1>
      <p className="text-slate-400 text-sm mb-6">
        Cadastre celulares, notebooks e outros equipamentos que você está alugando, e veja onde estão sendo usados.
      </p>

      {Object.keys(totaisPorTipo).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(totaisPorTipo).map(([tipo, qtd]) => (
            <div key={tipo} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
              <span className="text-2xl font-bold text-amber-400">{qtd}</span>{" "}
              <span className="text-sm text-slate-300">{tipo}</span>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={salvar} className="bg-slate-800 rounded-xl p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Tipo</label>
          <select
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          >
            <option>Celular</option>
            <option>Notebook</option>
            <option>Roteador</option>
            <option>Totem</option>
            <option>Outro</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Quantidade</label>
          <input
            type="number"
            min={1}
            value={form.quantidade}
            onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Identificador / IMEI / Serial</label>
          <input
            value={form.identificador}
            onChange={(e) => setForm({ ...form, identificador: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
            placeholder="opcional"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Fornecedor</label>
          <input
            value={form.fornecedor}
            onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
            placeholder="ex: Locadora X"
          />
        </div>
        <div className="col-span-2 md:col-span-4">
          <label className="block text-xs text-slate-400 mb-1">Onde está sendo usado (evento)</label>
          <select
            value={form.evento_id}
            onChange={(e) => setForm({ ...form, evento_id: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="">— Não atribuído —</option>
            {eventos.map((e) => (
              <option key={e.id} value={e.id}>
                #{e.numero} - {e.nome} ({e.data})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Início do aluguel</label>
          <input
            type="date"
            value={form.data_inicio}
            onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Fim do aluguel</label>
          <input
            type="date"
            value={form.data_fim}
            onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div className="col-span-2 md:col-span-4">
          <label className="block text-xs text-slate-400 mb-1">Observação</label>
          <input
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div className="col-span-2 md:col-span-4 flex gap-3">
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
          <p className="p-6 text-center text-slate-400">Nenhum equipamento alugado cadastrado</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-900 text-left text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 w-16 text-right">Qtd</th>
                <th className="px-4 py-3">ID/Serial</th>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3">Onde está</th>
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id} className="border-t border-slate-700">
                  <td className="px-4 py-3 text-white">{a.tipo}</td>
                  <td className="px-4 py-3 text-right text-amber-300 font-semibold">{a.quantidade || 1}</td>
                  <td className="px-4 py-3 text-slate-300">{a.identificador || "-"}</td>
                  <td className="px-4 py-3 text-slate-300">{a.fornecedor || "-"}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {a.evento_id ? (
                      <span className="text-blue-300">
                        #{a.evento_numero} - {a.evento_nome?.slice(0, 40)}
                      </span>
                    ) : (
                      <span className="text-slate-500">não atribuído</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">
                    {a.data_inicio || "?"} → {a.data_fim || "?"}
                  </td>
                  <td className="px-4 py-3 space-x-2">
                    <button onClick={() => editar(a)} className="text-blue-400 hover:text-blue-300 text-xs">
                      Editar
                    </button>
                    <button onClick={() => remover(a.id)} className="text-red-400 hover:text-red-300 text-xs">
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
