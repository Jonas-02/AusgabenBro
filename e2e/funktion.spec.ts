import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { vorbereiten, figmaDaten } from './hilfen';
import { spruchIndex } from '../src/domain/tagesspruch';
import { SPRUECHE } from '../src/inhalt/sprueche';

/**
 * Funktionstests zu den Abnahmekriterien (Prompt, Abschnitt 8). Ausgangslage
 * sind die Figma-Daten am 17.11.2026: Einkauf 20,43 €, Drogen −20 €,
 * Lifestyle 20,43 €, Sonstiges 20,43 €.
 */

const sheet = (page: Page) => page.locator('dialog[open]');
const hauptbetrag = (page: Page) => page.locator('main [class*="_hauptkarte_"] .nur-screenreader').first();
const potBetrag = (page: Page, i: number) => page.locator('main [class*="_potkarte_"]').nth(i).locator('.nur-screenreader').first();
const status = (page: Page) => sheet(page).locator('[class*="_status_"]');

async function sheetOffen(page: Page) {
  await page.locator('dialog[data-zustand="offen"]').waitFor();
  await page.waitForTimeout(350);
}

async function sheetZu(page: Page) {
  await expect(page.locator('dialog[open]')).toHaveCount(0);
}

async function tippe(page: Page, folge: string) {
  for (const z of folge) await page.getByRole('group', { name: 'Zahlenfeld' }).getByRole('button', { name: z, exact: true }).click();
}

async function neueAusgabe(page: Page) {
  await page.getByRole('button', { name: 'Ausgabe hinzufügen' }).click();
  await sheetOffen(page);
}

