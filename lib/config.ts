import db from "@/lib/db";
import { criptografar, descriptografar } from "@/lib/cripto";

export function get(chave: string): string | null {
  const r = db.prepare("SELECT valor FROM settings WHERE chave = ?").get(chave) as
    | { valor: string }
    | undefined;
  return r ? r.valor : null;
}

export function set(chave: string, valor: string | null) {
  if (valor === null || valor === "") {
    db.prepare("DELETE FROM settings WHERE chave = ?").run(chave);
  } else {
    db.prepare(
      "INSERT INTO settings (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor"
    ).run(chave, valor);
  }
}

export function getSenhaDescriptografada(): string | null {
  const cripto = get("gestao_senha");
  if (!cripto) return null;
  try {
    return descriptografar(cripto);
  } catch {
    return null;
  }
}

export function setSenha(senha: string) {
  set("gestao_senha", criptografar(senha));
}

function normalizarBaseUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://gestao.chronomax.com.br";
  }
}

export function getConfig() {
  return {
    usuario: get("gestao_usuario") || "",
    senha: getSenhaDescriptografada() || "",
    baseUrl: normalizarBaseUrl(get("gestao_base_url") || "https://gestao.chronomax.com.br"),
    semanas: parseInt(get("gestao_semanas_a_buscar") || "100"),
  };
}
