import { describe, expect, it } from "vitest";
import { candidatosLogin, loginDeTelefone, resolverLoginTecnico, validarSenhaTecnico } from "./login-tecnico";

describe("loginDeTelefone", () => {
  it("qualquer formato vira DDD + número", () => {
    expect(loginDeTelefone("(51) 99999-0000")).toBe("51999990000");
    expect(loginDeTelefone("+55 51 99999-0000")).toBe("51999990000");
    expect(loginDeTelefone("5551999990000")).toBe("51999990000");
    expect(loginDeTelefone("051999990000")).toBe("51999990000");
    expect(loginDeTelefone("(11) 3333-4444")).toBe("1133334444");
  });
  it("não aceita o que não parece telefone", () => {
    expect(loginDeTelefone("99999-0000")).toBeNull();
    expect(loginDeTelefone("joao.silva")).toBeNull();
    expect(loginDeTelefone("")).toBeNull();
  });
});

describe("resolverLoginTecnico", () => {
  it("login manual tem prioridade", () => {
    expect(resolverLoginTecnico("joao.silva", "(51) 99999-0000", true)).toBe("joao.silva");
  });
  it("login manual com cara de telefone é canonizado", () => {
    expect(resolverLoginTecnico("(51) 99999-0000", null, true)).toBe("51999990000");
  });
  it("sem login manual, usa o telefone só quando há senha", () => {
    expect(resolverLoginTecnico("", "(51) 99999-0000", true)).toBe("51999990000");
    expect(resolverLoginTecnico("", "(51) 99999-0000", false)).toBeNull();
    expect(resolverLoginTecnico("", "123", true)).toBeNull();
  });
});

describe("candidatosLogin", () => {
  it("telefone formatado procura também a forma canônica", () => {
    expect(candidatosLogin(" (51) 99999-0000 ")).toEqual(["(51) 99999-0000", "51999990000"]);
    expect(candidatosLogin("51999990000")).toEqual(["51999990000"]);
    expect(candidatosLogin("joao.silva")).toEqual(["joao.silva"]);
  });
});

describe("validarSenhaTecnico", () => {
  it("mínimo de 8 caracteres; vazio = não está trocando", () => {
    expect(validarSenhaTecnico("1234567")).toMatch(/8 caracteres/);
    expect(validarSenhaTecnico("12345678")).toBeNull();
    expect(validarSenhaTecnico("")).toBeNull();
    expect(validarSenhaTecnico(undefined)).toBeNull();
  });
});
