// Legt Figma-Referenz und App-Screenshot nebeneinander und erzeugt eine
// Differenzansicht (helle Stellen = Abweichung). Hilfsmittel fuer die
// visuelle Abnahme, kein Test.
//
// Aufruf: node scripts/vergleich.mjs <figma.png> <app.png> <ziel.png>

import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const [figma, app, ziel] = process.argv.slice(2);
if (!figma || !app || !ziel) {
  console.error('Aufruf: node scripts/vergleich.mjs <figma.png> <app.png> <ziel.png>');
  process.exit(1);
}

const daten = (pfad) => 'data:image/png;base64,' + readFileSync(pfad).toString('base64');
const B = 393;

const html = `<html><body style="margin:0;background:#000;display:flex;gap:8px;font:12px sans-serif;color:#fff">
  <figure style="margin:0"><img id="f" src="${daten(figma)}" width="${B}"><figcaption>Figma</figcaption></figure>
  <figure style="margin:0"><img id="a" src="${daten(app)}" width="${B}"><figcaption>App</figcaption></figure>
  <figure style="margin:0"><canvas id="d" width="${B}" height="852"></canvas><figcaption>Differenz</figcaption></figure>
  <script>
    const f = document.getElementById('f'), a = document.getElementById('a'), c = document.getElementById('d');
    Promise.all([f.decode(), a.decode()]).then(() => {
      const h = Math.round(f.naturalHeight * ${B} / f.naturalWidth);
      c.height = h;
      const x = c.getContext('2d');
      x.drawImage(f, 0, 0, ${B}, h);
      x.globalCompositeOperation = 'difference';
      x.drawImage(a, 0, 0, ${B}, Math.round(a.naturalHeight * ${B} / a.naturalWidth));
      document.body.dataset.fertig = '1';
    });
  </script>
</body></html>`;

const browser = await chromium.launch();
const seite = await browser.newPage({ viewport: { width: B * 3 + 16, height: 900 }, deviceScaleFactor: 1 });
await seite.setContent(html);
await seite.waitForSelector('body[data-fertig]');
await seite.screenshot({ path: ziel, fullPage: true });
await browser.close();
console.log('geschrieben:', ziel);
