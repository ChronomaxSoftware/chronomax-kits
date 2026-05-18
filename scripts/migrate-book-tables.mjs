// Cria as tabelas evento_itens_gestao e evento_equipe_gestao na chronomax.db
// e, opcionalmente, repopula a partir dos HTMLs de debug.
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve("data/chronomax.db");
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS evento_itens_gestao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  quantidade REAL NOT NULL DEFAULT 0,
  unidade TEXT,
  FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_evento_itens_gestao_evento_id ON evento_itens_gestao(evento_id);

CREATE TABLE IF NOT EXISTS evento_equipe_gestao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evento_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  funcao TEXT,
  cpf_prefixo TEXT,
  FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_evento_equipe_gestao_evento_id ON evento_equipe_gestao(evento_id);
`);

console.log("Tabelas criadas/garantidas.");

// Repopula a partir dos HTMLs de debug. Reusa o parseEventoHTML do projeto via tsx.
const { parseEventoHTML } = await import("../lib/parser.ts");

const debugDir = path.resolve("data/debug");
const arquivos = fs
  .readdirSync(debugDir)
  .filter((f) => /^evento-\d+\.html$/.test(f));

console.log(`Processando ${arquivos.length} HTMLs de evento...`);

const insItem = db.prepare(
  "INSERT INTO evento_itens_gestao (evento_id, nome, quantidade, unidade) VALUES (?, ?, ?, ?)"
);
const insEquipe = db.prepare(
  "INSERT INTO evento_equipe_gestao (evento_id, nome, funcao, cpf_prefixo) VALUES (?, ?, ?, ?)"
);
const delItens = db.prepare("DELETE FROM evento_itens_gestao WHERE evento_id = ?");
const delEquipe = db.prepare("DELETE FROM evento_equipe_gestao WHERE evento_id = ?");

let proc = 0;
let semEvento = 0;
let comItens = 0;
let comEquipe = 0;

for (const f of arquivos) {
  const numero = f.match(/evento-(\d+)\.html/)?.[1];
  if (!numero) continue;
  const row = db.prepare("SELECT id FROM eventos WHERE numero = ?").get(numero);
  if (!row) { semEvento++; continue; }
  const eid = row.id;
  const html = fs.readFileSync(path.join(debugDir, f), "utf-8");
  let dados;
  try {
    dados = parseEventoHTML(html);
  } catch (e) {
    console.log(`  ⚠️ #${numero} parse falhou: ${e.message}`);
    continue;
  }
  delItens.run(eid);
  for (const it of dados.itens_brutos || []) {
    insItem.run(eid, it.nome, it.quantidade, it.unidade);
  }
  delEquipe.run(eid);
  for (const tec of dados.tecnicos_gestao || []) {
    insEquipe.run(eid, tec.nome, tec.funcao, tec.cpf_prefixo);
  }
  proc++;
  if ((dados.itens_brutos || []).length > 0) comItens++;
  if ((dados.tecnicos_gestao || []).length > 0) comEquipe++;
}

console.log(
  `✅ ${proc} processados · ${comItens} com itens · ${comEquipe} com equipe · ${semEvento} sem evento no DB`
);

db.close();
