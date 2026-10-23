import { describe, expect, it } from "vitest";
import { estadoConvite, gerarTokenConvite, hashTokenConvite } from "./convite";
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

describe("estadoConvite", () => {
  it("novo: cria a senha; usado: vira atalho de login (não vence)", () => {
    expect(estadoConvite({ usado_em: null, ativo: 1, tem_senha: 0 })).toEqual({ modo: "criar_senha" });
    expect(estadoConvite({ usado_em: "2020-01-01", ativo: 1, tem_senha: 1 })).toEqual({ modo: "login" });
  });
  it("recusa inexistente, técnico inativo e acesso removido", () => {
    expect(estadoConvite(undefined).modo).toBe("invalido");
    expect(estadoConvite({ usado_em: null, ativo: 0, tem_senha: 0 })).toMatchObject({ modo: "invalido", erro: expect.stringMatching(/inativo/) });
    expect(estadoConvite({ usado_em: "2026-10-22", ativo: 1, tem_senha: 0 })).toMatchObject({ modo: "invalido", erro: expect.stringMatching(/removido/) });
  });
});

describe("mensagem e WhatsApp", () => {
  it("monta a mensagem com o primeiro nome e o link, sem prazo", () => {
    const m = mensagemConvite("João da Silva", "https://x/acesso/abc");
    expect(m).toContain("Olá João!");
    expect(m).toContain("https://x/acesso/abc");
    expect(m).not.toMatch(/dias/);
  });
  it("wa.me com DDI 55 e texto codificado; telefone inválido → null", () => {
    expect(linkWhatsApp("(51) 98888-7777", "oi tudo")).toBe("https://wa.me/5551988887777?text=oi%20tudo");
    expect(linkWhatsApp("123", "oi")).toBeNull();
  });
});
