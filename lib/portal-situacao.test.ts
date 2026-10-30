import { describe, expect, it } from "vitest";
import { liberaEm, podeDevolver, situacaoProva } from "./portal-situacao";
import { textoAlerta } from "./alertas";

// quarta-feira, 28/10/2026 — semana de seg 26/10 a dom 01/11
const agora = new Date(2026, 9, 28, 15, 0);

describe("situacaoProva", () => {
  it("passada = finalizada; hoje e até domingo = liberada", () => {
    expect(situacaoProva(new Date(2026, 9, 27), agora)).toBe("finalizada");
    expect(situacaoProva(new Date(2026, 9, 28), agora)).toBe("liberada");
    expect(situacaoProva(new Date(2026, 10, 1), agora)).toBe("liberada");
  });
  it("semana seguinte em diante = em breve; sem data = liberada", () => {
    expect(situacaoProva(new Date(2026, 10, 2), agora)).toBe("em_breve");
    expect(situacaoProva(new Date(2026, 11, 20), agora)).toBe("em_breve");
    expect(situacaoProva(null, agora)).toBe("liberada");
  });
  it("libera na segunda-feira da semana da prova", () => {
    const d = liberaEm(new Date(2026, 10, 8)); // domingo 08/11
    expect([d.getDate(), d.getMonth()]).toEqual([2, 10]);
  });
});

describe("podeDevolver", () => {
  it("do dia da prova até 30 dias depois", () => {
    expect(podeDevolver(new Date(2026, 9, 29), agora)).toBe(false); // amanhã
    expect(podeDevolver(new Date(2026, 9, 28), agora)).toBe(true); // hoje
    expect(podeDevolver(new Date(2026, 8, 28), agora)).toBe(true); // 30 dias atrás
    expect(podeDevolver(new Date(2026, 8, 27), agora)).toBe(false); // 31 dias atrás
    expect(podeDevolver(null, agora)).toBe(true);
  });
});

describe("textoAlerta", () => {
  it("recebimento e devolução, com observação opcional", () => {
    expect(textoAlerta("recebimento", "Ana Souza", "Corrida X (#12)")).toBe(
      "Ana Souza confirmou que RECEBEU todo o material — Corrida X (#12)"
    );
    expect(textoAlerta("devolucao", "Ana", "Corrida X (#12)", " faltou 1 cabo ")).toBe(
      "Ana confirmou que DEVOLVEU todo o material — Corrida X (#12) — obs.: faltou 1 cabo"
    );
  });
});
