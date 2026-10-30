/** Instruções para fixar o portal na tela inicial do celular (vira um "app"). */

export type Plataforma = "ios-safari" | "ios-outro" | "android" | "outro";

export function plataforma(userAgent: string): Plataforma {
  const ua = String(userAgent || "");
  // iPadOS se apresenta como Mac; o toque denuncia, mas aqui basta iPhone/iPad/iPod
  if (/iPhone|iPad|iPod/i.test(ua)) {
    // Chrome/Firefox/Edge no iPhone (CriOS/FxiOS/EdgiOS) não instalam: só o Safari
    return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? "ios-outro" : "ios-safari";
  }
  if (/Android/i.test(ua)) return "android";
  return "outro";
}

export function passosInstalar(p: Plataforma): string[] {
  switch (p) {
    case "ios-safari":
      return [
        "Toque no botão Compartilhar (o quadrado com a seta para cima ⬆, embaixo ou no topo da tela).",
        "Role e toque em \"Adicionar à Tela de Início\".",
        "Toque em \"Adicionar\". Pronto: abra pelo ícone Chronomax.",
      ];
    case "ios-outro":
      return [
        "No iPhone só dá para instalar pelo Safari.",
        "Copie o endereço desta página, abra no Safari e entre com seu telefone e senha.",
        "No Safari: Compartilhar ⬆ → \"Adicionar à Tela de Início\".",
      ];
    case "android":
      return [
        "Toque no menu ⋮ (três pontinhos no canto de cima do Chrome).",
        "Toque em \"Instalar app\" ou \"Adicionar à tela inicial\".",
        "Confirme. Pronto: abra pelo ícone Chronomax.",
      ];
    default:
      return [
        "Abra este endereço no navegador do seu celular e entre com seu telefone e senha.",
        "Android (Chrome): menu ⋮ → \"Instalar app\" / \"Adicionar à tela inicial\".",
        "iPhone (Safari): Compartilhar ⬆ → \"Adicionar à Tela de Início\".",
      ];
  }
}
