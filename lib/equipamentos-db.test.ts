/**
 * Integração com banco REAL (SQLite local em arquivo temporário via @libsql/client):
 * roda o initDB completo e exercita alocação, concorrência e remoção de provas.
 * Nunca toca no Turso — TURSO_DATABASE_URL é sobrescrita antes do primeiro acesso.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kits-teste-"));
process.env.TURSO_DATABASE_URL = "file:" + path.join(dir, "teste.db").replace(/\\/g, "/");
delete process.env.TURSO_AUTH_TOKEN;

const { initDB, dbRun, dbGet, dbAll, dbBatch, dbTransaction } = await import("./db");
const { alocarNaProva, liberarDaProva, mudarStatus, darSaida, registrarRetorno, ErroEquipamento } = await import("./equipamentos-db");
const { statementsApagarEventos } = await import("./eventos-remocao");

let ev1 = 0;
let ev2 = 0;

async function novoEquip(patrimonio: string, status = "disponivel") {
  const r = await dbRun("INSERT INTO equipamentos (tipo, patrimonio, status) VALUES ('Celular', ?, ?)", patrimonio, status);
  return Number(r.lastInsertRowid);
}
const equip = (id: number) =>
  dbGet<{ evento_id: number | null; status: string }>("SELECT evento_id, status FROM equipamentos WHERE id = ?", id);

beforeAll(async () => {
  await initDB();
  ev1 = Number((await dbRun("INSERT INTO eventos (numero, nome, data) VALUES ('9001', 'Corrida A', '01/12/2026')")).lastInsertRowid);
  ev2 = Number((await dbRun("INSERT INTO eventos (numero, nome, data) VALUES ('9002', 'Corrida B', '02/12/2026')")).lastInsertRowid);
});

afterAll(() => {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* Windows pode manter o arquivo aberto; é pasta temporária */
  }
});

describe("schema", () => {
  it("initDB é idempotente e patrimônio é único sem diferenciar maiúsculas", async () => {
    await initDB();
    await novoEquip("ABC-1");
    await expect(novoEquip("abc-1")).rejects.toThrow(/UNIQUE/);
  });
});

describe("alocarNaProva", () => {
  it("aloca, registra histórico com a referência da prova e ignora o que já está na prova", async () => {
    const a = await novoEquip("L-1");
    const b = await novoEquip("L-2");
    const r = await dbTransaction((tx) => alocarNaProva(tx, ev1, [a, b], "teste"));
    expect(r).toEqual({ alocados: 2, jaEstavam: 0 });
    expect(await equip(a)).toEqual({ evento_id: ev1, status: "alocado" });
    const h = await dbAll<{ acao: string; evento_ref: string; usuario: string }>(
      "SELECT acao, evento_ref, usuario FROM equipamento_historico WHERE equipamento_id = ?",
      a
    );
    expect(h).toEqual([{ acao: "alocado", evento_ref: "#9001 · Corrida A", usuario: "teste" }]);

    const de_novo = await dbTransaction((tx) => alocarNaProva(tx, ev1, [a], "teste"));
    expect(de_novo).toEqual({ alocados: 0, jaEstavam: 1 });
  });

  it("lote é tudo ou nada: um item em outra prova desfaz o lote inteiro", async () => {
    const livre = await novoEquip("T-1");
    const ocupado = await novoEquip("T-2");
    await dbTransaction((tx) => alocarNaProva(tx, ev2, [ocupado], "teste"));

    const erro = await dbTransaction((tx) => alocarNaProva(tx, ev1, [livre, ocupado], "teste")).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroEquipamento);
    expect(erro.status).toBe(409);
    expect(await equip(livre)).toEqual({ evento_id: null, status: "disponivel" }); // rollback
    expect(await equip(ocupado)).toEqual({ evento_id: ev2, status: "alocado" });
  });

  it("bloqueia manutenção e prova inexistente", async () => {
    const m = await novoEquip("M-1", "manutencao");
    await expect(dbTransaction((tx) => alocarNaProva(tx, ev1, [m], null))).rejects.toThrow(/manutenção/);
    const x = await novoEquip("X-1");
    await expect(dbTransaction((tx) => alocarNaProva(tx, 999999, [x], null))).rejects.toThrow(/Prova não encontrada/);
  });

});

