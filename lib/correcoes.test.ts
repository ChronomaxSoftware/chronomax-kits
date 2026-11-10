import { describe, expect, it } from "vitest";
import { qtdAtual, textoAlertaCorrecao, ultimaPorProduto, validarPedido } from "./correcoes";

const atuais = new Map([
  [1, 10],
  [2, 5],
]);

describe("validarPedido", () => {
  it("exige explicação", () => {
    expect(validarPedido([{ produto_id: 1, qtd: 9 }], "  curto ", atuais)).toEqual({
      erro: "Escreva a explicação (mínimo 10 letras).",
    });
  });

  it("só leva os itens que mudaram", () => {
    const r = validarPedido(
      [
        { produto_id: 1, qtd: 9 },
        { produto_id: 2, qtd: 5 },
      ],
      "veio um a menos na caixa",
      atuais
    );
    expect(r).toEqual({ itens: [{ produto_id: 1, qtd: 9, qtd_antes: 10 }], explicacao: "veio um a menos na caixa" });
  });

  it("recusa item de outra prova, quantidade inválida e pedido sem mudança", () => {
    const exp = "explicação suficiente";
    expect(validarPedido([{ produto_id: 3, qtd: 1 }], exp, atuais)).toEqual({ erro: "Item que não é desta prova." });
    expect(validarPedido([{ produto_id: 1, qtd: -1 }], exp, atuais)).toEqual({ erro: "Quantidade inválida." });
    expect(validarPedido([{ produto_id: 1, qtd: 2.5 }], exp, atuais)).toEqual({ erro: "Quantidade inválida." });
    expect(validarPedido([{ produto_id: 1, qtd: 10 }], exp, atuais)).toEqual({ erro: "Nenhuma quantidade diferente da atual." });
    expect(validarPedido("x", exp, atuais)).toEqual({ erro: "Itens inválidos." });
  });
});

describe("qtdAtual / ultimaPorProduto / texto", () => {
  it("quantidade atual = corrigida ou esperada", () => {
    expect(qtdAtual({ quantidade: 10, qtd_recebida: null })).toBe(10);
    expect(qtdAtual({ quantidade: 10, qtd_recebida: 9 })).toBe(9);
  });

  it("pega o último pedido de cada item", () => {
    const m = ultimaPorProduto([
      { id: 1, produto_id: 1, s: "a" },
      { id: 3, produto_id: 1, s: "c" },
      { id: 2, produto_id: 2, s: "b" },
    ]);
    expect(m.get(1)!.s).toBe("c");
    expect(m.get(2)!.s).toBe("b");
  });

  it("monta o texto do sino", () => {
    expect(textoAlertaCorrecao("Ana", "Corrida X (#1)", [{ nome: "Celular", antes: 10, pedida: 9 }], "faltou um")).toBe(
      "Ana pediu CORREÇÃO de quantidade — Corrida X (#1) — Celular 10 → 9 — explicação: faltou um"
    );
  });
});
