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

test('keine Scrollbalken, Scrollen geht trotzdem', async ({ page }) => {
  await vorbereiten(page);
  await page.goto('./#/fixkosten');
  const seite = await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth);
  expect(seite).toBe('none');
  // Ohne Mausrad: mobiles WebKit in Playwright kennt keins. Scrollen darf
  // nicht per CSS gesperrt sein, die Seite ist laenger als der Bildschirm,
  // und ein Scrollbefehl bewegt sie.
  const zustand = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overflowY,
    body: getComputedStyle(document.body).overflowY,
    laenger: document.documentElement.scrollHeight > window.innerHeight
  }));
  expect(zustand.html).not.toBe('hidden');
  expect(zustand.body).not.toBe('hidden');
  expect(zustand.laenger).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Fixkosten hinzufügen' }).click();
  await page.locator('dialog[data-zustand="offen"]').waitFor();
  const sheet = await page.locator('dialog[open] [class*="_inhalt_"]').evaluate((e) => getComputedStyle(e).scrollbarWidth);
  expect(sheet).toBe('none');
});
