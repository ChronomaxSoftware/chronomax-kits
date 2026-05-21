"use client";

import { Fragment, useEffect, useState } from "react";

type EventoLite = { numero: string; nome: string; data: string; cidade: string; uf: string };
type Linha = {
  id: number;
  nome: string;
  telefone: string | null;
  total: number;
  eventos: EventoLite[];
};

function mesAtualISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rotuloMes(iso: string): string {
  const [ano, mes] = iso.split("-");
  const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${nomes[parseInt(mes) - 1]}/${ano}`;
}

export default function EntregasPage() {
  const [mes, setMes] = useState(mesAtualISO());
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [expandido, setExpandido] = useState<Set<number>>(new Set());

  async function carregar(m: string) {
    setCarregando(true);
    try {
      const r = await fetch(`/api/tecnicos/entregas?mes=${m}`);
      const data = await r.json();
      setLinhas(data.tecnicos || []);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar(mes);
  }, [mes]);

  function toggle(id: number) {
    const n = new Set(expandido);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setExpandido(n);
  }

  const foram = linhas.filter((l) => l.total > 0);
  const naoForam = linhas.filter((l) => l.total === 0);

  return (
    <div className="max-w-4xl">
      <div className="bg-slate-800 rounded-xl p-4 mb-6 flex items-center gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Mês</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <div className="text-slate-300">
          <p className="text-sm">{rotuloMes(mes)}</p>
          <p className="text-xs text-slate-500">
            {foram.length} foram · {naoForam.length} não foram
          </p>
        </div>
      </div>

      {carregando ? (
        <p className="text-slate-400 p-6 text-center">Carregando...</p>
      ) : (
        <>
          <Secao titulo={`Foram a entregas (${foram.length})`} cor="text-green-400">
            {foram.length === 0 ? (
              <p className="p-6 text-center text-slate-400">Nenhum técnico participou em {rotuloMes(mes)}</p>
            ) : (
              <Tabela linhas={foram} expandido={expandido} toggle={toggle} />
            )}
          </Secao>

          <Secao titulo={`Não foram a nenhuma entrega (${naoForam.length})`} cor="text-amber-400">
            {naoForam.length === 0 ? (
              <p className="p-6 text-center text-slate-400">Todos os técnicos participaram</p>
            ) : (
              <ul className="divide-y divide-slate-700">
                {naoForam.map((t) => (
                  <li key={t.id} className="px-4 py-3 flex justify-between items-center">
                    <span className="text-white">{t.nome}</span>
                    <span className="text-xs text-slate-500">{t.telefone || "-"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </>
      )}
    </div>
  );
}

function Secao({ titulo, cor, children }: { titulo: string; cor: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className={`text-sm font-semibold uppercase tracking-wide mb-2 ${cor}`}>{titulo}</h2>
      <div className="bg-slate-800 rounded-xl overflow-hidden">{children}</div>
    </section>
  );
}

function Tabela({
  linhas,
  expandido,
  toggle,
}: {
  linhas: Linha[];
  expandido: Set<number>;
  toggle: (id: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
    <table className="w-full">
      <thead className="bg-slate-900 text-left text-xs text-slate-400 uppercase">
        <tr>
          <th className="px-4 py-3">Técnico</th>
          <th className="px-4 py-3 w-24 text-right">Entregas</th>
          <th className="px-4 py-3 w-12"></th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((t) => (
          <Fragment key={t.id}>
            <tr className="border-t border-slate-700 hover:bg-slate-700/30 cursor-pointer" onClick={() => toggle(t.id)}>
              <td className="px-4 py-3 text-white">{t.nome}</td>
              <td className="px-4 py-3 text-right">
                <span className="inline-block bg-blue-600 text-white text-sm font-semibold rounded-full px-3 py-0.5">
                  {t.total}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-500">{expandido.has(t.id) ? "▾" : "▸"}</td>
            </tr>
            {expandido.has(t.id) && (
              <tr className="bg-slate-900/40">
                <td colSpan={3} className="px-4 py-3">
                  <ul className="space-y-1 text-sm">
                    {t.eventos.map((e, i) => (
                      <li key={i} className="text-slate-300">
                        <span className="text-slate-500">#{e.numero}</span> {e.data} — {e.nome}
                        {e.cidade && <span className="text-slate-500"> ({e.cidade}{e.uf ? `/${e.uf}` : ""})</span>}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
    </div>
  );
}
