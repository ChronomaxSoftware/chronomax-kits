import { describe, expect, it } from "vitest";
import { chegadaPrimeiroDia, converterTextoColado, separarTextoColado, diaDaEntregaAntiga, entregaDoPrimeiroDia, formatarDia, formatarLinhas, lerLinha, lerLinhas, textoChegada } from "./datas-retirada";

describe("datas e horários da retirada", () => {
  it("monta a linha no formato do modelo", () => {
    expect(formatarDia({ data: "2026-11-06", inicio: "12:00", fim: "21:00" })).toBe("06/11/2026 das 12h00 às 21h00");
    expect(formatarDia({ data: "2026-11-07", inicio: "10:00", fim: "" })).toBe("07/11/2026 a partir das 10h00");
    expect(
      formatarLinhas([
        { data: "2026-11-06", inicio: "12:00", fim: "21:00" },
        { data: "", inicio: "10:00", fim: "21:00" }, // sem data: ignora
        { texto: "Sábado só retirada de número" },
      ])
    ).toBe("06/11/2026 das 12h00 às 21h00\nSábado só retirada de número");
  });

  it("lê de volta o modelo e variações", () => {
    expect(lerLinha("06/11/2026 das 12h00 às 21h00")).toEqual({ data: "2026-11-06", inicio: "12:00", fim: "21:00" });
    expect(lerLinha("07/11 das 10h às 21h", 2026)).toEqual({ data: "2026-11-07", inicio: "10:00", fim: "21:00" });
    expect(lerLinha("06/11/26 12:00 - 21:00")).toEqual({ data: "2026-11-06", inicio: "12:00", fim: "21:00" });
    expect(lerLinha("Sexta, 06/11/2026 das 9h30 às 18h")).toEqual({ data: "2026-11-06", inicio: "09:30", fim: "18:00" });
    expect(lerLinha("06/11/2026")).toEqual({ data: "2026-11-06", inicio: "", fim: "" });
    expect(lerLinha("28 Agosto: 10h às 19h", 2026)).toEqual({ data: "2026-08-28", inicio: "10:00", fim: "19:00" });
    expect(lerLinha("Agosto é o mês da prova")).toEqual({ texto: "Agosto é o mês da prova" });
    expect(lerLinha("31/02/2026 das 10h às 12h")).toEqual({ texto: "31/02/2026 das 10h às 12h" });
  });

  it("ignora o título colado junto", () => {
    const texto = "DATAS E HORÁRIOS:\n\n06/11/2026 das 12h00 às 21h00\n07/11/2026 das 10h00 às 21h00\n";
    expect(lerLinhas(texto)).toHaveLength(2);
    expect(formatarLinhas(lerLinhas(texto))).toBe("06/11/2026 das 12h00 às 21h00\n07/11/2026 das 10h00 às 21h00");
  });

  it("chegada 2h antes da abertura do 1º dia (o mais cedo, mesmo fora de ordem)", () => {
    const c = chegadaPrimeiroDia("07/11/2026 das 10h00 às 21h00\n06/11/2026 das 12h00 às 21h00");
    expect(c).toEqual({ data: "2026-11-06", dataRotulo: "06/11/2026", abertura: "12h00", chegada: "10h00", horasAntes: 2 });
    expect(textoChegada(c!)).toBe("Chegada da equipe no 1º dia: 06/11/2026 às 10h00 (2h antes da abertura, 12h00)");
    expect(chegadaPrimeiroDia("06/11/2026 das 9h30 às 18h")?.chegada).toBe("07h30");
    expect(chegadaPrimeiroDia("06/11/2026 das 1h às 5h")?.chegada).toBe("00h00");
    expect(chegadaPrimeiroDia("")).toBeNull();
    expect(chegadaPrimeiroDia("Só texto livre")).toBeNull();
  });
});

