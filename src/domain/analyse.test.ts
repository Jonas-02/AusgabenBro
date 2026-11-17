import { describe, expect, it } from 'vitest';
import {
  anstehend,
  kennzahlen,
  monatskosten,
  monatsverlauf,
  naechsteAbbuchung,
  potVerteilung,
  wochentag,
  wochentage,
  zyklenVergleich
} from './analyse';
import type { Ausgabe, Budgeteinstellung, Fixkosten, Pot } from './typen';

/* Figma-Stand am 17.11.2026 (wie e2e/hilfen.ts): vier Pots ab 1.11.,
   vier Ausgaben am 10.11., Zahltag 1, Uebertrag reset. */
const pot = (id: string, cent: number, erstelltAm = '2026-11-01'): Pot => ({
  id,
  name: id,
  symbol: id,
  betraege: [{ ab: erstelltAm, cent }],
  erstelltAm
});
const POTS = [pot('einkauf', 21_000), pot('drogen', 15_000), pot('lifestyle', 14_000), pot('sonstiges', 25_000)];
const aus = (id: string, potId: string, cent: number, datum: string): Ausgabe => ({ id, potId, cent, datum, erfasstUm: `${datum}T12:00:00Z` });
const AUSGABEN = [
  aus('a1', 'einkauf', 9_857, '2026-11-10'),
  aus('a2', 'drogen', 10_500, '2026-11-10'),
  aus('a3', 'lifestyle', 5_890, '2026-11-10'),
  aus('a4', 'sonstiges', 12_123, '2026-11-10')
];
const E: Budgeteinstellung = { zahltag: 1, uebertrag: 'reset' };
const HEUTE = '2026-11-17';

describe('Monatsverlauf', () => {
  const v = monatsverlauf(POTS, AUSGABEN, HEUTE, E);

  it('summiert Budget, Tagesbetrag und Ausgaben', () => {
    expect(v.budget).toBe(75_000);
    expect(v.proTag).toBe(2_500); // 700 + 500 + 467 + 833
    expect(v.ausgegeben).toBe(38_370);
    expect(v.tage).toHaveLength(30);
  });

  it('kumuliert ab dem Ausgabetag und stimmt mit dem Dashboard ueberein', () => {
    expect(v.tage[8]?.kumuliert).toBe(0);
    expect(v.tage[9]).toMatchObject({ tag: '2026-11-10', ausgegeben: 38_370, kumuliert: 38_370 });
    // Tag 17: zugeflossen wie in der Hauptkarte ("von 424,99 €")
    expect(v.tage[16]).toMatchObject({ budget: 42_499, kumuliert: 38_370, vergangen: true });
    expect(v.tage[17]?.vergangen).toBe(false);
    expect(v.tage[29]?.budget).toBe(75_000);
  });

  it('rechnet linear hoch und nennt den Spielraum pro Tag', () => {
    expect(v.prognose).toEqual({ ausgaben: 67_712, differenz: 7_288 }); // 38.370 × 30 / 17
    expect(v.spielraum).toEqual({ gesamt: 36_630, tage: 14, proTag: 2_616 });
  });

  it('rechnet in den ersten Tagen nicht hoch', () => {
    expect(monatsverlauf(POTS, AUSGABEN, '2026-11-02', E).prognose).toBeNull();
    expect(monatsverlauf(POTS, AUSGABEN, '2026-11-03', E).prognose).not.toBeNull();
  });

  it('meldet keinen Spielraum, wenn das Budget aufgebraucht ist', () => {
    const viel = [...AUSGABEN, aus('a5', 'einkauf', 50_000, '2026-11-12')];
    expect(monatsverlauf(POTS, viel, HEUTE, E).spielraum.proTag).toBe(0);
  });

  it('zaehlt den Uebertrag im Modus carry zum Budget', () => {
    const alt = [pot('einkauf', 21_000, '2026-10-01')];
    const v2 = monatsverlauf(alt, [aus('x', 'einkauf', 1_000, '2026-10-05')], HEUTE, { zahltag: 1, uebertrag: 'carry' });
    expect(v2.budget).toBe(21_000 + 20_000);
    expect(v2.tage[0]?.budget).toBe(20_000 + 700);
  });
});

