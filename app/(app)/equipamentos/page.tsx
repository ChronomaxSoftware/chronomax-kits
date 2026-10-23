"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { OPERADORAS, TIPOS_COM_CHIP, TIPOS_EQUIPAMENTO } from "@/lib/equipamentos";
import { normalizarNome } from "@/lib/tecnico-match";
import {
  Aviso,
  EventoOpcao,
  Indicador,
  StatusBadge,
  botaoPrimario,
  campo,
  provasParaAlocar,
  rotulo,
  rotuloProva,
  formatarDataHora,
} from "@/components/equipamentos/ui";
import HistoricoEquipamento from "@/components/equipamentos/HistoricoEquipamento";
import GraficoInventario from "@/components/equipamentos/GraficoInventario";
import type { EventoPedido } from "@/lib/inventario-resumo";

type Equipamento = {
  id: number;
  tipo: string;
  patrimonio: string;
  numero_chip: string | null;
  operadora: string | null;
  numero_serie: string | null;
  base_id: number | null;
  evento_id: number | null;
  status: string;
  observacao: string | null;
  base_nome: string | null;
  base_uf: string | null;
  evento_numero: string | null;
  evento_nome: string | null;
  evento_data: string | null;
  prova_ref: string | null;
  saida_em: string | null;
};
type Base = { id: number; nome: string; uf: string };

const VAZIO = {
  tipo: "Celular",
  patrimonio: "",
  numero_chip: "",
  operadora: "",
  numero_serie: "",
  base_id: "",
  evento_id: "",
  status: "disponivel",
  observacao: "",
};

async function lerJson<T>(r: Response, padrao: T): Promise<T> {
  try {
    const d = await r.json();
    return d as T;
  } catch {
    return padrao;
  }
}

