import { describe, expect, it } from "vitest";
import {
  formatarNumeroChip,
  infoChip,
  patrimoniosPorProduto,
  resumoChips,
  ehErroPatrimonioDuplicado,
  idOuNull,
  lerIdsLote,
  lerItensRetorno,
  normalizarPatrimonio,
  tipoDeProduto,
  validarCadastro,
} from "./equipamentos";

describe("normalizarPatrimonio", () => {
  it("apara, colapsa espaços e põe em maiúsculas", () => {
    expect(normalizarPatrimonio("  ch-001   024 ")).toBe("CH-001 024");
    expect(normalizarPatrimonio(null)).toBe("");
  });
});

describe("idOuNull", () => {
  it("aceita só inteiros positivos", () => {
    expect(idOuNull("12")).toBe(12);
    expect(idOuNull(3)).toBe(3);
    for (const v of ["", null, undefined, 0, -1, "1.5", "abc"]) expect(idOuNull(v)).toBeNull();
  });
});

describe("validarCadastro", () => {
  it("cadastro mínimo válido", () => {
    const r = validarCadastro({ tipo: "Notebook", patrimonio: "nb-01" });
    expect(r).toEqual({
      ok: true,
      dados: {
        tipo: "Notebook",
        patrimonio: "NB-01",
        numero_chip: null,
        operadora: null,
        numero_serie: null,
        base_id: null,
        status: "disponivel",
        observacao: null,
      },
    });
  });

  it("rejeita tipo desconhecido e patrimônio vazio", () => {
    expect(validarCadastro({ tipo: "Geladeira", patrimonio: "X" }).ok).toBe(false);
    expect(validarCadastro({ tipo: "Celular", patrimonio: "   " }).ok).toBe(false);
  });

  it("rejeita status inventado; 'alocado' vira disponivel (alocação não é escolhida à mão)", () => {
    expect(validarCadastro({ tipo: "Celular", patrimonio: "C1", status: "roubado" }).ok).toBe(false);
    const r = validarCadastro({ tipo: "Celular", patrimonio: "C1", status: "alocado" });
    expect(r.ok && r.dados.status).toBe("disponivel");
  });

  it("chip/operadora só ficam para Celular e Roteador", () => {
    const cel = validarCadastro({ tipo: "Celular", patrimonio: "C1", numero_chip: "51999990000", operadora: "Vivo" });
    expect(cel.ok && cel.dados.numero_chip).toBe("51999990000");
    const nb = validarCadastro({ tipo: "Notebook", patrimonio: "N1", numero_chip: "51999990000", operadora: "Vivo" });
    expect(nb.ok && [nb.dados.numero_chip, nb.dados.operadora]).toEqual([null, null]);
  });

  it("base inválida é erro, base vazia é null", () => {
    expect(validarCadastro({ tipo: "Totem", patrimonio: "T1", base_id: "abc" }).ok).toBe(false);
    const r = validarCadastro({ tipo: "Totem", patrimonio: "T1", base_id: "" });
    expect(r.ok && r.dados.base_id).toBeNull();
  });
});

describe("lerIdsLote", () => {
  it("aceita lista ou id único, remove repetidos", () => {
    expect(lerIdsLote({ equipamento_ids: [3, "3", 4] })).toEqual([3, 4]);
    expect(lerIdsLote({ equipamento_id: 7 })).toEqual([7]);
  });
  it("rejeita lote vazio ou com id inválido", () => {
    expect(lerIdsLote({ equipamento_ids: [] })).toBeNull();
    expect(lerIdsLote({ equipamento_ids: [1, "x"] })).toBeNull();
    expect(lerIdsLote({})).toBeNull();
  });
});

describe("ehErroPatrimonioDuplicado", () => {
  it("reconhece a violação do índice único", () => {
    expect(ehErroPatrimonioDuplicado(new Error("SQLITE_CONSTRAINT: UNIQUE constraint failed: equipamentos.patrimonio"))).toBe(true);
    expect(ehErroPatrimonioDuplicado(new Error("UNIQUE constraint failed: tecnicos.login"))).toBe(false);
  });
});

describe("tipoDeProduto", () => {
  it("liga o produto do evento ao tipo do inventário", () => {
    expect(tipoDeProduto("Celular")).toBe("Celular");
    expect(tipoDeProduto("Celulares")).toBe("Celular");
    expect(tipoDeProduto("Roteador 4G")).toBe("Roteador");
    expect(tipoDeProduto("Notebook")).toBe("Notebook");
    expect(tipoDeProduto("Totem")).toBe("Totem");
    expect(tipoDeProduto("Tablet")).toBe("Tablet");
  });
  it("produtos sem patrimônio não têm par", () => {
    for (const p of ["Carregador", "Extensão", "Régua de energia", "Mouse", "", null]) expect(tipoDeProduto(p)).toBeNull();
  });
});

