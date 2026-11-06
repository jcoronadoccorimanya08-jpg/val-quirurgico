// Genera los íconos de la app (PNG y SVG) a partir de un solo diseño vectorial.
// Uso: npm run icons
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

function svg({ rounded }) {
  const r = 150;
  const c = 2 * Math.PI * r;
  const arc = c * 0.8; // 80 % del anillo: el ciclo en marcha
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#151C27"/>
      <stop offset="1" stop-color="#0B0E13"/>
    </linearGradient>
    <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5AB6FF"/>
      <stop offset="1" stop-color="#2EE6A8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" ${rounded ? 'rx="116"' : ''} fill="url(#bg)"/>
  <circle cx="256" cy="256" r="${r}" fill="none" stroke="#212A36" stroke-width="30"/>
  <circle cx="256" cy="256" r="${r}" fill="none" stroke="url(#ring)" stroke-width="30" stroke-linecap="round"
    stroke-dasharray="${arc.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 256 256)"/>
  <path d="M188 262 L237 311 L328 210" fill="none" stroke="#2EE6A8" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

writeFileSync(new URL('favicon.svg', out), svg({ rounded: true }));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function png(file, size, rounded) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg({ rounded }).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`,
  );
  await page.screenshot({ path: new URL(file, out).pathname, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await png('icon-192.png', 192, true);
await png('icon-512.png', 512, true);
await png('icon-maskable-512.png', 512, false);
await png('apple-touch-icon.png', 180, false);
await browser.close();
console.log('Íconos generados en public/icons/');
