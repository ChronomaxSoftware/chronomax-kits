import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const dir = "C:/Users/CHRONOMAX_1/Desktop/capinha e cordão para fazer";
const arteCapa = path.join(dir, "WhatsApp Image 2026-05-06 at 21.35.59.jpeg");

// Carrega a arte e descobre dimensões reais via Playwright
const browser = await chromium.launch();

// Etapa 1: descobrir dimensões e cropar o logo
const page1 = await browser.newPage({ viewport: { width: 1200, height: 1800 } });
const arteB64 = fs.readFileSync(arteCapa).toString("base64");
const arteUrl = `data:image/jpeg;base64,${arteB64}`;

await page1.setContent(`
<html><body style="margin:0;background:#000;">
<canvas id="c"></canvas>
<script>
(async () => {
  const img = new Image();
  img.onload = () => {
    const c = document.getElementById('c');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    document.title = JSON.stringify({ w: img.width, h: img.height });
  };
  img.src = "${arteUrl}";
})();
</script>
</body></html>
`);
await page1.waitForTimeout(1500);
const dims = JSON.parse(await page1.title());
console.log("Arte original:", dims);

// O logo CHRONOMAX fica aproximadamente entre 36%–55% da altura, 12%–88% da largura
const cropX = Math.round(dims.w * 0.10);
const cropY = Math.round(dims.h * 0.36);
const cropW = Math.round(dims.w * 0.80);
const cropH = Math.round(dims.h * 0.20);

const logoCroppedPath = path.join(dir, "_logo-extraido.png");

// Crop via canvas com limpeza de fundo (deixa transparente onde a luminância é baixa)
await page1.evaluate(({ cropX, cropY, cropW, cropH }) => {
  const c = document.getElementById('c');
  const ctx = c.getContext('2d');
  const img = ctx.getImageData(cropX, cropY, cropW, cropH);
  const out = document.createElement('canvas');
  out.width = cropW; out.height = cropH;
  const octx = out.getContext('2d');
  octx.putImageData(img, 0, 0);
  document.body.dataset.cropped = out.toDataURL('image/png');
}, { cropX, cropY, cropW, cropH });

const croppedDataUrl = await page1.evaluate(() => document.body.dataset.cropped);
const croppedB64 = croppedDataUrl.split(",")[1];
fs.writeFileSync(logoCroppedPath, Buffer.from(croppedB64, "base64"));
console.log("Logo cropado salvo:", logoCroppedPath, `${cropW}x${cropH}px`);

await page1.close();

// Etapa 2: monta SVG do cordão 900mm x 20mm
// Em px usando 300dpi para impressão: 900mm = 10630px, 20mm = 236px
const dpi = 300;
const widthMm = 900;
const heightMm = 20;
const widthPx = Math.round((widthMm / 25.4) * dpi);
const heightPx = Math.round((heightMm / 25.4) * dpi);

// Calcula quantas vezes o logo cabe
const logoAspect = cropW / cropH;
const logoH = Math.round(heightPx * 0.7); // 70% da altura
const logoW = Math.round(logoH * logoAspect);
const totalLogos = 10;
const espacamento = (widthPx - totalLogos * logoW) / (totalLogos + 1);

const logoB64Final = fs.readFileSync(logoCroppedPath).toString("base64");
const logoData = `data:image/png;base64,${logoB64Final}`;

const logos = [];
for (let i = 0; i < totalLogos; i++) {
  const x = espacamento + i * (logoW + espacamento);
  const y = (heightPx - logoH) / 2;
  logos.push(`<image x="${x}" y="${y}" width="${logoW}" height="${logoH}" href="${logoData}" style="mix-blend-mode: lighten;"/>`);
}

const cordao = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}"
     preserveAspectRatio="none">
  <defs>
    <linearGradient id="fundo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#000000"/>
      <stop offset="40%" stop-color="#000510"/>
      <stop offset="80%" stop-color="#0A2A88"/>
      <stop offset="100%" stop-color="#0F3FB5"/>
    </linearGradient>
  </defs>
  <rect width="${widthPx}" height="${heightPx}" fill="url(#fundo)"/>
  ${logos.join("\n  ")}
</svg>`;

const svgPath = path.join(dir, "cordao-pescoco.svg");
fs.writeFileSync(svgPath, cordao);
console.log(`SVG cordão salvo: ${svgPath} (${widthPx}x${heightPx}px = ${widthMm}x${heightMm}mm @ ${dpi}dpi)`);

// Etapa 3: render PNG via HTML wrapper que controla escala
async function renderViaHtml(escala, outPath) {
  const w = Math.round(widthPx * escala);
  const h = Math.round(heightPx * escala);
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const svgInline = fs.readFileSync(svgPath, "utf-8");
  await page.setContent(`
    <!DOCTYPE html>
    <html><head><style>
      html, body { margin: 0; padding: 0; background: #000; }
      svg { display: block; width: ${w}px; height: ${h}px; }
    </style></head>
    <body>${svgInline}</body></html>
  `);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: outPath, fullPage: false, timeout: 90000 });
  await page.close();
  console.log(`✓ ${outPath} (${w}x${h}px)`);
}

await renderViaHtml(0.25, path.join(dir, "cordao-pescoco-preview.png"));
await renderViaHtml(1.0, path.join(dir, "cordao-pescoco.png"));

await browser.close();
console.log("✓ PNG cordão salvo:", path.join(dir, "cordao-pescoco.png"));
console.log("✓ Preview salvo:", path.join(dir, "cordao-pescoco-preview.png"));
