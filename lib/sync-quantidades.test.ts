import { describe, expect, it } from "vitest";
import { quantidadeAposSync } from "./sync-quantidades";

describe("quantidadeAposSync", () => {
  it("sem histórico: nunca diminui o que está no sistema", () => {
    expect(quantidadeAposSync(12, null, 10)).toBe(12);
    expect(quantidadeAposSync(8, null, 10)).toBe(10);
    expect(quantidadeAposSync(0, null, 10)).toBe(10); // evento/produto novo
  });

  it("não editado (igual ao último do Gestão): segue o Gestão", () => {
    expect(quantidadeAposSync(10, 10, 15)).toBe(15);
    expect(quantidadeAposSync(10, 10, 8)).toBe(8);
  });

  it("editado e Gestão igual ou menor: mantém o valor do usuário", () => {
    expect(quantidadeAposSync(12, 10, 10)).toBe(12);
    expect(quantidadeAposSync(8, 10, 10)).toBe(8);
    expect(quantidadeAposSync(0, 10, 10)).toBe(0); // removido pelo usuário
    expect(quantidadeAposSync(12, 10, 9)).toBe(12);
  });

  it("editado e Gestão aumentou: vale o maior", () => {
    expect(quantidadeAposSync(12, 10, 15)).toBe(15);
    expect(quantidadeAposSync(12, 10, 11)).toBe(12);
    expect(quantidadeAposSync(8, 10, 11)).toBe(11);
    expect(quantidadeAposSync(0, 10, 11)).toBe(11);
  });
});
