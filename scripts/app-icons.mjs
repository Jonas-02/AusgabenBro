// Erzeugt die App-Icons aus dem Wallet-Icon der Tab-Leiste (Figma 10:50).
// Im Figma gibt es kein App-Icon; abgeleitet aus Hintergrund #1E1E1E und
// Akzent #6598E4. Gerendert mit Playwright-Chromium.
//
// Aufruf: npm run icons

import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const wallet = readFileSync('design/figma/icons/wallet.svg', 'utf8')
  .replace(/<svg[^>]*>/, '')
  .replace('</svg>', '')
  .replace(/stroke="#[0-9A-Fa-f]+"/g, 'stroke="#6598E4"')
  .replace(/\s(id|style)="[^"]*"/g, '');

/** Wallet zentriert, Anteil = Kantenlaenge des Icons relativ zur Flaeche. */
function svg(anteil) {
  const icon = 22 / anteil;
  const versatz = (icon - 22) / 2;
  // fill="none": Die Wallet-Pfade sind reine Linien; ohne das fuellt SVG sie schwarz.
  return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="${-versatz} ${-versatz} ${icon} ${icon}">
  <rect x="${-versatz}" y="${-versatz}" width="${icon}" height="${icon}" fill="#1E1E1E"/>
  ${wallet}
</svg>`;
}

const ziele = [
  { datei: 'public/apple-touch-icon.png', px: 180, anteil: 0.56 },
  { datei: 'public/icon-192.png', px: 192, anteil: 0.56 },
  { datei: 'public/icon-512.png', px: 512, anteil: 0.56 },
  // Maskable: Inhalt muss im inneren Kreis (80 %) liegen.
  { datei: 'public/icon-512-maskable.png', px: 512, anteil: 0.44 }
];

const browser = await chromium.launch();
const seite = await browser.newPage();
for (const { datei, px, anteil } of ziele) {
  await seite.setViewportSize({ width: px, height: px });
  await seite.setContent(
    `<html><body style="margin:0;background:#1E1E1E">` +
      svg(anteil).replace('<svg ', `<svg width="${px}" height="${px}" `) +
      `</body></html>`
  );
  await seite.screenshot({ path: datei, omitBackground: false });
  console.log('geschrieben:', datei);
}
await browser.close();

// Favicon als SVG mit gerundeten Ecken.
writeFileSync(
  'public/favicon.svg',
  svg(0.62).replace('<rect ', '<rect rx="4" ')
);
console.log('geschrieben: public/favicon.svg');
