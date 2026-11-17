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
});
