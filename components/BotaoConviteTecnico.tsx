"use client";

import { useState } from "react";
import { linkWhatsApp, mensagemConvite } from "@/lib/convite-texto";

/**
 * "🔗 Link de acesso": gera o link para o técnico criar a própria senha e mostra
 * Copiar / Enviar pelo WhatsApp (abre o WhatsApp com a mensagem pronta; quem envia é você).
 */
export default function BotaoConviteTecnico({ tecnico }: { tecnico: { id: number; nome: string; telefone: string | null } }) {
  const [link, setLink] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    if (!confirm(`Gerar o link de ${tecnico.nome}? Um link anterior deixa de funcionar e o novo permite criar a senha de novo.`)) return;
    setErro("");
    setGerando(true);
    try {
      const r = await fetch(`/api/tecnicos/${tecnico.id}/convite`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErro(d.error || "Não foi possível gerar o link.");
      else setLink(`${window.location.origin}/acesso/${d.token}`);
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setGerando(false);
    }
  }

  const mensagem = link ? mensagemConvite(tecnico.nome, link) : "";
  const whats = link ? linkWhatsApp(tecnico.telefone, mensagem) : null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // sem permissão: o link fica visível para copiar à mão
    }
  }

  return (
    <div className="text-xs">
      <button type="button" onClick={gerar} disabled={gerando} className="text-blue-400 hover:text-blue-300 disabled:opacity-50 whitespace-nowrap">
        {gerando ? "Gerando…" : link ? "🔗 Gerar outro link" : "🔗 Link de acesso"}
      </button>
      {erro && <p className="mt-1 text-red-400">{erro}</p>}
      {link && (
        <div className="mt-2 rounded-lg border border-slate-600 bg-slate-900 p-2 space-y-2 text-left">
          <p className="break-all font-mono text-[11px] text-slate-300 select-all">{link}</p>
          <p className="text-slate-500">
            Não vence. Na 1ª vez o técnico cria a senha; depois o link abre o login com o telefone dele.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copiar} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded">
              {copiado ? "✓ Copiado" : "Copiar mensagem"}
            </button>
            {whats ? (
              <a href={whats} target="_blank" rel="noreferrer" className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded">
                Enviar pelo WhatsApp
              </a>
            ) : (
              <span className="text-amber-300 self-center">Sem telefone válido — copie e envie por outro meio.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
