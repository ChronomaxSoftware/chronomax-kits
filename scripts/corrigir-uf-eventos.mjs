// Corrige uma vez os eventos sem UF que vieram como "CIDADE/SP" (sigla grudada na cidade).
// Mesma regra de parseCidadeUf em lib/scraper-fetch.ts. Só mexe em eventos com uf vazia.
// Rodar: node scripts/corrigir-uf-eventos.mjs            (simula)
//        node scripts/corrigir-uf-eventos.mjs --aplicar  (grava no Turso)
import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

for (const linha of fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = linha.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const UFS_BR = new Set("AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split(" "));
function parseCidadeUf(raw) {
  if (!raw || !raw.trim()) return { cidade: null, uf: null };
  const t = raw.trim().replace(/[.\s]+$/, "");
  const m = t.match(/^(.+?)\s*[-/]\s*([A-Za-z]{2})$/);
  if (m && UFS_BR.has(m[2].toUpperCase())) return { cidade: m[1].trim(), uf: m[2].toUpperCase() };
  const n = t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  if (n === "SAO PAULO") return { cidade: t, uf: "SP" };
  if (n === "RIO DE JANEIRO") return { cidade: t, uf: "RJ" };
  return { cidade: raw.trim(), uf: null };
}

const aplicar = process.argv.includes("--aplicar");
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const { rows } = await db.execute("SELECT id, cidade FROM eventos WHERE uf IS NULL OR TRIM(uf) = ''");

const updates = [];
for (const e of rows) {
  const p = parseCidadeUf(e.cidade);
  if (!p.uf) continue;
  updates.push({ sql: "UPDATE eventos SET cidade = ?, uf = ? WHERE id = ?", args: [p.cidade, p.uf, e.id] });
}
console.log(`${rows.length} evento(s) sem UF; ${updates.length} serão corrigido(s).`);
if (!aplicar) {
  console.log("Simulação. Use --aplicar para gravar.");
} else if (updates.length > 0) {
  await db.batch(updates, "write");
  console.log("Gravado.");
}
