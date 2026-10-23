/**
 * Confere (no proxy) se o dono da sessão ainda está ativo. O cookie da sessão vale 30
 * dias; sem esta checagem, um usuário/técnico desativado continuaria entrando até ele
 * expirar. Cache curto por processo para não consultar o banco a cada requisição —
 * por isso quem é desativado perde o acesso em até 1 minuto (TTL), não na hora.
 */

import { dbGet } from "./db";
import type { SessionData } from "./session";

const TTL_MS = 60_000;
const cache = new Map<string, { ativo: boolean; ate: number }>();

function chave(s: SessionData): string | null {
  if (s.role === "tecnico" && s.tecnicoId) return `t:${s.tecnicoId}`;
  if (s.role === "admin" && s.userId) return `u:${s.userId}`;
  return null;
}

export async function sessaoAtiva(s: SessionData): Promise<boolean> {
  const k = chave(s);
  if (!k) return false;
  const c = cache.get(k);
  if (c && c.ate > Date.now()) return c.ativo;

  let ativo: boolean;
  try {
    const row =
      s.role === "tecnico"
        ? await dbGet<{ ok: number }>(
            "SELECT 1 AS ok FROM tecnicos WHERE id = ? AND ativo = 1 AND senha_hash IS NOT NULL AND senha_hash != ''",
            s.tecnicoId
          )
        : await dbGet<{ ok: number }>("SELECT 1 AS ok FROM users WHERE id = ? AND COALESCE(ativo, 1) = 1", s.userId);
    ativo = !!row;
  } catch (err) {
    // Falha de banco não pode trancar todo mundo fora: deixa passar e tenta de novo no próximo pedido
    console.error("[acesso] não foi possível conferir a sessão", err);
    return true;
  }
  cache.set(k, { ativo, ate: Date.now() + TTL_MS });
  return ativo;
}
