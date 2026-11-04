import { describe, expect, it } from "vitest";
import { ehTipoFotoKit, nomeKitDoArquivo } from "./kits-foto";

describe("nomeKitDoArquivo", () => {
  it("usa o nome do arquivo, sem extensão, em maiúsculas", () => {
    expect(nomeKitDoArquivo("INSCRICAO-ESSENCIAL.jpg")).toBe("INSCRICAO ESSENCIAL");
    expect(nomeKitDoArquivo("kit_premium.PNG")).toBe("KIT PREMIUM");
    expect(nomeKitDoArquivo("Kit Inscrição Plus.jpeg")).toBe("KIT INSCRIÇÃO PLUS");
    expect(nomeKitDoArquivo("C:\\fotos\\kit vip.webp")).toBe("KIT VIP");
  });

  it("tira numeração na frente e cópia repetida", () => {
    expect(nomeKitDoArquivo("01 - KIT BASICO.jpg")).toBe("KIT BASICO");
    expect(nomeKitDoArquivo("2_kit-atleta.jpg")).toBe("KIT ATLETA");
    expect(nomeKitDoArquivo("3. Kit Kids.png")).toBe("KIT KIDS");
    expect(nomeKitDoArquivo("kit premium (1).jpg")).toBe("KIT PREMIUM");
    expect(nomeKitDoArquivo("KIT 10K.jpg")).toBe("KIT 10K");
  });

  it("nome genérico de câmera/WhatsApp fica em branco", () => {
    for (const n of [
      "IMG_1234.jpg",
      "IMG-20261104-WA0003.jpg",
      "WhatsApp Image 2026-11-04 at 10.22.31.jpeg",
      "DSC01234.JPG",
      "PXL_20261104_101010.jpg",
      "20261104_153000.jpg",
      "image.png",
      "Screenshot 2026-11-04.png",
      "123.jpg",
      "",
    ]) {
      expect(nomeKitDoArquivo(n), n).toBe("");
    }
  });

  it("tipos de foto aceitos", () => {
    expect(ehTipoFotoKit("image/jpeg")).toBe(true);
    expect(ehTipoFotoKit("image/webp")).toBe(true);
    expect(ehTipoFotoKit("image/svg+xml")).toBe(false);
    expect(ehTipoFotoKit("application/pdf")).toBe(false);
  });
});