describe("liberar e manutenção", () => {
  it("libera, e só deixa ir para manutenção quando livre", async () => {
    const e = await novoEquip("R-1");
    await dbTransaction((tx) => alocarNaProva(tx, ev1, [e], null));
    await expect(dbTransaction((tx) => mudarStatus(tx, e, "manutencao", null))).rejects.toThrow(/Libere-o/);
    expect(await dbTransaction((tx) => liberarDaProva(tx, e, null))).toBe(true);
    expect(await dbTransaction((tx) => liberarDaProva(tx, e, null))).toBe(false);
    await dbTransaction((tx) => mudarStatus(tx, e, "manutencao", null));
    expect((await equip(e))?.status).toBe("manutencao");
    await dbTransaction((tx) => mudarStatus(tx, e, "disponivel", null));
    expect((await equip(e))?.status).toBe("disponivel");
  });
});

describe("statementsApagarEventos", () => {
  it("apaga a prova e filhas, libera os equipamentos e mantém histórico legível", async () => {
    const ev = Number((await dbRun("INSERT INTO eventos (numero, nome, data) VALUES ('9100', 'Prova Cancelada', '05/12/2026')")).lastInsertRowid);
    await dbRun("INSERT INTO evento_itens_gestao (evento_id, nome, quantidade) VALUES (?, 'Item', 1)", ev);
    const e = await novoEquip("D-1");
    await dbTransaction((tx) => alocarNaProva(tx, ev, [e], null));

    await dbBatch(statementsApagarEventos([ev], "Prova saiu do Gestão (sync)"));

    expect(await dbGet("SELECT id FROM eventos WHERE id = ?", ev)).toBeUndefined();
    expect(await dbGet("SELECT id FROM evento_itens_gestao WHERE evento_id = ?", ev)).toBeUndefined();
    expect(await equip(e)).toEqual({ evento_id: null, status: "disponivel" });
    const h = await dbAll<{ acao: string; evento_ref: string; observacao: string | null }>(
      "SELECT acao, evento_ref, observacao FROM equipamento_historico WHERE equipamento_id = ? ORDER BY id",
      e
    );
    expect(h.map((x) => x.acao)).toEqual(["alocado", "liberado"]);
    expect(h[1]).toMatchObject({ evento_ref: "#9100 · Prova Cancelada", observacao: "Prova saiu do Gestão (sync)" });
  });
});

const eq2 = (id: number) =>
  dbGet<{ evento_id: number | null; status: string; saida_em: string | null; evento_ref: string | null }>(
    "SELECT evento_id, status, saida_em, evento_ref FROM equipamentos WHERE id = ?",
    id
  );
const acoes = async (id: number) =>
  (await dbAll<{ acao: string }>("SELECT acao FROM equipamento_historico WHERE equipamento_id = ? ORDER BY id", id)).map((h) => h.acao);

