import { describe, expect, it } from "vitest";
import { montarLinhasApuradores, rotuloEk, semCpfNoFim } from "./excel-apuradores";

const prova = (id: number, data: string, tipo_kit: string | null, cliente = "Cliente X") => ({
  id,
  numero: String(100 + id),
  nome: `Prova ${id}`,
  data,
  cidade: "Porto Alegre",
  uf: "RS",
  cliente,
  tipo_kit,
});
const pessoa = (evento_id: number, nome: string, funcao: string | null, cache_ek = 0) => ({
  evento_id,
  nome,
  funcao,
  cpf_prefixo: null,
  cache_ek,
});

describe("auxiliares", () => {
  it("tira CPF do fim e rotula EK", () => {
    expect(semCpfNoFim("CAIO DOS SANTOS 38913423812")).toBe("CAIO DOS SANTOS");
    expect(rotuloEk("entrega")).toBe("Sim");
    expect(rotuloEk("sistema")).toBe("Só sistema (app)");
    expect(rotuloEk(null)).toBe("Não");
  });
});

describe("montarLinhasApuradores", () => {
  it("uma linha por prova, sem apurador entra, EK do Gestão ou dos atribuídos, repetido marcado", () => {
    const l = montarLinhasApuradores(
      [prova(2, "29/11/2026", null), prova(1, "28/11/2026", "entrega"), prova(3, "29/11/2026", "entrega")],
      [
        pessoa(1, "ANA APURA", "apurador"),
        pessoa(1, "BIA KIT", "suporte", 500),
        pessoa(2, "CARLOS", "suporte"),
        pessoa(3, "ANA APURA 12345678901", "apurador"),
      ],
      [{ evento_id: 3, nome: "DUDA TECNICA", funcao: null, cpf_prefixo: null }]
    );
    expect(l.map((x) => [x.data, x.prova, x.apurador, x.tem_ek, x.quem_ek, x.obs])).toEqual([
      ["28/11/2026", "Prova 1", "ANA APURA", "Sim", "BIA KIT", "ANA em 2 provas na semana"],
      ["29/11/2026", "Prova 2", "SEM APURADOR", "Não", "", "Sem apurador convocado no Gestão"],
      ["29/11/2026", "Prova 3", "ANA APURA", "Sim", "DUDA TECNICA", "ANA em 2 provas na semana"],
    ]);
    expect(l[1].sem_apurador).toBe(true);
    // tem EK mas ninguém escalado
    const vazio = montarLinhasApuradores([prova(9, "29/11/2026", "entrega")], [], []);
    expect(vazio[0].quem_ek).toBe("ninguém escalado");
    expect(l[0].cliente).toBe("Cliente X");
  });
});
