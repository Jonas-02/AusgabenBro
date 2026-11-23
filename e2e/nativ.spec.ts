import { expect, test } from '@playwright/test';
import { vorbereiten } from './hilfen';

/** Massnahmen, damit sich die Home-Bildschirm-App wie eine native App anfuehlt. */

test('kein Zoom: Viewport, Safari-Gesten und Doppeltipp', async ({ page }) => {
  await vorbereiten(page);
  await page.goto('./#/budget');
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).toContain('maximum-scale=1');
  expect(viewport).toContain('user-scalable=no');
  expect(viewport).toContain('viewport-fit=cover');

  const abgebrochen = await page.evaluate(() =>
    ['gesturestart', 'gesturechange', 'gestureend'].map((typ) => {
      const e = new Event(typ, { cancelable: true, bubbles: true });
      document.body.dispatchEvent(e);
      return e.defaultPrevented;
    })
  );
  expect(abgebrochen).toEqual([true, true, true]);

  const touchAction = await page.evaluate(() => getComputedStyle(document.documentElement).touchAction);
  expect(touchAction).toBe('manipulation');
});

test('kein Markieren ausser in Eingabefeldern, Tippen geht weiter', async ({ page }) => {
  await vorbereiten(page);
  await page.goto('./#/einstellungen');
  const auswahl = (sel: string) =>
    page.locator(sel).first().evaluate((el) => {
      const s = getComputedStyle(el) as CSSStyleDeclaration & { webkitUserSelect?: string };
      return s.userSelect || s.webkitUserSelect;
    });
  expect(await auswahl('main h1')).toBe('none');
  expect(await auswahl('main [class*="_posten_"]')).toBe('none');
  expect(await auswahl('input[type="text"]')).toBe('text');

  await page.getByLabel('dein Name').fill('Kim');
  await expect(page.getByLabel('dein Name')).toHaveValue('Kim');
});

test('Startbilder für alle iPhone-Größen, in passender Auflösung', async ({ page, request }) => {
  await page.goto('./');
  const bilder = await page.locator('link[rel="apple-touch-startup-image"]').evaluateAll((links) =>
    links.map((l) => ({ href: l.getAttribute('href') ?? '', media: l.getAttribute('media') ?? '' }))
  );
  expect(bilder.length).toBeGreaterThanOrEqual(12);
  // Dein iPhone (393 × 852 @3) ist dabei
  expect(bilder.some((b) => b.media.includes('device-width: 393px') && b.media.includes('device-height: 852px'))).toBe(true);

  for (const b of bilder) {
    const m = /device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\)/.exec(b.media);
    expect(m, b.media).not.toBeNull();
    const [, breite, hoehe, dpr] = (m as RegExpExecArray).map(Number);
    const antwort = await request.get(b.href);
    expect(antwort.ok(), b.href).toBe(true);
    const png = await antwort.body();
    // PNG-Kopf: Breite und Hoehe ab Byte 16 bzw. 20
    expect([png.readUInt32BE(16), png.readUInt32BE(20)], b.href).toEqual([breite! * dpr!, hoehe! * dpr!]);
  }
});

test('Startbilder landen nicht im Offline-Cache', async ({ page }) => {
  await vorbereiten(page);
  await page.goto('./#/budget');
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 15_000 });
  const imCache = await page.evaluate(async () => {
    const namen = await caches.keys();
    for (const n of namen) {
      const c = await caches.open(n);
      if ((await c.keys()).some((r) => r.url.includes('/splash/'))) return true;
    }
    return false;
  });
  expect(imCache).toBe(false);
});