test.describe('Ausgabe erfassen', () => {
  test('in drei Taps: FAB, Schnellbetrag, Speichern; Rückgängig nimmt sie zurück', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await expect(potBetrag(page, 0)).toHaveText('20,43 €');

    await page.getByRole('button', { name: 'Ausgabe hinzufügen' }).click(); // 1
    await sheetOffen(page);
    await expect(sheet(page).getByRole('button', { name: 'Einkauf und Haushalt' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'plus 10 Euro' }).click(); // 2
    await page.getByRole('button', { name: 'Ausgabe speichern' }).click(); // 3
    await sheetZu(page);

    await expect(page.getByRole('status')).toContainText('Gespeichert');
    await expect(potBetrag(page, 0)).toHaveText('10,43 €');
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(potBetrag(page, 0)).toHaveText('20,43 €');
  });

  test('der zuletzt genutzte Pot ist beim nächsten Mal vorausgewählt', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await neueAusgabe(page);
    await sheet(page).getByRole('button', { name: 'Lifestyle und Kleidung' }).click();
    await tippe(page, '5');
    await page.getByRole('button', { name: 'Ausgabe speichern' }).click();
    await sheetZu(page);
    await expect(potBetrag(page, 2)).toHaveText('15,43 €');
    await neueAusgabe(page);
    await expect(sheet(page).getByRole('button', { name: 'Lifestyle und Kleidung' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('Statuszeile und Vorgriff wie in 3.5, ohne Höhensprung', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await neueAusgabe(page);
    const hoehe = async () => (await sheet(page).boundingBox())?.height;
    const start = await hoehe();

    await expect(page.getByRole('button', { name: 'Ausgabe speichern' })).toBeVisible();
    // Einkauf: 20,43 € im Pot, 7 € am Tag.
    await tippe(page, '10');
    await expect(status(page)).toHaveText('bleibt im Plus');
    expect(await hoehe()).toBe(start);

    await page.getByRole('button', { name: 'Letzte Ziffer löschen' }).click();
    await page.getByRole('button', { name: 'Letzte Ziffer löschen' }).click();
    await tippe(page, '25'); // −4,57 € → morgen wieder im Plus
    await expect(status(page)).toHaveText('morgen wieder ausgeglichen');
    await expect(sheet(page).locator('[class*="_nachher_"]')).toHaveText('-4,57 €');
    expect(await hoehe()).toBe(start);

    await page.getByRole('button', { name: 'Letzte Ziffer löschen' }).click();
    await page.getByRole('button', { name: 'Letzte Ziffer löschen' }).click();
    await tippe(page, '32'); // −11,57 € → in 2 Tagen
    await expect(status(page)).toHaveText('in 2 Tagen wieder ausgeglichen');
    expect(await hoehe()).toBe(start);

    await tippe(page, '0'); // 320 € → bis 30.11. nicht mehr
    await expect(status(page)).toHaveText('diesen Monat nicht mehr ausgeglichen');
    expect(await hoehe()).toBe(start);

    await sheet(page).getByRole('button', { name: 'Drogen' }).click();
    expect(await hoehe()).toBe(start);
  });

  test('ohne Betrag wird nichts gespeichert', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await neueAusgabe(page);
    await page.getByRole('button', { name: 'Ausgabe speichern' }).click();
    await expect(sheet(page).getByText('Betrag eingeben')).toBeVisible();
    await expect(sheet(page)).toHaveCount(1);
  });

  test('Hardware-Tastatur: Ziffern, Komma, Rücktaste, Enter', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await neueAusgabe(page);
    await page.keyboard.type('12.55');
    await page.keyboard.press('Backspace');
    await expect(sheet(page).locator('[class*="_eingabe_"] .nur-screenreader')).toHaveText('Betrag: 12,50 €');
    await page.keyboard.press('Enter');
    await sheetZu(page);
    await expect(potBetrag(page, 0)).toHaveText('7,93 €');
  });
});

test.describe('Sheet schließen', () => {
  for (const weg of ['X', 'Esc', 'Scrim', 'Wischen'] as const) {
    test(`per ${weg}`, async ({ page }) => {
      await vorbereiten(page);
      await page.goto('./#/budget');
      await neueAusgabe(page);
      if (weg === 'X') await sheet(page).getByRole('button', { name: 'Schließen' }).click();
      if (weg === 'Esc') await page.keyboard.press('Escape');
      if (weg === 'Scrim') await page.mouse.click(196, 40);
      if (weg === 'Wischen') {
        const griff = await sheet(page).locator('[class*="_zug_"]').boundingBox();
        if (!griff) throw new Error('Griff fehlt');
        const x = griff.x + griff.width / 2;
        const y = griff.y + 10;
        await page.mouse.move(x, y);
        await page.mouse.down();
        for (let i = 1; i <= 10; i++) await page.mouse.move(x, y + i * 30);
        await page.mouse.up();
      }
      await sheetZu(page);
      await expect(page.locator('html')).not.toHaveClass(/sheet-offen/);
    });
  }

  test('kurzes Ziehen federt zurück', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await neueAusgabe(page);
    const griff = await sheet(page).locator('[class*="_zug_"]').boundingBox();
    if (!griff) throw new Error('Griff fehlt');
    const x = griff.x + griff.width / 2;
    const y = griff.y + 10;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) {
      await page.mouse.move(x, y + i * 3);
      await page.waitForTimeout(16); // langsam: unter der Tempo-Schwelle
    }
    await page.mouse.up();
    await page.waitForTimeout(400);
    await expect(sheet(page)).toHaveCount(1);
  });
});

