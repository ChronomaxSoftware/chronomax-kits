/**
 * TXT da semana com os técnicos de cada prova e o início da entrega (dia + horário),
 * uma prova embaixo da outra, em blocos bem visíveis.
 */

import { formatBR, parseDataBR } from "./semana";

export type EventoTecnicos = {
  numero: string;
  nome: string;
  data: string;
  cidade: string | null;
  uf: string | null;
  data_entrega: string | null;
  hora_entrega: string | null;
  tecnicos: { nome: string }[];
};

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const LINHA = "------------------------------";
const DUPLA = "==============================";

/** Início da entrega: data_entrega (ou a data da prova, sinalizada) + hora. */
export function inicioEntrega(e: EventoTecnicos): { data: Date | null; texto: string } {
  const entrega = parseDataBR(e.data_entrega);
  const data = entrega ?? parseDataBR(e.data);
  const hora = (e.hora_entrega || "").trim();
  const dia = data ? `${formatBR(data)} (${DIAS[data.getDay()]})` : "data a definir";
  const aviso = !entrega && data ? " (data da prova)" : "";
  return { data, texto: `${dia}${aviso} ${hora ? `às ${hora}` : "· horário a definir"}` };
}

export function textoTecnicosSemana(inicio: Date, fim: Date, eventos: EventoTecnicos[]): string {
  const linhas = [DUPLA, `SEMANA ${formatBR(inicio)} a ${formatBR(fim)}`, DUPLA, ""];
  if (eventos.length === 0) {
    linhas.push("Nenhuma prova nesta semana.");
    return linhas.join("\n");
  }

  const ordenados = eventos
    .map((e) => {
      const ini = inicioEntrega(e);
      const [h, m] = (e.hora_entrega || "").split(":").map(Number);
      const t = ini.data ? ini.data.getTime() + ((h || 0) * 60 + (m || 0)) * 60_000 : Infinity;
      return { e, ini, t };
    })
    .sort((a, b) => a.t - b.t);

  for (const { e, ini } of ordenados) {
    const local = [e.cidade, e.uf].filter(Boolean).join("/");
    linhas.push(LINHA, `${e.nome.toUpperCase()} (#${e.numero})`);
    if (local) linhas.push(local);
    linhas.push(LINHA, `INÍCIO: ${ini.texto}`, "", "TÉCNICOS:");
    if (e.tecnicos.length === 0) linhas.push("  • (sem técnico)");
    else for (const t of e.tecnicos) linhas.push(`  • ${t.nome}`);
    linhas.push("");
  }
  return linhas.join("\n");
}
