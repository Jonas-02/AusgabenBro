import { expect, test, type Page } from '@playwright/test';
import { schriftenBereit, vorbereiten } from './hilfen';

/**
 * Pixelabnahme gegen die Figma-Koordinaten (aus get_metadata, x relativ zum
 * jeweiligen Frame). Positionen und Hoehen muessen auf 1 px stimmen.
 *
 * Breiten von Textboxen haengen an der Schriftdarstellung des Browsers und
 * duerfen etwas mehr abweichen (siehe DECISIONS.md, "Textbreiten").
 */
type Box = { x: number; y: number; w: number; h: number };
const POS = 1;
const TEXTBREITE = 3;

async function box(page: Page, selektor: string, index = 0): Promise<Box> {
  const b = await page.locator(selektor).nth(index).boundingBox();
  if (!b) throw new Error(`nicht sichtbar: ${selektor}`);
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

/**
 * `textToleranz` gilt fuer die Breite und fuer x: Elemente hinter einem Text
 * (zweiter Chip in der Reihe) erben dessen Breitenabweichung.
 */
function pruefe(ist: Box, soll: Partial<Box>, name: string, textToleranz = POS) {
  const toleranz = { x: textToleranz, y: POS, w: textToleranz, h: POS };
  for (const k of ['x', 'y', 'w', 'h'] as const) {
    const s = soll[k];
    if (s !== undefined) {
      expect.soft(Math.abs(ist[k] - s), `${name}.${k}: ist ${ist[k].toFixed(1)}, Figma ${s}`).toBeLessThanOrEqual(toleranz[k] + 0.01);
    }
  }
}

test.describe('Masse wie in Figma', () => {
  test('Dashboard 1:2', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await schriftenBereit(page);

    pruefe(await box(page, 'main h1'), { x: 28, y: 32, w: 337, h: 48 }, 'Begruessung 2:17');
    const karten = 'main [class*="_karte_"]';
    pruefe(await box(page, karten, 0), { x: 28, y: 90, w: 337, h: 120 }, 'Hauptkarte 1:4');
    pruefe(await box(page, 'main [class*="_satz_"]'), { y: 153, h: 16 }, 'Satz 2:11');
    pruefe(await box(page, 'main [class*="_balken_"]', 0), { x: 29, y: 181, w: 335, h: 28 }, 'Balken 2:5');
    pruefe(await box(page, '#pots-titel'), { x: 28, y: 230, h: 19 }, 'Deine Pots 2:32');

    // Pot-Card v2 (Figma 20:187) statt der Karten aus 1:2: 107 px hoch,
    // Abstand 12 wie zwischen den Gruppen in 1:2.
    const potKarten = [261, 380, 499, 618];
    for (const [i, y] of potKarten.entries()) {
      pruefe(await box(page, karten, i + 1), { x: 28, y, w: 337, h: 107 }, `Pot ${i + 1} 20:188`);
      pruefe(await box(page, 'main [class*="_balken_"]', i + 1), { x: 29, y: y + 78, w: 335, h: 28 }, `Pot-Balken ${i + 1} 20:203`);
    }

    pruefe(await box(page, 'nav[aria-label="Hauptnavigation"]'), { x: 0, y: 769, w: 393, h: 83 }, 'Tab-Leiste 10:58');
    pruefe(await box(page, 'button[aria-label="Ausgabe hinzufügen"]'), { x: 268, y: 707, w: 109, h: 46 }, 'FAB 10:71', TEXTBREITE);
  });

  test('Ausgaben-Sheet 7:4', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await page.getByRole('button', { name: 'Ausgabe hinzufügen' }).click();
    await page.locator('dialog[data-zustand="offen"]').waitFor();
    await page.waitForTimeout(400);
    for (const z of '12') await page.getByRole('group', { name: 'Zahlenfeld' }).getByRole('button', { name: z, exact: true }).click();
    await schriftenBereit(page);

    // Abgeleitet: Notizfeld (36) + Abstand (8) unter den Chips. Das Sheet
    // haengt unten, alles darueber rueckt um N nach oben.
    const N = 44;
    pruefe(await box(page, 'dialog'), { x: 0, y: 120 - N, w: 393, h: 732 + N }, 'Sheet 7:93');
    pruefe(await box(page, 'dialog [class*="_kopf_"]'), { x: 20, y: 146 - N, w: 353, h: 28 }, 'Kopf 7:96');
    pruefe(await box(page, 'dialog [class*="_eingabe_"]'), { x: 20, y: 188 - N, h: 73 }, 'Eingabe 7:103');

    const schnell = [{ x: 20, w: 52 }, { x: 80, w: 56 }, { x: 144, w: 59 }];
    for (const [i, q] of schnell.entries()) {
      pruefe(await box(page, 'dialog [class*="_schnell_"] > button', i), { ...q, y: 271 - N, h: 34 }, `Schnellbetrag ${i + 1}`, TEXTBREITE);
    }

    pruefe(await box(page, 'dialog [class*="_potWahl_"] > p'), { x: 20, y: 319 - N, h: 13 }, 'Frage 7:109');
    const chips = [{ x: 20, y: 340 - N, w: 140 }, { x: 168, y: 340 - N, w: 77 }, { x: 20, y: 378 - N, w: 143 }, { x: 171, y: 378 - N, w: 161 }];
    for (const [i, c] of chips.entries()) {
      pruefe(await box(page, 'dialog [class*="_chips_"] > button', i), { ...c, h: 30 }, `Chip ${i + 1}`, TEXTBREITE);
    }

    pruefe(await box(page, 'dialog[open] input[aria-label="Notiz"]'), { x: 20, y: 422 - 14 - 36, w: 353, h: 36 }, 'Notiz (abgeleitet)');
    pruefe(await box(page, 'dialog [class*="_auswirkung_"]'), { x: 20, y: 422, w: 353, h: 116 }, 'Auswirkung 7:139');
    pruefe(await box(page, 'dialog [class*="_auswirkung_"] [class*="_balken_"]'), { x: 32, y: 490, w: 329, h: 12 }, 'Balken 7:147');
    pruefe(await box(page, 'dialog [class*="_status_"]'), { x: 32, y: 510, h: 16 }, 'Status 10:76');
    pruefe(await box(page, 'dialog [role="group"]'), { x: 20, y: 552, w: 353, h: 200 }, 'Zahlenfeld 7:164');
    pruefe(await box(page, 'dialog [class*="_cta_"]'), { x: 20, y: 766, w: 353, h: 52 }, 'Speichern 7:196');
  });

  test.describe('Fixkosten', () => {
    test.use({ viewport: { width: 393, height: 951 } });
    test('Fixkosten 11:46', async ({ page }) => {
      await vorbereiten(page);
      await page.goto('./#/fixkosten');
      await schriftenBereit(page);
      const karten = 'main [class*="_karte_"]';
      pruefe(await box(page, 'main h1'), { x: 28, y: 32, w: 337, h: 48 }, 'Kopf 11:47');
      pruefe(await box(page, karten, 0), { x: 28, y: 100, w: 337, h: 54 }, 'Uebersicht 11:48');
      pruefe(await box(page, '#fix-titel'), { y: 174, h: 19 }, 'Alle Fixkosten 11:63');
      pruefe(await box(page, 'main [class*="_gruppeLabel_"]', 0), { y: 205, h: 14 }, 'Label Wohnen 11:65');
      pruefe(await box(page, karten, 1), { y: 223, h: 151 }, 'Karte Wohnen 11:71');
      pruefe(await box(page, 'main [class*="_posten_"]', 0), { x: 29, y: 224, w: 335, h: 50 }, 'Miete 11:72');
      pruefe(await box(page, 'main [class*="_posten_"]', 1), { y: 274, h: 50 }, 'Strom 11:78');
      pruefe(await box(page, karten, 2), { y: 404, h: 115 }, 'Karte Versicherungen 11:95');
      pruefe(await box(page, 'main [class*="_posten_"]', 3), { y: 405, h: 57 }, 'Haftpflicht 11:96');
      pruefe(await box(page, karten, 3), { y: 549, h: 151 }, 'Karte Abos 11:118');
      pruefe(await box(page, karten, 4), { y: 730, h: 51 }, 'Karte Mobilitaet 11:145');
      pruefe(await box(page, 'nav[aria-label="Hauptnavigation"]'), { x: 0, y: 868, w: 393, h: 83 }, 'Tab-Leiste 11:152');
      pruefe(await box(page, 'button[aria-label="Fixkosten hinzufügen"]'), { x: 265, y: 806, w: 112, h: 46 }, 'FAB 11:165', TEXTBREITE);
    });
  });

  test('Fixkosten-Sheet 12:187', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/fixkosten');
    await page.getByRole('button', { name: 'Fixkosten hinzufügen' }).click();
    await page.locator('dialog[data-zustand="offen"]').waitFor();
    await page.waitForTimeout(400);
    await schriftenBereit(page);
    const d = 'dialog[open]';
    pruefe(await box(page, `${d} [class*="_kopf_"]`), { x: 20, y: 341, w: 353, h: 28 }, 'Kopf 12:190');
    pruefe(await box(page, `${d} label[class*="_betrag_"]`), { x: 20, y: 383, h: 73 }, 'Betrag 12:196');
    pruefe(await box(page, `${d} input[class*="_feld_"]`), { x: 20, y: 491, w: 353, h: 40 }, 'Feld 12:201');
    const kat = [{ x: 20, y: 566, w: 82 }, { x: 110, y: 566, w: 177 }, { x: 20, y: 604, w: 131 }, { x: 159, y: 604, w: 83 }, { x: 250, y: 604, w: 116 }];
    for (const [i, c] of kat.entries()) pruefe(await box(page, `${d} [class*="_chips_"] >> nth=0 >> button`, i), { ...c, h: 30 }, `Kategorie-Chip ${i + 1}`, TEXTBREITE);
    const rh = [{ x: 20, w: 70 }, { x: 98, w: 84 }, { x: 190, w: 57 }];
    for (const [i, c] of rh.entries()) pruefe(await box(page, `${d} [class*="_chips_"] >> nth=1 >> button`, i), { ...c, y: 669, h: 29 }, `Rhythmus-Chip ${i + 1}`, TEXTBREITE);
    pruefe(await box(page, `${d} label[class*="_auswahl_"]`), { x: 20, y: 712, w: 353, h: 40 }, 'Abbuchungstag 12:244');
    pruefe(await box(page, `${d} [class*="_cta_"]`), { x: 20, y: 766, w: 353, h: 52 }, 'Speichern 12:250');
  });

  test('Pot-Card v2 20:187', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await schriftenBereit(page);
    const karte = 'main [class*="_potkarte_"] >> nth=1'; // Drogen, wie im Figma-Frame
    const k = await box(page, karte);
    if (!k) throw new Error('Karte fehlt');
    const rel = async (sel: string, i = 0) => {
      const b = await box(page, `${karte} >> ${sel}`, i);
      if (!b) throw new Error(`nicht sichtbar: ${sel}`);
      return { x: b.x - k.x, y: b.y - k.y, w: b.w, h: b.h };
    };
    pruefe(k, { w: 337, h: 107 }, 'Karte 20:188');
    pruefe(await rel('[class*="_potName_"]'), { x: 13, y: 13, h: 14 }, 'Name-Zeile 20:211');
    pruefe(await rel('[class*="_potName_"] svg'), { x: 13, y: 13, w: 14, h: 14 }, 'Icon 20:190');
    pruefe(await rel('[class*="_betrag_"]'), { x: 13, y: 33, h: 33 }, 'Betrag 20:212');
    // Meta ist rechtsbuendig und so breit wie ihr Text; es zaehlt die rechte Kante (1 + 220 + 97).
    const meta = await rel('[class*="_meta_"]');
    pruefe({ x: meta.x + meta.w, y: meta.y, w: 0, h: meta.h }, { x: 318, y: 13, h: 32 }, 'Meta 20:207 rechte Kante', TEXTBREITE);
    pruefe(await rel('[class*="_balken_"]'), { x: 1, y: 79, w: 335, h: 28 }, 'Balken 20:203');
    // Minus: gedeckt | Vorgriff, getrennt durch 1 px in Kartenfarbe (20:205)
    const trenner = await page.locator(`${karte} >> [class*="_trenner_"]`).evaluate((e) => getComputedStyle(e).borderLeftWidth);
    expect(trenner).toBe('1px');
  });
});