describe("saída e retorno", () => {
  it("separado → saída → retorno OK volta a ficar disponível", async () => {
    const a = await novoEquip("S-1");
    await dbTransaction((tx) => alocarNaProva(tx, ev1, [a], "ana"));
    expect(await dbTransaction((tx) => darSaida(tx, ev1, [a], "ana"))).toEqual({ sairam: 1, jaEstavamEmCampo: 0 });
    const emCampo = await eq2(a);
    expect(emCampo).toMatchObject({ evento_id: ev1, status: "em_campo", evento_ref: "#9001 · Corrida A" });
    expect(emCampo?.saida_em).toBeTruthy();
    // repetir a saída não faz nada
    expect(await dbTransaction((tx) => darSaida(tx, ev1, [a], "ana"))).toEqual({ sairam: 0, jaEstavamEmCampo: 1 });

    await dbTransaction((tx) => registrarRetorno(tx, a, "ok", "bruno", null));
    expect(await eq2(a)).toEqual({ evento_id: null, status: "disponivel", saida_em: null, evento_ref: null });
    expect(await acoes(a)).toEqual(["alocado", "saida", "retorno"]);
  });

  it("retorno com defeito vai para manutenção com a observação", async () => {
    const a = await novoEquip("S-2");
    await dbTransaction((tx) => alocarNaProva(tx, ev1, [a], null));
    await dbTransaction((tx) => darSaida(tx, ev1, [a], null));
    await dbTransaction((tx) => registrarRetorno(tx, a, "defeito", null, "tela quebrada"));
    expect((await eq2(a))?.status).toBe("manutencao");
    const h = await dbGet<{ acao: string; observacao: string; evento_ref: string }>(
      "SELECT acao, observacao, evento_ref FROM equipamento_historico WHERE equipamento_id = ? ORDER BY id DESC LIMIT 1",
      a
    );
    expect(h).toEqual({ acao: "retorno_defeito", observacao: "tela quebrada", evento_ref: "#9001 · Corrida A" });
  });

  it("em campo: não libera, não aloca em outra prova, não vai p/ manutenção e não dá saída de quem não é da prova", async () => {
    const a = await novoEquip("S-3");
    const livre = await novoEquip("S-4");
    await dbTransaction((tx) => alocarNaProva(tx, ev1, [a], null));
    await dbTransaction((tx) => darSaida(tx, ev1, [a], null));
    await expect(dbTransaction((tx) => liberarDaProva(tx, a, null))).rejects.toThrow(/Registre o retorno/);
    await expect(dbTransaction((tx) => alocarNaProva(tx, ev2, [a], null))).rejects.toThrow(/outra prova|em campo/);
    await expect(dbTransaction((tx) => mudarStatus(tx, a, "manutencao", null))).rejects.toThrow(/em campo/);
    await expect(dbTransaction((tx) => darSaida(tx, ev1, [livre], null))).rejects.toThrow(/não está separado/);
    await expect(dbTransaction((tx) => registrarRetorno(tx, livre, "ok", null, null))).rejects.toThrow(/não está em campo/);
  });

  it("saída em lote é tudo ou nada", async () => {
    const a = await novoEquip("S-5");
    const fora = await novoEquip("S-6");
    await dbTransaction((tx) => alocarNaProva(tx, ev1, [a], null));
    await expect(dbTransaction((tx) => darSaida(tx, ev1, [a, fora], null))).rejects.toThrow();
    expect((await eq2(a))?.status).toBe("alocado");
  });

  it("prova apagada: separado volta a disponível, em campo continua pendente e ainda dá entrada", async () => {
    const ev = Number((await dbRun("INSERT INTO eventos (numero, nome, data) VALUES ('9200', 'Prova Sumiu', '06/12/2026')")).lastInsertRowid);
    const sep = await novoEquip("P-1");
    const fora = await novoEquip("P-2");
    await dbTransaction((tx) => alocarNaProva(tx, ev, [sep, fora], null));
    await dbTransaction((tx) => darSaida(tx, ev, [fora], null));

    await dbBatch(statementsApagarEventos([ev], "Prova saiu do Gestão (sync)"));

    expect((await eq2(sep))?.status).toBe("disponivel");
    expect(await eq2(fora)).toMatchObject({ evento_id: null, status: "em_campo", evento_ref: "#9200 · Prova Sumiu" });
    expect((await acoes(fora)).at(-1)).toBe("prova_removida");
    // não pode ser realocado nem excluído enquanto em campo; o retorno funciona
    await expect(dbTransaction((tx) => alocarNaProva(tx, ev1, [fora], null))).rejects.toThrow(/em campo/);
    await dbTransaction((tx) => registrarRetorno(tx, fora, "ok", null, null));
    expect((await eq2(fora))?.status).toBe("disponivel");
    const ultimo = await dbGet<{ evento_ref: string }>(
      "SELECT evento_ref FROM equipamento_historico WHERE equipamento_id = ? ORDER BY id DESC LIMIT 1",
      fora
    );
    expect(ultimo?.evento_ref).toBe("#9200 · Prova Sumiu");
  });
});

// Por último: no driver LOCAL do libsql, a transação que perde a disputa (SQLITE_BUSY no BEGIN)
// deixa aquela conexão inutilizável para os testes seguintes. No Turso isso não acontece.
describe("concorrência", () => {
  it("concorrência: duas alocações simultâneas do mesmo aparelho → só uma vence", async () => {
    const c = await novoEquip("C-1");
    const res = await Promise.allSettled([
      dbTransaction((tx) => alocarNaProva(tx, ev1, [c], "pessoa A")),
      dbTransaction((tx) => alocarNaProva(tx, ev2, [c], "pessoa B")),
    ]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const final = await equip(c);
    expect([ev1, ev2]).toContain(final?.evento_id);
    const n = await dbGet<{ n: number }>(
      "SELECT COUNT(*) AS n FROM equipamento_historico WHERE equipamento_id = ? AND acao = 'alocado'",
      c
    );
    expect(Number(n?.n)).toBe(1);
  });
});
