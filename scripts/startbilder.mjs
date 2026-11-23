// Startbilder fuer iOS (apple-touch-startup-image). Ohne sie zeigt eine
// Home-Bildschirm-App beim Start kurz einen weissen Bildschirm. Gestaltung wie
// das App-Icon: Wallet aus Figma 10:50 in #6598E4 auf #1E1E1E.
// Schreibt die PNGs nach public/splash/ und die <link>-Tags in index.html
// zwischen die Marker <!-- startbilder --> und <!-- /startbilder -->.
//
// Aufruf: npm run startbilder

import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// CSS-Pixel und Pixeldichte, Hochformat. Quelle: Apple Human Interface
// Guidelines, Layout → Specifications.
export const GERAETE = [
  { b: 440, h: 956, dpr: 3, name: 'iPhone 16 Pro Max, 17 Pro Max' },
  { b: 430, h: 932, dpr: 3, name: 'iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus' },
  { b: 428, h: 926, dpr: 3, name: 'iPhone 12/13 Pro Max, 14 Plus' },
  { b: 420, h: 912, dpr: 3, name: 'iPhone Air' },
  { b: 414, h: 896, dpr: 3, name: 'iPhone XS Max, 11 Pro Max' },
  { b: 414, h: 896, dpr: 2, name: 'iPhone XR, 11' },
  { b: 414, h: 736, dpr: 3, name: 'iPhone 8 Plus' },
  { b: 402, h: 874, dpr: 3, name: 'iPhone 16 Pro, 17, 17 Pro' },
  { b: 393, h: 852, dpr: 3, name: 'iPhone 14 Pro, 15, 15 Pro, 16' },
  { b: 390, h: 844, dpr: 3, name: 'iPhone 12, 13, 14, 16e' },
  { b: 375, h: 812, dpr: 3, name: 'iPhone X, XS, 11 Pro, 12/13 mini' },
  { b: 375, h: 667, dpr: 2, name: 'iPhone SE (2./3.), 8' }
];

const wallet = readFileSync('design/figma/icons/wallet.svg', 'utf8')
  .replace(/<svg[^>]*>/, '')
  .replace('</svg>', '')
  .replace(/stroke="#[0-9A-Fa-f]+"/g, 'stroke="#6598E4"')
  .replace(/\s(id|style)="[^"]*"/g, '');

const ICON_PT = 88;

mkdirSync('public/splash', { recursive: true });
const browser = await chromium.launch();
const links = [];
for (const g of GERAETE) {
  const datei = `splash/${g.b * g.dpr}x${g.h * g.dpr}.png`;
  const seite = await browser.newPage({ viewport: { width: g.b, height: g.h }, deviceScaleFactor: g.dpr });
  await seite.setContent(
    `<html><body style="margin:0;height:100vh;display:grid;place-items:center;background:#1E1E1E">` +
      `<svg width="${ICON_PT}" height="${ICON_PT}" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">${wallet}</svg>` +
      `</body></html>`
  );
  await seite.screenshot({ path: `public/${datei}` });
  await seite.close();
  links.push(
    `    <!-- ${g.name} -->\n` +
      `    <link rel="apple-touch-startup-image" href="${datei}" media="(device-width: ${g.b}px) and (device-height: ${g.h}px) and (-webkit-device-pixel-ratio: ${g.dpr}) and (orientation: portrait)" />`
  );
  console.log('geschrieben:', datei);
}
await browser.close();

const html = readFileSync('index.html', 'utf8');
const neu = html.replace(/<!-- startbilder -->[\s\S]*<!-- \/startbilder -->/, `<!-- startbilder -->\n${links.join('\n')}\n    <!-- /startbilder -->`);
if (neu === html && !html.includes('<!-- startbilder -->')) throw new Error('Marker <!-- startbilder --> fehlt in index.html');
writeFileSync('index.html', neu);
console.log('index.html aktualisiert');