describe("converterTextoColado", () => {
  it("o modelo colado vira os dias do book", () => {
    const l = converterTextoColado("DATAS E HORÁRIOS:\n\n06/11/2026 das 12h00 às 21h00\n07/11/2026 das 10h00 às 21h00\n");
    expect(l).toEqual([
      { data: "2026-11-06", inicio: "12:00", fim: "21:00" },
      { data: "2026-11-07", inicio: "10:00", fim: "21:00" },
    ]);
    expect(formatarLinhas(l)).toBe("06/11/2026 das 12h00 às 21h00\n07/11/2026 das 10h00 às 21h00");
  });

  it("vários dias na mesma linha, com dia da semana (formato do Gestão)", () => {
    const l = converterTextoColado(
      "Datas e horários:  28/05 (quinta): 10h às 20h              29/05 (sexta): 10h às 20h  30/05 (sábado): 10h às 14h",
      2026
    );
    expect(formatarLinhas(l)).toBe("28/05/2026 das 10h00 às 20h00\n29/05/2026 das 10h00 às 20h00\n30/05/2026 das 10h00 às 14h00");
  });

  it("data por extenso em lista, com dia da semana e parênteses", () => {
    const texto =
      "- Quinta-feira (5 de novembro): 11h às 21h\n- Sexta-feira (6 de novembro): 11h às 21h\n- Sábado (7 de novembro): 11h às 19h";
    const l = converterTextoColado(texto, 2026);
    expect(formatarLinhas(l)).toBe(
      "05/11/2026 das 11h00 às 21h00\n06/11/2026 das 11h00 às 21h00\n07/11/2026 das 11h00 às 19h00"
    );
    expect(chegadaPrimeiroDia(formatarLinhas(l))?.chegada).toBe("09h00");
    // tudo numa linha só, mês abreviado, com ano e domingo
    expect(
      formatarLinhas(converterTextoColado("Sábado, 7 nov.: 9h às 18h  Domingo 8 de nov de 2026: 6h", 2026))
    ).toBe("07/11/2026 das 09h00 às 18h00\n08/11/2026 a partir das 06h00");
    expect(lerLinha("• terça (3 de março) 10h - 20h", 2026)).toEqual({ data: "2026-03-03", inicio: "10:00", fim: "20:00" });
  });

  it("o que não é data fica como texto", () => {
    expect(converterTextoColado("Retirada só com documento")).toEqual([{ texto: "Retirada só com documento" }]);
    expect(converterTextoColado("")).toEqual([]);
  });
});

describe("data e hora da entrega vêm do 1º dia", () => {
  it("1º dia (o mais cedo) vira data_entrega/hora_entrega", () => {
    expect(entregaDoPrimeiroDia("07/11/2026 das 10h00 às 21h00\n06/11/2026 das 12h00 às 21h00")).toEqual({
      data_entrega: "2026-11-06",
      hora_entrega: "12:00",
    });
    expect(entregaDoPrimeiroDia("06/11/2026")).toEqual({ data_entrega: "2026-11-06", hora_entrega: null });
    expect(entregaDoPrimeiroDia("")).toEqual({ data_entrega: null, hora_entrega: null });
    expect(entregaDoPrimeiroDia("só texto")).toEqual({ data_entrega: null, hora_entrega: null });
  });

  it("prova antiga: data/hora da entrega viram o 1º dia do editor (e voltam iguais)", () => {
    const linha = diaDaEntregaAntiga("2026-11-04", "10:00");
    expect(linha).toBe("04/11/2026 a partir das 10h00");
    expect(entregaDoPrimeiroDia(linha)).toEqual({ data_entrega: "2026-11-04", hora_entrega: "10:00" });
    expect(diaDaEntregaAntiga("04/11/2026", "9:30")).toBe("04/11/2026 a partir das 09h30");
    expect(diaDaEntregaAntiga("2026-11-04", null)).toBe("04/11/2026");
    expect(diaDaEntregaAntiga(null, "10:00")).toBe("");
  });
});

describe("data por extenso não mexe em texto livre", () => {
  it("dia da semana sem data fica como está", () => {
    expect(converterTextoColado("Sábado só retirada de número (com documento)")).toEqual([
      { texto: "Sábado só retirada de número (com documento)" },
    ]);
  });
});

describe("colar com emojis, horário na linha de baixo e local", () => {
  const texto = `📅 SEXTA-FEIRA – 13/11
⏰ Das 10h às 18h

📅 SÁBADO – 14/11
⏰ Das 10h às 18h

📍 LOCAL: PARQUE SHOPPING SULACAP
Av. Marechal Fontenelle, 3545
📌 Corredor da Drogaria Pacheco – 1º andar.`;

  it("junta o horário com a data e separa o local", () => {
    const r = separarTextoColado(texto, 2026);
    expect(formatarLinhas(r.linhas)).toBe("13/11/2026 das 10h00 às 18h00\n14/11/2026 das 10h00 às 18h00");
    expect(r.local).toBe("PARQUE SHOPPING SULACAP\nAv. Marechal Fontenelle, 3545\nCorredor da Drogaria Pacheco – 1º andar.");
    expect(chegadaPrimeiroDia(formatarLinhas(r.linhas))?.chegada).toBe("08h00");
  });

  it("sem bloco de local, local = null e os formatos antigos continuam iguais", () => {
    const r = separarTextoColado("06/11/2026 das 12h00 às 21h00\n07/11/2026 das 10h00 às 21h00");
    expect(r.local).toBeNull();
    expect(formatarLinhas(r.linhas)).toBe("06/11/2026 das 12h00 às 21h00\n07/11/2026 das 10h00 às 21h00");
    expect(formatarLinhas(converterTextoColado("- Quinta-feira (5 de novembro): 11h às 21h", 2026))).toBe("05/11/2026 das 11h00 às 21h00");
  });

  it("horário solto sem data em cima continua texto; data que já tem horário não é sobrescrita", () => {
    expect(converterTextoColado("Das 10h às 18h")).toEqual([{ texto: "Das 10h às 18h" }]);
    expect(formatarLinhas(converterTextoColado("13/11/2026 das 9h às 12h\nDas 14h às 18h"))).toBe(
      "13/11/2026 das 09h00 às 12h00\nDas 14h às 18h"
    );
  });

  it("Endereço: também abre o bloco do local", () => {
    expect(separarTextoColado("13/11/2026 10h às 18h\nEndereço: Rua A, 10").local).toBe("Rua A, 10");
  });
});

