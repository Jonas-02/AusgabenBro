/**
 * Die Pflichttests aus Abschnitt 3.7 der Spezifikation, in derselben
 * Reihenfolge und Formulierung.
 */
import { describe, expect, it } from 'vitest';
import { proTag, potStand, vorschau, zugeflossen } from './pot';
import { tagIndex, zyklusVon } from './zyklus';
import { differenz, heute } from './datum';
import { monatswert, uebersicht } from './fixkosten';
import { addiere, tippe } from './eingabe';
import { euro, euroGerundet } from './geld';
import type { Ausgabe, Budgeteinstellung, Fixkosten, Pot } from './typen';

const reset: Budgeteinstellung = { zahltag: 1, uebertrag: 'reset' };

function pot(monatlich: number, id = 'p'): Pot {
  return { id, name: 'Test', symbol: 'einkauf', betraege: [{ ab: '2026-01-01', cent: monatlich }], erstelltAm: '2026-01-01' };
}

function ausgabe(cent: number, datum: string, potId = 'p'): Ausgabe {
  return { id: `${datum}-${cent}`, potId, cent, datum, erfasstUm: `${datum}T12:00:00Z` };
}

describe('3.7 Pflichttests', () => {
  it('Pot 210 €/Monat, 30-Tage-Zyklus, Tag 17 → accrued 119,00 €, daily 7,00 €', () => {
    expect(zugeflossen(21_000, 17, 30)).toBe(11_900);
    expect(proTag(21_000, 30)).toBe(700);
    // Ueber den echten Zyklus: November hat 30 Tage, der 17. ist Tag 17.
    const s = potStand(pot(21_000), [], '2026-11-17', reset);
    expect(s.zyklus.tage).toBe(30);
    expect(s.tagIndex).toBe(17);
    expect(euro(s.zugeflossen, { immerNachkomma: true })).toBe('119,00 €');
    expect(euro(s.proTag, { immerNachkomma: true })).toBe('7,00 €');
  });

  it('Pot 140 €/Monat, 30 Tage → Tag 1: 4,66 €, Tag 30: genau 140,00 €', () => {
    expect(zugeflossen(14_000, 1, 30)).toBe(466);
    expect(zugeflossen(14_000, 30, 30)).toBe(14_000);
    // Keine Rundungsdrift: die Summe der Tageszufluesse ergibt exakt 140 €.
    let summe = 0;
    for (let t = 1; t <= 30; t++) summe += zugeflossen(14_000, t, 30) - zugeflossen(14_000, t - 1, 30);
    expect(summe).toBe(14_000);
  });

  describe('Stand 20,43 €, daily 7 €', () => {
    // 210 €/Monat am 17. von 30 Tagen: 119,00 € zugeflossen, 98,57 € ausgegeben.
    const p = pot(21_000);
    const bisher = [ausgabe(9_857, '2026-11-10')];
    const heuteTag = '2026-11-17';

    it('Voraussetzung: Stand 20,43 €, daily 7 €', () => {
      const s = potStand(p, bisher, heuteTag, reset);
      expect(s.stand).toBe(2_043);
      expect(s.proTag).toBe(700);
    });

    it('Ausgabe 12 € → danach 8,43 €, „bleibt im Plus"', () => {
      const v = vorschau(p, bisher, heuteTag, reset, 1_200);
      expect(v.vorher).toBe(2_043);
      expect(v.nachher).toBe(843);
      expect(v.ausgleich).toEqual({ art: 'plus' });
    });

    it('Ausgabe 32 € → danach −11,57 €, n = 2', () => {
      const v = vorschau(p, bisher, heuteTag, reset, 3_200);
      expect(v.nachher).toBe(-1_157);
      expect(v.ausgleich).toEqual({ art: 'ausgleich', tage: 2 });
    });
  });

  describe('Zahltag', () => {
    it('Zahltag 31 im Februar → Zyklus beginnt am 28. (Normaljahr)', () => {
      expect(zyklusVon('2026-02-28', 31).start).toBe('2026-02-28');
      expect(zyklusVon('2026-03-10', 31).start).toBe('2026-02-28');
    });

    it('Zahltag 31 im Februar → Zyklus beginnt am 29. (Schaltjahr)', () => {
      expect(zyklusVon('2028-02-29', 31).start).toBe('2028-02-29');
      expect(zyklusVon('2028-03-05', 31).start).toBe('2028-02-29');
    });

    it('Zahltag 15 → Zyklus 15.11.–14.12. mit 30 Tagen', () => {
      expect(zyklusVon('2026-11-20', 15)).toEqual({ start: '2026-11-15', ende: '2026-12-14', tage: 30 });
    });
  });

  describe('Zyklus über Jahreswechsel, Schaltjahr und Zeitumstellung', () => {
    it('Jahreswechsel: Zahltag 15, Anfang Januar liegt im Dezember-Zyklus', () => {
      const z = zyklusVon('2027-01-03', 15);
      expect(z).toEqual({ start: '2026-12-15', ende: '2027-01-14', tage: 31 });
      expect(tagIndex('2027-01-01', z)).toBe(18);
    });

    it('Schaltjahr: Zyklus ueber den 29. Februar zaehlt einen Tag mehr', () => {
      expect(zyklusVon('2028-02-10', 1).tage).toBe(29);
      expect(zyklusVon('2027-02-10', 1).tage).toBe(28);
      expect(zyklusVon('2028-02-20', 15)).toEqual({ start: '2028-02-15', ende: '2028-03-14', tage: 29 });
    });

    it('Sommerzeit: der 28.03.2027 hat 23 Stunden und zaehlt trotzdem als 1 Tag', () => {
      // Die Tests laufen mit TZ=Europe/Berlin. Ohne diese Zeitzone waere der
      // Test wertlos, deshalb wird das hier zuerst geprueft.
      const vor = new Date(2027, 2, 28, 0, 0);
      const nach = new Date(2027, 2, 29, 0, 0);
      expect((nach.getTime() - vor.getTime()) / 3_600_000).toBe(23);

      // Kurz vor Mitternacht am Umstellungstag ist immer noch der 28.
      expect(heute(new Date(2027, 2, 28, 23, 30))).toBe('2027-03-28');
      expect(heute(new Date(2027, 2, 29, 0, 30))).toBe('2027-03-29');
      expect(differenz('2027-03-29', '2027-03-28')).toBe(1);

      const z = zyklusVon('2027-03-28', 15);
      expect(z.tage).toBe(31);
      expect(tagIndex('2027-03-28', z)).toBe(14);
      expect(tagIndex('2027-03-29', z)).toBe(15);
    });

    it('Winterzeit: der 25.10.2026 hat 25 Stunden und zaehlt als 1 Tag', () => {
      const vor = new Date(2026, 9, 25, 0, 0);
      const nach = new Date(2026, 9, 26, 0, 0);
      expect((nach.getTime() - vor.getTime()) / 3_600_000).toBe(25);
      expect(differenz('2026-10-26', '2026-10-25')).toBe(1);
      expect(tagIndex('2026-10-26', zyklusVon('2026-10-26', 1))).toBe(26);
    });
  });

  describe('Fixkosten-Beispiel aus dem Figma', () => {
    const fk = (name: string, cent: number, rhythmus: Fixkosten['rhythmus'] = 'monthly'): Fixkosten => ({
      id: name, name, cent, rhythmus, kategorieId: 'k', tag: 1, startMonat: 1
    });
    const liste = [
      fk('Miete', 62_000),
      fk('Strom', 4_800),
      fk('Internet', 3_499),
      fk('Haftpflicht', 5_940, 'yearly'),
      fk('Rundfunkbeitrag', 5_508, 'quarterly'),
      fk('Fitnessstudio', 2_990),
      fk('Handyvertrag', 1_599),
      fk('Musik-Abo', 1_099),
      fk('Monatsticket', 6_300)
    ];

    it('Rundfunkbeitrag 55,08 € vierteljährlich → 18,36 €', () => {
      expect(monatswert(fk('Rundfunk', 5_508, 'quarterly'))).toBe(1_836);
    });

    it('Haftpflicht 59,40 € jährlich → 4,95 €', () => {
      expect(monatswert(fk('Haftpflicht', 5_940, 'yearly'))).toBe(495);
    });

    it('Σ 846,18 € pro Monat, 10.154 € im Jahr', () => {
      const u = uebersicht(liste);
      expect(u.proMonat).toBe(84_618);
      expect(euro(u.proMonat)).toBe('846,18 €');
      expect(euroGerundet(u.imJahr)).toBe('10.154 €');
      expect(u.anzahl).toBe(9);
    });
  });

  describe('Zahlenfeld', () => {
    it('„0" dann „5" → „5"', () => {
      expect(tippe(tippe('', '0'), '5')).toBe('5');
    });

    it('„," dann „5" → „0,5"', () => {
      expect(tippe(tippe('', ','), '5')).toBe('0,5');
    });

    it('kein drittes Nachkommazeichen', () => {
      expect(tippe('12,34', '5')).toBe('12,34');
    });

    it('Quick +10 auf „12,5" → „22,5"', () => {
      expect(addiere('12,5', 1_000)).toBe('22,5');
    });
  });
});
