"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Dados = {
  numero: string | null;
  nome: string | null;
  data: string | null;
  cidade: string | null;
  uf: string | null;
  qtd_atletas: number;
  nivel: string | null;
  qtd_celulares: number;
  dias_entrega: number;
  qtd_totens: number;
  tem_entrega_kit: boolean;
};

export default function ImportarPage() {
  const router = useRouter();
  const [html, setHtml] = useState("");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function analisar() {
    setErro("");
    setPreview(null);
    if (!html.trim()) {
      setErro("Cole o HTML primeiro");
      return;
    }
    setCarregando(true);
    const r = await fetch("/api/eventos/importar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, url, salvar: false }),
    });
    const data = await r.json();
    setCarregando(false);
    if (!r.ok) {
      setErro(data.error || "Erro");
      return;
    }
    setPreview(data.dados);
  }

  async function salvar() {
    setErro("");
    setCarregando(true);
    const r = await fetch("/api/eventos/importar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, url, salvar: true }),
    });
    const data = await r.json();
    setCarregando(false);
    if (!r.ok) {
      setErro(data.error || "Erro ao salvar");
      return;
    }
    router.push(`/eventos/${data.id}`);
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">Importar evento</h1>
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6 text-sm text-slate-300">
        <p className="font-semibold text-white mb-2">Como copiar do Gestão:</p>
        <p className="mb-2">
          <strong>Jeito fácil:</strong> Abra o evento no Gestão →{" "}
          <kbd className="bg-slate-700 px-1.5 rounded">Ctrl+A</kbd> →{" "}
          <kbd className="bg-slate-700 px-1.5 rounded">Ctrl+C</kbd> → cole abaixo
        </p>
        <p>
          <strong>Jeito completo:</strong> Abra o evento → <kbd className="bg-slate-700 px-1.5 rounded">F12</kbd> → aba{" "}
          <em>Elements</em> → clique direito em <code>&lt;body&gt;</code> → <em>Copy → Copy outerHTML</em> → cole abaixo
        </p>
      </div>

      <div className="bg-slate-800 rounded-xl p-4 mb-4">
        <label className="block text-xs text-slate-400 mb-1">URL do evento (opcional)</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://gestao.chronomax.com.br/squads/convocacoes/..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-blue-500"
        />

        <label className="block text-xs text-slate-400 mb-1">HTML da página</label>
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          placeholder="Cole aqui o código-fonte (Ctrl+U → Ctrl+A → Ctrl+C)"
          rows={12}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
        />

        <div className="flex gap-3 mt-3">
          <button
            onClick={analisar}
            disabled={carregando}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {carregando ? "Analisando..." : "Analisar"}
          </button>
          <button
            onClick={() => {
              setHtml("");
              setPreview(null);
              setErro("");
              setUrl("");
            }}
            className="text-slate-400 hover:text-white px-4 py-2"
          >
            Limpar
          </button>
        </div>
      </div>

      {erro && <div className="bg-red-900/40 border border-red-700 text-red-300 p-4 rounded-xl mb-4">{erro}</div>}

      {preview && (
        <div className="bg-slate-800 rounded-xl p-6 mb-4">
          <h2 className="text-lg font-bold mb-4">Pré-visualização</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Campo label="Número" valor={preview.numero || "—"} />
            <Campo label="Data" valor={preview.data || "—"} />
            <Campo label="Cidade/UF" valor={`${preview.cidade || "—"}${preview.uf ? " - " + preview.uf : ""}`} />
            <Campo label="Atletas" valor={String(preview.qtd_atletas || "—")} />
          </div>

          <div className="mb-4">
            <p className="text-xs text-slate-400 mb-1">Nome</p>
            <p className="text-white font-medium">{preview.nome || "—"}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4 pt-4 border-t border-slate-700">
            <Campo label="Celulares" valor={String(preview.qtd_celulares)} destaque />
            <Campo label="Dias de entrega" valor={String(preview.dias_entrega)} destaque />
            <Campo label="Totens" valor={String(preview.qtd_totens)} destaque />
          </div>

          {!preview.tem_entrega_kit ? (
            <div className="bg-yellow-900/40 border border-yellow-700 text-yellow-300 p-3 rounded-lg text-sm">
              Este evento parece não ter entrega de kit. Verifique antes de salvar.
            </div>
          ) : (
            <div className="bg-green-900/40 border border-green-700 text-green-300 p-3 rounded-lg text-sm mb-4">
              Evento com entrega de kit detectado.
            </div>
          )}

          <button
            onClick={salvar}
            disabled={carregando || !preview.numero}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg w-full"
          >
            {carregando ? "Salvando..." : "Salvar evento"}
          </button>
        </div>
      )}
    </div>
  );
}

function Campo({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={destaque ? "text-2xl font-bold text-blue-400" : "text-white"}>{valor}</p>
    </div>
  );
}
