import { describe, it, expect } from "vitest";
import { classificarKit, tipoKitDeModo } from "./kit-mode";

const ITEM_ESTACAO = "Estação de Entrega de Kits via App GoRunKing - Números e Produtos";
const ITEM_SISTEMA = "Sistema Para Entrega De Kits - App GO RUNKING - Locação por Login/Estação";
const ITEM_TECNICO = "Técnico Especializado para Entrega de Kits";
const ITEM_QUALQUER = ["Camiseta Runner", "Medalha", "Número de peito"];

describe("classificarKit", () => {
  it("1) evento somente OPERATION (Estação)", () => {
    expect(classificarKit([ITEM_ESTACAO])).toBe("OPERATION");
  });

  it("Técnico especializado também é OPERATION", () => {
    expect(classificarKit([ITEM_TECNICO])).toBe("OPERATION");
  });

  it("2) evento somente SYSTEM_ONLY (Locação)", () => {
    expect(classificarKit([ITEM_SISTEMA])).toBe("SYSTEM_ONLY");
  });

  it("3) evento com ambos os produtos → OPERATION (precedência)", () => {
    expect(classificarKit([ITEM_SISTEMA, ITEM_ESTACAO])).toBe("OPERATION");
  });

  it("4) evento sem produtos relacionados → null", () => {
    expect(classificarKit(ITEM_QUALQUER)).toBeNull();
    expect(classificarKit([])).toBeNull();
    expect(classificarKit([null, undefined, ""])).toBeNull();
  });

  it("ignora acento/caixa/espaços", () => {
    expect(classificarKit(["  ESTACAO  DE   ENTREGA DE KITS via app gorunking "])).toBe("OPERATION");
    expect(classificarKit(["sistema para entrega de kit - locacao por login"])).toBe("SYSTEM_ONLY");
  });

  it("5) grande volume classifica corretamente", () => {
    const operation: string[] = [];
    const systemOnly: string[] = [];
    for (let i = 0; i < 3000; i++) {
      operation.push(`Evento ${i}`, ITEM_ESTACAO);
      systemOnly.push(`Evento ${i}`, ITEM_SISTEMA);
    }
    expect(classificarKit(operation)).toBe("OPERATION");
    expect(classificarKit(systemOnly)).toBe("SYSTEM_ONLY");
  });
});

describe("tipoKitDeModo", () => {
  it("mapeia para o campo tipo_kit", () => {
    expect(tipoKitDeModo("OPERATION")).toBe("entrega");
    expect(tipoKitDeModo("SYSTEM_ONLY")).toBe("sistema");
    expect(tipoKitDeModo(null)).toBeNull();
  });
});