describe("local por dia", () => {
  it("salva e lê o local do dia depois do travessão", () => {
    const d = { data: "2026-11-13", inicio: "10:00", fim: "16:00", local: "Agência Sicredi — Av. Protásio Alves, 1180" };
    expect(formatarDia(d)).toBe("13/11/2026 das 10h00 às 16h00 — Agência Sicredi — Av. Protásio Alves, 1180");
    expect(lerLinha(formatarDia(d))).toEqual(d);
    expect(lerLinha("14/11/2026 das 11h às 18h – Shopping Praia de Belas")).toEqual({
      data: "2026-11-14", inicio: "11:00", fim: "18:00", local: "Shopping Praia de Belas",
    });
    // sem local continua igual (sem a chave local)
    expect(lerLinha("06/11/2026 das 12h00 às 21h00")).toEqual({ data: "2026-11-06", inicio: "12:00", fim: "21:00" });
    expect(lerLinha("SEXTA-FEIRA – 13/11/2026 10h às 18h")).toEqual({ data: "2026-11-13", inicio: "10:00", fim: "18:00" });
  });

  it("chegada mostra o local do 1º dia", () => {
    const c = chegadaPrimeiroDia("14/11/2026 das 11h00 às 18h00 — Shopping\n13/11/2026 das 10h00 às 16h00 — Sicredi")!;
    expect(c.local).toBe("Sicredi");
    expect(textoChegada(c)).toBe("Chegada da equipe no 1º dia: 13/11/2026 às 08h00 (2h antes da abertura, 10h00) — 📍 Sicredi");
  });

  it("mensagem em texto corrido: cada data com o seu horário e a sugestão de local", () => {
    const r = separarTextoColado(
      "temos dois locais confirmados para entrega, mesmos do ano passado, agência do Sicredi na Av Protásio Alves, 1180, dia 13/11/2026 das 10h às 16h e sábado dia 14/11/2026, no shopping praia de belas (alteramos a loja), das 11h às 18h.",
      2026
    );
    expect(formatarLinhas(r.linhas)).toBe(
      "13/11/2026 das 10h00 às 16h00 — Agência do Sicredi na Av Protásio Alves, 1180\n" +
        "14/11/2026 das 11h00 às 18h00 — Shopping praia de belas (alteramos a loja)"
    );
    expect(r.local).toBe("13/11: Agência do Sicredi na Av Protásio Alves, 1180\n14/11: Shopping praia de belas (alteramos a loja)");
  });

  it("um local só em texto corrido vira o Local de entrega (dias sem local)", () => {
    const r = separarTextoColado("A entrega será no Ginásio Central, dias 13/11/2026 das 10h às 16h e 14/11/2026 das 9h às 12h.", 2026);
    expect(formatarLinhas(r.linhas)).toBe("13/11/2026 das 10h00 às 16h00\n14/11/2026 das 09h00 às 12h00");
    expect(r.local).toBe("Ginásio Central");
  });

  it("formatos por linha continuam ganhando do texto corrido", () => {
    const l = converterTextoColado("Datas e horários:  28/05 (quinta): 10h às 20h  29/05 (sexta): 10h às 20h", 2026);
    expect(formatarLinhas(l)).toBe("28/05/2026 das 10h00 às 20h00\n29/05/2026 das 10h00 às 20h00");
  });
});

describe("todosOsDiasComLocal", () => {
  it("só quando todo dia tem local", async () => {
    const { todosOsDiasComLocal } = await import("./datas-retirada");
    expect(todosOsDiasComLocal("13/11/2026 das 10h00 às 16h00 — A\n14/11/2026 das 11h00 às 18h00 — B")).toBe(true);
    expect(todosOsDiasComLocal("13/11/2026 das 10h00 às 16h00 — A\n14/11/2026 das 11h00 às 18h00")).toBe(false);
    expect(todosOsDiasComLocal("")).toBe(false);
  });
});
