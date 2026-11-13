/**
 * Planilha de apuradores da semana: uma linha por prova com cliente, apurador(es),
 * se tem entrega de kit (EK) e quem faz a EK. Provas sem apurador também entram.
 */
import { parseDataBR } from "./semana";
import { convocadosDaProva, type ConvocadoBruto } from "./excel-semana";

export type ProvaApurador = {
  id: number;
  numero: string;
  nome: string;
  data: string;
  cidade: string | null;
  uf: string | null;
  cliente: string | null;
  tipo_kit: string | null;
};
export type EquipeApurador = ConvocadoBruto & { cache_ek: number | null };

export type LinhaApurador = {
  data: string;
  numero: string;
  prova: string;
  cliente: string;
  local: string;
  apurador: string;
  tem_ek: string;
  quem_ek: string;
  obs: string;
  sem_apurador: boolean;
};

/** "CAIO ... 38913423812" → sem o CPF grudado no fim do nome. */
export function semCpfNoFim(nome: string): string {
  return nome.replace(/\s+\d{11}\s*$/, "").trim();
}

export function rotuloEk(tipoKit: string | null): string {
  if (tipoKit === "entrega") return "Sim";
  if (tipoKit === "sistema") return "Só sistema (app)";
  return "Não";
}

export function montarLinhasApuradores(
  provas: ProvaApurador[],
  equipe: EquipeApurador[],
  atribuidos: ConvocadoBruto[]
): LinhaApurador[] {
  const ordenadas = [...provas].sort(
    (a, b) =>
      (parseDataBR(a.data)?.getTime() ?? Infinity) - (parseDataBR(b.data)?.getTime() ?? Infinity) ||
      a.nome.trim().localeCompare(b.nome.trim(), "pt-BR")
  );

  const linhas = ordenadas.map((p) => {
    const daProva = equipe.filter((e) => Number(e.evento_id) === Number(p.id));
    const apuradores = convocadosDaProva(daProva.filter((e) => /apura/i.test(e.funcao || ""))).map((c) => semCpfNoFim(c.nome));
    let ek = convocadosDaProva(daProva.filter((e) => Number(e.cache_ek) > 0)).map((c) => semCpfNoFim(c.nome));
    if (ek.length === 0 && p.tipo_kit === "entrega") {
      ek = convocadosDaProva(atribuidos.filter((a) => Number(a.evento_id) === Number(p.id))).map((c) => semCpfNoFim(c.nome));
    }
    return {
      data: p.data || "",
      numero: String(p.numero ?? ""),
      prova: p.nome.trim(),
      cliente: (p.cliente || "").trim(),
      local: [p.cidade, p.uf].filter(Boolean).join("/"),
      apurador: apuradores.join(", ") || "SEM APURADOR",
      tem_ek: rotuloEk(p.tipo_kit),
      quem_ek: ek.join(", ") || (p.tipo_kit === "entrega" ? "ninguém escalado" : ""),
      obs: apuradores.length ? "" : "Sem apurador convocado no Gestão",
      sem_apurador: apuradores.length === 0,
      _apuradores: apuradores,
    };
  });

  // apurador escalado em mais de uma prova na semana
  const vezes = new Map<string, number>();
  for (const l of linhas) for (const a of l._apuradores) vezes.set(a, (vezes.get(a) || 0) + 1);
  return linhas.map(({ _apuradores, ...l }) => {
    const repetido = _apuradores.find((a) => (vezes.get(a) || 0) > 1);
    return repetido ? { ...l, obs: `${repetido.split(" ")[0]} em ${vezes.get(repetido)} provas na semana` } : l;
  });
}
