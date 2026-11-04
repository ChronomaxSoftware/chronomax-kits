import { describe, expect, it } from "vitest";
import { enderecoRetiradaBook, equipamentosBook, itensEquipamentosBook } from "./book-equipamentos";

const produtos = [
  { nome: "Celular", quantidade: 10 },
  { nome: "Roteador", quantidade: 2 },
  { nome: "Totem", quantidade: 1 },
  { nome: "Notebook", quantidade: 3 },
  { nome: "Carregador", quantidade: 8 },
  { nome: "Régua de energia", quantidade: 4 },
];

describe("equipamentosBook", () => {
  it("puxa do Produtos e tira os online dos celulares número", () => {
    const e = equipamentosBook(produtos, { qtd_celulares_grupo_online: 1, qtd_celulares_produtos_online: 2 });
    expect(e).toMatchObject({
      roteadores: 2,
      celulares_total: 10,
      celulares_numero: 7,
      celulares_grupo_online: 1,
      celulares_produtos_online: 2,
      totens: 1,
      notebooks: 3,
      online_excede: false,
    });
  });

  it("soma produtos do mesmo tipo e ignora o que não é equipamento", () => {
    const e = equipamentosBook(
      [
        { nome: "Celular", quantidade: 4 },
        { nome: "Celular reserva", quantidade: 1 },
        { nome: "Extensão", quantidade: 9 },
      ],
      {}
    );
    expect(e.celulares_total).toBe(5);
    expect(e.celulares_numero).toBe(5);
    expect(e.roteadores).toBe(0);
  });

  it("online maior que o total: número fica 0 e avisa", () => {
    const e = equipamentosBook([{ nome: "Celular", quantidade: 2 }], { qtd_celulares_grupo_online: 2, qtd_celulares_produtos_online: 1 });
    expect(e.celulares_numero).toBe(0);
    expect(e.online_excede).toBe(true);
  });

  it("itens só com quantidade, na ordem do book", () => {
    const e = equipamentosBook(produtos, { qtd_celulares_grupo_online: 1 });
    expect(itensEquipamentosBook(e)).toEqual([
      { nome: "Roteadores", quantidade: 2 },
      { nome: "Celulares número", quantidade: 9 },
      { nome: "Celular grupo online", quantidade: 1 },
      { nome: "Totens", quantidade: 1 },
      { nome: "Notebooks", quantidade: 3 },
    ]);
    expect(itensEquipamentosBook(equipamentosBook([], {}))).toEqual([]);
  });
});

describe("enderecoRetiradaBook", () => {
  it("preenchido vence; vazio usa o Local de entrega", () => {
    expect(enderecoRetiradaBook("Shopping X", "Loja Y")).toBe("Shopping X");
    expect(enderecoRetiradaBook("  ", "Loja Y")).toBe("Loja Y");
    expect(enderecoRetiradaBook(null, null)).toBe("");
  });
});
