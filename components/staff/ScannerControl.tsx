"use client";

import { useEffect, useState } from "react";
import ScannerQR from "./ScannerQR";
import ModalVinculo, { AcaoVinculo, DadosVinculo } from "./ModalVinculo";

type Device = { id: number; nome: string; patrimonio?: string | null; status: string };
type Atual = { id: number; colaborador: string; funcao: string | null; inicio: string } | null;
type EventoOpt = { id: number; numero?: string; nome: string };

const LABEL: Record<AcaoVinculo, string> = {
  vincular: "Colaborador vinculado",
  trocar: "Responsável trocado",
  finalizar: "Utilização finalizada",
};

export default function ScannerControl({ onMudou }: { onMudou?: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);
  const [atual, setAtual] = useState<Atual>(null);
  const [eventos, setEventos] = useState<EventoOpt[]>([]);
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch("/api/staff/options")
      .then((r) => (r.ok ? r.json() : { eventos: [] }))
      .then((d) => setEventos(d.eventos || []))
      .catch(() => {});
  }, []);

  async function aoLer(text: string) {
    setScanning(false);
    setErro("");
    setMsg("");
    try {
      const r = await fetch("/api/staff/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: text }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErro(data.error || "QR inválido");
        return;
      }
      setDevice(data.device);
      setAtual(data.atual);
    } catch {
      setErro("Erro ao ler o QR");
    }
  }

  async function confirmar(action: AcaoVinculo, d: DadosVinculo) {
    if (!device) return;
    setSalvando(true);
    setErro("");
    try {
      const r = await fetch("/api/staff/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, device_id: device.id, ...d }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(data.error || "Erro ao salvar");
        return;
      }
      setMsg(LABEL[action]);
      setTimeout(() => setMsg(""), 3500);
      setDevice(null);
      setAtual(null);
      onMudou?.();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-3">
      {!scanning && !device && (
        <button
          onClick={() => {
            setScanning(true);
            setErro("");
            setMsg("");
          }}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
        >
          📷 Escanear QR Code
        </button>
      )}

      {msg && <p className="text-green-400 text-sm">✓ {msg}</p>}
      {erro && <p className="text-red-400 text-sm">{erro}</p>}

      {scanning && (
        <div className="bg-slate-800 rounded-xl p-4">
          <ScannerQR onResult={aoLer} />
          <button onClick={() => setScanning(false)} className="mt-3 text-slate-400 hover:text-white text-sm">
            Cancelar
          </button>
        </div>
      )}

      {device && (
        <ModalVinculo
          device={device}
          atual={atual}
          eventos={eventos}
          salvando={salvando}
          onConfirm={confirmar}
          onClose={() => {
            setDevice(null);
            setAtual(null);
          }}
        />
      )}
    </div>
  );
}
