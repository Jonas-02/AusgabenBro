import { expect, test } from '@playwright/test';

test('App startet und laedt beide Schriften', async ({ page }) => {
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
