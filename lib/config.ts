import { dbGet, dbRun } from "@/lib/db";
import { criptografar, descriptografar } from "@/lib/cripto";

export async function get(chave: string): Promise<string | null> {
  const r = await dbGet<{ valor: string }>("SELECT valor FROM settings WHERE chave = ?", chave);
  return r ? r.valor : null;
}

export async function set(chave: string, valor: string | null) {
  if (valor === null || valor === "") {
    await dbRun("DELETE FROM settings WHERE chave = ?", chave);
  } else {
    await dbRun(
      "INSERT INTO settings (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor",
      chave,
      valor
    );
  }
}

export async function getSenhaDescriptografada(): Promise<string | null> {
  const cripto = await get("gestao_senha");
  if (!cripto) return null;
  try {
    return descriptografar(cripto);
  } catch {
    return null;
  }
}

export async function setSenha(senha: string) {
  await set("gestao_senha", criptografar(senha));
}

function normalizarBaseUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://gestao.chronomax.com.br";
  }
}

export async function getConfig() {
  return {
    usuario: (await get("gestao_usuario")) || "",
    senha: (await getSenhaDescriptografada()) || "",
    baseUrl: normalizarBaseUrl((await get("gestao_base_url")) || "https://gestao.chronomax.com.br"),
    semanas: parseInt((await get("gestao_semanas_a_buscar")) || "100"),
  };
}
