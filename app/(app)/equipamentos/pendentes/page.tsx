"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseDataBR } from "@/lib/semana";
import ConferenciaRetorno, { ItemEmCampo } from "@/components/equipamentos/ConferenciaRetorno";
import ConferenciaAcessorios, { type ProvaAcessoriosTela } from "@/components/equipamentos/ConferenciaAcessorios";
import { Aviso, Indicador } from "@/components/equipamentos/ui";

type Pendente = ItemEmCampo & { evento_id: number | null; evento_data: string | null; evento_numero: string | null };

type Grupo = { chave: string; eventoId: number | null; titulo: string; data: string | null; atrasada: boolean; itens: Pendente[] };

export default function PendentesPage() {
  const [lista, setLista] = useState<Pendente[] | null>(null);
  const [acessorios, setAcessorios] = useState<ProvaAcessoriosTela[]>([]);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  const carregar = useCallback(async () => {
    try {
      const [r, ra] = await Promise.all([fetch("/api/equipamentos/pendentes"), fetch("/api/acessorios/retorno")]);
      if (!r.ok) throw new Error();
      setLista(await r.json());
      if (ra.ok) setAcessorios(await ra.json());
    } catch {
      setErro("Não foi possível carregar os pendentes. Recarregue a página.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Agrupa por prova; prova que já passou (ou foi removida) com aparelho fora = atrasada
  const grupos = useMemo<Grupo[]>(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const mapa = new Map<string, Grupo>();
    for (const p of lista || []) {
      const chave = p.evento_id ? `ev-${p.evento_id}` : `ref-${p.evento_ref}`;
      if (!mapa.has(chave)) {
        const d = parseDataBR(p.evento_data);
        mapa.set(chave, {
          chave,
          eventoId: p.evento_id,
          titulo: p.evento_ref || "Prova removida",
          data: p.evento_data,
          atrasada: !p.evento_id || (d !== null && d < hoje),
          itens: [],
        });
      }
      mapa.get(chave)!.itens.push(p);
    }
    return [...mapa.values()].sort((a, b) => Number(b.atrasada) - Number(a.atrasada));
  }, [lista]);

  if (lista === null && !erro) return <p className="text-slate-400">Carregando…</p>;

  const atrasados = grupos.filter((g) => g.atrasada).reduce((s, g) => s + g.itens.length, 0);

  return (
    <div className="space-y-6">
      <p className="text-slate-400 text-sm">
        Aparelhos que <strong className="text-slate-300">saíram para uma prova e ainda não tiveram o retorno registrado</strong>.
        Confira o que voltou e dê entrada — o que não for marcado continua aqui.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Indicador titulo="Em campo" valor={lista?.length ?? 0} cor="text-sky-300" />
        <Indicador titulo="Provas com pendência" valor={grupos.length} />
        <Indicador titulo="De provas que já passaram" valor={atrasados} cor={atrasados ? "text-amber-300" : "text-white"} />
      </div>

      {erro && <Aviso tipo="erro" texto={erro} onFechar={() => setErro("")} />}
      {ok && <Aviso tipo="ok" texto={ok} onFechar={() => setOk("")} />}

      {grupos.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-6 text-sm text-slate-400">✓ Nenhum equipamento pendente de retorno.</div>
      ) : (
        grupos.map((g) => (
          <section key={g.chave} className={`bg-slate-800 rounded-xl overflow-hidden border ${g.atrasada ? "border-amber-500/40" : "border-transparent"}`}>
            <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">
                  {g.eventoId ? (
                    <Link href={`/eventos/${g.eventoId}/equipamentos`} className="hover:underline">
                      {g.titulo}
                    </Link>
                  ) : (
                    g.titulo
                  )}
                </h2>
                <p className="text-xs text-slate-400">
                  {g.data ? `Prova em ${g.data} · ` : ""}
                  {g.itens.length} aparelho(s) em campo
                </p>
              </div>
              {g.atrasada && (
                <span className="text-xs rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2 py-0.5 self-start">
                  {g.eventoId ? "Prova já passou" : "Prova removida do Gestão"}
                </span>
              )}
            </div>
            <ConferenciaRetorno
              itens={g.itens}
              onConcluido={async (msg) => {
                setOk(msg);
                await carregar();
              }}
            />
          </section>
        ))
      )}

      <div className="pt-2">
        <h2 className="text-lg font-semibold">Acessórios a conferir</h2>
        <p className="text-slate-400 text-sm">
          Extensão, régua, mouse… (por quantidade, do card Produtos). Digite quantos voltaram de cada prova; o que faltou
          pode ser descontado do estoque da base.
        </p>
      </div>
      {acessorios.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-6 text-sm text-slate-400">✓ Nenhum acessório a conferir.</div>
      ) : (
        acessorios.map((p) => (
          <ConferenciaAcessorios
            key={p.evento_id}
            prova={p}
            onConcluido={async (msg) => {
              setOk(msg);
              await carregar();
            }}
          />
        ))
      )}
    </div>
  );
}
