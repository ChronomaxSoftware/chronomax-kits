"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { tipoDeProduto } from "@/lib/equipamentos";
import type { EventoUso } from "@/lib/estoque-semana";
import GraficoAcessorios, { type BaseAcessorios } from "@/components/equipamentos/GraficoAcessorios";
import { Aviso, botaoPrimario, campo } from "@/components/equipamentos/ui";

type Produto = { id: number; nome: string; quantidade_estoque: number | null };

/**
 * Acessórios = itens controlados por QUANTIDADE em cada base (Extensão, Régua, Mouse...).
 * Equipamentos com patrimônio (Celular, Roteador, ...) ficam na aba Equipamentos.
 * As quantidades por base são gravadas em estoque_base (PUT /api/bases/[id]).
 */
export default function AcessoriosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [bases, setBases] = useState<BaseAcessorios[]>([]);
  const [eventos, setEventos] = useState<EventoUso[]>([]);
  const [editado, setEditado] = useState<Map<string, number>>(new Map()); // "baseId:produtoId" → qtd
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [rp, rb, re] = await Promise.all([fetch("/api/produtos"), fetch("/api/bases"), fetch("/api/eventos")]);
      setProdutos(rp.ok ? await rp.json() : []);
      setBases(rb.ok ? await rb.json() : []);
      setEventos(re.ok ? await re.json() : []);
    } catch {
      setErro("Não foi possível carregar. Recarregue a página.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const acessorios = useMemo(() => produtos.filter((p) => !tipoDeProduto(p.nome)), [produtos]);

  const salvo = (b: BaseAcessorios, pid: number) => b.estoque.find((e) => e.produto_id === pid)?.quantidade || 0;
  const valor = (b: BaseAcessorios, pid: number) => editado.get(`${b.id}:${pid}`) ?? salvo(b, pid);

  function editar(b: BaseAcessorios, pid: number, qtd: number) {
    setEditado((m) => {
      const n = new Map(m);
      if (qtd === salvo(b, pid)) n.delete(`${b.id}:${pid}`);
      else n.set(`${b.id}:${pid}`, qtd);
      return n;
    });
  }

  async function salvar() {
    setErro("");
    setOk("");
    setSalvando(true);
    try {
      const basesAlteradas = bases.filter((b) => acessorios.some((p) => editado.has(`${b.id}:${p.id}`)));
      for (const b of basesAlteradas) {
        const r = await fetch(`/api/bases/${b.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estoque: acessorios.map((p) => ({ produto_id: p.id, quantidade: valor(b, p.id) })) }),
        });
        if (!r.ok) throw new Error();
      }
      setEditado(new Map());
      setOk("Quantidades salvas.");
      await carregar();
    } catch {
      setErro("Não foi possível salvar. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    setErro("");
    setOk("");
    const nome = novo.trim();
    if (!nome) return;
    const tipo = tipoDeProduto(nome);
    if (tipo) {
      setErro(`${tipo} é equipamento com patrimônio — cadastre cada aparelho na aba Equipamentos.`);
      return;
    }
    const r = await fetch("/api/produtos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErro(d.error || "Não foi possível adicionar.");
      return;
    }
    setNovo("");
    setOk(`${nome} adicionado. Preencha a quantidade em cada base.`);
    carregar();
  }

  if (carregando) return <p className="text-slate-400">Carregando…</p>;

  return (
    <div className="space-y-6">
      <p className="text-slate-400 text-sm">
        Itens controlados por <strong className="text-slate-300">quantidade</strong> em cada base (extensão, régua,
        mouse…). Celular, Roteador, Notebook, Tablet e Totem são por patrimônio, na aba Equipamentos.
      </p>

      <GraficoAcessorios produtos={acessorios} bases={bases} eventos={eventos} />

      {erro && <Aviso tipo="erro" texto={erro} onFechar={() => setErro("")} />}
      {ok && <Aviso tipo="ok" texto={ok} onFechar={() => setOk("")} />}

      <section className="bg-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-semibold">Quantidade por base</h2>
          <form onSubmit={adicionar} className="flex gap-2">
            <input
              aria-label="Nome do novo acessório"
              className={`${campo} sm:w-56`}
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              placeholder="Novo acessório (ex.: Fone)"
            />
            <button className={botaoPrimario} disabled={!novo.trim()}>
              Adicionar
            </button>
          </form>
        </div>

        {acessorios.length === 0 ? (
          <p className="p-4 text-sm text-slate-400">Nenhum acessório cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-xs text-slate-400 uppercase">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  {bases.map((b) => (
                    <th key={b.id} className="px-2 py-3 text-right whitespace-nowrap">
                      {b.nome}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {acessorios.map((p) => {
                  const total = bases.reduce((s, b) => s + valor(b, p.id), 0);
                  const antigo = Number(p.quantidade_estoque) || 0;
                  return (
                    <tr key={p.id} className="border-t border-slate-700 align-top">
                      <td className="px-4 py-2 text-white">
                        {p.nome}
                        {antigo > total && (
                          <span className="block text-[11px] text-amber-300">
                            Antes: {antigo} no total geral — faltam {antigo - total} para distribuir nas bases
                          </span>
                        )}
                      </td>
                      {bases.map((b) => (
                        <td key={b.id} className="px-2 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            aria-label={`${p.nome} em ${b.nome}`}
                            value={valor(b, p.id)}
                            onChange={(e) => editar(b, p.id, Math.max(0, parseInt(e.target.value) || 0))}
                            className={`w-20 bg-slate-900 border rounded px-2 py-1 text-white text-right ${
                              editado.has(`${b.id}:${p.id}`) ? "border-blue-500" : "border-slate-700"
                            }`}
                          />
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right font-semibold text-white">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-slate-700 flex items-center justify-between gap-3">
          <span className="text-sm text-slate-400">{editado.size} alteração(ões) não salva(s)</span>
          <button onClick={salvar} disabled={editado.size === 0 || salvando} className={botaoPrimario}>
            {salvando ? "Salvando…" : "Salvar quantidades"}
          </button>
        </div>
      </section>
    </div>
  );
}
