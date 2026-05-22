import { describe, it, expect } from "vitest";
import { parseDataBR, dataNaJanela, JANELA_DIAS } from "./semana";

function maisDias(ref: Date, dias: number): Date {
  const d = new Date(ref);
  d.setDate(d.getDate() + dias);
  return d;
}

describe("parseDataBR", () => {
  it("interpreta dd/mm/yyyy", () => {
    const d = parseDataBR("05/12/2026");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(11); // dezembro
    expect(d!.getDate()).toBe(5);
  });

  it("interpreta d/m/yyyy (sem zero à esquerda)", () => {
    const d = parseDataBR("5/2/2026");
    expect(d!.getDate()).toBe(5);
    expect(d!.getMonth()).toBe(1); // fevereiro
  });

  it("interpreta ISO yyyy-mm-dd", () => {
    const d = parseDataBR("2026-02-05");
    expect(d!.getDate()).toBe(5);
    expect(d!.getMonth()).toBe(1);
  });

  it("retorna null (sem lançar) para entradas inválidas/nulas", () => {
    expect(parseDataBR("xx")).toBeNull();
    expect(parseDataBR("")).toBeNull();
    expect(parseDataBR(null)).toBeNull();
    expect(parseDataBR(undefined)).toBeNull();
  });
});

describe("dataNaJanela (próximas 32 semanas)", () => {
  const ref = new Date(2026, 4, 21); // 21/05/2026 00:00 local

  it("evento de hoje está dentro", () => {
    expect(dataNaJanela(new Date(2026, 4, 21, 10, 30), ref)).toBe(true);
  });

  it("evento de amanhã está dentro", () => {
    expect(dataNaJanela(maisDias(ref, 1), ref)).toBe(true);
  });

  it("evento exatamente em +224 dias (limite) está dentro", () => {
    expect(dataNaJanela(maisDias(ref, JANELA_DIAS), ref)).toBe(true);
  });

  it("evento em +225 dias está fora", () => {
    expect(dataNaJanela(maisDias(ref, JANELA_DIAS + 1), ref)).toBe(false);
  });

  it("evento passado (ontem) está fora", () => {
    expect(dataNaJanela(maisDias(ref, -1), ref)).toBe(false);
  });

  it("volume grande: conta exatamente 225 dias dentro da janela", () => {
    const total = 5000;
    let dentro = 0;
    for (let i = 0; i < total; i++) {
      // offsets de -100 a +4899 dias em relação a hoje
      if (dataNaJanela(maisDias(ref, i - 100), ref)) dentro++;
    }
    // dias 0..224 inclusive = 225
    expect(dentro).toBe(JANELA_DIAS + 1);
  });
});
