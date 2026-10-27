"use client";

import { useState } from "react";
import { CaixaTxt, JanelaModal } from "@/components/BotaoTxtSemana";
import { textoSeparacao, ufsDasProvas, type EventoSeparacao } from "@/lib/txt-separacao";

type EventoComId = EventoSeparacao & { id: number };

/**
 * TXT de separação da semana: primeiro escolhe as provas (todas, nenhuma ou por UF),
 * depois mostra o texto com o que separar de cada uma.
 */
export default function BotaoTxtSeparacao({
  inicio,
  fim,
  eventos,
  nomeArquivo,
}: {
  inicio: Date;
  fim: Date;
  eventos: EventoComId[];
  nomeArquivo: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [texto, setTexto] = useState<string | null>(null);

  const ufs = ufsDasProvas(eventos);
  const daUf = (uf: string) => eventos.filter((e) => (e.uf || "").trim().toUpperCase() === uf).map((e) => e.id);

  function abrir() {
    setMarcadas(new Set());
    setTexto(null);
    setAberto(true);
  }

  function alternar(id: number) {
    setMarcadas((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  /** Atalho de UF: marca as provas do estado; se todas já estavam marcadas, desmarca. */
  function alternarUf(uf: string) {
    const ids = daUf(uf);
    setMarcadas((m) => {
      const n = new Set(m);
      const todas = ids.every((id) => n.has(id));
      for (const id of ids) {
        if (todas) n.delete(id);
        else n.add(id);
      }
      return n;
    });
  }

  function gerar() {
    setTexto(textoSeparacao(inicio, fim, eventos.filter((e) => marcadas.has(e.id))));
  }

  const atalho = "text-xs px-2 py-1 rounded border";

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded whitespace-nowrap"
      >
        📦 TXT separação
      </button>

      {aberto && (
        <JanelaModal titulo="Separação — escolha as provas" onFechar={() => setAberto(false)}>
          {texto !== null ? (
            <CaixaTxt
              texto={texto}
              nomeArquivo={nomeArquivo}
              extra={
                <button
                  onClick={() => setTexto(null)}
                  className="mr-auto text-slate-300 hover:text-white text-sm px-3 py-2"
                >
                  ← Voltar
                </button>
              }
            />
          ) : eventos.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma prova nesta semana.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setMarcadas(new Set(eventos.map((e) => e.id)))}
                  className={`${atalho} border-slate-600 text-slate-200 hover:bg-slate-700`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setMarcadas(new Set())}
                  className={`${atalho} border-slate-600 text-slate-200 hover:bg-slate-700`}
                >
                  Nenhuma
                </button>
                {ufs.map((uf) => {
                  const ids = daUf(uf);
                  const ativo = ids.every((id) => marcadas.has(id));
                  return (
                    <button
                      key={uf}
                      onClick={() => alternarUf(uf)}
                      aria-pressed={ativo}
                      className={`${atalho} ${
                        ativo ? "border-blue-500 bg-blue-600/30 text-white" : "border-slate-600 text-slate-200 hover:bg-slate-700"
                      }`}
                    >
                      {uf} ({ids.length})
                    </button>
                  );
                })}
              </div>

              <ul className="space-y-1">
                {eventos.map((e) => {
                  const local = [e.cidade, e.uf].filter(Boolean).join("/");
                  const tecnicos = e.tecnicos.map((t) => t.nome).join(", ");
                  return (
                    <li key={e.id}>
                      <label className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-700/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={marcadas.has(e.id)}
                          onChange={() => alternar(e.id)}
                          className="mt-1 h-4 w-4 accent-blue-600"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm text-white leading-tight">{e.nome}</span>
                          <span className="block text-xs text-slate-400">
                            {e.data}
                            {local && ` · ${local}`}
                            {tecnicos && ` · ${tecnicos}`}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-xs text-slate-400">
                  {marcadas.size} de {eventos.length} selecionada{eventos.length > 1 ? "s" : ""}
                </span>
                <button
                  onClick={gerar}
                  disabled={marcadas.size === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg"
                >
                  Gerar TXT
                </button>
              </div>
            </>
          )}
        </JanelaModal>
      )}
    </>
  );
}
