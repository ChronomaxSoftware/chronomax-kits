// Sondagem READ-ONLY da API do Gestão para descobrir o filtro mais barato
// de /proposals sem perder eventos. Usa as credenciais salvas no Turso.
// Rodar: node scripts/probe-gestao.mjs
import { createClient } from "@libsql/client";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// ── carregar .env.local manualmente ──
const envPath = path.join(process.cwd(), ".env.local");
for (const linha of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = linha.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

// ── descriptografar (mesma lógica de lib/cripto.ts) ──
const KEY_SOURCE = process.env.SESSION_SECRET || "chronomax-kits-super-secret-password-change-in-production-32chars";
const key = crypto.createHash("sha256").update(KEY_SOURCE).digest();
function descriptografar(b64) {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 16), tag = buf.subarray(16, 32), enc = buf.subarray(32);
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const get = async (chave) => (await db.execute({ sql: "SELECT valor FROM settings WHERE chave = ?", args: [chave] })).rows[0]?.valor ?? null;

const usuario = await get("gestao_usuario");
const senhaCripto = await get("gestao_senha");
const baseUrlRaw = (await get("gestao_base_url")) || "https://gestao.chronomax.com.br";
const senha = descriptografar(senhaCripto);
const baseUrl = (() => { const u = new URL(baseUrlRaw); return `${u.protocol}//${u.host}`; })();
const api = (p) => `${baseUrl}/api${p}`;

console.log(`Base: ${baseUrl}  Usuário: ${usuario}`);

// ── login ──
const loginRes = await fetch(api("/auth/login"), {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: usuario, password: senha }),
});
if (!loginRes.ok) { console.error("LOGIN FALHOU", loginRes.status, await loginRes.text()); process.exit(1); }
const token = (await loginRes.json()).token;
const H = { Authorization: `Bearer ${token}` };

// helper: roda uma query, mede tempo, conta e resume status
async function probe(nome, qs) {
  const t = Date.now();
  const res = await fetch(api(`/proposals?${qs}`), { headers: H });
  const ms = ((Date.now() - t) / 1000).toFixed(1);
  if (!res.ok) { console.log(`\n[${nome}] HTTP ${res.status} em ${ms}s — ${qs}`); return; }
  const data = await res.json();
  const props = data.proposals || [];
  const porStatus = {};
  for (const p of props) porStatus[p.status] = (porStatus[p.status] || 0) + 1;
  const comItens = props.filter((p) => Array.isArray(p.items) && p.items.length > 0).length;
  console.log(`\n[${nome}] ${ms}s · ${props.length} propostas · com itens: ${comItens} · total(pagination): ${data.pagination?.total ?? "?"}`);
  console.log(`   query: ${qs}`);
  console.log(`   status:`, porStatus);
}

// Testes (do mais barato ao mais pesado). Evito repetir o full pesado (já medido em ~38s).
await probe("status=aprovada (sem itens)", "limit=10000&status=aprovada");
await probe("status=aprovada (com itens)", "limit=10000&status=aprovada&includeItems=true");
await probe("status=em_negociacao (com itens)", "limit=10000&status=em_negociacao&includeItems=true");
await probe("SEM includeItems (todos)", "limit=10000");

process.exit(0);