describe('Verteilung, Vergleich, Wochentage', () => {
  it('sortiert Pots nach Ausgaben', () => {
    const d = potVerteilung(POTS, AUSGABEN, HEUTE, E);
    expect(d.map((x) => x.potId)).toEqual(['sonstiges', 'drogen', 'einkauf', 'lifestyle']);
    expect(d[0]?.anteil).toBeCloseTo(12_123 / 38_370, 6);
    expect(d.reduce((n, x) => n + x.anteil, 0)).toBeCloseTo(1, 6);
  });

  it('vergleicht Zyklen seit dem ersten Pot', () => {
    const pots = [pot('einkauf', 21_000, '2026-09-20')];
    const ausgaben = [aus('s', 'einkauf', 5_000, '2026-09-25'), aus('o', 'einkauf', 30_000, '2026-10-05'), aus('n', 'einkauf', 1_000, HEUTE)];
    const z = zyklenVergleich(pots, ausgaben, HEUTE, E);
    expect(z.map((x) => [x.zyklus.start, x.ausgegeben, x.budget, x.laufend])).toEqual([
      ['2026-09-01', 5_000, 21_000, false],
      ['2026-10-01', 30_000, 21_000, false],
      ['2026-11-01', 1_000, 21_000, true]
    ]);
    expect(zyklenVergleich(pots, ausgaben, HEUTE, E, 2)).toHaveLength(2);
    expect(zyklenVergleich([], [], HEUTE, E)).toEqual([]);
  });

  it('kennt die Wochentage', () => {
    expect(wochentag('2026-11-17')).toBe(1); // Dienstag
    expect(wochentag('2026-11-01')).toBe(6); // Sonntag
  });

  it('mittelt Ausgaben je Wochentag ueber den Zeitraum', () => {
    const w = wochentage(POTS, AUSGABEN, HEUTE);
    expect(w.tage).toBe(17);
    // 1.–17.11.: drei Dienstage (3., 10., 17.), Ausgaben nur am 10.
    expect(w.werte[1]).toEqual({ wochentag: 1, summe: 38_370, tage: 3, schnitt: 12_790 });
    expect(w.werte[6]?.tage).toBe(3);
    expect(w.werte[0]?.schnitt).toBe(0);
  });
});

describe('Kennzahlen', () => {
  it('zaehlt Tage ohne Ausgabe und Tage ueber dem Tagesbetrag', () => {
    const v = monatsverlauf(POTS, AUSGABEN, HEUTE, E);
    expect(kennzahlen(v, POTS, AUSGABEN, HEUTE)).toEqual({
      anzahl: 4,
      schnittProAusgabe: 9_593,
      schnittProTag: 2_257,
      groesste: AUSGABEN[3],
      tageOhne: 15,
      abgeschlosseneTage: 16,
      tageDrueber: 1
    });
  });

  it('kommt ohne Ausgaben aus', () => {
    const v = monatsverlauf(POTS, [], '2026-11-01', E);
    expect(kennzahlen(v, POTS, [], '2026-11-01')).toMatchObject({ anzahl: 0, schnittProAusgabe: null, groesste: null, abgeschlosseneTage: 0 });
  });
});

describe('Fixkosten', () => {
  const fk = (id: string, tag: number, rhythmus: Fixkosten['rhythmus'] = 'monthly', startMonat = 1, cent = 1_000): Fixkosten => ({
    id,
    name: id,
    cent,
    kategorieId: 'k',
    rhythmus,
    tag,
    startMonat
  });

  it('findet die naechste Abbuchung', () => {
    expect(naechsteAbbuchung(fk('a', 20), HEUTE)).toBe('2026-11-20');
    expect(naechsteAbbuchung(fk('a', 17), HEUTE)).toBe('2026-11-17');
    expect(naechsteAbbuchung(fk('a', 15), HEUTE)).toBe('2026-12-15');
    expect(naechsteAbbuchung(fk('q', 15, 'quarterly', 2), HEUTE)).toBe('2027-02-15');
    expect(naechsteAbbuchung(fk('j', 1, 'yearly', 3), HEUTE)).toBe('2027-03-01');
    expect(naechsteAbbuchung(fk('m', 31), '2027-02-10')).toBe('2027-02-28');
  });

  it('listet die naechsten 30 Tage nach Datum', () => {
    const liste = [fk('Strom', 15), fk('Miete', 1), fk('Monatsticket', 1), fk('Internet', 20), fk('Haftpflicht', 1, 'yearly', 3)];
    expect(anstehend(liste, HEUTE).map((a) => [a.fixkosten.name, a.datum])).toEqual([
      ['Internet', '2026-11-20'],
      ['Miete', '2026-12-01'],
      ['Monatsticket', '2026-12-01'],
      ['Strom', '2026-12-15']
    ]);
  });

  it('addiert Budget und Fixkosten', () => {
    expect(monatskosten(POTS, [fk('a', 1, 'monthly', 1, 62_000), fk('b', 1, 'yearly', 3, 5_940)])).toEqual({
      budget: 75_000,
      fixkosten: 62_000 + 495,
      gesamt: 75_000 + 62_495
    });
  });
});
