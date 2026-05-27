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
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [acaoMsg, setAcaoMsg] = useState("");
  const [processando, setProcessando] = useState(false);

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

  // Desenha um PNG idêntico ao card azul do QRDisplay (visto no notebook),
  // pronto pra ser papel de parede do celular.
  async function desenharQR(d: { id: number; uuid: string; secure_token: string; nome: string }): Promise<Blob> {
    const payload = JSON.stringify({ deviceId: d.id, uuid: d.uuid, secureToken: d.secure_token });
    const qrUrl = await QRCode.toDataURL(payload, { width: 720, margin: 1, errorCorrectionLevel: "M" });
    const W = 800;
    const H = 990;
    const codigo = d.uuid.slice(0, 8).toUpperCase();
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    // Fundo: gradiente azul (blue-700 → blue-950), igual ao card do QRDisplay
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#1d4ed8");
    grad.addColorStop(1, "#172554");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    // Marca Chronomax
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 60px sans-serif";
    ctx.fillText("CHRONOMAX", W / 2, 110);
    ctx.fillStyle = "#bfdbfe"; // blue-200
    ctx.font = "600 24px sans-serif";
    ctx.letterSpacing = "8px";
    ctx.fillText("CONTROLE DE STAFF", W / 2, 150);
    ctx.letterSpacing = "0px";
    // Nome do aparelho — encolhe a fonte e quebra em até 2 linhas pra nunca cortar
    // (no notebook o texto é HTML e quebra sozinho; no canvas precisamos ajustar na mão).
    const maxNomeW = 700;
    const escolherNome = (): { lines: string[]; size: number } => {
      for (let s = 90; s >= 48; s -= 2) {
        ctx.font = `bold ${s}px sans-serif`;
        if (ctx.measureText(d.nome).width <= maxNomeW) return { lines: [d.nome], size: s };
      }
      const palavras = d.nome.split(/\s+/).filter(Boolean);
      for (let s = 60; s >= 34; s -= 2) {
        ctx.font = `bold ${s}px sans-serif`;
        let l1 = "";
        let i = 0;
        for (; i < palavras.length; i++) {
          const t = l1 ? `${l1} ${palavras[i]}` : palavras[i];
          if (ctx.measureText(t).width > maxNomeW) break;
          l1 = t;
        }
        const l2 = palavras.slice(i).join(" ");
        if (l1 && !l2) return { lines: [l1], size: s };
        if (l1 && ctx.measureText(l2).width <= maxNomeW) return { lines: [l1, l2], size: s };
      }
      ctx.font = "bold 34px sans-serif";
      return { lines: [d.nome], size: 34 };
    };
    const nomeFit = escolherNome();
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${nomeFit.size}px sans-serif`;
    const nomeCy = 235;
    const lh = nomeFit.size * 1.08;
    const nomeStartY = nomeCy - ((nomeFit.lines.length - 1) * lh) / 2 + nomeFit.size * 0.34;
    nomeFit.lines.forEach((ln, i) => ctx.fillText(ln, W / 2, nomeStartY + i * lh));
    // Código (8 primeiros do uuid)
    ctx.fillStyle = "#bfdbfe";
    ctx.font = "500 28px sans-serif";
    ctx.fillText(`Código: ${codigo}`, W / 2, 335);
    // Caixa branca arredondada com o QR
    const boxX = 110, boxY = 365, boxSize = 580, pad = 28;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxSize, boxSize, 28);
    ctx.fill();
    const img = new Image();
    img.src = qrUrl;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("falha ao renderizar QR"));
    });
    ctx.drawImage(img, boxX + pad, boxY + pad, boxSize - pad * 2, boxSize - pad * 2);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
  }

  // Sanitiza o nome do aparelho pra virar nome de arquivo válido.
  function nomeArquivo(nome: string) {
    return (nome || "qr").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "qr";
  }

  // Núcleo reutilizável: grava 1 PNG por aparelho direto numa pasta (pendrive),
  // via File System Access API. Sem suporte no navegador, cai no download de ZIP.
  async function exportarParaPasta(
    devices: { id: number; uuid: string; secure_token: string; nome: string }[],
    msg: (s: string) => void
  ) {
    const usados = new Set<string>();
    const nomeUnico = (nome: string) => {
      const base = nomeArquivo(nome);
      let fn = `${base}.png`;
      let k = 2;
      while (usados.has(fn)) fn = `${base} (${k++}).png`;
      usados.add(fn);
      return fn;
    };
    const picker = (
      window as unknown as {
        showDirectoryPicker?: (o?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;

    if (picker) {
      const dir = await picker({ mode: "readwrite" });
      let n = 0;
      for (const d of devices) {
        const blob = await desenharQR(d);
        const fh = await dir.getFileHandle(nomeUnico(d.nome), { create: true });
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
        msg(`Salvando na pasta... ${++n}/${devices.length}`);
      }
      msg(`${n} QR Code(s) salvos na pasta escolhida — prontos pro pendrive 🎉`);
    } else {
      const zip = new JSZip();
      for (const d of devices) zip.file(nomeUnico(d.nome), await desenharQR(d));
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qrcodes-staff.zip";
      a.click();
      URL.revokeObjectURL(url);
      msg(`Seu navegador não salva direto na pasta — baixei o ZIP (${devices.length}).`);
    }
  }

  async function gerarLote(destino: "zip" | "pasta") {
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
      if (destino === "pasta") {
        await exportarParaPasta(devices, setLoteMsg);
      } else {
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
      }
      carregar();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") setLoteMsg("Exportação cancelada (os aparelhos foram criados).");
      else setLoteMsg(e instanceof Error ? e.message : "Erro ao gerar/exportar");
    } finally {
      setGerandoLote(false);
    }
  }

  // --- Seleção em lote (excluir / exportar) ---
  function toggleSel(id: number) {
    setSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  const selecionarTodos = () => setSelecionados(new Set(lista.map((d) => d.id)));
  const selecionarSemUso = () => setSelecionados(new Set(lista.filter((d) => d.status !== "em_uso").map((d) => d.id)));
  const limparSel = () => setSelecionados(new Set());

  async function excluirSelecionados() {
    const ids = Array.from(selecionados);
    if (!ids.length) return;
    if (!confirm(`Excluir ${ids.length} aparelho(s)? Os que tiverem histórico são mantidos (só dá pra inativar).`)) return;
    setProcessando(true);
    setAcaoMsg("");
    try {
      const r = await fetch("/api/staff/devices/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setAcaoMsg(d.error || "Erro ao excluir");
        return;
      }
      const bloq = Array.isArray(d.bloqueados) ? d.bloqueados.length : 0;
      setAcaoMsg(`${d.excluidos} excluído(s)` + (bloq ? ` · ${bloq} mantido(s) por terem histórico (inative em vez de excluir).` : "."));
      limparSel();
      carregar();
    } catch {
      setAcaoMsg("Erro ao excluir");
    } finally {
      setProcessando(false);
    }
  }

  async function exportarSelecionados() {
    const sel = lista.filter((d) => selecionados.has(d.id));
    if (!sel.length) {
      setAcaoMsg("Selecione ao menos um aparelho.");
      return;
    }
    setProcessando(true);
    setAcaoMsg("");
    try {
      await exportarParaPasta(sel, setAcaoMsg);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") setAcaoMsg("Exportação cancelada.");
      else setAcaoMsg(e instanceof Error ? e.message : "Erro ao exportar");
    } finally {
      setProcessando(false);
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
            onClick={() => gerarLote("pasta")}
            disabled={gerandoLote}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg"
          >
            {gerandoLote ? "Gerando..." : "📁 Gerar e salvar na pasta (pendrive)"}
          </button>
          <button
            onClick={() => gerarLote("zip")}
            disabled={gerandoLote}
            className="bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white px-4 py-2 rounded-lg"
          >
            {gerandoLote ? "Gerando..." : "Gerar e baixar ZIP"}
          </button>
          {loteMsg && <span className="text-sm text-slate-300">{loteMsg}</span>}
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="bg-slate-800/50 rounded-xl p-8 text-center text-slate-400">Nenhum aparelho cadastrado ainda.</p>
      ) : (
        <>
        <div className="bg-slate-800 rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-200 mr-1">
            {selecionados.size > 0 ? `${selecionados.size} selecionado(s)` : "Seleção em lote:"}
          </span>
          <button onClick={selecionarTodos} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg">
            Selecionar todos
          </button>
          <button onClick={selecionarSemUso} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg">
            Todos sem uso
          </button>
          <button onClick={limparSel} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1.5">
            Limpar
          </button>
          <div className="flex-1" />
          <button
            onClick={exportarSelecionados}
            disabled={processando || selecionados.size === 0}
            className="text-sm bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white px-3 py-1.5 rounded-lg"
          >
            📁 Exportar QRs → pasta ({selecionados.size})
          </button>
          <button
            onClick={excluirSelecionados}
            disabled={processando || selecionados.size === 0}
            className="text-sm bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white px-3 py-1.5 rounded-lg"
          >
            🗑 Excluir selecionados ({selecionados.size})
          </button>
          {acaoMsg && <span className="w-full text-sm text-slate-300">{acaoMsg}</span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {lista.map((d) => (
            <div
              key={d.id}
              className={`bg-slate-800 border rounded-xl p-4 ${
                selecionados.has(d.id) ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selecionados.has(d.id)}
                    onChange={() => toggleSel(d.id)}
                    className="w-4 h-4 accent-blue-600 shrink-0"
                  />
                  <h3 className="font-bold text-white truncate">{d.nome}</h3>
                </label>
                <span className={`${corStatus(d.status)} text-white text-xs px-2 py-0.5 rounded shrink-0`}>
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
        </>
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
