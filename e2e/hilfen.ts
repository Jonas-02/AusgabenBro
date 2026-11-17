import type { Page } from '@playwright/test';

/** Das Figma ist fuer den 17. November gebaut ("Internet am 20. · in 3 Tagen"). */
export const FIGMA_HEUTE = '2026-11-17T10:00:00';

const pot = (id: string, name: string, symbol: string, cent: number) => ({
  id, name, symbol, betraege: [{ ab: '2026-11-01', cent }], erstelltAm: '2026-11-01'
});
const ausgabe = (id: string, potId: string, cent: number, datum = '2026-11-10') => ({
  id, potId, cent, datum, erfasstUm: `${datum}T12:00:00.000Z`
});
const fix = (id: string, name: string, cent: number, kategorieId: string, tag: number, rhythmus = 'monthly', startMonat = 1) => ({
  id, name, cent, kategorieId, tag, rhythmus, startMonat
});

/**
 * Zustand, der den Figma-Screens moeglichst nahe kommt. Die Beispielzahlen
 * im Figma sind untereinander nicht stimmig (380,32 von 425 ergibt nicht
 * 76,43); hier stimmen sie, deshalb weichen einzelne Werte ab.
 */
export function figmaDaten() {
  return {
    onboardingFertig: true,
    name: 'Jonas',
    motto: 'Hör auf dir Zigaretten zu kaufen',
    zahltag: 1,
    uebertrag: 'reset',
    pots: [
      pot('einkauf', 'Einkauf und Haushalt', 'einkauf', 21_000),
      pot('drogen', 'Drogen', 'drogen', 15_000),
      pot('lifestyle', 'Lifestyle und Kleidung', 'lifestyle', 14_000),
      pot('sonstiges', 'Sonstiges und Ausgehen', 'sonstiges', 25_000)
    ],
    // Am 17. von 30 Tagen ergibt das jeweils 20,43 € bzw. −20 € wie im Figma.
    ausgaben: [
      ausgabe('a1', 'einkauf', 9_857),
      ausgabe('a2', 'drogen', 10_500),
      ausgabe('a3', 'lifestyle', 5_890),
      ausgabe('a4', 'sonstiges', 12_123)
    ],
    letzterPot: 'einkauf',
    fixkosten: [
      fix('f1', 'Miete', 62_000, 'wohnen', 1),
      fix('f2', 'Strom', 4_800, 'wohnen', 15),
      fix('f3', 'Internet', 3_499, 'wohnen', 20),
      fix('f4', 'Haftpflicht', 5_940, 'versicherungen', 1, 'yearly', 3),
      fix('f5', 'Rundfunkbeitrag', 5_508, 'versicherungen', 15, 'quarterly', 2),
      fix('f6', 'Fitnessstudio', 2_990, 'abos', 5),
      fix('f7', 'Handyvertrag', 1_599, 'abos', 25),
      fix('f8', 'Musik-Abo', 1_099, 'abos', 28),
      fix('f9', 'Monatsticket', 6_300, 'mobilitaet', 1)
    ],
    kategorien: [
      { id: 'wohnen', name: 'Wohnen', symbol: 'wohnen' },
      { id: 'versicherungen', name: 'Versicherungen und Beiträge', symbol: 'versicherungen' },
      { id: 'abos', name: 'Abos und Verträge', symbol: 'abos' },
      { id: 'mobilitaet', name: 'Mobilität', symbol: 'mobilitaet' }
    ]
  };
}

export type Daten = ReturnType<typeof figmaDaten>;

interface Optionen {
  daten?: Daten | null;
  /** Safe-Area des iPhone 14 Pro nachbilden wie im Figma-Rahmen. */
  homeIndikator?: boolean;
}

/** Feste Uhrzeit, gespeicherter Zustand und Safe-Area vor dem ersten Laden. */
export async function vorbereiten(page: Page, { daten = figmaDaten(), homeIndikator = true }: Optionen = {}) {
  await page.clock.setFixedTime(new Date(FIGMA_HEUTE));
  await page.addInitScript(
    ({ zustand, indikator }) => {
      if (zustand && !sessionStorage.getItem('vorbereitet')) {
        localStorage.setItem('ausgabenbro', JSON.stringify({ state: zustand, version: 1 }));
        sessionStorage.setItem('vorbereitet', 'ja');
      }
      if (indikator) {
        // Playwright kennt env(safe-area-inset-*) nicht. Der Figma-Rahmen
        // hat oben 0 und unten 34 px fuer den Home-Indikator.
        document.addEventListener('DOMContentLoaded', () => {
          const s = document.createElement('style');
          s.textContent = ':root{--safe-bottom:34px;--safe-top:0px}';
          document.head.appendChild(s);
        });
      }
    },
    { zustand: daten, indikator: homeIndikator }
  );
}

export async function schriftenBereit(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}
