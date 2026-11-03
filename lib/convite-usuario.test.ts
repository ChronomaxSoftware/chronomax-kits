import { describe, expect, it } from "vitest";
import { estadoConviteUsuario, expiraConviteUsuario } from "./convite-usuario";

describe("link de senha do usuário do escritório", () => {
  const agora = new Date("2026-11-03T12:00:00Z");

  it("vence em 24h", () => {
    expect(expiraConviteUsuario(agora)).toBe("2026-11-04T12:00:00.000Z");
  });

  it("vale só uma vez, no prazo e com usuário ativo", () => {
    const base = { usado_em: null, expira_em: "2026-11-04T12:00:00.000Z", ativo: 1 };
    expect(estadoConviteUsuario(base, agora)).toEqual({ ok: true });
    expect(estadoConviteUsuario(undefined, agora).ok).toBe(false);
    expect(estadoConviteUsuario({ ...base, usado_em: "2026-11-03T11:00:00Z" }, agora)).toMatchObject({ ok: false, erro: expect.stringMatching(/já foi usado/) });
    expect(estadoConviteUsuario({ ...base, expira_em: "2026-11-03T11:59:59Z" }, agora)).toMatchObject({ ok: false, erro: expect.stringMatching(/venceu/) });
    expect(estadoConviteUsuario({ ...base, ativo: 0 }, agora)).toMatchObject({ ok: false, erro: expect.stringMatching(/desativado/) });
    expect(estadoConviteUsuario({ ...base, expira_em: "lixo" }, agora).ok).toBe(false);
  });
});
