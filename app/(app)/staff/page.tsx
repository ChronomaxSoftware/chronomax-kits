"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import JSZip from "jszip";
import QRDisplay from "@/components/staff/QRDisplay";
import { labelStatusDevice } from "@/lib/staff";

type Device = {
  id: number;
  uuid: string;
  secure_token: string;
  nome: string;
  patrimonio: string | null;
  modelo: string | null;
  telefone: string | null;
  imei: string | null;
  observacoes: string | null;
  status: string;
  atual_colaborador: string | null;
  atual_funcao: string | null;
  atual_inicio: string | null;
};

const FORM_VAZIO = {
  nome: "",
  patrimonio: "",
  modelo: "",
  telefone: "",
  imei: "",
  observacoes: "",
  status: "disponivel",
};

function corStatus(s: string) {
  if (s === "disponivel") return "bg-green-600";
  if (s === "em_uso") return "bg-amber-600";
  return "bg-slate-600";
}

export default function AparelhosPage() {
  const [lista, setLista] = useState<Device[]>([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editId, setEditId] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [qr, setQr] = useState<Device | null>(null);
  const [loteQtd, setLoteQtd] = useState("90");
  const [loteInicio, setLoteInicio] = useState("1");
  const [lotePrefixo, setLotePrefixo] = useState("");
  const [gerandoLote, setGerandoLote] = useState(false);
  const [loteMsg, setLoteMsg] = useState("");

  async function carregar() {
    const r = await fetch("/api/staff/devices");
    if (r.ok) setLista(await r.json());
  }
  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!form.nome.trim()) return;
    const r = editId
      ? await fetch(`/api/staff/devices/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
      : await fetch("/api/staff/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErro(d.error || "Erro ao salvar");
      return;
    }
    cancelar();
    carregar();
  }

  function editar(d: Device) {
    setEditId(d.id);
    setForm({
      nome: d.nome,
      patrimonio: d.patrimonio || "",
      modelo: d.modelo || "",
      telefone: d.telefone || "",
      imei: d.imei || "",
      observacoes: d.observacoes || "",
      status: d.status === "inativo" ? "inativo" : "disponivel",
    });
    setErro("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelar() {
    setEditId(null);
    setForm(FORM_VAZIO);
    setErro("");
  }

  async function excluir(d: Device) {
    if (!confirm(`Excluir o aparelho "${d.nome}"?`)) return;
    const r = await fetch(`/api/staff/devices/${d.id}`, { method: "DELETE" });
    if (!r.ok) {
      const x = await r.json().catch(() => ({}));
      alert(x.error || "Não foi possível excluir");
      return;
    }
    carregar();
  }

  // Desenha um PNG (número + QR) pronto pra ser papel de parede do celular.
  async function desenharQR(d: { id: number; uuid: string; secure_token: string; nome: string }): Promise<Blob> {
    const payload = JSON.stringify({ deviceId: d.id, uuid: d.uuid, secureToken: d.secure_token });
    const qrUrl = await QRCode.toDataURL(payload, { width: 760, margin: 2, errorCorrectionLevel: "M" });
    const W = 800;
    const H = 940;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0b3d91";
    ctx.font = "bold 96px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(d.nome, W / 2, 110);
    const img = new Image();
    img.src = qrUrl;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("falha ao renderizar QR"));
    });
    ctx.drawImage(img, 20, 150, 760, 760);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
  }

  async function gerarLote() {
    const quantidade = parseInt(loteQtd) || 0;
    if (quantidade < 1) {
      setLoteMsg("Informe uma quantidade válida.");
      return;
    }
    setGerandoLote(true);
    setLoteMsg("Gerando...");
    try {
      const r = await fetch("/api/staff/devices/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantidade, inicio: parseInt(loteInicio) || 1, prefixo: lotePrefixo }),
      });
      if (!r.ok) {
        const x = await r.json().catch(() => ({}));
        setLoteMsg(x.error || "Erro ao gerar");
        return;
      }
      const devices: { id: number; uuid: string; secure_token: string; nome: string; numero: number }[] = await r.json();
      const zip = new JSZip();
      const pad = String(Math.max(...devices.map((d) => d.numero))).length;
      for (const d of devices) {
        const blob = await desenharQR(d);
        zip.file(`${String(d.numero).padStart(pad, "0")}.png`, blob);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qrcodes-staff.zip";
      a.click();
      URL.revokeObjectURL(url);
      setLoteMsg(`${devices.length} QR Codes gerados e baixados (qrcodes-staff.zip).`);
      carregar();
    } catch (e) {
      setLoteMsg(e instanceof Error ? e.message : "Erro ao gerar/baixar");
    } finally {
      setGerandoLote(false);
    }
  }

  const inp = "w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500";

  return (
    <div>
      <form onSubmit={salvar} className="bg-slate-800 rounded-xl p-4 mb-6 space-y-3">
        <p className="text-sm font-semibold text-slate-200">{editId ? "Editar aparelho" : "Cadastrar aparelho"}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome do aparelho *</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inp} placeholder="ex: CEL-01" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Número de patrimônio</label>
            <input value={form.patrimonio} onChange={(e) => setForm({ ...form, patrimonio: e.target.value })} className={inp} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Modelo</label>
            <input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} className={inp} placeholder="ex: Galaxy A15" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Número do telefone</label>
            <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className={inp} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">IMEI (opcional)</label>
            <input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} className={inp} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inp}>
              <option value="disponivel">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-xs text-slate-400 mb-1">Observações</label>
            <input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className={inp} />
          </div>
        </div>
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <div className="flex gap-3">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
            {editId ? "Atualizar" : "Cadastrar (gera QR)"}
          </button>
          {editId && (
            <button type="button" onClick={cancelar} className="text-slate-400 px-3 py-2 hover:text-slate-200">
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="bg-slate-800 rounded-xl p-4 mb-6 space-y-3">
        <p className="text-sm font-semibold text-slate-200">Gerar QR Codes em lote</p>
        <p className="text-xs text-slate-400">
          Cria aparelhos numerados (sem precisar preencher dados), já bipáveis, e baixa um ZIP com 1 imagem por número —
          é só pôr de papel de parede em cada celular. Os dados (patrimônio/telefone) você completa depois, se quiser.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Quantidade</label>
            <input type="number" min={1} max={300} value={loteQtd} onChange={(e) => setLoteQtd(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Começa em</label>
            <input type="number" min={1} value={loteInicio} onChange={(e) => setLoteInicio(e.target.value)} className={inp} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Prefixo no nome (opcional)</label>
            <input value={lotePrefixo} onChange={(e) => setLotePrefixo(e.target.value)} placeholder="ex: CEL-" className={inp} />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={gerarLote}
            disabled={gerandoLote}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg"
          >
            {gerandoLote ? "Gerando..." : "Gerar e baixar ZIP"}
          </button>
          {loteMsg && <span className="text-sm text-slate-300">{loteMsg}</span>}
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="bg-slate-800/50 rounded-xl p-8 text-center text-slate-400">Nenhum aparelho cadastrado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {lista.map((d) => (
            <div key={d.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-bold text-white">{d.nome}</h3>
                <span className={`${corStatus(d.status)} text-white text-xs px-2 py-0.5 rounded`}>
                  {labelStatusDevice(d.status)}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {d.patrimonio ? `Patrimônio ${d.patrimonio}` : "sem patrimônio"}
                {d.modelo ? ` · ${d.modelo}` : ""}
              </p>
              {d.telefone && <p className="text-xs text-slate-400">📱 {d.telefone}</p>}
              {d.status === "em_uso" && d.atual_colaborador && (
                <p className="text-xs text-amber-300 mt-2">
                  Em uso por <strong>{d.atual_colaborador}</strong>
                  {d.atual_funcao ? ` (${d.atual_funcao})` : ""}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={() => setQr(d)} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg">
                  Ver QR
                </button>
                <button onClick={() => editar(d)} className="text-sm text-blue-400 hover:text-blue-300 px-2 py-1.5">
                  Editar
                </button>
                <button onClick={() => excluir(d)} className="text-sm text-red-400 hover:text-red-300 px-2 py-1.5">
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {qr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setQr(null)} />
          <div className="relative w-full max-w-sm">
            <QRDisplay device={qr} secureToken={qr.secure_token} />
            <button onClick={() => setQr(null)} className="mt-3 mx-auto block text-slate-300 hover:text-white text-sm">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
