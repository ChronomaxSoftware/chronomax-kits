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

describe("calcularPrevisao sem base abastecedora", () => {
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
    hoje,
    6,
    null
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
    expect(calcularPrevisao(bases, [], hoje, 6, null).blocos).toEqual([]);
  });
});

describe("calcularPrevisao com SP abastecendo as outras bases", () => {
  const MOUSE = 3;
  const bs: BaseEstoque[] = [
    { id: 1, nome: "São Paulo", uf: "SP", estoque: [{ produto_id: CEL, produto_nome: "Celular", quantidade: 20 }, { produto_id: MOUSE, produto_nome: "Mouse", quantidade: 2 }] },
    { id: 2, nome: "Porto Alegre", uf: "RS", estoque: [{ produto_id: CEL, produto_nome: "Celular", quantidade: 1 }] },
    { id: 3, nome: "Rio de Janeiro", uf: "RJ", estoque: [] },
  ];
  const p = calcularPrevisao(
    bs,
    [
      // semana 0: SP pede 8 → sobram 12; RS precisa 4 (5−1), RJ precisa 10, sem base precisa 3
      ev(1, "07/11/2026", "SP", [[CEL, "Celular", 8]]),
      ev(2, "05/11/2026", "RS", [[CEL, "Celular", 5]]), // mais cedo: atendido primeiro
      ev(3, "07/11/2026", "RJ", [[CEL, "Celular", 10], [MOUSE, "Mouse", 1]]),
      ev(4, "08/11/2026", "BA", [[CEL, "Celular", 3]]),
      // semana 1: só RJ, SP cobre tudo
      ev(5, "14/11/2026", "RJ", [[CEL, "Celular", 6]]),
    ],
    hoje
  );
  const bloco = (t: string) => p.blocos.find((b) => b.titulo.startsWith(t))!;
  const cel = (t: string) => bloco(t).linhas.find((l) => l.nome === "Celular")!;

  it("SP cobre a falta, prova mais próxima primeiro, e o resto vira falta real", () => {
    expect(p.abastecedor).toBe("São Paulo/SP");
    expect(cel("Porto Alegre").celulas[0]).toMatchObject({ pedido: 5, doAbastecedor: 4, faltaReal: 0, situacao: "abastecido" });
    // RJ (07/11) antes de sem base (08/11): sobra 12 − 4 (RS) = 8 → RJ recebe 8 de 10
    expect(cel("Rio de Janeiro").celulas[0]).toMatchObject({ pedido: 10, doAbastecedor: 8, faltaReal: 2, situacao: "falta" });
    expect(cel("Sem base").celulas[0]).toMatchObject({ pedido: 3, doAbastecedor: 0, faltaReal: 3, situacao: "falta" });
    expect(cel("Sem base").estoque).toBe(0);
  });

  it("linha de SP mostra quanto foi enviado; produto que SP só envia ganha linha", () => {
    expect(cel("São Paulo").enviado).toEqual([12, 6, 0, 0, 0, 0]);
    const mouse = bloco("São Paulo").linhas.find((l) => l.nome === "Mouse")!;
    expect(mouse.enviado![0]).toBe(1);
    expect(mouse.celulas[0].situacao).toBe("vazio");
    expect(bloco("Rio de Janeiro").linhas.find((l) => l.nome === "Mouse")!.celulas[0].situacao).toBe("abastecido");
  });

  it("plano da semana: o que enviar e a falta real", () => {
    expect(p.plano[0].envios).toEqual([
      { produto: "Celular", para: "Porto Alegre/RS", quantidade: 4 },
      { produto: "Celular", para: "Rio de Janeiro/RJ", quantidade: 8 },
      { produto: "Mouse", para: "Rio de Janeiro/RJ", quantidade: 1 },
    ]);
    expect(p.plano[0].faltas).toEqual([
      { produto: "Celular", bloco: "Rio de Janeiro/RJ", falta: 2 },
      { produto: "Celular", bloco: "Sem base (prova em estado sem base)", falta: 3 },
    ]);
    expect(p.plano[0].sobraAbastecedor).toEqual([
      { produto: "Celular", sobra: 0 },
      { produto: "Mouse", sobra: 1 },
    ]);
    expect(p.plano[1]).toMatchObject({ envios: [{ produto: "Celular", para: "Rio de Janeiro/RJ", quantidade: 6 }], faltas: [] });
    expect(p.faltas.map((f) => [f.bloco, f.falta])).toEqual([
      ["Rio de Janeiro/RJ", 2],
      ["Sem base (prova em estado sem base)", 3],
    ]);
  });

  it("falta da própria SP sugere outra base com sobra", () => {
    const p2 = calcularPrevisao(
      [
        { id: 1, nome: "São Paulo", uf: "SP", estoque: [] },
        { id: 3, nome: "Rio de Janeiro", uf: "RJ", estoque: [{ produto_id: 9, produto_nome: "Notebook", quantidade: 3 }] },
      ],
      [ev(1, "07/11/2026", "SP", [[9, "Notebook", 1]])],
      hoje
    );
    const c = p2.blocos[0].linhas[0].celulas[0];
    expect(c).toMatchObject({ situacao: "falta", faltaReal: 1, cobertura: [{ base: "Rio de Janeiro/RJ", sobra: 3 }] });
  });
});
