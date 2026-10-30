import { describe, expect, it } from "vitest";
import { celularesDoTecnico, diaCurto, hojeBR, textoAlertaConferencia } from "./conferencia-diaria";

describe("hojeBR", () => {
  it("usa o fuso de Brasília (01:30 UTC ainda é o dia anterior)", () => {
    expect(hojeBR(new Date("2026-10-31T01:30:00Z"))).toBe("2026-10-30");
    expect(hojeBR(new Date("2026-10-31T13:00:00Z"))).toBe("2026-10-31");
    expect(diaCurto("2026-10-30")).toBe("30/10");
  });
});

describe("celularesDoTecnico", () => {
  it("os que ele pegou e os sem técnico", () => {
    const c = [
      { id: 1, com_tecnico_id: 7 },
      { id: 2, com_tecnico_id: 8 },
      { id: 3, com_tecnico_id: null },
    ];
    expect(celularesDoTecnico(c, 7).map((x) => x.id)).toEqual([1, 3]);
  });
});

describe("textoAlertaConferencia", () => {
  it("resume ok e problemas", () => {
    expect(
      textoAlertaConferencia("Ana", "Corrida (#1)", "2026-10-30", [
        { patrimonio: "CEL-1", status: "ok" },
        { patrimonio: "CEL-2", status: "problema", obs: "tela quebrada" },
      ])
    ).toBe("Ana enviou a conferência do dia 30/10 — Corrida (#1): ✅ 1 · ⚠ 1 com problema (CEL-2: tela quebrada)");
    expect(textoAlertaConferencia("Ana", "Corrida (#1)", "2026-10-30", [{ patrimonio: "CEL-1", status: "ok" }])).toMatch(
      /tudo certo$/
    );
  });
});
