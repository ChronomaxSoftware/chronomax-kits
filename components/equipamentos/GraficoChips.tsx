"use client";

import { resumoChips } from "@/lib/equipamentos";

// Validadas no fundo escuro (slate-800); cada quantidade também vai em texto
const SEGMENTOS = [
  { chave: "emUso", rotulo: "Com chip — em uso (separado/em campo)", cor: "#3b82f6" },
  { chave: "livres", rotulo: "Com chip — livre no estoque", cor: "#059669" },
  { chave: "manutencao", rotulo: "Com chip — manutenção", cor: "#d97706" },
  { chave: "semChip", rotulo: "Sem chip", cor: "#64748b" },
] as const;

/** Controle dos chips: quantos celulares têm chip e quantos desses estão em uso. */
export default function GraficoChips({
  equipamentos,
}: {
  equipamentos: { tipo: string; status: string; numero_chip?: string | null; operadora?: string | null }[];
}) {
  const r = resumoChips(equipamentos);
  if (r.celulares === 0) return null;
  const resumo = `${r.celulares} celulares: ${r.comChip} com chip (${r.emUso} em uso, ${r.livres} livres, ${r.manutencao} em manutenção) e ${r.semChip} sem chip`;
  return (
    <section className="bg-slate-800 rounded-xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-3">
        <div>
          <h2 className="font-semibold text-white">📶 Chips dos celulares</h2>
          <p className="text-xs text-slate-400">
            Tem chip = operadora ou número cadastrado no patrimônio. Em uso = separado para prova ou em campo.
          </p>
        </div>
        <p className="text-sm text-slate-300">
          <strong className="text-white text-lg">{r.comChip}</strong> de {r.celulares} com chip ·{" "}
          <strong className="text-sky-300">{r.emUso}</strong> em uso ·{" "}
          <strong className="text-emerald-300">{r.livres}</strong> livres
        </p>
      </div>
      <div role="img" aria-label={resumo} className="flex h-5 w-full gap-0.5 rounded bg-slate-900/60 overflow-hidden">
        {SEGMENTOS.map((s) => {
          const v = r[s.chave];
          if (!v) return null;
          return (
            <div
              key={s.chave}
              title={`${s.rotulo}: ${v}`}
              style={{ width: `${(v / r.celulares) * 100}%`, backgroundColor: s.cor }}
              className="h-full"
            />
          );
        })}
      </div>
      <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-300">
        {SEGMENTOS.map((s) => (
          <li key={s.chave} className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.cor }} aria-hidden="true" />
              {s.rotulo}
            </span>
            <strong className="text-white">{r[s.chave]}</strong>
          </li>
        ))}
      </ul>
      {r.semChip > 0 && (
        <p className="mt-2 text-[11px] text-slate-500">
          Celular com chip mas sem operadora e sem número aparece como &quot;sem chip&quot; — preencha a operadora no patrimônio.
        </p>
      )}
    </section>
  );
}
