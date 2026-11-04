import { describe, expect, it } from "vitest";
import {
  agruparEnvios,
  ehEtapaEnvio,
  enderecoEntrega,
  itensBook,
  linkMapa,
  materialSeparado,
  normalizarDataEnvio,
  rotuloDataEnvio,
  situacaoEnvio,
  type EnvioBase,
} from "./envios";

const p = (id: number, data_envio: string | null, extra: Partial<EnvioBase> = {}): EnvioBase => ({
  id,
  nome: `Prova ${id}`,
  numero: String(1000 + id),
  data: "20/11/2026",
  data_envio,
  material_em: null,
  numeros_em: null,
  ...extra,
});

describe("envios — regras", () => {
  it("etapas e situação", () => {
    expect(ehEtapaEnvio("material")).toBe(true);
    expect(ehEtapaEnvio("numeros")).toBe(true);
    expect(ehEtapaEnvio("arte")).toBe(false);
    expect(situacaoEnvio({ material_em: null, numeros_em: null })).toBe("pendente");
    expect(situacaoEnvio({ material_em: "x", numeros_em: null })).toBe("parcial");
    expect(situacaoEnvio({ material_em: "x", numeros_em: "y" })).toBe("enviado");
  });

  it("data de envio: vazio = sem data, inválida = erro", () => {
    expect(normalizarDataEnvio("2026-11-05")).toBe("2026-11-05");
    expect(normalizarDataEnvio("")).toBeNull();
    expect(normalizarDataEnvio(null)).toBeNull();
    expect(normalizarDataEnvio("2026-02-30")).toBeUndefined();
    expect(normalizarDataEnvio("05/11/2026")).toBeUndefined();
    expect(rotuloDataEnvio("2026-11-05", new Date(2026, 0, 1))).toBe("05/11");
    expect(rotuloDataEnvio("2027-01-05", new Date(2026, 0, 1))).toBe("05/01/2027");
    expect(rotuloDataEnvio(null)).toBe("");
  });

  it("endereço da prova vence o do técnico; mapa só com endereço", () => {
    expect(enderecoEntrega("Rua A, 1", "Rua B, 2")).toBe("Rua A, 1");
    expect(enderecoEntrega("  ", "Rua B, 2")).toBe("Rua B, 2");
    expect(enderecoEntrega(null, null)).toBeNull();
    expect(linkMapa("Rua A, 1 - Rio")).toBe("https://www.google.com/maps/search/?api=1&query=Rua%20A%2C%201%20-%20Rio");
    expect(linkMapa("")).toBeNull();
  });
});

describe("agruparEnvios", () => {
  const hoje = new Date(2026, 10, 3, 15, 0);
  const lista = [
    p(1, "2026-11-05"),
    p(2, "2026-11-03"),
    p(3, "2026-11-05", { data: "10/11/2026" }),
    p(4, "2026-11-01"),
    p(5, "2026-10-30", { material_em: "a", numeros_em: "b" }),
    p(6, null),
    p(7, "2026-11-04", { material_em: "a", numeros_em: "b" }),
  ];

  it("separa atrasadas, dias, sem data e já enviadas", () => {
    const g = agruparEnvios(lista, { hoje, soPendentes: false, busca: "" });
    expect(g.atrasadas.map((x) => x.id)).toEqual([4]);
    expect(g.dias.map((d) => d.chave)).toEqual(["2026-11-03", "2026-11-04", "2026-11-05"]);
    expect(g.dias[2].provas.map((x) => x.id)).toEqual([3, 1]); // pela data da prova
    expect(g.semData.map((x) => x.id)).toEqual([6]);
    expect(g.enviadas.map((x) => x.id)).toEqual([5]);
  });

  it("pendentes esconde o que já foi todo enviado; busca por nome/número", () => {
    const g = agruparEnvios(lista, { hoje, soPendentes: true, busca: "" });
    expect(g.enviadas).toEqual([]);
    expect(g.dias.map((d) => d.chave)).toEqual(["2026-11-03", "2026-11-05"]);
    const b = agruparEnvios(lista, { hoje, soPendentes: false, busca: "1006" });
    expect(b.semData.map((x) => x.id)).toEqual([6]);
    expect(b.dias).toEqual([]);
  });
});

describe("material do envio", () => {
  it("book: só o que tem quantidade, na ordem do card", () => {
    expect(itensBook({ qtd_roteadores: 2, qtd_celulares: 8, qtd_totens: 0, qtd_notebooks: null })).toEqual([
      { nome: "Celulares (número)", quantidade: 8 },
      { nome: "Roteadores", quantidade: 2 },
    ]);
    expect(itensBook({})).toEqual([]);
  });

  it("separado = produto com quantidade ou patrimônio", () => {
    expect(materialSeparado({ produtos: [], equipamentos: [] })).toBe(false);
    expect(materialSeparado({ produtos: [{ quantidade: 0 }], equipamentos: [] })).toBe(false);
    expect(materialSeparado({ produtos: [{ quantidade: 2 }], equipamentos: [] })).toBe(true);
    expect(materialSeparado({ produtos: [], equipamentos: [{}] })).toBe(true);
  });
});
