"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseDataBR } from "@/lib/semana";
import ConferenciaRetorno, { ItemEmCampo } from "@/components/equipamentos/ConferenciaRetorno";
import ConferenciaAcessorios, { type ProvaAcessoriosTela } from "@/components/equipamentos/ConferenciaAcessorios";
import { Aviso, Indicador } from "@/components/equipamentos/ui";

type Pendente = ItemEmCampo & { evento_id: number | null; evento_data: string | null; evento_numero: string | null };

/** Uma prova = um card: aparelhos com patrimônio + demais materiais (por quantidade). */
type Grupo = {
  chave: string;
  eventoId: number | null;
  titulo: string;
  data: string | null;
  atrasada: boolean;
  aparelhos: Pendente[];
  acessorios: ProvaAcessoriosTela | null;
};

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

  // Agrupa tudo por prova; prova que já passou (ou foi removida) com material fora = atrasada
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
          aparelhos: [],
          acessorios: null,
        });
      }
      mapa.get(chave)!.aparelhos.push(p);
    }
    for (const a of acessorios) {
      const chave = `ev-${a.evento_id}`;
      const g = mapa.get(chave);
      if (g) {
        g.acessorios = a;
        g.atrasada = g.atrasada || a.atrasada;
      } else {
        mapa.set(chave, {
          chave,
          eventoId: a.evento_id,
          titulo: `#${a.numero} · ${a.nome}`,
          data: a.data,
          atrasada: a.atrasada,
          aparelhos: [],
          acessorios: a,
        });
      }
    }
    return [...mapa.values()].sort(
      (a, b) =>
        Number(b.atrasada) - Number(a.atrasada) ||
        (parseDataBR(a.data)?.getTime() ?? 0) - (parseDataBR(b.data)?.getTime() ?? 0)
    );
  }, [lista, acessorios]);

  if (lista === null && !erro) return <p className="text-slate-400">Carregando…</p>;

  const totalAparelhos = lista?.length ?? 0;
  const totalMateriais = acessorios.reduce((s, a) => s + a.itens.reduce((t, i) => t + i.quantidade, 0), 0);
  const provasAtrasadas = grupos.filter((g) => g.atrasada).length;

  const concluir = async (msg: string) => {
    setOk(msg);
    await carregar();
  };

  return (
    <div className="space-y-6">
      <p className="text-slate-400 text-sm">
        Tudo que <strong className="text-slate-300">saiu para uma prova e ainda não teve o retorno registrado</strong>: aparelhos
        com patrimônio e os demais materiais (carregador, extensão, régua, mouse, equipamento sem patrimônio…). Confira o que
        voltou e dê entrada — o que não for registrado continua aqui.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Indicador titulo="Provas com pendência" valor={grupos.length} />
        <Indicador titulo="Aparelhos com patrimônio" valor={totalAparelhos} cor="text-sky-300" />
        <Indicador titulo="Demais materiais (itens)" valor={totalMateriais} cor="text-sky-300" />
        <Indicador titulo="Provas que já passaram" valor={provasAtrasadas} cor={provasAtrasadas ? "text-amber-300" : "text-white"} />
      </div>

      {erro && <Aviso tipo="erro" texto={erro} onFechar={() => setErro("")} />}
      {ok && <Aviso tipo="ok" texto={ok} onFechar={() => setOk("")} />}

      {grupos.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-6 text-sm text-slate-400">✓ Nenhum material pendente de retorno.</div>
      ) : (
        grupos.map((g) => (
          <section
            key={g.chave}
            className={`bg-slate-800 rounded-xl overflow-hidden border ${g.atrasada ? "border-amber-500/40" : "border-transparent"}`}
          >
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
                  {g.data ? `Prova em ${g.data}` : ""}
                  {g.aparelhos.length > 0 && ` · ${g.aparelhos.length} aparelho(s) com patrimônio`}
                  {g.acessorios && ` · ${g.acessorios.itens.length} outro(s) material(is)`}
                  {g.acessorios?.base ? ` · base: ${g.acessorios.base.nome}` : ""}
                </p>
              </div>
              {g.atrasada && (
                <span className="text-xs rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2 py-0.5 self-start">
                  {g.eventoId ? "Prova já passou" : "Prova removida do Gestão"}
                </span>
              )}
            </div>

            {g.aparelhos.length > 0 && (
              <div>
                <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  📱 Aparelhos com patrimônio ({g.aparelhos.length})
                </p>
                <ConferenciaRetorno itens={g.aparelhos} onConcluido={concluir} />
              </div>
            )}

            {g.acessorios && (
              <div className={g.aparelhos.length > 0 ? "border-t-4 border-slate-900" : ""}>
                <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  📦 Demais materiais ({g.acessorios.itens.length})
                </p>
                <ConferenciaAcessorios prova={g.acessorios} onConcluido={concluir} embutido />
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
