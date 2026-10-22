import { describe, expect, it } from "vitest";
import { ehErroPatrimonioDuplicado, idOuNull, lerIdsLote, normalizarPatrimonio, validarCadastro } from "./equipamentos";

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
