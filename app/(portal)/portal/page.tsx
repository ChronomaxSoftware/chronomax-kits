"use client";

import { useEffect, useState } from "react";

type Produto = {
  id: number;
  nome: string;
  quantidade: number;
  recebido: number;
  qtd_recebida: number | null;
  recebido_em: string | null;
};

type EventoPortal = {
  id: number;
  numero: string;
  nome: string;
  data: string;
  cidade: string | null;
  uf: string | null;
  local_entrega: string | null;
  data_entrega: string | null;
  hora_entrega: string | null;
  obs_recebimento: string | null;
  obs_em: string | null;
  confirmado_em: string | null;
  produtos: Produto[];
  equipamentos: { tipo: string; patrimonio: string; numero_chip: string | null; status: string }[];
};

function dataHora(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function PortalPage() {
  const [eventos, setEventos] = useState<EventoPortal[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    try {
      const r = await fetch("/api/portal/eventos");
      if (r.ok) setEventos(await r.json());
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  if (carregando) return <p className="text-slate-400 py-10 text-center">Carregando...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Minhas entregas</h1>
      {eventos.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-slate-800/50 rounded-xl">
          <p>Nenhum evento atribuído a você ainda.</p>
        </div>
      ) : (
        eventos.map((ev) => (
          // a chave muda quando o servidor confirma algo → o cartão recomeça com o estado salvo
          <CardEventoPortal
            key={`${ev.id}:${ev.confirmado_em}:${ev.obs_em}:${ev.produtos.map((p) => `${p.recebido}-${p.qtd_recebida}`).join()}`}
            evento={ev}
            onSalvo={carregar}
          />
        ))
      )}
    </div>
  );
}

type ItemEstado = {
  produto_id: number;
  nome: string;
  quantidade: number;
  recebido: boolean;
  qtd_recebida: number;
};

function CardEventoPortal({ evento, onSalvo }: { evento: EventoPortal; onSalvo: () => void }) {
  const [itens, setItens] = useState<ItemEstado[]>(() =>
    evento.produtos.map((p) => ({
      produto_id: p.id,
      nome: p.nome,
      quantidade: p.quantidade,
      recebido: !!p.recebido,
      qtd_recebida: p.qtd_recebida ?? p.quantidade,
    }))
  );
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState("");
  const [obs, setObs] = useState(evento.obs_recebimento || "");
  const obsMudou = obs.trim() !== (evento.obs_recebimento || "").trim();

  const total = itens.length;
  const confirmados = itens.filter((i) => i.recebido).length;
  const status = total === 0 ? "vazio" : confirmados === total ? "confirmado" : confirmados > 0 ? "parcial" : "pendente";

  const badge =
    status === "confirmado"
      ? { txt: "✓ Recebido", cor: "bg-green-600" }
      : status === "parcial"
      ? { txt: `Parcial (${confirmados}/${total})`, cor: "bg-amber-600" }
      : status === "pendente"
      ? { txt: "Pendente", cor: "bg-slate-600" }
      : { txt: "Sem material", cor: "bg-slate-700" };

  function toggle(idx: number) {
    setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, recebido: !it.recebido } : it)));
  }
  function setQtd(idx: number, v: number) {
    setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, qtd_recebida: v } : it)));
  }
  function marcarTodos(valor: boolean) {
    setItens((arr) => arr.map((it) => ({ ...it, recebido: valor })));
  }

  async function enviar(corpo: Record<string, unknown>) {
    setSalvando(true);
    setSalvo(false);
    setErro("");
    try {
      const r = await fetch(`/api/portal/eventos/${evento.id}/confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      if (r.ok) {
        setSalvo(true);
        setTimeout(() => setSalvo(false), 2500);
        onSalvo();
      } else {
        const d = await r.json().catch(() => ({}));
        setErro(d.error || "Não foi possível salvar. Tente de novo.");
      }
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  // Item a item (quando falta algo) — leva junto a observação
  function confirmar() {
    enviar({
      itens: itens.map((i) => ({ produto_id: i.produto_id, recebido: i.recebido, qtd_recebida: i.qtd_recebida })),
      observacao: obs,
    });
  }

  function recebiTudo() {
    if (!confirm("Confirmar que você recebeu TODO o material desta prova, na quantidade esperada?")) return;
    enviar({ tudo: true, observacao: obs });
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs text-slate-400 font-mono">#{evento.numero}</span>
        <span className={`${badge.cor} text-white text-xs font-semibold px-2 py-0.5 rounded`}>{badge.txt}</span>
      </div>
      <h2 className="font-bold text-white leading-tight">{evento.nome}</h2>
      <p className="text-xs text-slate-400 mt-1">
        📅 {evento.data}
        {evento.cidade && <> · 📍 {evento.cidade}{evento.uf ? "/" + evento.uf : ""}</>}
      </p>
      {(evento.local_entrega || evento.data_entrega) && (
        <p className="text-xs text-amber-300 mt-1">
          🚚 {evento.local_entrega || "Entrega"} {evento.data_entrega ? `· ${evento.data_entrega}` : ""} {evento.hora_entrega || ""}
        </p>
      )}
      {evento.confirmado_em && (
        <p className="text-xs text-green-400 mt-1">✓ Você confirmou o recebimento em {dataHora(evento.confirmado_em)}</p>
      )}

      {evento.equipamentos.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Aparelhos (patrimônio)</p>
          <ul className="flex flex-wrap gap-1.5">
            {evento.equipamentos.map((e) => (
              <li
                key={e.patrimonio}
                className="rounded-full border border-slate-600 bg-slate-900 px-2.5 py-1 text-xs text-slate-200"
              >
                {e.tipo} · <span className="font-mono font-semibold text-white">{e.patrimonio}</span>
                {e.numero_chip ? <span className="text-slate-400"> · {e.numero_chip}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {total === 0 ? (
        <p className="text-sm text-slate-400 mt-3">Nenhum material cadastrado para este evento ainda.</p>
      ) : (
        <>
          <div className="flex items-center justify-between mt-4 mb-2">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Material</p>
            <div className="flex gap-3 text-xs">
              <button onClick={() => marcarTodos(true)} className="text-blue-400 hover:text-blue-300">
                Marcar tudo
              </button>
              <button onClick={() => marcarTodos(false)} className="text-slate-400 hover:text-slate-200">
                Limpar
              </button>
            </div>
          </div>

          <ul className="space-y-2">
            {itens.map((it, idx) => (
              <li
                key={it.produto_id}
                className={`flex items-center gap-3 rounded-lg p-3 border ${
                  it.recebido ? "bg-green-900/20 border-green-700/50" : "bg-slate-900 border-slate-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={it.recebido}
                  onChange={() => toggle(idx)}
                  className="w-6 h-6 shrink-0 accent-green-500"
                />
                <label className="flex-1 min-w-0" onClick={() => toggle(idx)}>
                  <span className="text-white block truncate">{it.nome}</span>
                  <span className="text-xs text-slate-500">esperado: {it.quantidade}</span>
                </label>
                <div className="shrink-0 text-right">
                  <label className="block text-[10px] text-slate-500 mb-0.5">recebido</label>
                  <input
                    type="number"
                    min={0}
                    value={it.qtd_recebida}
                    onChange={(e) => setQtd(idx, parseInt(e.target.value) || 0)}
                    className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-right"
                  />
                </div>
              </li>
            ))}
          </ul>

          <button
            onClick={recebiTudo}
            disabled={salvando}
            className="mt-4 w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-semibold py-3 rounded-lg"
          >
            ✅ Recebi todo o material
          </button>
          <button
            onClick={confirmar}
            disabled={salvando}
            className="mt-2 w-full bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 text-white text-sm py-2.5 rounded-lg"
          >
            {salvando ? "Salvando..." : salvo ? "✓ Salvo!" : "Faltou algo? Salvar o que marquei acima"}
          </button>
        </>
      )}

      <div className="mt-4">
        <label htmlFor={`obs-${evento.id}`} className="block text-xs text-slate-500 uppercase tracking-wide mb-1">
          Observações
        </label>
        <textarea
          id={`obs-${evento.id}`}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Ex.: veio 1 carregador a menos; roteador com a capa quebrada…"
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
        />
        {evento.obs_em && !obsMudou && (
          <p className="text-[11px] text-slate-500 mt-1">Enviada em {dataHora(evento.obs_em)}</p>
        )}
        {obsMudou && (
          <button
            onClick={() => enviar({ observacao: obs })}
            disabled={salvando}
            className="mt-2 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-sm py-2.5 rounded-lg"
          >
            {salvando ? "Enviando..." : "Enviar observação"}
          </button>
        )}
      </div>
      {erro && <p className="mt-2 text-sm text-red-400">{erro}</p>}
    </div>
  );
}
