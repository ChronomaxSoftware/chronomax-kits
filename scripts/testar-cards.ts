import fs from "fs";
import { parseEventoHTML } from "../lib/parser";

const html = fs.readFileSync("data/debug/evento-4733.html", "utf-8");
const r = parseEventoHTML(html);
console.log("=== EVENTO 4733 ===");
console.log("tipo_kit:", r.tipo_kit);
console.log("total técnicos:", r.tecnicos_gestao.length);
console.log("com is_entrega_kit:", r.tecnicos_gestao.filter((t) => t.is_entrega_kit).length);
r.tecnicos_gestao.forEach((t, i) => {
  console.log(
    `  ${i} | EK=${String(t.cache_ek).padStart(5)} | fn=${(t.funcao || "-").padEnd(10)} | cpf=${(t.cpf_prefixo || "-").padEnd(12)} | ${t.nome}`
  );
});

const html2 = fs.readFileSync("data/debug/evento-4906.html", "utf-8");
const r2 = parseEventoHTML(html2);
console.log();
console.log("=== EVENTO 4906 (todos alocados) ===");
console.log("tipo_kit:", r2.tipo_kit);
console.log("total técnicos:", r2.tecnicos_gestao.length);
console.log("qtd_celulares:", r2.qtd_celulares);
console.log(
  "itens GoRunKing:",
  r2.itens_brutos.filter((i) => /GoRunKing/i.test(i.nome)).map((i) => i.nome)
);
