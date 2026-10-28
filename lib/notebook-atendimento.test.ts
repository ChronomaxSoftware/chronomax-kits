import { describe, expect, it } from "vitest";
import { ehNotebookAtendimento, qtdNotebookAtendimento } from "./notebook-atendimento";
import { parseEventoHTML } from "./parser";

describe("notebook para atendimento", () => {
  it("reconhece o item do Gestão (com ou sem acento) e não o da entrega de kits", () => {
    expect(ehNotebookAtendimento("Locação de Notebook para Eventos - Atendimento")).toBe(true);
    expect(ehNotebookAtendimento("LOCACAO DE NOTEBOOK PARA EVENTOS - ATENDIMENTO")).toBe(true);
    expect(ehNotebookAtendimento("Locação de Notebook para Entrega de Kits")).toBe(false);
  });

  it("soma as unidades; 0 quando não tem", () => {
    expect(
      qtdNotebookAtendimento([
        { nome: "Locação de Notebook para Eventos - Atendimento", quantidade: 3 },
        { nome: "Estação de Entrega de Kits", quantidade: 5 },
      ])
    ).toBe(3);
    expect(qtdNotebookAtendimento([])).toBe(0);
  });

  it("o parser do sync captura o item (linha 'servico' entre o nome e a quantidade)", () => {
    const html = `<html><body>
      <div>Locação de Notebook para Eventos - Atendimento</div>
      <div>servico</div>
      <div>3 unidade</div>
    </body></html>`;
    const r = parseEventoHTML(html);
    expect(qtdNotebookAtendimento(r.itens_brutos)).toBe(3);
  });
});
