import { describe, expect, it } from "vitest";
import { inicioEntrega, textoTecnicosSemana, type EventoTecnicos } from "./txt-tecnicos";

const ev = (o: Partial<EventoTecnicos>): EventoTecnicos => ({
  numero: "1",
  nome: "Prova",
  data: "01/11/2026",
  cidade: "Porto Alegre",
  uf: "RS",
  data_entrega: null,
  hora_entrega: null,
  tecnicos: [],
  ...o,
});

describe("inicioEntrega", () => {
  it("usa data/hora da entrega", () => {
    expect(inicioEntrega(ev({ data_entrega: "2026-10-30", hora_entrega: "08:00" })).texto).toBe(
      "30/10/2026 (sexta) às 08:00"
    );
  });
  it("sem data de entrega usa a da prova sinalizada; sem hora avisa", () => {
    expect(inicioEntrega(ev({})).texto).toBe("01/11/2026 (domingo) (data da prova) · horário a definir");
  });
});

describe("textoTecnicosSemana", () => {
  it("ordena pelo início e lista técnicos um embaixo do outro", () => {
    const txt = textoTecnicosSemana(new Date(2026, 9, 26), new Date(2026, 10, 1), [
      ev({ numero: "20", nome: "Corrida B", data_entrega: "2026-10-31", hora_entrega: "07:00", tecnicos: [{ nome: "Maria" }] }),
      ev({ numero: "10", nome: "Maratona A", data_entrega: "2026-10-30", hora_entrega: "08:00", tecnicos: [{ nome: "João" }, { nome: "Ana" }] }),
      ev({ numero: "30", nome: "Sem técnico", data_entrega: "2026-10-31", hora_entrega: "09:00", cidade: null, uf: null }),
    ]);
    expect(txt).toBe(
      [
        "==============================",
        "SEMANA 26/10/2026 a 01/11/2026",
        "==============================",
        "",
        "------------------------------",
        "MARATONA A (#10)",
        "Porto Alegre/RS",
        "------------------------------",
        "INÍCIO: 30/10/2026 (sexta) às 08:00",
        "",
        "TÉCNICOS:",
        "  • João",
        "  • Ana",
        "",
        "------------------------------",
        "CORRIDA B (#20)",
        "Porto Alegre/RS",
        "------------------------------",
        "INÍCIO: 31/10/2026 (sábado) às 07:00",
        "",
        "TÉCNICOS:",
        "  • Maria",
        "",
        "------------------------------",
        "SEM TÉCNICO (#30)",
        "------------------------------",
        "INÍCIO: 31/10/2026 (sábado) às 09:00",
        "",
        "TÉCNICOS:",
        "  • (sem técnico)",
        "",
      ].join("\n")
    );
  });
});
