import type { MetadataRoute } from "next";

/**
 * App instalável (ícone na tela inicial do celular). Abre no /abrir, que manda quem
 * está logado para o lugar certo: técnico → /portal, escritório → início.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kits Gestão",
    short_name: "Kits Gestão",
    description: "Entregas de kit da Chronomax",
    id: "/",
    start_url: "/abrir",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
