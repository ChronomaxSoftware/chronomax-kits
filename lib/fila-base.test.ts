import { describe, expect, it } from "vitest";
import { diasEntre, filaBase, filtrarFila, textoDias, urgenciaBase, type EventoBase } from "./fila-base";

const ev = (o: Partial<EventoBase>): EventoBase => ({
  id: 1,
  numero: "1",
  nome: "P",
  data: "30/11/2026",
  cidade: null,
  uf: null,
  qtd_atletas: 0,
  data_entrega: null,
  hora_entrega: null,
  tem_kit: 1,
  base1_ok: 0,
  base_final_ok: 0,
  base1_ok_em: null,
  base_final_ok_em: null,
  ...o,
});

const HOJE = "2026-11-24";

describe("filaBase", () => {
  it("ordena pela entrega de kit, depois hora e número", () => {
    const fila = filaBase(
      [
        ev({ id: 1, numero: "10", data_entrega: "2026-11-28", data: "30/11/2026" }),
        ev({ id: 2, numero: "20", data_entrega: "2026-11-26", hora_entrega: "14:00", data: "29/11/2026" }),
        ev({ id: 3, numero: "5", data_entrega: "2026-11-26", hora_entrega: "09:00", data: "29/11/2026" }),
        ev({ id: 4, numero: "7", data: "27/11/2026" }), // sem entrega: usa a data da prova
      ],
      HOJE
    );
    expect(fila.map((i) => i.evento.id)).toEqual([3, 2, 4, 1]);
    expect(fila[2].semEntrega).toBe(true);
    expect(fila[0].dias).toBe(2);
  });

  it("tira prova sem kit, prova que já passou e entrega longe demais", () => {
    const fila = filaBase(
      [
        ev({ id: 1, tem_kit: 0, data_entrega: "2026-11-25" }),
        ev({ id: 2, data: "20/11/2026", data_entrega: "2026-11-18" }),
        ev({ id: 3, data: "31/12/2026", data_entrega: "2026-12-29" }),
        ev({ id: 4, data: "26/11/2026", data_entrega: "2026-11-23" }), // entrega ontem, prova ainda vem
      ],
      HOJE
    );
    expect(fila.map((i) => i.evento.id)).toEqual([4]);
    expect(fila[0].dias).toBe(-1);
    expect(fila[0].urgencia).toBe("vermelho");
  });
});

describe("urgência, filtros e textos", () => {
  it("cores", () => {
    expect(urgenciaBase({ base1_ok: 1, base_final_ok: 1 }, 0)).toBe("feito");
    expect(urgenciaBase({ base1_ok: 1, base_final_ok: 0 }, 1)).toBe("vermelho");
    expect(urgenciaBase({ base1_ok: 0, base_final_ok: 0 }, 3)).toBe("amarelo");
    expect(urgenciaBase({ base1_ok: 0, base_final_ok: 0 }, 4)).toBe("normal");
  });

  it("filtros", () => {
    const fila = filaBase(
      [
        ev({ id: 1, data_entrega: "2026-11-25", base1_ok: 1, base_final_ok: 1 }),
        ev({ id: 2, data_entrega: "2026-11-25", base1_ok: 1 }),
        ev({ id: 3, data_entrega: "2026-11-25" }),
      ],
      HOJE
    );
    expect(filtrarFila(fila, "pendentes").map((i) => i.evento.id)).toEqual([2, 3]);
    expect(filtrarFila(fila, "falta_final").map((i) => i.evento.id)).toEqual([2]);
    expect(filtrarFila(fila, "todas")).toHaveLength(3);
  });

  it("dias", () => {
    expect(diasEntre("2026-11-30", "2026-12-02")).toBe(2);
    expect(textoDias(0)).toBe("Hoje");
    expect(textoDias(1)).toBe("Amanhã");
    expect(textoDias(-3)).toBe("Foi há 3 dias");
    expect(textoDias(5)).toBe("Faltam 5 dias");
  });
});
