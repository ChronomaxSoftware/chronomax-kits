import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const one = async (sql) => Number((await client.execute(sql)).rows[0]?.n || 0);

console.log("== Totais ==");
console.log("eventos:", await one("SELECT COUNT(*) n FROM eventos"));
console.log("eventos com kit (tem_kit=1):", await one("SELECT COUNT(*) n FROM eventos WHERE tem_kit=1"));
console.log("evento_tecnicos (vínculos):", await one("SELECT COUNT(*) n FROM evento_tecnicos"));
console.log("evento_equipe_gestao (snapshot):", await one("SELECT COUNT(*) n FROM evento_equipe_gestao"));
console.log("equipe marcada is_entrega_kit=1:", await one("SELECT COUNT(*) n FROM evento_equipe_gestao WHERE is_entrega_kit=1"));
console.log("equipe com cache_ek>0:", await one("SELECT COUNT(*) n FROM evento_equipe_gestao WHERE cache_ek>0"));

console.log("\n== Por evento de kit (20 mais recentes): tecnicos vinculados x equipe total x equipe_kit ==");
const r = await client.execute(`
  SELECT e.numero, substr(e.nome,1,32) AS nome, e.tipo_kit,
    (SELECT COUNT(*) FROM evento_tecnicos et WHERE et.evento_id=e.id) AS tecnicos,
    (SELECT COUNT(*) FROM evento_equipe_gestao eg WHERE eg.evento_id=e.id) AS equipe,
    (SELECT COUNT(*) FROM evento_equipe_gestao eg WHERE eg.evento_id=e.id AND eg.is_entrega_kit=1) AS equipe_kit
  FROM eventos e WHERE e.tem_kit=1
  ORDER BY e.id DESC LIMIT 20
`);
for (const x of r.rows) {
  console.log(
    `#${x.numero} [${x.tipo_kit ?? "-"}] ${x.nome} | vinculados:${x.tecnicos} equipe:${x.equipe} equipe_kit:${x.equipe_kit}`
  );
}

console.log("\n== Distribuição de funcao na equipe (top) ==");
const f = await client.execute(
  "SELECT COALESCE(funcao,'(null)') funcao, COUNT(*) n, SUM(is_entrega_kit) kit FROM evento_equipe_gestao GROUP BY funcao ORDER BY n DESC LIMIT 15"
);
for (const x of f.rows) console.log(`funcao=${x.funcao} | total:${x.n} | is_entrega_kit:${x.kit}`);
