import { describe, expect, it } from "vitest";
import { nomeAparelhoStaff, provaNaJanelaStaff, provaPadrao } from "./staff-prova";

const agora = new Date(2026, 9, 30, 10); // 30/10/2026

describe("provaNaJanelaStaff", () => {
  it("de 7 dias atrás até 30 dias à frente", () => {
    expect(provaNaJanelaStaff("23/10/2026", agora)).toBe(true);
    expect(provaNaJanelaStaff("22/10/2026", agora)).toBe(false);
    expect(provaNaJanelaStaff("29/11/2026", agora)).toBe(true);
    expect(provaNaJanelaStaff("30/11/2026", agora)).toBe(false);
    expect(provaNaJanelaStaff(null, agora)).toBe(false);
  });
});

describe("provaPadrao", () => {
  it("hoje ou a próxima; sem futuras, a mais recente", () => {
    const p = [{ data: "25/10/2026" }, { data: "02/11/2026" }, { data: "30/10/2026" }];
    expect(provaPadrao(p, agora)?.data).toBe("30/10/2026");
    expect(provaPadrao([{ data: "25/10/2026" }, { data: "27/10/2026" }], agora)?.data).toBe("27/10/2026");
    expect(provaPadrao([], agora)).toBeNull();
  });
});

describe("nomeAparelhoStaff", () => {
  it("tipo + patrimônio", () => {
    expect(nomeAparelhoStaff("Celular", "CEL-10")).toBe("Celular CEL-10");
  });
});
