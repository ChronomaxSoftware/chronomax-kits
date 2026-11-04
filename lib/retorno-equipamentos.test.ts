import { describe, expect, it } from "vitest";
import { jaSaiuParaProva, pendenteDeRetorno } from "./retorno-equipamentos";

const agora = new Date(2026, 10, 4, 15, 0); // 04/11/2026

describe("jaSaiuParaProva", () => {
  it("vale a data da entrega ou, sem ela, a da prova", () => {
    expect(jaSaiuParaProva("01/11/2026", null, agora)).toBe(true);
    expect(jaSaiuParaProva("04/11/2026", null, agora)).toBe(true); // dia da prova
    expect(jaSaiuParaProva("08/11/2026", null, agora)).toBe(false);
    expect(jaSaiuParaProva("08/11/2026", "2026-11-04", agora)).toBe(true); // entregue hoje
    expect(jaSaiuParaProva("08/11/2026", "2026-11-06", agora)).toBe(false);
    expect(jaSaiuParaProva(null, null, agora)).toBe(false);
  });
});

describe("pendenteDeRetorno", () => {
  it("em campo sempre; alocado só depois que saiu para a prova", () => {
    expect(pendenteDeRetorno({ status: "em_campo", evento_id: null }, null, agora)).toBe(true);
    expect(pendenteDeRetorno({ status: "alocado", evento_id: 1 }, { data: "01/11/2026" }, agora)).toBe(true);
    expect(pendenteDeRetorno({ status: "alocado", evento_id: 1 }, { data: "15/11/2026" }, agora)).toBe(false);
    expect(pendenteDeRetorno({ status: "alocado", evento_id: null }, { data: "01/11/2026" }, agora)).toBe(false);
    expect(pendenteDeRetorno({ status: "disponivel", evento_id: null }, { data: "01/11/2026" }, agora)).toBe(false);
  });
});
