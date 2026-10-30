import { describe, expect, it } from "vitest";
import { acessoriosPendentes, faltou, textoAlertaAcessorios, type LinhaAcessorio } from "./retorno-acessorios";

const agora = new Date(2026, 9, 30, 10, 0); // 30/10/2026
const l = (o: Partial<LinhaAcessorio>): LinhaAcessorio => ({
  evento_id: 1,
  evento_numero: "100",
  evento_nome: "Corrida",
  evento_data: "29/10/2026",
  evento_uf: "RJ",
  produto_id: 10,
  produto_nome: "Extensão",
  quantidade: 5,
  devolucao_em: null,
  ...o,
});

describe("acessoriosPendentes", () => {
  it("só acessórios não conferidos de provas entre o início da conferência e hoje", () => {
    const p = acessoriosPendentes(
      [
        l({}),
        l({ produto_id: 11, produto_nome: "Mouse", quantidade: 2 }),
        l({ produto_id: 12, produto_nome: "Celular", quantidade: 10 }), // equipamento: tem patrimônio
        l({ produto_id: 13, produto_nome: "Régua", devolucao_em: "2026-10-30" }), // já conferido
        l({ evento_id: 2, evento_data: "30/10/2026" }), // hoje: entra, ainda não atrasada
        l({ evento_id: 3, evento_data: "31/10/2026" }), // futura
        l({ evento_id: 4, evento_data: "20/10/2026" }), // antes do início
      ],
      agora
    );
    expect(p.map((x) => [x.evento_id, x.atrasada, x.itens.map((i) => `${i.nome}:${i.quantidade}`)])).toEqual([
      [1, true, ["Extensão:5", "Mouse:2"]],
      [2, false, ["Extensão:5"]],
    ]);
  });
});

describe("faltou", () => {
  it("diferença nunca negativa", () => {
    expect(faltou(5, 4)).toBe(1);
    expect(faltou(5, 5)).toBe(0);
    expect(faltou(5, 7)).toBe(0);
    expect(faltou(5, -1)).toBe(5);
  });
});

describe("textoAlertaAcessorios", () => {
  it("monta a mensagem", () => {
    const [p] = acessoriosPendentes([l({})], agora);
    expect(textoAlertaAcessorios(p)).toBe("Conferir retorno dos acessórios — Corrida (#100), 29/10/2026 · RJ (Extensão 5)");
  });
});
