import { describe, expect, it } from "vitest";
import { liberaEm, podeDevolver, situacaoProva } from "./portal-situacao";
import { pendenciasRetorno, textoAlerta } from "./alertas";

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

describe("pendenciasRetorno", () => {
  const base = { base_id: 1, base_nome: "Porto Alegre", base_uf: "RS", evento_numero: "9001", evento_nome: "Maratona" };
  it("1 alerta por prova+base, só depois do dia da prova, avisando outro estado", () => {
    const p = pendenciasRetorno(
      [
        { ...base, tipo: "Celular", evento_id: 5, evento_data: "27/10/2026", evento_uf: "RJ" },
        { ...base, tipo: "Celular", evento_id: 5, evento_data: "27/10/2026", evento_uf: "RJ" },
        { ...base, tipo: "Roteador", evento_id: 5, evento_data: "27/10/2026", evento_uf: "RJ" },
        { ...base, tipo: "Celular", evento_id: 6, evento_data: "28/10/2026", evento_uf: "RS" }, // é hoje: ainda não
        { ...base, tipo: "Celular", evento_id: 7, evento_data: "20/10/2026", evento_uf: "rs" },
      ],
      agora
    );
    expect(p).toEqual([
      {
        chave: "retorno:5:1",
        evento_id: 5,
        mensagem:
          "Faltam voltar 3 patrimônios da base Porto Alegre/RS (Celular 2, Roteador 1) — Maratona (#9001), 27/10/2026 · RJ · está em OUTRO ESTADO",
      },
      {
        chave: "retorno:7:1",
        evento_id: 7,
        mensagem: "Falta voltar 1 patrimônio da base Porto Alegre/RS (Celular 1) — Maratona (#9001), 20/10/2026 · RS",
      },
    ]);
  });
});
