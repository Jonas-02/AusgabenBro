import { expect, test } from '@playwright/test';
import { vorbereiten } from './hilfen';

test('App startet und laedt beide Schriften', async ({ page }) => {
  // Mit Daten, damit das Dashboard (mit Ziffern in Momo) erscheint. Der
  // Browser laedt eine Schrift erst, wenn Text sie braucht.
  await vorbereiten(page);
  await page.goto('./');
  await expect(page).toHaveTitle('AusgabenBro');
  const geladen = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      manjari: document.fonts.check('16px "Manjari"'),
      momo: document.fonts.check('16px "Momo Trust Display"', '76,43 €')
    };
  });
  expect(geladen).toEqual({ manjari: true, momo: true });
});

test('Manifest ist fuer den Home-Bildschirm eingerichtet', async ({ request }) => {
  const antwort = await request.get('manifest.webmanifest');
  expect(antwort.ok()).toBe(true);
  const manifest = await antwort.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.theme_color).toBe('#1E1E1E');
  expect(manifest.background_color).toBe('#1E1E1E');
});

test('Erster Start zeigt das Onboarding', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hallo,');
  await expect(page.getByLabel('wie heißt du?')).toBeVisible();
});
