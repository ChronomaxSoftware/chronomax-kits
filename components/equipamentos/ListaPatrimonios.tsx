import { infoChip } from "@/lib/equipamentos";

export type PatrimonioItem = {
  tipo: string;
  patrimonio: string;
  numero_chip?: string | null;
  operadora?: string | null;
  status?: string;
};

const ICONE: Record<string, string> = { Celular: "📱", Tablet: "📱", Roteador: "📡", Notebook: "💻", Totem: "🖥️" };

/** "📶 Vivo · (11) 93066-0118" / "🚫 Sem chip" (nada para tablet/notebook). */
export function SeloChip({ e, compacto = false }: { e: PatrimonioItem; compacto?: boolean }) {
  const c = infoChip(e);
  if (c.temChip === null) return null;
  return c.temChip ? (
    <span className={`text-emerald-300 ${compacto ? "text-[11px]" : "text-xs"}`}>📶 {c.rotulo}</span>
  ) : (
    <span className={`text-amber-300 ${compacto ? "text-[11px]" : "text-xs"}`}>🚫 Sem chip</span>
  );
}

/**
 * Patrimônios dentro da linha do produto (portal do técnico e aba Envios): número em
 * destaque + chip; avisa quando a quantidade pedida é maior que o separado.
 */
export default function ListaPatrimonios({ lista, quantidade }: { lista: PatrimonioItem[]; quantidade?: number }) {
  const falta = quantidade !== undefined ? Math.max(0, quantidade - lista.length) : 0;
  if (lista.length === 0 && falta === 0) return null;
  return (
    <ul className="mt-1.5 space-y-0.5">
      {lista.map((e) => (
        <li key={`${e.tipo}-${e.patrimonio}`} className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-300">
          <span>
            {ICONE[e.tipo] ?? "🔧"} <span className="font-mono font-semibold text-white text-sm">{e.patrimonio}</span>
          </span>
          <SeloChip e={e} />
          {e.status === "em_campo" && <span className="text-[11px] text-sky-300">em campo</span>}
        </li>
      ))}
      {falta > 0 && (
        <li className="text-xs text-amber-300">
          ⚠️ {falta} sem patrimônio separado{lista.length === 0 ? " ainda" : ""}
        </li>
      )}
    </ul>
  );
}