export default function EquipamentosPage() {
  const [lista, setLista] = useState<Equipamento[]>([]);
  const [eventos, setEventos] = useState<EventoOpcao[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [form, setForm] = useState(VAZIO);
  const [editando, setEditando] = useState<Equipamento | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [ocupado, setOcupado] = useState<number | null>(null); // id em alocação/liberação
  const [historicoDe, setHistoricoDe] = useState<Equipamento | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [rEq, rEv, rBa] = await Promise.all([fetch("/api/equipamentos"), fetch("/api/eventos"), fetch("/api/bases")]);
      if (!rEq.ok) throw new Error();
      const [eq, ev, ba] = await Promise.all([
        lerJson<Equipamento[]>(rEq, []),
        lerJson<EventoOpcao[]>(rEv, []),
        lerJson<Base[]>(rBa, []),
      ]);
      setLista(Array.isArray(eq) ? eq : []);
      setEventos(Array.isArray(ev) ? ev : []);
      setBases(Array.isArray(ba) ? ba : []);
    } catch {
      setErro("Não foi possível carregar o inventário. Verifique a conexão e recarregue a página.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const provas = useMemo(() => provasParaAlocar(eventos), [eventos]);

  const filtrados = useMemo(() => {
    const q = normalizarNome(busca);
    return lista.filter((e) => {
      if (filtroTipo && e.tipo !== filtroTipo) return false;
      if (filtroStatus && e.status !== filtroStatus) return false;
      if (!q) return true;
      return [e.patrimonio, e.numero_chip, e.numero_serie, e.tipo, e.evento_numero, e.evento_nome, e.base_nome, e.observacao].some(
        (v) => normalizarNome(v).includes(q)
      );
    });
  }, [lista, busca, filtroTipo, filtroStatus]);

  const contagem = useMemo(
    () => ({
      total: lista.length,
      disponivel: lista.filter((e) => e.status === "disponivel").length,
      alocado: lista.filter((e) => e.status === "alocado").length,
      em_campo: lista.filter((e) => e.status === "em_campo").length,
      manutencao: lista.filter((e) => e.status === "manutencao").length,
    }),
    [lista]
  );

  function avisar(tipo: "erro" | "ok", texto: string) {
    setErro(tipo === "erro" ? texto : "");
    setOk(tipo === "ok" ? texto : "");
  }

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (!form.patrimonio.trim()) {
      avisar("erro", "Informe o número de patrimônio.");
      return;
    }
    if (form.evento_id && form.status === "manutencao") {
      avisar("erro", "Equipamento em manutenção não pode ser alocado a uma prova.");
      return;
    }
    setSalvando(true);
    try {
      const body = {
        ...form,
        base_id: form.base_id ? Number(form.base_id) : null,
        evento_id: form.evento_id ? Number(form.evento_id) : null,
      };
      // Aparelho em campo: o vínculo com a prova só muda pela saída/retorno
      if (editando?.status === "em_campo") delete (body as Partial<typeof body>).evento_id;
      const r = await fetch(editando ? `/api/equipamentos/${editando.id}` : "/api/equipamentos", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await lerJson<{ error?: string }>(r, {});
      if (!r.ok) {
        avisar("erro", d.error || "Não foi possível salvar.");
        return;
      }
      avisar("ok", editando ? `Patrimônio ${form.patrimonio.toUpperCase()} atualizado.` : `Patrimônio ${form.patrimonio.toUpperCase()} cadastrado.`);
      cancelar();
      await carregar();
    } catch {
      avisar("erro", "Falha de conexão ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function editar(e: Equipamento) {
    setEditando(e);
    setForm({
      tipo: e.tipo,
      patrimonio: e.patrimonio,
      numero_chip: e.numero_chip || "",
      operadora: e.operadora || "",
      numero_serie: e.numero_serie || "",
      base_id: e.base_id ? String(e.base_id) : "",
      evento_id: e.evento_id ? String(e.evento_id) : "",
      status: e.status === "manutencao" ? "manutencao" : "disponivel",
      observacao: e.observacao || "",
    });
    setErro("");
    setOk("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelar() {
    setEditando(null);
    setForm(VAZIO);
  }

  async function remover(e: Equipamento) {
    if (!confirm(`Excluir o patrimônio ${e.patrimonio}? O histórico dele também será apagado.`)) return;
    const r = await fetch(`/api/equipamentos/${e.id}`, { method: "DELETE" });
    const d = await lerJson<{ error?: string }>(r, {});
    if (r.ok) {
      avisar("ok", `Patrimônio ${e.patrimonio} excluído.`);
      if (editando?.id === e.id) cancelar();
      await carregar();
    } else avisar("erro", d.error || "Não foi possível excluir o equipamento.");
  }

  async function mudarAlocacao(e: Equipamento, eventoId: number | null) {
    if (eventoId === null && !confirm(`Liberar o patrimônio ${e.patrimonio} da prova #${e.evento_numero}?`)) return;
    setOcupado(e.id);
    try {
      const r = await fetch(`/api/equipamentos/${e.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evento_id: eventoId }),
      });
      const d = await lerJson<{ error?: string }>(r, {});
      if (!r.ok) avisar("erro", d.error || "Falha na alocação.");
      else avisar("ok", eventoId ? `Patrimônio ${e.patrimonio} alocado.` : `Patrimônio ${e.patrimonio} liberado.`);
      await carregar();
    } catch {
      avisar("erro", "Falha de conexão.");
    } finally {
      setOcupado(null);
    }
  }

  const comChip = TIPOS_COM_CHIP.includes(form.tipo);

  return (
    <div className="space-y-6">
      <p className="text-slate-400 text-sm">
        Cada aparelho é controlado pelo <strong className="text-slate-300">patrimônio</strong>: separado para a prova →
        saída → retorno conferido. Um equipamento só pode estar em uma prova por vez.{" "}
        <Link href="/celulares-chip" className="text-slate-500 hover:text-slate-300 underline">
          Ver lista antiga de celulares com chip
        </Link>
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Indicador titulo="Cadastrados" valor={contagem.total} />
        <Indicador titulo="Disponíveis" valor={contagem.disponivel} cor="text-emerald-300" />
        <Indicador titulo="Separados p/ prova" valor={contagem.alocado} cor="text-violet-300" />
        <Indicador titulo="Em campo" valor={contagem.em_campo} cor="text-sky-300" />
        <Indicador titulo="Em manutenção" valor={contagem.manutencao} cor="text-amber-300" />
      </div>

      {!carregando && (
        // /api/eventos devolve também os produtos de cada prova (usados no pedido da semana)
        <GraficoInventario equipamentos={lista} eventos={eventos as unknown as EventoPedido[]} bases={bases} />
      )}

      {erro && <Aviso tipo="erro" texto={erro} onFechar={() => setErro("")} />}
      {ok && <Aviso tipo="ok" texto={ok} onFechar={() => setOk("")} />}

      <form onSubmit={salvar} className="bg-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{editando ? `Editar patrimônio ${editando.patrimonio}` : "Cadastrar equipamento"}</h2>
          {editando && (
            <button type="button" onClick={cancelar} className="text-sm text-slate-400 hover:text-white">
              Cancelar edição
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="eq-tipo" className={rotulo}>Tipo *</label>
            <select id="eq-tipo" className={campo} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {TIPOS_EQUIPAMENTO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="eq-patrimonio" className={rotulo}>Patrimônio *</label>
            <input
              id="eq-patrimonio"
              className={`${campo} uppercase`}
              value={form.patrimonio}
              onChange={(e) => setForm({ ...form, patrimonio: e.target.value })}
              placeholder="Ex.: CH-001024"
              maxLength={60}
              required
            />
          </div>
          <div>
            <label htmlFor="eq-serie" className={rotulo}>Nº de série / IMEI</label>
            <input
              id="eq-serie"
              className={campo}
              value={form.numero_serie}
              onChange={(e) => setForm({ ...form, numero_serie: e.target.value })}
              placeholder="Opcional"
              maxLength={60}
            />
          </div>
          <div>
            <label htmlFor="eq-status" className={rotulo}>Situação</label>
            <select
              id="eq-status"
              className={campo}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value, evento_id: e.target.value === "manutencao" ? "" : form.evento_id })}
            >
              <option value="disponivel">Em operação</option>
              <option value="manutencao">Em manutenção</option>
            </select>
          </div>
          {comChip && (
            <>
              <div>
                <label htmlFor="eq-chip" className={rotulo}>Número do chip</label>
                <input
                  id="eq-chip"
                  className={campo}
                  value={form.numero_chip}
                  onChange={(e) => setForm({ ...form, numero_chip: e.target.value })}
                  placeholder="DDD + número (opcional)"
                  maxLength={30}
                />
              </div>
              <div>
                <label htmlFor="eq-operadora" className={rotulo}>Operadora</label>
                <select id="eq-operadora" className={campo} value={form.operadora} onChange={(e) => setForm({ ...form, operadora: e.target.value })}>
                  <option value="">—</option>
                  {OPERADORAS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>
            <label htmlFor="eq-base" className={rotulo}>Base de origem</label>
            <select id="eq-base" className={campo} value={form.base_id} onChange={(e) => setForm({ ...form, base_id: e.target.value })}>
              <option value="">Sem base</option>
              {bases.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome}/{b.uf}
                </option>
              ))}
            </select>
          </div>
          <div className={comChip ? "" : "lg:col-span-3"}>
            <label htmlFor="eq-prova" className={rotulo}>Prova (opcional)</label>
            <select
              id="eq-prova"
              className={campo}
              value={form.evento_id}
              disabled={form.status === "manutencao" || editando?.status === "em_campo"}
              onChange={(e) => setForm({ ...form, evento_id: e.target.value })}
            >
              <option value="">Não alocado</option>
              {/* Garante que a prova atual aparece mesmo se for antiga */}
              {editando?.evento_id && !provas.some((p) => p.id === editando.evento_id) && (
                <option value={editando.evento_id}>
                  {rotuloProva({ numero: editando.evento_numero || "?", nome: editando.evento_nome || "", data: editando.evento_data })}
                </option>
              )}
              {provas.map((v) => (
                <option key={v.id} value={v.id}>
                  {rotuloProva(v)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="eq-obs" className={rotulo}>Observações</label>
            <input
              id="eq-obs"
              className={campo}
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="Estado, acessórios, detalhes…"
              maxLength={500}
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button disabled={salvando} className={botaoPrimario}>
            {salvando ? "Salvando…" : editando ? "Salvar alterações" : "+ Cadastrar"}
          </button>
        </div>
      </form>

      <section className="bg-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 flex flex-col lg:flex-row lg:items-end gap-3 justify-between border-b border-slate-700">
          <div>
            <h2 className="font-semibold">Equipamentos</h2>
            <p className="text-xs text-slate-400">
              Mostrando {filtrados.length} de {lista.length}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="search"
              aria-label="Buscar equipamento"
              className={`${campo} sm:w-72`}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar patrimônio, chip, série ou prova"
            />
            <select aria-label="Filtrar por tipo" className={`${campo} sm:w-36`} value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Todos os tipos</option>
              {TIPOS_EQUIPAMENTO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select aria-label="Filtrar por situação" className={`${campo} sm:w-40`} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todas as situações</option>
              <option value="disponivel">Disponível</option>
              <option value="alocado">Separado p/ prova</option>
              <option value="em_campo">Em campo</option>
              <option value="manutencao">Manutenção</option>
            </select>
          </div>
        </div>

        {carregando ? (
          <p className="p-6 text-sm text-slate-400">Carregando inventário…</p>
        ) : filtrados.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">
            {lista.length === 0 ? "Nenhum equipamento cadastrado ainda." : "Nenhum equipamento encontrado com esses filtros."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-700">
            {filtrados.map((e) => (
              <li key={e.id} className="p-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-white">{e.patrimonio}</span>
                    <StatusBadge status={e.status} />
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {e.tipo}
                    {e.numero_serie ? ` · ${e.numero_serie}` : ""}
                  </div>
                </div>
                <div className="text-sm min-w-0">
                  {e.numero_chip ? (
                    <>
                      <div className="text-slate-200">{e.numero_chip}</div>
                      <div className="text-xs text-slate-400">{e.operadora || "Operadora não informada"}</div>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">Sem chip</span>
                  )}
                  {e.base_nome && <div className="text-xs text-slate-500">Base: {e.base_nome}/{e.base_uf}</div>}
                </div>
                <div className="text-sm min-w-0">
                  {e.status === "em_campo" ? (
                    <div className="min-w-0">
                      {e.evento_id ? (
                        <Link href={`/eventos/${e.evento_id}/equipamentos`} className="text-blue-400 hover:underline truncate block">
                          {e.prova_ref}
                        </Link>
                      ) : (
                        <span className="text-slate-300 truncate block">{e.prova_ref || "Prova removida"}</span>
                      )}
                      <Link href="/equipamentos/pendentes" className="text-xs text-sky-300 hover:underline">
                        Em campo desde {formatarDataHora(e.saida_em)} · dar entrada
                      </Link>
                    </div>
                  ) : e.evento_id ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/eventos/${e.evento_id}/equipamentos`} className="text-blue-400 hover:underline truncate max-w-full">
                        {rotuloProva({ numero: e.evento_numero || "?", nome: e.evento_nome || "", data: e.evento_data })}
                      </Link>
                      <button
                        onClick={() => mudarAlocacao(e, null)}
                        disabled={ocupado === e.id}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        Liberar
                      </button>
                    </div>
                  ) : e.status === "manutencao" ? (
                    <span className="text-xs text-slate-500">Indisponível para alocação</span>
                  ) : (
                    <select
                      aria-label={`Alocar ${e.patrimonio} a uma prova`}
                      className={`${campo} py-1.5 text-xs`}
                      value=""
                      disabled={ocupado === e.id}
                      onChange={(ev) => ev.target.value && mudarAlocacao(e, Number(ev.target.value))}
                    >
                      <option value="">Alocar a uma prova…</option>
                      {provas.map((v) => (
                        <option key={v.id} value={v.id}>
                          {rotuloProva(v)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex gap-3 text-sm lg:justify-end">
                  <button onClick={() => editar(e)} className="text-blue-400 hover:text-blue-300">
                    Editar
                  </button>
                  <button onClick={() => setHistoricoDe(e)} className="text-slate-300 hover:text-white">
                    Histórico
                  </button>
                  <button
                    onClick={() => remover(e)}
                    disabled={!!e.evento_id || e.status === "em_campo"}
                    title={
                      e.status === "em_campo"
                        ? "Registre o retorno antes de excluir"
                        : e.evento_id
                          ? "Libere da prova antes de excluir"
                          : undefined
                    }
                    className="text-red-400 hover:text-red-300 disabled:opacity-40"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Carregadores, extensões, réguas e mouses continuam sendo controlados por quantidade em{" "}
        <Link href="/produtos" className="text-blue-400 hover:underline">
          Produtos &amp; Estoque
        </Link>
        . A antiga tela de celulares com chip continua disponível como legado.
      </p>

      {historicoDe && <HistoricoEquipamento equipamento={historicoDe} onFechar={() => setHistoricoDe(null)} />}
    </div>
  );
}
