import { describe, expect, it } from "vitest";
import { validarNovaSenhaAdmin } from "./senha-admin";

describe("validarNovaSenhaAdmin", () => {
  it("aceita senha forte e diferente", () => {
    expect(validarNovaSenhaAdmin("Pista#Larga2026", "chronomax", "admin")).toBeNull();
  });
  it("recusa curta, com a senha inicial, com o usuário ou igual à atual", () => {
    expect(validarNovaSenhaAdmin("curta1", "x", "admin")).toMatch(/10 caracteres/);
    expect(validarNovaSenhaAdmin("Chronomax2026!", "x", "admin")).toMatch(/senha inicial/);
    expect(validarNovaSenhaAdmin("admin-2026-forte", "x", "admin")).toMatch(/nome de usuário/);
    expect(validarNovaSenhaAdmin("MesmaSenha123", "MesmaSenha123", "lider")).toMatch(/diferente/);
  });
});
