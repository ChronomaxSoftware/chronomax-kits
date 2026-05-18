// Re-parseia todos os HTMLs em data/debug/evento-*.html e atualiza no banco:
//   - eventos.tipo_kit
//   - evento_equipe_gestao (com is_entrega_kit + cache_ek)
//   - evento_itens_gestao
// Útil pra aplicar mudanças no parser sem rodar sync completo (19+ min).
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve("data/chronomax.db");
const db = new Database(dbPath);

// garante colunas novas (idempotente)
const colExiste = (tab, col) =>
  db.prepare(`PRAGMA table_info(${tab})`).all().some((c) => c.name === col);
if (!colExiste("evento_equipe_gestao", "is_entrega_kit")) {
  db.exec("ALTER TABLE evento_equipe_gestao ADD COLUMN is_entrega_kit INTEGER DEFAULT 0");
}
if (!colExiste("evento_equipe_gestao", "cache_ek")) {
  db.exec("ALTER TABLE evento_equipe_gestao ADD COLUMN cache_ek INTEGER DEFAULT 0");
}

const { parseEventoHTML } = await import("../lib/parser.ts");

const debugDir = path.resolve("data/debug");
const arquivos = fs
  .readdirSync(debugDir)
  .filter((f) => /^evento-\d+\.html$/.test(f));

console.log(`Processando ${arquivos.length} HTMLs...`);

const updTipoKit = db.prepare("UPDATE eventos SET tipo_kit = ? WHERE id = ?");
const delItens = db.prepare("DELETE FROM evento_itens_gestao WHERE evento_id = ?");
const delEquipe = db.prepare("DELETE FROM evento_equipe_gestao WHERE evento_id = ?");
const delEventoTec = db.prepare("DELETE FROM evento_tecnicos WHERE evento_id = ?");
const insItem = db.prepare(
  "INSERT INTO evento_itens_gestao (evento_id, nome, quantidade, unidade) VALUES (?, ?, ?, ?)"
);
const insEquipe = db.prepare(
  "INSERT INTO evento_equipe_gestao (evento_id, nome, funcao, cpf_prefixo, is_entrega_kit, cache_ek) VALUES (?, ?, ?, ?, ?, ?)"
);
const findTecnico = db.prepare(
  "SELECT id FROM tecnicos WHERE cpf_prefixo = ? OR LOWER(nome) = LOWER(?) LIMIT 1"
);
const insTecnico = db.prepare(
  "INSERT INTO tecnicos (nome, cpf_prefixo) VALUES (?, ?)"
);
const ligaTecnico = db.prepare(
  "INSERT INTO evento_tecnicos (evento_id, tecnico_id) VALUES (?, ?) ON CONFLICT DO NOTHING"
);

let proc = 0;
let semEvento = 0;
let entrega = 0;
let sistema = 0;
let nulos = 0;
let totalEntregaKit = 0;
let falhas = 0;

for (const f of arquivos) {
  const numero = f.match(/evento-(\d+)\.html/)?.[1];
  if (!numero) continue;
  const row = db.prepare("SELECT id FROM eventos WHERE numero = ?").get(numero);
  if (!row) {
    semEvento++;
    continue;
  }
  const eid = row.id;
  const html = fs.readFileSync(path.join(debugDir, f), "utf-8");
  let dados;
  try {
    dados = parseEventoHTML(html);
  } catch (e) {
    console.log(`  ⚠️ #${numero} parse falhou: ${e.message}`);
    falhas++;
    continue;
  }

  updTipoKit.run(dados.tipo_kit, eid);
  if (dados.tipo_kit === "entrega") entrega++;
  else if (dados.tipo_kit === "sistema") sistema++;
  else nulos++;

  delItens.run(eid);
  for (const it of dados.itens_brutos || []) {
    insItem.run(eid, it.nome, it.quantidade, it.unidade);
  }

  delEquipe.run(eid);
  delEventoTec.run(eid);
  for (const tec of dados.tecnicos_gestao || []) {
    insEquipe.run(
      eid,
      tec.nome,
      tec.funcao,
      tec.cpf_prefixo,
      tec.is_entrega_kit ? 1 : 0,
      tec.cache_ek || 0
    );
    if (tec.is_entrega_kit) {
      totalEntregaKit++;
      // só liga em evento_tecnicos quem é da entrega de kit
      let row = findTecnico.get(tec.cpf_prefixo, tec.nome);
      if (!row) {
        const r = insTecnico.run(tec.nome, tec.cpf_prefixo);
        row = { id: r.lastInsertRowid };
      }
      ligaTecnico.run(eid, row.id);
    }
  }

  proc++;
}

console.log();
console.log(`✅ ${proc} processados | ${falhas} falhas | ${semEvento} sem evento no DB`);
console.log(`   tipo_kit: ${entrega} entrega · ${sistema} sistema · ${nulos} null`);
console.log(`   técnicos com is_entrega_kit=1: ${totalEntregaKit}`);

db.close();