describe("lerItensRetorno", () => {
  it("aceita ok/defeito, remove repetidos e corta observação longa", () => {
    const r = lerItensRetorno({ itens: [{ id: 1, resultado: "ok" }, { id: "2", resultado: "defeito", observacao: "tela quebrada" }, { id: 1, resultado: "defeito" }] });
    expect(r).toEqual([
      { id: 1, resultado: "ok", observacao: null },
      { id: 2, resultado: "defeito", observacao: "tela quebrada" },
    ]);
  });
  it("rejeita lista vazia, id inválido ou resultado desconhecido", () => {
    expect(lerItensRetorno({ itens: [] })).toBeNull();
    expect(lerItensRetorno({})).toBeNull();
    expect(lerItensRetorno({ itens: [{ id: "x", resultado: "ok" }] })).toBeNull();
    expect(lerItensRetorno({ itens: [{ id: 1, resultado: "perdido" }] })).toBeNull();
  });
});


describe("chip do aparelho", () => {
  it("formata o número", () => {
    expect(formatarNumeroChip("11930660118")).toBe("(11) 93066-0118");
    expect(formatarNumeroChip("+55 11 93066-0118")).toBe("(11) 93066-0118");
    expect(formatarNumeroChip("5133334444")).toBe("(51) 3333-4444");
    expect(formatarNumeroChip("123")).toBe("123");
    expect(formatarNumeroChip(null)).toBe("");
  });

  it("tem chip = operadora ou número; tablet não usa chip", () => {
    expect(infoChip({ tipo: "Celular", numero_chip: "11930660118", operadora: "Vivo" })).toEqual({ temChip: true, rotulo: "Vivo · (11) 93066-0118" });
    expect(infoChip({ tipo: "Celular", numero_chip: null, operadora: "Vivo" })).toEqual({ temChip: true, rotulo: "Vivo (número não cadastrado)" });
    expect(infoChip({ tipo: "Celular", numero_chip: "11930660118", operadora: "" })).toEqual({ temChip: true, rotulo: "(11) 93066-0118" });
    expect(infoChip({ tipo: "Celular", numero_chip: " ", operadora: null })).toEqual({ temChip: false, rotulo: "Sem chip" });
    expect(infoChip({ tipo: "Roteador", operadora: "Claro" }).temChip).toBe(true);
    expect(infoChip({ tipo: "Tablet", numero_chip: "11930660118" })).toEqual({ temChip: null, rotulo: "" });
  });

  it("resumo dos chips dos celulares", () => {
    expect(
      resumoChips([
        { tipo: "Celular", status: "disponivel", operadora: "Vivo" },
        { tipo: "Celular", status: "alocado", numero_chip: "11930660118" },
        { tipo: "Celular", status: "em_campo", operadora: "TIM" },
        { tipo: "Celular", status: "manutencao", operadora: "Vivo" },
        { tipo: "Celular", status: "em_campo" },
        { tipo: "Roteador", status: "alocado", operadora: "Claro" },
      ])
    ).toEqual({ celulares: 5, comChip: 4, semChip: 1, emUso: 2, livres: 1, manutencao: 1 });
  });
});

describe("patrimoniosPorProduto", () => {
  it("põe cada patrimônio na linha do produto do mesmo tipo", () => {
    const eq = [
      { tipo: "Celular", patrimonio: "2035" },
      { tipo: "Celular", patrimonio: "2037" },
      { tipo: "Roteador", patrimonio: "R1" },
      { tipo: "Tablet", patrimonio: "T1" },
    ];
    const r = patrimoniosPorProduto([{ nome: "Carregador" }, { nome: "Celular" }, { nome: "Celulares reserva" }, { nome: "Roteador 4G" }], eq);
    expect(r.porProduto.get("Celular")!.map((e) => e.patrimonio)).toEqual(["2035", "2037"]);
    expect(r.porProduto.get("Celulares reserva")).toEqual([]);
    expect(r.porProduto.get("Roteador 4G")!.map((e) => e.patrimonio)).toEqual(["R1"]);
    expect(r.porProduto.has("Carregador")).toBe(false);
    expect(r.sobra.map((e) => e.patrimonio)).toEqual(["T1"]);
  });
});
