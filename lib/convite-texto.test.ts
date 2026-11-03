import { describe, expect, it } from "vitest";
import { linkWhatsAppSemNumero, mensagemConviteUsuario } from "./convite-texto";

describe("mensagem do link de senha do usuário", () => {
  const m = mensagemConviteUsuario("Maria Souza", "maria", "https://x/acesso/u/abc");
  it("tem link, login, validade e como salvar como app", () => {
    expect(m).toMatch(/^Olá Maria!/);
    expect(m).toContain("https://x/acesso/u/abc");
    expect(m).toContain("O seu login é: maria");
    expect(m).toMatch(/24 horas/);
    expect(m).toMatch(/Android \(Chrome\): menu ⋮/);
    expect(m).toMatch(/iPhone \(Safari\): Compartilhar ⬆/);
  });
  it("WhatsApp sem número abre a escolha do contato", () => {
    expect(linkWhatsAppSemNumero("a b")).toBe("https://wa.me/?text=a%20b");
  });
});
