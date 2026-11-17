import { test, type Page } from '@playwright/test';
import { schriftenBereit, vorbereiten } from './hilfen';

/**
 * Screenshots aller Screens und Zustaende bei 393x852 fuer den Vergleich mit
 * design/figma. Die Bilder landen in e2e/screenshots/aktuell und werden in
 * der CI als Artefakt gesichert.
 */
const ORDNER = 'e2e/screenshots/aktuell';

async function foto(page: Page, projekt: string, name: string) {
  await schriftenBereit(page);
  await page.screenshot({ path: `${ORDNER}/${projekt}/${name}.png`, animations: 'disabled' });
}

async function sheetOffen(page: Page) {
  await page.locator('dialog[data-zustand="offen"]').waitFor();
  await page.waitForTimeout(350); // Einfahr-Animation
}

async function tippe(page: Page, folge: string) {
  for (const z of folge) await page.getByRole('group', { name: 'Zahlenfeld' }).getByRole('button', { name: z, exact: true }).click();
}

test.describe('Screenshots fuer die visuelle Abnahme', () => {
  test.use({ deviceScaleFactor: 2 });

  test('1-2 Dashboard', async ({ page }, info) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await foto(page, info.project.name, '1-2_dashboard');
  });

  test('7-4 Ausgabe erfassen, Standard', async ({ page }, info) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await page.getByRole('button', { name: 'Ausgabe hinzufügen' }).click();
    await sheetOffen(page);
    await tippe(page, '12');
    await foto(page, info.project.name, '7-4_ausgabe-standard');
  });

  test('7-198 Ausgabe erfassen, Vorgriff', async ({ page }, info) => {
    await vorbereiten(page);
    await page.goto('./#/budget');
    await page.getByRole('button', { name: 'Ausgabe hinzufügen' }).click();
    await sheetOffen(page);
    await tippe(page, '32');
    await foto(page, info.project.name, '7-198_ausgabe-vorgriff');
  });

  test.describe('Fixkosten', () => {
    // Figma 11:46 ist 951 px hoch, der Screen scrollt.
    test.use({ viewport: { width: 393, height: 951 } });
    test('11-46 Fixkosten', async ({ page }, info) => {
      await vorbereiten(page);
      await page.goto('./#/fixkosten');
      await foto(page, info.project.name, '11-46_fixkosten');
    });
  });

  test('12-62 Fixkosten hinzufuegen', async ({ page }, info) => {
    await vorbereiten(page);
    await page.goto('./#/fixkosten');
    await page.getByRole('button', { name: 'Fixkosten hinzufügen' }).click();
    await sheetOffen(page);
    await page.getByLabel('Betrag in Euro').fill('34,99');
    await page.getByLabel('wofür?').fill('Internet');
    await page.locator('dialog[open] select').first().selectOption('20');
    await page.locator('dialog[open]').getByRole('heading').click(); // Fokus aus dem Feld, Tastatur zu
    await foto(page, info.project.name, '12-62_fixkosten-sheet');
  });

  test.describe('Abgeleitete Screens', () => {
    test('Onboarding', async ({ page }, info) => {
      await vorbereiten(page, { daten: null });
      await page.goto('./');
      await page.getByLabel('wie heißt du?').fill('Jonas');
      await page.locator('main').click({ position: { x: 5, y: 5 } });
      await foto(page, info.project.name, 'abgeleitet_onboarding-1');
      await page.getByRole('button', { name: 'Weiter' }).click();
      await foto(page, info.project.name, 'abgeleitet_onboarding-2');
      await page.getByRole('button', { name: 'Weiter' }).click();
      await foto(page, info.project.name, 'abgeleitet_onboarding-3');
    });

    test('Pot-Verlauf', async ({ page }, info) => {
      await vorbereiten(page);
      await page.goto('./#/budget');
      await page.getByRole('button', { name: /^Drogen:/ }).click();
      await foto(page, info.project.name, 'abgeleitet_pot-verlauf');
    });

    test('Einstellungen', async ({ page }, info) => {
      await vorbereiten(page);
      await page.goto('./#/einstellungen');
      await schriftenBereit(page);
      await page.screenshot({ path: `${ORDNER}/${info.project.name}/abgeleitet_einstellungen.png`, fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: /Einkauf und Haushalt/ }).first().click();
      await sheetOffen(page);
      await foto(page, info.project.name, 'abgeleitet_pot-sheet');
    });
  });

  test.describe('Grosse Schrift (Safari-Zoom 150 %)', () => {
    test.use({ viewport: { width: 262, height: 568 } });
    test('Screens', async ({ page }, info) => {
      await vorbereiten(page);
      for (const [name, ziel] of [
        ['dashboard', './#/budget'],
        ['fixkosten', './#/fixkosten'],
        ['pot-verlauf', './#/pot/drogen'],
        ['einstellungen', './#/einstellungen']
      ] as const) {
        await page.goto(ziel);
        await schriftenBereit(page);
        await page.screenshot({ path: `${ORDNER}/${info.project.name}/gross_${name}.png`, fullPage: true, animations: 'disabled' });
      }
      await page.goto('./#/budget');
      await page.getByRole('button', { name: 'Ausgabe hinzufügen' }).click();
      await sheetOffen(page);
      await tippe(page, '32');
      await foto(page, info.project.name, 'gross_ausgabe-sheet');
      await page.locator('dialog[open] [class*="_inhalt_"]').evaluate((e) => e.scrollTo(0, e.scrollHeight));
      await foto(page, info.project.name, 'gross_ausgabe-sheet-unten');
    });
  });
});
