import { describe, it, expect } from "vitest";
import { normalizarNome, chaveTecnico, enfileirarTecnicoNovo, planejarMesclaPorNome } from "./tecnico-match";

// A raiz do bug era a identidade do técnico construída por chave frágil.
// Estes testes cobrem o núcleo (normalização + chave canônica + deduplicação).
// Os cenários de banco (vinculado/não-vinculado, inativos, admin/usuário comum)
// são garantidos pelas queries das APIs (filtro t.ativo=1 e JOIN evento_tecnicos),
// fora do escopo de teste puro.

describe("normalizarNome", () => {
  it("remove acentos, caixa e espaços extras", () => {
    expect(normalizarNome("  João   Silva  ")).toBe("joao silva");
    expect(normalizarNome("José Antônio")).toBe("jose antonio");
  });

  it("variações de acento/caixa/espaço produzem o mesmo resultado", () => {
    expect(normalizarNome("JOÃO  SILVA")).toBe(normalizarNome("joão silva"));
  });

  it("trata null/undefined/vazio sem lançar", () => {
    expect(normalizarNome(null)).toBe("");
    expect(normalizarNome(undefined)).toBe("");
    expect(normalizarNome("   ")).toBe("");
  });

  it("nomes realmente diferentes continuam diferentes", () => {
    expect(normalizarNome("João Silva")).not.toBe(normalizarNome("João Santos"));
  });
});

describe("chaveTecnico", () => {
  it("usa o CPF quando houver (prioridade sobre o nome)", () => {
    expect(chaveTecnico("123.456.789", "João")).toBe("cpf:123.456.789");
    // mesma pessoa (mesmo CPF) com nome escrito diferente → mesma identidade
    expect(chaveTecnico("123.456.789", "João Silva")).toBe(chaveTecnico("123.456.789", "J. Silva"));
  });

  it("cai no nome normalizado quando não há CPF", () => {
    expect(chaveTecnico(null, "João Silva")).toBe("nome:joao silva");
    expect(chaveTecnico("", "JOÃO  SILVA")).toBe(chaveTecnico(null, "joao silva"));
  });

  it("homônimos com CPF diferente são identidades diferentes", () => {
    expect(chaveTecnico("111.111.111", "João Silva")).not.toBe(chaveTecnico("222.222.222", "João Silva"));
  });

  it("chave de CPF e de nome nunca colidem", () => {
    expect(chaveTecnico("123456789", null)).not.toBe(chaveTecnico(null, "123456789"));
  });
});

describe("deduplicação por identidade (cenários do bug)", () => {
  it("mesma pessoa com CPF em ambas as syncs → 1 identidade", () => {
    const set = new Set([chaveTecnico("123.456.789", "João"), chaveTecnico("123.456.789", "joão s")]);
    expect(set.size).toBe(1);
  });

  it("múltiplos técnicos distintos no mesmo evento → várias identidades", () => {
    const techs = [
      { cpf: "111.111.111", nome: "Ana" },
      { cpf: "222.222.222", nome: "Bruno" },
      { cpf: null, nome: "Carlos" },
    ];
    const set = new Set(techs.map((t) => chaveTecnico(t.cpf, t.nome)));
    expect(set.size).toBe(3);
  });

  it("volume grande: pares colapsam pela identidade de CPF", () => {
    const n = 5000;
    const set = new Set<string>();
    for (let i = 0; i < n; i++) {
      const cpf = String(100000000 + i); // 9 dígitos distintos por pessoa
      set.add(chaveTecnico(cpf, `Tec ${i}`));
      set.add(chaveTecnico(cpf, `  TEC  ${i} `)); // mesma pessoa, nome formatado diferente
    }
    expect(set.size).toBe(n);
  });
});

describe("enfileirarTecnicoNovo", () => {
  it("mesma pessoa com e sem CPF no mesmo lote vira UMA linha (com o CPF)", () => {
    const l: { nome: string; cpf_prefixo: string | null }[] = [];
    enfileirarTecnicoNovo(l, { nome: "KLEBER ANDRADE DOS SANTOS", cpf_prefixo: null });
    enfileirarTecnicoNovo(l, { nome: "Kleber Andrade dos Santos ", cpf_prefixo: "128.260.044" });
    expect(l).toEqual([{ nome: "KLEBER ANDRADE DOS SANTOS", cpf_prefixo: "128.260.044" }]);
  });
  it("ordem inversa também não duplica", () => {
    const l: { nome: string; cpf_prefixo: string | null }[] = [];
    enfileirarTecnicoNovo(l, { nome: "Kleber Andrade", cpf_prefixo: "128" });
    enfileirarTecnicoNovo(l, { nome: "KLEBER ANDRADE", cpf_prefixo: null });
    expect(l).toHaveLength(1);
  });
  it("pessoas diferentes continuam separadas", () => {
    const l: { nome: string; cpf_prefixo: string | null }[] = [];
    enfileirarTecnicoNovo(l, { nome: "Ana", cpf_prefixo: "1" });
    enfileirarTecnicoNovo(l, { nome: "Bia", cpf_prefixo: null });
    expect(l).toHaveLength(2);
  });
});

describe("planejarMesclaPorNome", () => {
  const t = (id: number, nome: string, cpf: string | null, tel: string | null, login: string | null = null) => ({
    id, nome, cpf_prefixo: cpf, telefone: tel, login, senha_hash: null,
  });
  it("mescla a casca vazia no cadastro com dados (caso DAVID 167/198)", () => {
    expect(
      planejarMesclaPorNome([
        t(167, "DAVID JEFFERSON GOMES RODRIGUES BARROS", "394.311.548", "11 97767-0774"),
        t(198, "DAVID JEFFERSON GOMES RODRIGUES BARROS", null, null),
      ])
    ).toEqual([{ keeper: 167, dup: 198 }]);
  });
  it("casa nome com caixa/espaço diferente (caso THIAGO 29/88)", () => {
    expect(planejarMesclaPorNome([t(29, "THIAGO GONSAGA DE SOUZA", "051", "4899156732"), t(88, "Thiago Gonsaga de Souza ", null, null)])).toEqual([
      { keeper: 29, dup: 88 },
    ]);
  });
  it("dois cadastros com dados diferentes → não mexe (caso CRISTIANE)", () => {
    expect(planejarMesclaPorNome([t(76, "CRISTIANE", "000.000.000", "11 99255-3360"), t(99, "Cristiane ", "315", "11994899657")])).toEqual([]);
  });
  it("casca com login não é casca (não apaga acesso)", () => {
    expect(planejarMesclaPorNome([t(1, "Zé", "1", "11999990000"), t(2, "Zé", null, null, "ze")])).toEqual([]);
  });
  it("só cascas → não mexe", () => {
    expect(planejarMesclaPorNome([t(1, "Zé", null, null), t(2, "Zé", null, null)])).toEqual([]);
  });
});
