import { describe, expect, it } from "vitest";
import { destinoDoRole, normalizarPerfil, podeMudarPerfil, roleDoPerfil, telaoPodeAcessar } from "./perfil-usuario";

describe("perfil do usuário", () => {
  it("perfil vira role da sessão (padrão = acesso total)", () => {
    expect(roleDoPerfil("telao")).toBe("telao");
    expect(roleDoPerfil("total")).toBe("admin");
    expect(roleDoPerfil(null)).toBe("admin");
    expect(normalizarPerfil("qualquer")).toBe("total");
  });

  it("cada um entra no seu lugar", () => {
    expect(destinoDoRole("tecnico")).toBe("/portal");
    expect(destinoDoRole("telao")).toBe("/telao");
    expect(destinoDoRole("admin")).toBe("/");
  });

  it("Só Telão acessa só a aba e as APIs dela", () => {
    for (const ok of ["/telao", "/api/telao", "/api/telao/12", "/abrir"]) expect(telaoPodeAcessar(ok)).toBe(true);
    for (const nao of ["/", "/config", "/eventos/1", "/api/usuarios", "/api/eventos", "/api/alertas", "/telaox", "/portal"]) {
      expect(telaoPodeAcessar(nao)).toBe(false);
    }
  });

  it("não deixa mudar o próprio perfil nem ficar sem acesso total", () => {
    expect(podeMudarPerfil(1, 1, "telao", true, 3)).toMatch(/próprio/);
    expect(podeMudarPerfil(2, 1, "telao", true, 1)).toMatch(/pelo menos um/);
    expect(podeMudarPerfil(2, 1, "telao", true, 2)).toBeNull();
    expect(podeMudarPerfil(2, 1, "total", false, 1)).toBeNull();
  });
});
