"use client";

import { useEffect, useState } from "react";
import { botaoSecundario } from "./ui";

type Registro = {
  id: number;
  acao: string;
  observacao: string | null;
  usuario: string | null;
  criado_em: string;
  evento_ref: string | null;
};

const ACOES: Record<string, string> = {
  cadastrado: "Cadastrado",
  cadastrado_manutencao: "Cadastrado (em manutenção)",
  alocado: "Alocado à prova",
  liberado: "Liberado da prova",
  desalocado: "Liberado da prova",
  manutencao: "Enviado para manutenção",
  retorno_manutencao: "Voltou da manutenção",
};

/** CURRENT_TIMESTAMP do SQLite é UTC ("yyyy-mm-dd hh:mm:ss") → horário local legível. */
function formatarData(s: string) {
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? s : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function HistoricoEquipamento({
  equipamento,
  onFechar,
}: {
  equipamento: { id: number; patrimonio: string };
  onFechar: () => void;
}) {
  const [registros, setRegistros] = useState<Registro[] | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    fetch(`/api/equipamentos/${equipamento.id}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!ativo) return;
        if (!r.ok) setErro(d.error || "Não foi possível carregar o histórico.");
        else setRegistros(d.historico || []);
      })
      .catch(() => ativo && setErro("Falha de conexão."));
    return () => {
      ativo = false;
    };
  }, [equipamento.id]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={`Histórico do patrimônio ${equipamento.patrimonio}`}>
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative w-full sm:max-w-lg max-h-[85vh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <div className="text-xs text-slate-400">Histórico</div>
            <div className="font-mono font-semibold">{equipamento.patrimonio}</div>
          </div>
          <button onClick={onFechar} className={botaoSecundario}>
            Fechar
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          {erro ? (
            <p className="text-sm text-red-300">{erro}</p>
          ) : registros === null ? (
            <p className="text-sm text-slate-400">Carregando…</p>
          ) : registros.length === 0 ? (
            <p className="text-sm text-slate-400">Sem registros.</p>
          ) : (
            <ol className="space-y-3">
              {registros.map((r) => (
                <li key={r.id} className="border-l-2 border-slate-700 pl-3">
                  <div className="text-sm text-slate-100">
                    {ACOES[r.acao] || r.acao}
                    {r.evento_ref && <span className="text-slate-400"> · {r.evento_ref}</span>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatarData(r.criado_em)}
                    {r.usuario ? ` · por ${r.usuario}` : ""}
                    {r.observacao ? ` · ${r.observacao}` : ""}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
