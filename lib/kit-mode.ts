/**
 * Classificação do tipo de contratação de entrega de kit de um evento, a partir
 * dos itens contratados no Gestão.
 *
 *  - OPERATION   = a Chronomax opera a entrega de kit presencialmente
 *                  (item "Estação de Entrega de Kits" ou "Técnico ... Entrega de Kits").
 *                  → carrega técnicos, escala, dashboard, QR, relatórios.
 *  - SYSTEM_ONLY = a Chronomax só fornece o sistema (item "Sistema Para Entrega
 *                  De Kits ... Locação por Login/Estação"). → sem equipe operacional.
 *  - null        = evento sem item de entrega de kit.
 */
export type DeliveryKitMode = "OPERATION" | "SYSTEM_ONLY" | null;

function norm(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // remove acentos
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function classificarKit(itemNames: (string | null | undefined)[]): DeliveryKitMode {
  let station = false;
  let tecnico = false;
  let locacao = false;

  for (const raw of itemNames) {
    const n = norm(raw);
    if (!n) continue;

    // Operação presencial: estação física de entrega ou técnico especializado contratado
    if (n.includes("estacao de entrega de kit")) station = true;
    if (n.includes("tecnico") && n.includes("entrega") && n.includes("kit")) tecnico = true;

    // Apenas locação do sistema
    if (
      n.includes("sistema para entrega de kit") ||
      n.includes("locacao por login") ||
      n.includes("locacao por estacao")
    ) {
      locacao = true;
    }
  }

  if (station || tecnico) return "OPERATION"; // operação tem precedência (ex.: evento com ambos os itens)
  if (locacao) return "SYSTEM_ONLY";
  return null;
}

/** Mapeia o modo para o campo `tipo_kit` persistido (compatível com o que já existe). */
export function tipoKitDeModo(modo: DeliveryKitMode): "entrega" | "sistema" | null {
  if (modo === "OPERATION") return "entrega";
  if (modo === "SYSTEM_ONLY") return "sistema";
  return null;
}
