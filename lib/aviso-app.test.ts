import { describe, expect, it } from "vitest";
import { precisaAvisoApp } from "./aviso-app";

const vazio = { tutorial_visto_em: null, convite_usado_em: null, aviso_app_visto_em: null };

describe("precisaAvisoApp", () => {
  it("quem acessou antes da mudança vê o aviso até confirmar", () => {
    expect(precisaAvisoApp({ ...vazio, tutorial_visto_em: "2026-10-28T10:00:00.000Z" })).toBe(true);
    expect(precisaAvisoApp({ ...vazio, convite_usado_em: "2026-10-30T12:00:00.000Z" })).toBe(true);
    expect(
      precisaAvisoApp({ ...vazio, tutorial_visto_em: "2026-10-28T10:00:00.000Z", aviso_app_visto_em: "2026-10-31T09:00:00.000Z" })
    ).toBe(false);
  });
  it("quem entrou depois (ou nunca entrou) não vê", () => {
    expect(precisaAvisoApp({ ...vazio, tutorial_visto_em: "2026-10-31T10:00:00.000Z" })).toBe(false);
    expect(precisaAvisoApp(vazio)).toBe(false);
  });
});
