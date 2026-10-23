import { describe, expect, it } from "vitest";
import { quantidadesNota, textoNotaFiscalSemana, type EventoNota } from "./nota-fiscal";

const ev = (o: Partial<EventoNota>): EventoNota => ({
  numero: "1",
  nome: "Prova",
  data: "01/11/2026",
  cidade: "Porto Alegre",
  uf: "RS",
  tecnicos: [],
  produtos: [],
  ...o,
});

describe("quantidadesNota", () => {
  it("soma produtos do mesmo tipo e ignora os que não são equipamento ou têm qtd 0", () => {
    const q = quantidadesNota([
      { nome: "Celular", quantidade: 3 },
      { nome: "Celular reserva", quantidade: 2 },
      { nome: "Carregador", quantidade: 5 },
      { nome: "Roteador", quantidade: 0 },
    ]);
    expect([...q]).toEqual([["Celular", 5]]);
  });
});

describe("textoNotaFiscalSemana", () => {
  const ini = new Date(2026, 9, 26);
  const fim = new Date(2026, 10, 1);

  it("lista técnico, prova e só os itens que vão, com os nomes da nota e total", () => {
    const txt = textoNotaFiscalSemana(ini, fim, [
      ev({
        numero: "20",
        nome: "Corrida B",
        data: "01/11/2026",
        cidade: "São Paulo",
        uf: "SP",
        tecnicos: [{ nome: "Maria" }],
        produtos: [
          { nome: "Celular", quantidade: 2 },
          { nome: "Tablet", quantidade: 1 },
        ],
      }),
      ev({
        numero: "10",
        nome: "Maratona A",
        data: "31/10/2026",
        tecnicos: [{ nome: "João" }, { nome: "Ana" }],
        produtos: [
          { nome: "Celular", quantidade: 5 },
          { nome: "Totem", quantidade: 1 },
          { nome: "Extensão", quantidade: 4 },
        ],
      }),
      ev({ nome: "Sem equipamento", tecnicos: [{ nome: "Zé" }], produtos: [{ nome: "Mouse", quantidade: 2 }] }),
    ]);
    expect(txt).toBe(
      [
        "NOTA FISCAL — Semana 26/10/2026 a 01/11/2026",
        "",
        "Técnico: João, Ana",
        "Prova: Maratona A (#10) — 31/10/2026 — Porto Alegre/RS",
        "Celular Motorola: 5",
        "Totem Sunmi: 1",
        "",
        "Técnico: Maria",
        "Prova: Corrida B (#20) — 01/11/2026 — São Paulo/SP",
        "Celular Motorola: 2",
        "Tablet Positivo: 1",
        "",
        "TOTAL DA SEMANA",
        "Celular Motorola: 7",
        "Tablet Positivo: 1",
        "Totem Sunmi: 1",
        "",
      ].join("\n")
    );
  });

  it("marca prova sem técnico e avisa quando nada vai", () => {
    expect(textoNotaFiscalSemana(ini, fim, [ev({ produtos: [{ nome: "Roteador", quantidade: 1 }] })])).toContain(
      "Técnico: (sem técnico)"
    );
    expect(textoNotaFiscalSemana(ini, fim, [ev({})])).toContain("Nenhuma prova desta semana");
  });
});
