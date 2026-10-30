"use client";

import { useCallback, useEffect, useState } from "react";
import ModalVinculo, { type AcaoVinculo, type DadosVinculo } from "@/components/staff/ModalVinculo";
import { provaPadrao } from "@/lib/staff-prova";

type Prova = { id: number; numero: string; nome: string; data: string; cidade: string | null; uf: string | null; celulares: number };
type Celular = {
  equipamento_id: number;
  tipo: string;
  patrimonio: string;
  numero_chip: string | null;
  device_id: number | null;
  vinculo_id: number | null;
  colaborador: string | null;
  funcao: string | null;
  inicio: string | null;
};

const LABEL: Record<AcaoVinculo, string> = {
  vincular: "Colaborador vinculado",
  trocar: "Responsável trocado",
  finalizar: "Utilização finalizada",
};

/**
 * Celulares alocados à prova (Inventário) prontos para vincular ao colaborador — sem bipar QR.
 * O aparelho entra no cadastro do Staff sozinho, pelo patrimônio, no primeiro vínculo.
 */
export default function CelularesDaProva() {
  const [provas, setProvas] = useState<Prova[] | null>(null);
  const [provaId, setProvaId] = useState<number | null>(null);
  const [celulares, setCelulares] = useState<Celular[]>([]);
  const [equipe, setEquipe] = useState<string[]>([]);
  const [aberto, setAberto] = useState<{ cel: Celular; deviceId: number } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/staff/provas")
      .then((r) => (r.ok ? r.json() : []))
      .then((lista: Prova[]) => {
        setProvas(lista);
        setProvaId(provaPadrao(lista)?.id ?? null);
      })
      .catch(() => setProvas([]));
  }, []);

  const carregar = useCallback(async (id: number) => {
    const r = await fetch(`/api/staff/provas/${id}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErro(d.error || "Não foi possível carregar os celulares.");
      return;
    }
    setCelulares(d.celulares || []);
    setEquipe(d.equipe || []);
  }, []);

  useEffect(() => {
    if (provaId) carregar(provaId);
  }, [provaId, carregar]);

  async function abrir(cel: Celular) {
    setErro("");
    if (cel.device_id) {
      setAberto({ cel, deviceId: cel.device_id });
      return;
    }
    const r = await fetch(`/api/staff/provas/${provaId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ equipamento_id: cel.equipamento_id }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErro(d.error || "Não foi possível preparar o aparelho.");
      return;
    }
    setAberto({ cel, deviceId: Number(d.device_id) });
  }

  async function confirmar(action: AcaoVinculo, dados: DadosVinculo) {
    if (!aberto || !provaId) return;
    setSalvando(true);
    setErro("");
    try {
      const r = await fetch("/api/staff/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, device_id: aberto.deviceId, ...dados, event_id: provaId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.error || "Erro ao salvar");
        return;
      }
      setMsg(`${LABEL[action]} — ${aberto.cel.patrimonio}`);
      setTimeout(() => setMsg(""), 3500);
      setAberto(null);
      await carregar(provaId);
    } finally {
      setSalvando(false);
    }
  }

  if (provas === null) return <p className="text-slate-400 text-sm">Carregando…</p>;
  if (provas.length === 0) {
    return (
      <p className="bg-slate-800 rounded-xl p-4 text-sm text-slate-400">
        Nenhuma prova com celular alocado (de 7 dias atrás até 30 dias à frente).
      </p>
    );
  }

  const prova = provas.find((p) => p.id === provaId) || null;
  const emUso = celulares.filter((c) => c.vinculo_id).length;

  return (
    <div className="space-y-3">
      <select
        aria-label="Prova"
        value={provaId ?? ""}
        onChange={(e) => setProvaId(Number(e.target.value))}
        className="w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
      >
        {provas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.data} · #{p.numero} {p.nome} ({p.celulares} cel.)
          </option>
        ))}
      </select>

      {msg && <p className="text-green-400 text-sm">✓ {msg}</p>}
      {erro && <p className="text-red-400 text-sm">{erro}</p>}

      <p className="text-xs text-slate-400">
        {celulares.length} celular{celulares.length === 1 ? "" : "es"} alocado{celulares.length === 1 ? "" : "s"} · {emUso} em uso
        · toque no celular para vincular, trocar ou finalizar
      </p>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {celulares.map((c) => (
          <li key={c.equipamento_id}>
            <button
              onClick={() => abrir(c)}
              className={`w-full text-left rounded-xl border p-3 hover:bg-slate-700/60 ${
                c.vinculo_id ? "border-blue-500/50 bg-blue-500/10" : "border-slate-700 bg-slate-800"
              }`}
            >
              <span className="font-mono font-semibold text-white">{c.patrimonio}</span>
              {c.numero_chip && <span className="text-xs text-slate-400"> · {c.numero_chip}</span>}
              <span className="block text-sm mt-1">
                {c.vinculo_id ? (
                  <span className="text-blue-200">
                    👤 {c.colaborador}
                    {c.funcao ? ` (${c.funcao})` : ""}
                    {c.inicio && (
                      <span className="text-xs text-slate-400">
                        {" "}· desde {new Date(c.inicio).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-slate-400">Livre — toque para vincular</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {aberto && prova && (
        <ModalVinculo
          device={{ id: aberto.deviceId, nome: `${aberto.cel.tipo} ${aberto.cel.patrimonio}`, patrimonio: aberto.cel.patrimonio, status: aberto.cel.vinculo_id ? "em_uso" : "disponivel" }}
          atual={
            aberto.cel.vinculo_id
              ? { id: aberto.cel.vinculo_id, colaborador: aberto.cel.colaborador || "", funcao: aberto.cel.funcao, inicio: aberto.cel.inicio || "" }
              : null
          }
          eventos={[]}
          eventoFixo={{ id: prova.id, numero: prova.numero, nome: prova.nome }}
          sugestoes={equipe}
          salvando={salvando}
          onConfirm={confirmar}
          onClose={() => setAberto(null)}
        />
      )}
    </div>
  );
}
