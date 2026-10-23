import { describe, expect, it } from "vitest";
import { podeDesativar, validarNomeUsuario, validarUsername } from "./usuarios";

describe("validarUsername", () => {
  it("normaliza para minúsculas e aceita letras, números, ponto, hífen e _", () => {
    expect(validarUsername("  Maria.Silva ")).toEqual({ ok: true, username: "maria.silva" });
    expect(validarUsername("joao_2")).toEqual({ ok: true, username: "joao_2" });
  });
  it("recusa login que parece telefone, curto ou com espaço", () => {
    expect(validarUsername("51999990000").ok).toBe(false);
    expect(validarUsername("ab").ok).toBe(false);
    expect(validarUsername("maria silva").ok).toBe(false);
    expect(validarUsername("").ok).toBe(false);
  });
});

describe("validarNomeUsuario", () => {
  it("exige 2 a 80 caracteres", () => {
    expect(validarNomeUsuario(" Ana ")).toBe("Ana");
    expect(validarNomeUsuario("A")).toBeNull();
  });
});

describe("podeDesativar", () => {
  it("não desativa a si mesmo nem o último ativo", () => {
    expect(podeDesativar(1, 1, 3)).toMatch(/próprio/);
    expect(podeDesativar(2, 1, 1)).toMatch(/último/);
    expect(podeDesativar(2, 1, 2)).toBeNull();
  });
});
