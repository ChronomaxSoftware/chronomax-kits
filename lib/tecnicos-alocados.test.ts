import { describe, expect, it } from "vitest";
import { diaMes, proximasEntregasPorTecnico } from "./tecnicos-alocados";

const ev = (tecnico_id: number, evento_id: number, data: string, nome = `Prova ${evento_id}`) => ({
  tecnico_id,
  evento_id,
  numero: String(4000 + evento_id),
  nome,
  data,
  cidade: "Porto Alegre",
  uf: "RS",
});

describe("proximasEntregasPorTecnico", () => {
  it("só de hoje em diante, ordenado por data, por técnico", () => {
    const m = proximasEntregasPorTecnico(
      [ev(1, 1, "15/11/2026"), ev(1, 2, "09/11/2026"), ev(1, 3, "10/11/2026"), ev(2, 4, "13/11/2026")],
      "2026-11-10"
    );
    expect(m.get(1)!.map((e) => e.evento_id)).toEqual([3, 1]);
    expect(m.get(2)!.map((e) => e.evento_id)).toEqual([4]);
  });

  it("ignora data inválida e prova repetida; quem só tem entrega passada fica de fora", () => {
    const m = proximasEntregasPorTecnico(
      [ev(1, 1, "a definir"), ev(1, 2, "2026-11-20"), ev(1, 2, "2026-11-20"), ev(3, 5, "01/10/2026")],
      "2026-11-10"
    );
    expect(m.get(1)!.map((e) => e.evento_id)).toEqual([2]);
    expect(m.has(3)).toBe(false);
  });
});

describe("diaMes", () => {
  it("formata dd/mm", () => {
    expect(diaMes("13/11/2026")).toBe("13/11");
    expect(diaMes("2026-11-05")).toBe("05/11");
    expect(diaMes("sem data")).toBe("sem data");
  });
});