test.describe('Pot-Verlauf', () => {
  test('Ausgabe bearbeiten und löschen', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await page.getByRole('button', { name: /^Drogen: -20 € im Minus/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Drogen');
    await expect(page.getByRole('heading', { name: '1 Ausgabe' })).toBeVisible();

    await page.getByRole('button', { name: /105,00/ }).click();
    await sheetOffen(page);
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Letzte Ziffer löschen' }).click();
    await tippe(page, '95');
    await page.getByRole('button', { name: 'Änderung speichern' }).click();
    await sheetZu(page);
    await expect(page.getByRole('button', { name: /95,00/ })).toBeVisible();

    await page.getByRole('button', { name: /95,00/ }).click();
    await sheetOffen(page);
    await sheet(page).getByRole('button', { name: 'Löschen', exact: true }).click();
    await sheetZu(page);
    await expect(page.getByRole('heading', { name: '0 Ausgaben' })).toBeVisible();
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(page.getByRole('heading', { name: '1 Ausgabe' })).toBeVisible();

    await page.getByRole('link', { name: 'Budget' }).first().click();
    await expect(potBetrag(page, 1)).toHaveText('-10 €');
  });
});

test.describe('Fixkosten', () => {
  test('anlegen, bearbeiten, löschen, ohne Einfluss aufs Budget', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    const budgetVorher = await hauptbetrag(page).textContent();

    await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Fixkosten' }).click();
    await expect(page.getByText('9 Posten')).toBeVisible();
    await page.getByRole('button', { name: 'Fixkosten hinzufügen' }).click();
    await sheetOffen(page);
    await page.getByLabel('Betrag in Euro').fill('12,99');
    await page.getByLabel('wofür?').fill('Zeitung');
    await sheet(page).getByRole('button', { name: 'Abos und Verträge' }).click();
    await page.getByRole('button', { name: 'Fixkosten speichern' }).click();
    await sheetZu(page);
    await expect(page.getByText('10 Posten')).toBeVisible();
    await expect(page.getByRole('button', { name: /Zeitung/ })).toContainText('12,99');

    await page.getByRole('button', { name: /Zeitung/ }).click();
    await sheetOffen(page);
    await expect(page.getByLabel('Betrag in Euro')).toHaveValue('12,99');
    await page.getByLabel('wofür?').fill('Zeitung digital');
    await sheet(page).getByRole('button', { name: 'jährlich', exact: true }).click();
    await page.getByRole('button', { name: 'Fixkosten speichern' }).click();
    await sheetZu(page);
    const zeile = page.getByRole('button', { name: /Zeitung digital/ });
    await expect(zeile).toContainText('jährlich am 17. November');
    await expect(zeile).toContainText('12,99 € im Jahr');
    await expect(zeile).toContainText('1,08 €');

    await zeile.click();
    await sheetOffen(page);
    await sheet(page).getByRole('button', { name: 'Löschen', exact: true }).click();
    await sheetZu(page);
    await expect(page.getByText('9 Posten')).toBeVisible();
    await expect(page.getByRole('button', { name: /Zeitung/ })).toHaveCount(0);

    await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Budget' }).click();
    await expect(hauptbetrag(page)).toHaveText(budgetVorher ?? '');
  });
});

test.describe('Zeit und Daten', () => {
  test('Pots füllen sich täglich und starten am Zahltag neu', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await expect(potBetrag(page, 0)).toHaveText('20,43 €');

    // Naechster Tag, App kommt aus dem Hintergrund zurueck.
    await page.clock.setFixedTime(new Date('2026-11-18T00:00:05'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(potBetrag(page, 0)).toHaveText('27,43 €');

    // Zahltag 1. Dezember: neuer Zyklus mit 31 Tagen, Uebertrag "reset".
    await page.clock.setFixedTime(new Date('2026-12-01T08:00:00'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(potBetrag(page, 0)).toHaveText('6,77 €'); // floor(21000 / 31)
    await expect(potBetrag(page, 1)).toHaveText('4,83 €'); // Drogen: Minus verfaellt
  });

  test('Daten bleiben nach Neuladen erhalten', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await neueAusgabe(page);
    await tippe(page, '3');
    await page.getByRole('button', { name: 'Ausgabe speichern' }).click();
    await sheetZu(page);
    await expect(potBetrag(page, 0)).toHaveText('17,43 €');
    await page.reload();
    await expect(potBetrag(page, 0)).toHaveText('17,43 €');
  });

  test('Export, alles löschen, Import', async ({ page }, info) => {
    // Ohne Datei-Teilen, damit der Download-Weg greift.
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true });
    });
    await vorbereiten(page);
    await page.goto('./#/einstellungen');

    const laden = page.waitForEvent('download');
    await page.getByRole('button', { name: /Daten exportieren/ }).click();
    const download = await laden;
    expect(download.suggestedFilename()).toBe('ausgabenbro-2026-11-17.json');
    const pfad = info.outputPath('sicherung.json');
    await download.saveAs(pfad);
    const datei = JSON.parse(fs.readFileSync(pfad, 'utf8'));
    expect(datei.app).toBe('ausgabenbro');
    expect(datei.daten.pots).toHaveLength(4);
    expect(datei.daten.fixkosten).toHaveLength(9);

    await page.getByRole('button', { name: /Alle Daten löschen/ }).click();
    await sheetOffen(page);
    await page.getByRole('button', { name: 'Alles löschen' }).click();
    await expect(page.getByLabel('wie heißt du?')).toBeVisible();

    // Als Buffer: Chromium liest per Pfad uebergebene Dateien nicht, wenn
    // der Pfad Umlaute enthaelt (Testtitel "loeschen" mit ö).
    const waehler = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Ich habe eine Sicherung' }).click();
    await (await waehler).setFiles({ name: 'sicherung.json', mimeType: 'application/json', buffer: fs.readFileSync(pfad) });
    await expect(page.getByRole('status')).toContainText('Sicherung geladen');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Hallo Jonas,');
    await expect(potBetrag(page, 1)).toHaveText('-20 €');
  });

  test('kaputte Datei wird abgelehnt, Daten bleiben', async ({ page }, info) => {
    await vorbereiten(page);
    await page.goto('./#/einstellungen');
    const pfad = info.outputPath('kaputt.json');
    fs.writeFileSync(pfad, '{"app":"etwas anderes"}');
    const waehler = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /Daten importieren/ }).click();
    await (await waehler).setFiles({ name: 'kaputt.json', mimeType: 'application/json', buffer: fs.readFileSync(pfad) });
    await expect(page.getByRole('status')).toContainText('keine Exportdatei');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
  });

  async function swAktiv(page: Page) {
    await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 15_000 });
  }

  test('Service Worker hält alle Dateien für offline bereit', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await swAktiv(page);
    const fehlend = await page.evaluate(async () => {
      const urls = [
        new URL('index.html', location.href).href,
        ...[...document.querySelectorAll<HTMLScriptElement>('script[src]')].map((e) => e.src),
        ...[...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"], link[rel="manifest"], link[rel="apple-touch-icon"], link[rel="icon"]')].map(
          (e) => e.href
        ),
        ...performance
          .getEntriesByType('resource')
          .map((r) => r.name)
          .filter((n) => n.endsWith('.woff2'))
      ];
      const ohne: string[] = [];
      for (const u of urls) if (!(await caches.match(u, { ignoreSearch: true }))) ohne.push(u);
      return { anzahl: urls.length, ohne };
    });
    expect(fehlend.ohne).toEqual([]);
    expect(fehlend.anzahl).toBeGreaterThanOrEqual(5); // HTML, JS, CSS, Manifest, Icons, 2 Schriften
  });

  test('lädt ohne Netz neu', async ({ page, context, browserName }) => {
    // Playwright-WebKit bricht ein Neuladen bei setOffline(true) mit
    // "WebKit encountered an internal error" ab, auch wenn der Service Worker
    // die Seite kontrolliert. Fuer WebKit belegt der Test darueber, dass alles
    // im Cache liegt. Siehe DECISIONS.md.
    test.skip(browserName === 'webkit', 'Offline-Emulation von Playwright-WebKit, siehe DECISIONS.md');
    await vorbereiten(page);
    await page.goto('./#/budget');
    await swAktiv(page);
    await context.setOffline(true);
    await page.reload();
    await expect(potBetrag(page, 0)).toHaveText('20,43 €');
    await context.setOffline(false);
  });
});

