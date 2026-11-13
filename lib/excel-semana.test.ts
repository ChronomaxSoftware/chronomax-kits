import { describe, expect, it } from "vitest";
import { convocadosDaProva, limparNome, montarLinhas, resumoPorProva } from "./excel-semana";

describe("limparNome", () => {
  it("tira o CPF da frente do nome", () => {
    expect(limparNome("65.080.948 DANIEL SANTOS")).toBe("DANIEL SANTOS");
    expect(limparNome("MARIA")).toBe("MARIA");
  });
});

describe("convocadosDaProva", () => {
  it("não repete a mesma pessoa (CPF ou nome) e completa a função", () => {
    const r = convocadosDaProva([
      { evento_id: 1, nome: "65.080.948 DANIEL SANTOS", funcao: "apurador", cpf_prefixo: "65.080.948" },
      { evento_id: 1, nome: "Daniel Santos", funcao: null, cpf_prefixo: null },
      { evento_id: 1, nome: "ANA", funcao: null, cpf_prefixo: "11.111.111" },
      { evento_id: 1, nome: "ANA PAULA", funcao: "staff", cpf_prefixo: "11.111.111" },
    ]);
    expect(r.map((c) => [c.nome, c.funcao])).toEqual([
      ["DANIEL SANTOS", "apurador"],
      ["ANA", "staff"],
    ]);
  });
});

describe("montarLinhas", () => {
  const provas = [
    { id: 2, numero: "20", nome: "Corrida B", data: "15/11/2026", cidade: "São Paulo", uf: "SP" },
    { id: 1, numero: "10", nome: "Maratona A", data: "14/11/2026", cidade: "Porto Alegre", uf: "RS" },
  ];
  const cadastro = [
    { nome: "DANIEL SANTOS", cpf_prefixo: "650.809.480", telefone: "51999990000", cpf: "65080948012" },
    { nome: "Maria", cpf_prefixo: null, telefone: null, cpf: null },
  ];

  it("ordena por data, uma linha por convocado, telefone e CPF do cadastro; prova sem ninguém aparece", () => {
    const l = montarLinhas(
      provas,
      [
        { evento_id: 1, nome: "Maria", funcao: "técnico", cpf_prefixo: null },
        { evento_id: 1, nome: "DANIEL SANTOS", funcao: null, cpf_prefixo: "650.809.480" },
      ],
      cadastro
    );
    expect(l.map((x) => [x.data, x.prova, x.nome, x.telefone, x.cpf])).toEqual([
      ["14/11/2026", "Maratona A", "DANIEL SANTOS", "51999990000", "650.809.480-12"],
      ["14/11/2026", "Maratona A", "Maria", "", "não cadastrado"],
      ["15/11/2026", "Corrida B", "(sem convocados)", "", ""],
    ]);
    expect(l[0].local).toBe("Porto Alegre/RS");
    const r = resumoPorProva(l);
    expect(r.map((x) => [x.prova, x.quantidade, x.nomes])).toEqual([
      ["Maratona A", 2, "DANIEL SANTOS, Maria"],
      ["Corrida B", 0, ""],
    ]);
  });
});
