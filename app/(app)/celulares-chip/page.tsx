"use client";

import { useEffect, useMemo, useState } from "react";

type Celular = {
  id: number;
  apelido: string | null;
  numero: string | null;
  operadora: string | null;
  identificador: string | null;
  quantidade: number;
  base_id: number | null;
  evento_id: number | null;
  observacao: string | null;
  base_nome: string | null;
  base_uf: string | null;
  evento_numero: string | null;
  evento_nome: string | null;
  evento_data: string | null;
  evento_cidade: string | null;
  evento_uf: string | null;
};

type Base = { id: number; nome: string; uf: string };
type Evento = { id: number; numero: string; nome: string; data: string; cidade: string | null; uf: string | null };

const formInicial = {
  apelido: "",
  numero: "",
  operadora: "Vivo",
  identificador: "",
  quantidade: "1",
  base_id: "",
  evento_id: "",
  observacao: "",
};

export default function CelularesChipPage() {
  const [lista, setLista] = useState<Celular[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [editando, setEditando] = useState<Celular | null>(null);
  const [form, setForm] = useState(formInicial);

  async function carregar() {
    const [c, b, e] = await Promise.all([
      fetch("/api/celulares-chip").then((r) => r.json()),
      fetch("/api/bases").then((r) => r.json()),
      fetch("/api/eventos").then((r) => r.json()),
    ]);
    setLista(c);
    setBases(b);
    setEventos(e);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(ev: React.FormEvent) {
    ev.preventDefault();
    const body = {
      ...form,
      quantidade: Math.max(1, parseInt(form.quantidade) || 1),
      base_id: form.base_id ? parseInt(form.base_id) : null,
      evento_id: form.evento_id ? parseInt(form.evento_id) : null,
    };
    if (editando) {
      await fetch(`/api/celulares-chip/${editando.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/celulares-chip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    cancelar();
    carregar();
  }

  async function remover(id: number) {
    if (!confirm("Remover este celular?")) return;
    await fetch(`/api/celulares-chip/${id}`, { method: "DELETE" });
    carregar();
  }

  function editar(c: Celular) {
    setEditando(c);
    setForm({
      apelido: c.apelido || "",
      numero: c.numero || "",
      operadora: c.operadora || "Vivo",
      identificador: c.identificador || "",
      quantidade: String(c.quantidade || 1),
      base_id: c.base_id ? String(c.base_id) : "",
      evento_id: c.evento_id ? String(c.evento_id) : "",
      observacao: c.observacao || "",
    });
  }

  function cancelar() {
    setEditando(null);
    setForm(formInicial);
  }

  const totalGeral = useMemo(() => lista.reduce((s, c) => s + (c.quantidade || 1), 0), [lista]);

  const totaisPorBase = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of lista) {
      const chave = c.base_nome ? `${c.base_nome}/${c.base_uf}` : c.evento_id ? `Em evento` : "Sem local";
      m.set(chave, (m.get(chave) || 0) + (c.quantidade || 1));
    }
    return m;
  }, [lista]);

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-2">Celulares com chip</h1>
      <p className="text-slate-400 text-sm mb-6">
        Cadastre cada celular com chip ativo, número e onde ele está agora (base ou evento).
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
          <span className="text-2xl font-bold text-blue-400">{totalGeral}</span>{" "}
          <span className="text-sm text-slate-300">total</span>
        </div>
        {Array.from(totaisPorBase.entries()).map(([k, v]) => (
          <div key={k} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
            <span className="text-2xl font-bold text-amber-400">{v}</span>{" "}
            <span className="text-sm text-slate-300">{k}</span>
          </div>
        ))}
      </div>

      <form onSubmit={salvar} className="bg-slate-800 rounded-xl p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Apelido</label>
          <input
            value={form.apelido}
            onChange={(e) => setForm({ ...form, apelido: e.target.value })}
            placeholder="ex: CEL-01"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Número do chip</label>
          <input
            value={form.numero}
            onChange={(e) => setForm({ ...form, numero: e.target.value })}
            placeholder="(51) 99999-9999"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Operadora</label>
          <select
            value={form.operadora}
            onChange={(e) => setForm({ ...form, operadora: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          >
            <option>Vivo</option>
            <option>Tim</option>
            <option>Claro</option>
            <option>Oi</option>
            <option>Outra</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">IMEI / Serial</label>
          <input
            value={form.identificador}
            onChange={(e) => setForm({ ...form, identificador: e.target.value })}
            placeholder="opcional"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
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

        <div className="col-span-2">
          <label className="block text-xs text-slate-400 mb-1">Base atual</label>
          <select
            value={form.base_id}
            onChange={(e) => setForm({ ...form, base_id: e.target.value, evento_id: e.target.value ? "" : form.evento_id })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="">— Nenhuma —</option>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}/{b.uf}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-slate-400 mb-1">Em evento (opcional)</label>
          <select
            value={form.evento_id}
            onChange={(e) => setForm({ ...form, evento_id: e.target.value, base_id: e.target.value ? "" : form.base_id })}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="">— Nenhum —</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                #{ev.numero} - {ev.nome.slice(0, 50)} ({ev.data})
              </option>
            ))}
          </select>
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
            {editando ? "Atualizar" : "Adicionar celular"}
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
          <p className="p-6 text-center text-slate-400">Nenhum celular cadastrado</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-slate-900 text-left text-xs text-slate-400 uppercase">
              <tr>
                <th className="px-4 py-3">Apelido</th>
                <th className="px-4 py-3 w-16 text-right">Qtd</th>
                <th className="px-4 py-3">Número / Operadora</th>
                <th className="px-4 py-3">IMEI/Serial</th>
                <th className="px-4 py-3">Onde está</th>
                <th className="px-4 py-3">Obs.</th>
                <th className="px-4 py-3 w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id} className="border-t border-slate-700">
                  <td className="px-4 py-3 text-white">{c.apelido || "-"}</td>
                  <td className="px-4 py-3 text-right text-amber-300 font-semibold">{c.quantidade || 1}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {c.numero || "-"}
                    {c.operadora && <span className="text-xs text-slate-500"> · {c.operadora}</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">{c.identificador || "-"}</td>
                  <td className="px-4 py-3">
                    {c.evento_id ? (
                      <span className="text-purple-300">
                        🎯 #{c.evento_numero} {c.evento_cidade ? `(${c.evento_cidade}/${c.evento_uf})` : ""}
                      </span>
                    ) : c.base_id ? (
                      <span className="text-blue-300">
                        📍 {c.base_nome}/{c.base_uf}
                      </span>
                    ) : (
                      <span className="text-slate-500">não atribuído</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{c.observacao || "-"}</td>
                  <td className="px-4 py-3 space-x-2">
                    <button onClick={() => editar(c)} className="text-blue-400 hover:text-blue-300 text-xs">
                      Editar
                    </button>
                    <button onClick={() => remover(c.id)} className="text-red-400 hover:text-red-300 text-xs">
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
