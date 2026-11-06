import { describe, expect, it } from "vitest";
import { calcularPrevisao, situacaoDe, type BaseEstoque, type EventoPrevisao } from "./previsao-estoque";

const hoje = new Date(2026, 10, 6); // sexta 06/11/2026 → semana de 02/11
const CEL = 1;
const CAR = 2;

const bases: BaseEstoque[] = [
  { id: 1, nome: "São Paulo", uf: "SP", estoque: [{ produto_id: CEL, produto_nome: "Celular", quantidade: 10 }, { produto_id: CAR, produto_nome: "Carregador", quantidade: 5 }] },
  { id: 2, nome: "Porto Alegre", uf: "RS", estoque: [{ produto_id: CEL, produto_nome: "Celular", quantidade: 8 }] },
];

const ev = (id: number, data: string, uf: string | null, produtos: [number, string, number][]): EventoPrevisao => ({
  id,
  numero: String(4000 + id),
  nome: `Prova ${id}`,
  data,
  uf,
  produtos: produtos.map(([produto_id, nome, quantidade]) => ({ produto_id, nome, quantidade })),
});

describe("situacaoDe", () => {
  it("falta, limite, sobra, vazio", () => {
    expect(situacaoDe(0, 5)).toBe("vazio");
    expect(situacaoDe(6, 5)).toBe("falta");
    expect(situacaoDe(5, 5)).toBe("limite");
    expect(situacaoDe(3, 5)).toBe("sobra");
    expect(situacaoDe(1, 0)).toBe("falta");
  });
});

describe("calcularPrevisao", () => {
  const p = calcularPrevisao(
    bases,
    [
      ev(1, "07/11/2026", "SP", [[CEL, "Celular", 6], [CAR, "Carregador", 5]]),
      ev(2, "08/11/2026", "sp", [[CEL, "Celular", 6]]), // mesma semana, mesma base: soma 12 > 10
      ev(3, "15/11/2026", "SP", [[CEL, "Celular", 4]]),
      ev(4, "08/11/2026", "RS", [[CEL, "Celular", 3]]),
      ev(5, "14/11/2026", "BA", [[CEL, "Celular", 20]]), // sem base: compara com o total 18
      ev(6, "20/12/2026", "SP", [[CEL, "Celular", 99]]), // fora das 6 semanas
      ev(7, "data ruim", "SP", [[CEL, "Celular", 99]]),
      ev(8, "09/11/2026", "SP", [[CAR, "Carregador", 0]]), // quantidade 0 não conta
    ],
    hoje
  );

  it("6 semanas a partir da semana atual", () => {
    expect(p.semanas).toHaveLength(6);
    expect(p.semanas[0]).toMatchObject({ inicio: "02/11/2026", fim: "08/11/2026", rotulo: "02/11–08/11" });
    expect(p.semanas[5].inicio).toBe("07/12/2026");
  });

  it("soma por base e semana e marca falta/limite/sobra", () => {
    const sp = p.blocos.find((b) => b.chave === "base:1")!;
    const cel = sp.linhas.find((l) => l.nome === "Celular")!;
    expect(cel.estoque).toBe(10);
    expect(cel.celulas[0]).toMatchObject({ pedido: 12, saldo: -2, situacao: "falta" });
    expect(cel.celulas[0].provas.map((x) => x.numero)).toEqual(["4001", "4002"]);
    expect(cel.celulas[1]).toMatchObject({ pedido: 4, saldo: 6, situacao: "sobra" });
    expect(cel.celulas[2].situacao).toBe("vazio");
    const car = sp.linhas.find((l) => l.nome === "Carregador")!;
    expect(car.celulas[0]).toMatchObject({ pedido: 5, situacao: "limite" });
  });

  it("na falta, mostra outra base com sobra na mesma semana", () => {
    const cel = p.blocos.find((b) => b.chave === "base:1")!.linhas.find((l) => l.nome === "Celular")!;
    expect(cel.celulas[0].cobertura).toEqual([{ base: "Porto Alegre/RS", sobra: 5 }]); // 8 − 3
  });

  it("prova de estado sem base compara com o total de todas as bases", () => {
    const sem = p.blocos.find((b) => b.chave === "sem_base")!;
    expect(sem.semBase).toBe(true);
    expect(sem.linhas[0]).toMatchObject({ nome: "Celular", estoque: 18 });
    expect(sem.linhas[0].celulas[1]).toMatchObject({ pedido: 20, saldo: -2, situacao: "falta", cobertura: [] });
  });

  it("lista as faltas e ignora prova fora do horizonte ou sem data", () => {
    expect(p.faltas).toEqual([
      { semana: "02/11–08/11", bloco: "São Paulo/SP", produto: "Celular", falta: 2, pedido: 12, estoque: 10 },
      { semana: "09/11–15/11", bloco: "Sem base (prova em estado sem base)", produto: "Celular", falta: 2, pedido: 20, estoque: 18 },
    ]);
    const todasProvas = p.blocos.flatMap((b) => b.linhas.flatMap((l) => l.celulas.flatMap((c) => c.provas.map((x) => x.id))));
    expect(todasProvas).not.toContain(6);
    expect(todasProvas).not.toContain(7);
    expect(todasProvas).not.toContain(8);
  });

  it("base sem pedido nenhum não aparece", () => {
    expect(calcularPrevisao(bases, [], hoje).blocos).toEqual([]);
  });
});
