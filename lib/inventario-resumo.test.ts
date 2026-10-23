import { describe, expect, it } from "vitest";
import { contagemPorBase, resumoInventario } from "./inventario-resumo";

const bases = [
  { id: 1, uf: "RS" },
  { id: 2, uf: "SP" },
];
const equip = [
  { tipo: "Celular", status: "disponivel", base_id: 1 },
  { tipo: "Celular", status: "alocado", base_id: 1 },
  { tipo: "Celular", status: "em_campo", base_id: 2 },
  { tipo: "Celular", status: "manutencao", base_id: 1 },
  { tipo: "Roteador", status: "disponivel", base_id: null },
];
const eventos = [
  { data: "28/10/2026", uf: "RS", produtos: [{ nome: "Celular", quantidade: 3 }, { nome: "Extensão", quantidade: 2 }] },
  { data: "30/10/2026", uf: "SP", produtos: [{ nome: "Celular", quantidade: 1 }] },
  { data: "31/10/2026", uf: "BA", produtos: [{ nome: "Roteador", quantidade: 1 }] },
  { data: "05/11/2026", uf: "RS", produtos: [{ nome: "Celular", quantidade: 9 }] }, // outra semana
];
const semana = new Date(2026, 9, 26);

describe("resumoInventario", () => {
  it("todas as bases", () => {
    expect(resumoInventario(equip, eventos, bases, "todas", semana)).toEqual([
      { tipo: "Celular", total: 4, alocado: 2, manutencao: 1, disponivel: 1, pedido: 4 },
      { tipo: "Roteador", total: 1, alocado: 0, manutencao: 0, disponivel: 1, pedido: 1 },
    ]);
  });

  it("filtra por base (patrimônios pela base, provas pela UF)", () => {
    expect(resumoInventario(equip, eventos, bases, 1, semana)).toEqual([
      { tipo: "Celular", total: 3, alocado: 1, manutencao: 1, disponivel: 1, pedido: 3 },
    ]);
  });

  it("sem base: patrimônio sem base e provas de UF sem base", () => {
    expect(resumoInventario(equip, eventos, bases, "sem_base", semana)).toEqual([
      { tipo: "Roteador", total: 1, alocado: 0, manutencao: 0, disponivel: 1, pedido: 1 },
    ]);
  });
});

describe("contagemPorBase", () => {
  it("conta por base e tipo, sem manutenção e sem base", () => {
    expect([...contagemPorBase(equip)]).toEqual([
      ["1:Celular", 2],
      ["2:Celular", 1],
    ]);
  });
});