test.describe('Einstellungen', () => {
  test('Pot anlegen, verschieben, löschen mit Rückgängig; Summe live', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/einstellungen');
    const summe = page.locator('[class*="_summe_"]');
    await expect(summe).toContainText('750 €');

    await page.getByRole('button', { name: 'Pot hinzufügen' }).click();
    await sheetOffen(page);
    await page.getByLabel('Betrag pro Monat in Euro').fill('60');
    await page.getByLabel('wie heißt der Pot?').fill('Kaffee');
    await page.getByRole('button', { name: 'Pot speichern' }).click();
    await sheetZu(page);
    await expect(summe).toContainText('810 €');

    await page.getByRole('button', { name: 'Kaffee nach oben' }).click();
    const namen = page.locator('main ul [class*="_name_"]');
    await expect(namen.nth(3)).toHaveText('Kaffee');

    await page.getByRole('button', { name: /Kaffee/ }).first().click();
    await sheetOffen(page);
    await page.getByRole('button', { name: 'Pot löschen' }).click();
    await sheetZu(page);
    await expect(summe).toContainText('750 €');
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(summe).toContainText('810 €');
  });

  test('Name, Motto und Übertrag wirken aufs Dashboard', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/einstellungen');
    await page.getByLabel('dein Name').fill('Kim');
    await page.getByLabel('dein Motto').fill('Erst sparen, dann kaufen');
    await page.getByRole('button', { name: 'mitnehmen' }).click();
    await page.getByRole('link', { name: 'Budget' }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hallo Kim,Erst sparen, dann kaufen');
  });
});

