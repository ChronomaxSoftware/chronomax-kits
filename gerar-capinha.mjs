import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const dir = "C:/Users/CHRONOMAX_1/Desktop/capinha e cordão para fazer";
const logoPath = "C:/Users/CHRONOMAX_1/Desktop/teste/grupo watssap/WhatsApp Image 2026-03-16 at 16.14.51.jpeg";

const logoB64 = fs.readFileSync(logoPath).toString("base64");
const logoData = `data:image/jpeg;base64,${logoB64}`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="1080" height="2160" viewBox="0 0 1080 2160" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="fundo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#0A0E13"/>
      <stop offset="35%" stop-color="#0A0E13"/>
      <stop offset="55%" stop-color="#0F4F82"/>
      <stop offset="80%" stop-color="#1789C7"/>
      <stop offset="100%" stop-color="#1FA0DC"/>
    </linearGradient>
    <linearGradient id="azul1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1FA0DC"/><stop offset="100%" stop-color="#0F65A0"/>
    </linearGradient>
    <linearGradient id="azul2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2EB0E8"/><stop offset="100%" stop-color="#1789C7"/>
    </linearGradient>
    <linearGradient id="azul3" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F4F82"/><stop offset="100%" stop-color="#082B4A"/>
    </linearGradient>
    <linearGradient id="azul4" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3EBEEF"/><stop offset="100%" stop-color="#1FA0DC"/>
    </linearGradient>
    <radialGradient id="vinheta" cx="50%" cy="50%" r="75%">
      <stop offset="60%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.35)"/>
    </radialGradient>

    <!-- Filtro chromakey: deixa só pixels claros (brancos) visíveis em branco, resto transparente -->
    <filter id="iconeLimpo" x="0" y="0" width="100%" height="100%">
      <feColorMatrix type="luminanceToAlpha" result="luma"/>
      <feComponentTransfer in="luma" result="thresh">
        <feFuncA type="table" tableValues="0 0 0 0 0 0 0 0.5 1 1"/>
      </feComponentTransfer>
      <feFlood flood-color="#FFFFFF" result="branco"/>
      <feComposite in="branco" in2="thresh" operator="in"/>
    </filter>
  </defs>

  <rect x="0" y="0" width="1080" height="2160" fill="url(#fundo)"/>

  <g opacity="0.95">
    <polygon points="200,1300 700,1450 350,1700"  fill="url(#azul3)"/>
    <polygon points="700,1450 1080,1380 1080,1750" fill="url(#azul1)"/>
    <polygon points="350,1700 700,1450 720,1880"   fill="url(#azul2)"/>
    <polygon points="720,1880 1080,1750 1080,2050" fill="url(#azul4)"/>
    <polygon points="0,1800 350,1700 720,1880 0,2160" fill="url(#azul3)"/>
    <polygon points="720,1880 1080,2050 1080,2160 600,2160" fill="url(#azul1)"/>
    <polygon points="0,2160 600,2160 0,2050" fill="url(#azul2)"/>
    <polygon points="500,1550 850,1500 700,1700" fill="url(#azul4)" opacity="0.55"/>
    <polygon points="100,1950 400,1880 250,2100" fill="url(#azul1)" opacity="0.65"/>
    <polygon points="800,1950 1050,1900 950,2100" fill="url(#azul2)" opacity="0.55"/>
    <polygon points="450,1850 650,1820 580,2000" fill="url(#azul4)" opacity="0.4"/>
  </g>

  <rect x="0" y="0" width="1080" height="2160" fill="url(#vinheta)"/>

  <!-- Logo: ícone (com chromakey) + texto CHRONOMAX em linha, igual camiseta -->
  <g transform="translate(540, 480)" text-anchor="middle"
     font-family="Arial Black, Helvetica, sans-serif">
    <!-- Ícone do cronômetro com filtro removendo fundo azul -->
    <image x="-440" y="-130" width="240" height="240"
           href="${logoData}" filter="url(#iconeLimpo)"/>

    <!-- Texto à direita do ícone (alinhado à esquerda do conjunto) -->
    <g transform="translate(60, 0)">
      <text font-size="120" font-weight="900" letter-spacing="2" text-anchor="middle">
        <tspan fill="#FFFFFF">CHRONO</tspan><tspan fill="#1FA0DC">MAX</tspan><tspan fill="#FFFFFF" font-size="60" baseline-shift="40%">®</tspan>
      </text>
      <text y="80" font-size="36" fill="#FFFFFF" letter-spacing="6" font-weight="300" text-anchor="middle">
        MUITO ALÉM DO SEU TEMPO
      </text>
    </g>
  </g>

  <!-- Coroa GO no rodapé -->
  <g transform="translate(540, 1980)" text-anchor="middle"
     font-family="Arial Black, Helvetica, sans-serif" fill="#FFFFFF">
    <path d="M -90,-30 L -75,-70 L -60,-30 L -30,-80 L 0,-30 L 30,-80 L 60,-30 L 75,-70 L 90,-30 Z
             M -100,-30 L 100,-30 L 100,0 L -100,0 Z"
          fill="#FFFFFF"/>
    <circle cx="-75" cy="-72" r="6" fill="#FFFFFF"/>
    <circle cx="-30" cy="-82" r="6" fill="#FFFFFF"/>
    <circle cx="0"   cy="-32" r="6" fill="#FFFFFF"/>
    <circle cx="30"  cy="-82" r="6" fill="#FFFFFF"/>
    <circle cx="75"  cy="-72" r="6" fill="#FFFFFF"/>
    <text y="80" font-size="100" font-weight="900" letter-spacing="6">GO</text>
  </g>
</svg>`;

const svgPath = path.join(dir, "capinha-nova.svg");
fs.writeFileSync(svgPath, svg);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 2160 } });
await page.goto("file:///" + svgPath.replace(/\\/g, "/"), { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(dir, "capinha-nova.png"), fullPage: false, timeout: 60000 });
await browser.close();
console.log("✓ Atualizado:", dir);
