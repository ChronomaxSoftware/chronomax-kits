// Corrige os eventos sem UF já gravados, usando a mesma regra do sync (lib/cidade-uf.ts).
// Só mexe em eventos com uf vazia.
// Rodar: node scripts/corrigir-uf-eventos.mjs            (simula)
//        node scripts/corrigir-uf-eventos.mjs --aplicar  (grava no Turso)
import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import { parseCidadeUf } from "../lib/cidade-uf.ts";

for (const linha of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = linha.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const aplicar = process.argv.includes("--aplicar");
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const { rows } = await db.execute("SELECT id, numero, cidade FROM eventos WHERE uf IS NULL OR TRIM(uf) = ''");

const updates = [];
for (const e of rows) {
  const p = parseCidadeUf(e.cidade);
  if (!p.uf) {
    console.log(`  continua sem UF: #${e.numero} ${JSON.stringify(e.cidade)}`);
    continue;
  }
  console.log(`  #${e.numero} ${JSON.stringify(e.cidade)} -> ${p.cidade} / ${p.uf}`);
  updates.push({ sql: "UPDATE eventos SET cidade = ?, uf = ? WHERE id = ?", args: [p.cidade, p.uf, e.id] });
}
console.log(`${rows.length} evento(s) sem UF; ${updates.length} serão corrigido(s).`);
if (!aplicar) {
  console.log("Simulação. Use --aplicar para gravar.");
} else if (updates.length > 0) {
  await db.batch(updates, "write");
  console.log("Gravado.");
}
