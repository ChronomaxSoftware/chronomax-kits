import { describe, expect, it } from "vitest";
import { passosInstalar, plataforma } from "./instalar-app";

describe("plataforma", () => {
  it("separa iPhone Safari, iPhone com outro navegador, Android e computador", () => {
    expect(plataforma("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1")).toBe("ios-safari");
    expect(plataforma("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 CriOS/126.0 Mobile/15E148 Safari/604.1")).toBe("ios-outro");
    expect(plataforma("Mozilla/5.0 (Linux; Android 14; moto g54) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36")).toBe("android");
    expect(plataforma("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0")).toBe("outro");
  });
  it("cada plataforma tem passo a passo", () => {
    expect(passosInstalar("ios-safari").join(" ")).toMatch(/Tela de Início/);
    expect(passosInstalar("android").join(" ")).toMatch(/⋮/);
    expect(passosInstalar("ios-outro").join(" ")).toMatch(/Safari/);
  });
});
