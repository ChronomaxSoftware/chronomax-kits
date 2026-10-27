import { describe, expect, it } from "vitest";
import { textoSeparacao, ufsDasProvas, type EventoSeparacao } from "./txt-separacao";

const ev = (o: Partial<EventoSeparacao>): EventoSeparacao => ({
  numero: "1",
  nome: "Prova",
  data: "01/11/2026",
  cidade: null,
  uf: null,
  local_entrega: null,
  data_entrega: null,
  hora_entrega: null,
  tecnicos: [],
  produtos: [],
  ...o,
});

const ini = new Date(2026, 9, 26);
const fim = new Date(2026, 10, 1);

describe("ufsDasProvas", () => {
  it("únicas, maiúsculas, ordenadas e sem vazias", () => {
    expect(ufsDasProvas([{ uf: "sp" }, { uf: "RJ" }, { uf: null }, { uf: "SP" }, { uf: " " }])).toEqual(["RJ", "SP"]);
  });
});

describe("textoSeparacao", () => {
  it("lista itens > 0 por prova, em ordem de data, e soma o total", () => {
    const t = textoSeparacao(ini, fim, [
      ev({
        numero: "2",
        nome: "Corrida B",
        data: "02/11/2026",
        uf: "RJ",
        cidade: "Rio de Janeiro",
        tecnicos: [{ nome: "Ana" }],
        produtos: [
          { nome: "Celular", quantidade: 3 },
          { nome: "Mouse", quantidade: 0 },
        ],
      }),
      ev({
        numero: "1",
        nome: "Corrida A",
        local_entrega: "Shopping X",
        data_entrega: "31/10/2026",
        hora_entrega: "10:00",
        produtos: [
          { nome: "Celular", quantidade: 2 },
          { nome: "Extensão", quantidade: 1 },
        ],
      }),
    ]);
    expect(t.indexOf("Corrida A")).toBeLessThan(t.indexOf("Corrida B"));
    expect(t).toContain("PROVA: Corrida B (#2) — 02/11/2026 — Rio de Janeiro/RJ");
    expect(t).toContain("Técnico: Ana");
    expect(t).toContain("Técnico: (sem técnico)");
    expect(t).toContain("Entrega: Shopping X · 31/10/2026 10:00");
    expect(t).not.toContain("Mouse");
    const total = t.slice(t.indexOf("TOTAL A SEPARAR (2 provas)"));
    expect(total).toContain("- Celular: 5");
    expect(total).toContain("- Extensão: 1");
  });

  it("sem provas selecionadas", () => {
    expect(textoSeparacao(ini, fim, [])).toContain("Nenhuma prova selecionada.");
  });

  it("prova sem itens avisa", () => {
    expect(textoSeparacao(ini, fim, [ev({})])).toContain("(nenhum item no card Produtos)");
  });
});
