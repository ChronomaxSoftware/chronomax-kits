import fs from "fs";
import path from "path";
import { parseEventoHTML } from "../lib/parser";

const dir = path.join(process.cwd(), "data", "debug");
const arquivos = fs.readdirSync(dir).filter((f) => /^evento-\d+\.html$/.test(f));

let okCount = 0;
let falhas: { arquivo: string; erro: string; stack: string }[] = [];

for (const arq of arquivos) {
  const html = fs.readFileSync(path.join(dir, arq), "utf-8");
  try {
    parseEventoHTML(html);
    okCount++;
  } catch (e) {
    falhas.push({
      arquivo: arq,
      erro: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error && e.stack ? e.stack : "",
    });
  }
}

console.log(`Testados: ${arquivos.length} | OK: ${okCount} | Falhas: ${falhas.length}`);
for (const f of falhas) {
  console.log(`\n--- ${f.arquivo} ---`);
  console.log(f.erro);
  console.log(f.stack);
}
