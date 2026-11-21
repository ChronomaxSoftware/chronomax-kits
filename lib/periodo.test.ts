import { describe, expect, it } from "vitest";
import { diaIso, lerDiaIso, noPeriodo } from "./periodo";

describe("eventos-periodo", () => {
  it("lê e escreve dia ISO", () => {
    expect(diaIso(lerDiaIso("2026-11-23")!)).toBe("2026-11-23");
    expect(lerDiaIso("2026-02-30")).toBeNull();
    expect(lerDiaIso("23/11/2026")).toBeNull();
  });

  it("filtra de início a fim inclusive, com ou sem kit", () => {
    const ev = [
      { id: 1, data: "22/11/2026" },
      { id: 2, data: "23/11/2026" },
      { id: 3, data: "29/11/2026" },
      { id: 4, data: "30/11/2026" },
      { id: 5, data: null },
      { id: 6, data: "2026-11-25" },
    ];
    expect(noPeriodo(ev, new Date(2026, 10, 23), new Date(2026, 10, 29)).map((e) => e.id)).toEqual([2, 3, 6]);
  });
});
