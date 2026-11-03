"use client";

import { useState } from "react";
import { linkWhatsAppSemNumero, mensagemConviteUsuario } from "@/lib/convite-texto";

/**
 * "🔗 Link de senha" do usuário do escritório: gera um link de uso único (24h) para a
 * pessoa criar a própria senha. Copiar / Enviar pelo WhatsApp (escolhe o contato lá).
 */
export default function BotaoLinkSenhaUsuario({ usuario }: { usuario: { id: number; name: string; username: string } }) {
  const [link, setLink] = useState<string | null>(null);
  const [expira, setExpira] = useState("");
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    if (!confirm(`Gerar o link de senha de ${usuario.name}? Um link anterior deixa de funcionar. A senha atual continua valendo até a pessoa criar a nova.`)) return;
    setErro("");
    setGerando(true);
    try {
      const r = await fetch(`/api/usuarios/${usuario.id}/convite`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setErro(d.error || "Não foi possível gerar o link.");
      else {
        setLink(`${window.location.origin}/acesso/u/${d.token}`);
        setExpira(new Date(d.expira_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }));
      }
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setGerando(false);
    }
  }

  const mensagem = link ? mensagemConviteUsuario(usuario.name, usuario.username, link) : "";

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
        {gerando ? "Gerando…" : link ? "🔗 Gerar outro link" : "🔗 Link de senha"}
      </button>
      {erro && <p className="mt-1 text-red-400">{erro}</p>}
      {link && (
        <div className="mt-2 rounded-lg border border-slate-600 bg-slate-900 p-2 space-y-2 text-left">
          <p className="break-all font-mono text-[11px] text-slate-300 select-all">{link}</p>
          <p className="text-slate-500">Uso único. Vale até {expira}. A pessoa abre, cria a senha nova e já entra.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copiar} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded">
              {copiado ? "✓ Copiado" : "Copiar mensagem"}
            </button>
            <a href={linkWhatsAppSemNumero(mensagem)} target="_blank" rel="noreferrer" className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded">
              Enviar pelo WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
