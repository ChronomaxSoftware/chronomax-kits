import { describe, expect, it } from "vitest";
import { agruparTelao, situacaoTelao, tipoItemTelao, tiposTelao } from "./telao";

describe("tipoItemTelao", () => {
  it("reconhece os 3 itens de telão do Gestão", () => {
    expect(tipoItemTelao("Foto Resultados Para Arena (Telão Por Conta do Cliente)")).toBe("foto_resultados");
    expect(tipoItemTelao("Foto Certificado Para Arena (Telão Por Conta do Cliente)")).toBe("foto_certificado");
    expect(
      tipoItemTelao("Output de resultados ao vivo, para painel/streaming (rede NDI ou cabo HDMI por conta do cliente)")
    ).toBe("output_ao_vivo");
  });
  it("não conta TV, relógio de LED e outros itens", () => {
    expect(tipoItemTelao("Locação de Televisão para Eventos - TV 55")).toBeNull();
    expect(tipoItemTelao("Locação de Relógios Led Dupla Face - Para Pórtico")).toBeNull();
    expect(tipoItemTelao("Cartela de Adesivos para identificação Triathlon")).toBeNull();
    expect(tipoItemTelao("")).toBeNull();
  });
  it("ignora acento e maiúscula", () => {
    expect(tipoItemTelao("FOTO RESULTADOS PARA ARENA")).toBe("foto_resultados");
  });
});

describe("tiposTelao", () => {
  it("sem repetir e em ordem fixa", () => {
    expect(
      tiposTelao(["Output de resultados ao vivo", "Foto Resultados Para Arena", "Foto Resultados Para Arena", "TV 55"])
    ).toEqual(["foto_resultados", "output_ao_vivo"]);
    expect(tiposTelao(["TV 55"])).toEqual([]);
  });
});

describe("situacaoTelao", () => {
  it("segue as etapas", () => {
    expect(situacaoTelao({ arte_cobrada_em: null, pronto_em: null })).toBe("cobrar_arte");
    expect(situacaoTelao({ arte_cobrada_em: "x", pronto_em: null })).toBe("aguardando_pronto");
    expect(situacaoTelao({ arte_cobrada_em: null, pronto_em: "x" })).toBe("pronto");
  });
});

describe("agruparTelao", () => {
  const p = (id: number, data: string | null, extra: Partial<{ nome: string; pronto_em: string }> = {}) => ({
    id,
    numero: String(1000 + id),
    nome: extra.nome ?? `Corrida ${id}`,
    data,
    arte_cobrada_em: null,
    pronto_em: extra.pronto_em ?? null,
  });
  const hoje = new Date(2026, 10, 3); // terça 03/11/2026

  it("separa futuras por semana, sem data e passadas", () => {
    const g = agruparTelao([p(1, "15/11/2026"), p(2, "08/11/2026"), p(3, "03/11/2026"), p(4, "01/11/2026"), p(5, null)], {
      hoje,
      soPendentes: false,
      busca: "",
    });
    expect(g.semanas.map((s) => s.provas.map((x) => x.id))).toEqual([[3, 2], [1]]);
    expect(g.semanas[0].chave).not.toBe(g.semanas[1].chave);
    expect(g.semData.map((x) => x.id)).toEqual([5]);
    expect(g.passadas.map((x) => x.id)).toEqual([4]);
  });

  it("pendentes esconde o que já está pronto; busca por nome sem acento ou número", () => {
    const lista = [p(1, "10/11/2026", { nome: "Maratona São Paulo" }), p(2, "10/11/2026", { pronto_em: "x" })];
    expect(agruparTelao(lista, { hoje, soPendentes: true, busca: "" }).semanas[0].provas.map((x) => x.id)).toEqual([1]);
    expect(agruparTelao(lista, { hoje, soPendentes: false, busca: "sao paulo" }).semanas[0].provas.map((x) => x.id)).toEqual([1]);
    expect(agruparTelao(lista, { hoje, soPendentes: false, busca: "1002" }).semanas[0].provas.map((x) => x.id)).toEqual([2]);
  });
});
