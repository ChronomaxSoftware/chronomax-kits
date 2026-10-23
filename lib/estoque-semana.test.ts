import { describe, expect, it } from "vitest";
import { estoqueDaSemana } from "./estoque-semana";

describe("estoqueDaSemana", () => {
  const produtos = [
    { id: 1, nome: "Mouse", quantidade_estoque: 10 },
    { id: 2, nome: "Extensão", quantidade_estoque: 10 },
    { id: 3, nome: "Celular", quantidade_estoque: 50 },
    { id: 4, nome: "Carregador", quantidade_estoque: 0 },
  ];
  const eventos = [
    { data: "28/10/2026", produtos: [{ id: 2, quantidade: 4 }, { id: 3, quantidade: 30 }] },
    { data: "01/11/2026", produtos: [{ id: 2, quantidade: 2 }, { id: 3, quantidade: 22 }] },
    { data: "05/11/2026", produtos: [{ id: 1, quantidade: 9 }] }, // outra semana
  ];

  it("soma só as provas da semana e calcula disponível e falta", () => {
    expect(estoqueDaSemana(produtos, eventos, new Date(2026, 9, 26))).toEqual([
      { id: 3, nome: "Celular", total: 50, alocado: 52, disponivel: 0, falta: 2 },
      { id: 2, nome: "Extensão", total: 10, alocado: 6, disponivel: 4, falta: 0 },
      { id: 1, nome: "Mouse", total: 10, alocado: 0, disponivel: 10, falta: 0 },
    ]);
  });

  it("produto sem estoque mas alocado aparece como falta", () => {
    const l = estoqueDaSemana(produtos, [{ data: "27/10/2026", produtos: [{ id: 4, quantidade: 3 }] }], new Date(2026, 9, 26));
    expect(l.find((x) => x.id === 4)).toEqual({ id: 4, nome: "Carregador", total: 0, alocado: 3, disponivel: 0, falta: 3 });
  });
});
