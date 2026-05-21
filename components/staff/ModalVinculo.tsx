"use client";

import { useState } from "react";
import { FUNCOES_STAFF } from "@/lib/staff";

type DeviceScan = { id: number; nome: string; patrimonio?: string | null; status: string };
type Atual = { id: number; colaborador: string; funcao: string | null; inicio: string } | null;
type EventoOpt = { id: number; numero?: string; nome: string };

export type AcaoVinculo = "vincular" | "trocar" | "finalizar";
export type DadosVinculo = {
  colaborador?: string;
  funcao?: string;
  observacao?: string;
  event_id?: number | null;
};

export default function ModalVinculo({
  device,
  atual,
  eventos,
  onConfirm,
  onClose,
  salvando,
}: {
  device: DeviceScan;
  atual: Atual;
  eventos: EventoOpt[];
  onConfirm: (action: AcaoVinculo, data: DadosVinculo) => void;
  onClose: () => void;
  salvando?: boolean;
}) {
  const emUso = !!atual;
  const [colaborador, setColaborador] = useState("");
  const [funcao, setFuncao] = useState<string>(FUNCOES_STAFF[0]);
  const [observacao, setObservacao] = useState("");
  const [eventId, setEventId] = useState<string>("");

  function enviar(action: "vincular" | "trocar") {
    if (!colaborador.trim()) return;
    onConfirm(action, {
      colaborador: colaborador.trim(),
      funcao,
      observacao: observacao.trim(),
      event_id: eventId ? Number(eventId) : null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-800 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-white">{device.nome}</h2>
            {device.patrimonio && <p className="text-xs text-slate-400">Patrimônio: {device.patrimonio}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none">
            ✕
          </button>
        </div>

        {emUso && atual && (
          <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 mb-4 text-sm">
            <p className="text-amber-200">
              Em uso por <strong>{atual.colaborador}</strong>
              {atual.funcao ? ` (${atual.funcao})` : ""}
            </p>
            <p className="text-xs text-amber-300/80">desde {new Date(atual.inicio).toLocaleString("pt-BR")}</p>
            <button
              onClick={() => onConfirm("finalizar", {})}
              disabled={salvando}
              className="mt-2 w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-white py-2 rounded-lg text-sm"
            >
              Finalizar utilização (devolver aparelho)
            </button>
          </div>
        )}

        <p className="text-sm font-semibold text-slate-200 mb-2">
          {emUso ? "Trocar responsável" : "Vincular colaborador"}
        </p>
        <div className="space-y-3">
          <input
            value={colaborador}
            onChange={(e) => setColaborador(e.target.value)}
            placeholder="Nome completo do colaborador"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
          <select
            value={funcao}
            onChange={(e) => setFuncao(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          >
            {FUNCOES_STAFF.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="">— Evento (opcional) —</option>
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.numero ? `#${ev.numero} - ` : ""}
                {ev.nome}
              </option>
            ))}
          </select>
          <input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Observação (opcional)"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
          <button
            onClick={() => enviar(emUso ? "trocar" : "vincular")}
            disabled={salvando || !colaborador.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white py-3 rounded-lg font-medium"
          >
            {salvando ? "Salvando..." : emUso ? "Trocar responsável" : "Vincular"}
          </button>
        </div>
      </div>
    </div>
  );
}
