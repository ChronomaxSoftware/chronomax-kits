import { describe, expect, it } from "vitest";
import { normalizarNumerosCliente, textoNumerosCliente } from "./numeros-cliente";

describe("números de peito para o cliente", () => {
  it("texto só quando vai", () => {
    expect(textoNumerosCliente(0, "Ana")).toBeNull();
    expect(textoNumerosCliente(null, null)).toBeNull();
    expect(textoNumerosCliente(1, " Ana ")).toBe("Números de peito vão para o cliente — leva: Ana");
    expect(textoNumerosCliente(true, "")).toBe("Números de peito vão para o cliente — leva: a definir");
  });

  it("normaliza o formulário", () => {
    expect(normalizarNumerosCliente(true, "  João  ")).toEqual({ vai: 1, quem: "João" });
    expect(normalizarNumerosCliente(false, "João")).toEqual({ vai: 0, quem: null });
    expect(normalizarNumerosCliente(1, "   ")).toEqual({ vai: 1, quem: null });
    expect(normalizarNumerosCliente("x", 5)).toEqual({ vai: 0, quem: null });
    expect(normalizarNumerosCliente(1, "a".repeat(300)).quem).toHaveLength(200);
  });
});