test.describe('Onboarding', () => {
  test('Name, Zahltag, Pots anpassen, fertig', async ({ page }) => {
    await vorbereiten(page, { daten: null });
    await page.goto('./');
    await page.getByLabel('wie heißt du?').fill('Jonas');
    await page.getByLabel('Zahltag').selectOption('15');
    await page.getByRole('button', { name: 'Weiter' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Deine Pots');
    await page.getByRole('button', { name: /Drogen/ }).first().click();
    await sheetOffen(page);
    await page.getByLabel('Betrag pro Monat in Euro').fill('100');
    await page.getByRole('button', { name: 'Pot speichern' }).click();
    await sheetZu(page);
    await expect(page.getByText('700 €').first()).toBeVisible();
    await page.getByRole('button', { name: 'Weiter' }).click();

    await expect(page.getByText('Zum Home-Bildschirm')).toBeVisible();
    await page.getByRole('button', { name: 'Los geht’s' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Hallo Jonas,');
    await expect(page.locator('main [class*="_potkarte_"]')).toHaveCount(4);
    expect(page.url()).toContain('#/budget');
  });
});

test.describe('Große Schrift', () => {
  // Safari "Seitenzoom" 150 %: das Layout bekommt 393 / 1,5 = 262 CSS-Pixel.
  test.use({ viewport: { width: 262, height: 568 } });

  for (const [name, ziel] of [
    ['Dashboard', './#/budget'],
    ['Fixkosten', './#/fixkosten'],
    ['Pot-Verlauf', './#/pot/drogen'],
    ['Einstellungen', './#/einstellungen']
  ] as const) {
    test(`${name}: nichts ragt seitlich heraus`, async ({ page }) => {
      await vorbereiten(page);
      await page.goto(ziel);
      await page.evaluate(() => document.fonts.ready);
      const breite = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(breite).toBeLessThanOrEqual(262);
    });
  }

  test('Ausgaben-Sheet passt und scrollt', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await neueAusgabe(page);
    const box = await sheet(page).boundingBox();
    expect(box?.height).toBeLessThanOrEqual(568);
    await page.getByRole('button', { name: 'Ausgabe speichern' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Ausgabe speichern' })).toBeInViewport();
  });
});

test.describe('Tagesspruch', () => {
  const spruchAm = (tag: string) => SPRUECHE[spruchIndex(tag, SPRUECHE.length)] as string;
  const unterzeile = (page: Page) => page.locator('main h1 [class*="_unter_"]');

  test('jeder Spruch passt in höchstens zwei Zeilen', async ({ page }) => {
    await vorbereiten(page, { daten: { ...figmaDaten(), tagesspruch: true } });
    await page.goto('./#/budget');
    await page.evaluate(() => document.fonts.ready);
    const zuLang = await unterzeile(page).evaluate((el, liste) => {
      el.textContent = 'X';
      const zeile = el.getBoundingClientRect().height;
      const lang: string[] = [];
      for (const t of liste) {
        el.textContent = t;
        if (el.getBoundingClientRect().height > zeile * 2 + 1) lang.push(t);
      }
      return lang;
    }, SPRUECHE as string[]);
    expect(zuLang).toEqual([]);
  });

  test('Einstellungen schalten zwischen Spruch und Motto, um Mitternacht kommt ein neuer', async ({ page }) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await expect(unterzeile(page)).toHaveText('Hör auf dir Zigaretten zu kaufen');

    await page.getByRole('link', { name: 'Einstellungen' }).click();
    await page.getByRole('button', { name: 'täglicher Spruch' }).click();
    await expect(page.getByLabel('dein Motto')).toHaveCount(0);
    await page.getByRole('link', { name: 'Budget' }).first().click();
    await expect(unterzeile(page)).toHaveText(spruchAm('2026-11-17'));

    await page.reload();
    await expect(unterzeile(page)).toHaveText(spruchAm('2026-11-17'));

    await page.clock.setFixedTime(new Date('2026-11-18T00:00:05'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(unterzeile(page)).toHaveText(spruchAm('2026-11-18'));
    expect(spruchAm('2026-11-18')).not.toBe(spruchAm('2026-11-17'));
  });

  test('neue Nutzer bekommen den Spruch', async ({ page }) => {
    await vorbereiten(page, { daten: null });
    await page.goto('./');
    await page.getByLabel('wie heißt du?').fill('Jonas');
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Los geht’s' }).click();
    await expect(unterzeile(page)).toHaveText(spruchAm('2026-11-17'));
  });
});

