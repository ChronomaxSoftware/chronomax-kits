import { describe, expect, it } from "vitest";
import { expiracaoConvite, gerarTokenConvite, hashTokenConvite, motivoConviteInvalido } from "./convite";
import { linkWhatsApp, mensagemConvite } from "./convite-texto";

describe("token do convite", () => {
  it("é longo, aleatório e o hash é estável", () => {
    const a = gerarTokenConvite();
    const b = gerarTokenConvite();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hashTokenConvite(a)).toBe(hashTokenConvite(a));
    expect(hashTokenConvite(a)).not.toBe(a);
  });
});

describe("motivoConviteInvalido", () => {
  const agora = new Date("2026-10-23T12:00:00Z");
  it("válido dentro do prazo e sem uso", () => {
    expect(motivoConviteInvalido({ usado_em: null, expira_em: expiracaoConvite(agora) }, agora)).toBeNull();
  });
  it("recusa inexistente, usado e vencido", () => {
    expect(motivoConviteInvalido(undefined, agora)).toMatch(/inválido/);
    expect(motivoConviteInvalido({ usado_em: "2026-10-22", expira_em: expiracaoConvite(agora) }, agora)).toMatch(/já foi usado/);
    expect(motivoConviteInvalido({ usado_em: null, expira_em: "2026-10-23T11:59:59Z" }, agora)).toMatch(/expirou/);
  });
});

describe("mensagem e WhatsApp", () => {
  it("monta a mensagem com o primeiro nome e o link", () => {
    const m = mensagemConvite("João da Silva", "https://x/acesso/abc");
    expect(m).toContain("Olá João!");
    expect(m).toContain("https://x/acesso/abc");
  });
  it("wa.me com DDI 55 e texto codificado; telefone inválido → null", () => {
    expect(linkWhatsApp("(51) 98888-7777", "oi tudo")).toBe("https://wa.me/5551988887777?text=oi%20tudo");
    expect(linkWhatsApp("123", "oi")).toBeNull();
  });
});
