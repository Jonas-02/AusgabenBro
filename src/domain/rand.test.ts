/** Randfaelle jenseits der Pflichttests. */
import { describe, expect, it } from 'vitest';
import { gesamt, monatsbetrag, potStand, standBalken, uebertrag, vorschau } from './pot';
import { zyklusVon } from './zyklus';
import { zeile, abbuchungstag, istAbbuchungsmonat } from './fixkosten';
import { addiere, ausBetrag, loesche, tippe, zuCent, tasteVonKey } from './eingabe';
import { euro, euro2, parseEuro, teile } from './geld';
import { istTag } from './datum';
import type { Ausgabe, Budgeteinstellung, Fixkosten, Pot } from './typen';

const reset: Budgeteinstellung = { zahltag: 1, uebertrag: 'reset' };
const carry: Budgeteinstellung = { zahltag: 1, uebertrag: 'carry' };

function pot(monatlich: number, erstelltAm = '2026-09-01', id = 'p'): Pot {
  return { id, name: id, symbol: 'einkauf', betraege: [{ ab: erstelltAm, cent: monatlich }], erstelltAm };
}
function a(cent: number, datum: string, potId = 'p'): Ausgabe {
  return { id: `${potId}-${datum}-${cent}`, potId, cent, datum, erfasstUm: datum };
}

describe('Pot-Stand', () => {
  it('Ausgaben vor dem Zyklusstart zaehlen im Modus reset nicht', () => {
    const s = potStand(pot(21_000), [a(5_000, '2026-10-31')], '2026-11-01', reset);
    expect(s.ausgegeben).toBe(0);
    expect(s.stand).toBe(700);
  });

  it('Ausgaben nach heute zaehlen nicht', () => {
    const s = potStand(pot(21_000), [a(5_000, '2026-11-20')], '2026-11-17', reset);
    expect(s.ausgegeben).toBe(0);
  });

  it('Modus carry: Ergebnis abgeschlossener Zyklen fliesst ein, positiv wie negativ', () => {
    // September: 210 € zu, 200 € aus → +10 €. Oktober: 210 € zu, 250 € aus → −40 €.
    const ausgaben = [a(20_000, '2026-09-15'), a(25_000, '2026-10-15')];
    const z = zyklusVon('2026-11-01', 1);
    expect(uebertrag(pot(21_000), ausgaben, z, carry)).toBe(-3_000);
    const s = potStand(pot(21_000), ausgaben, '2026-11-01', carry);
    expect(s.stand).toBe(-3_000 + 700);
  });

  it('Modus carry beginnt erst mit dem Zyklus, in dem der Pot angelegt wurde', () => {
    const p = pot(21_000, '2026-10-20');
    const z = zyklusVon('2026-11-05', 1);
    expect(uebertrag(p, [a(1_000, '2026-10-21')], z, carry)).toBe(20_000);
  });

  it('Neuer Monatsbetrag gilt rueckwirkend fuer den laufenden Zyklus, nicht fuer fruehere', () => {
    const p: Pot = { ...pot(21_000), betraege: [{ ab: '2026-09-01', cent: 21_000 }, { ab: '2026-11-17', cent: 30_000 }] };
    expect(monatsbetrag(p, zyklusVon('2026-11-02', 1))).toBe(30_000);
    expect(monatsbetrag(p, zyklusVon('2026-10-15', 1))).toBe(21_000);
  });

  it('Dashboard summiert alle Pots', () => {
    const staende = [potStand(pot(21_000, '2026-09-01', 'x'), [], '2026-11-17', reset), potStand(pot(15_000, '2026-09-01', 'y'), [], '2026-11-17', reset)];
    const g = gesamt(staende);
    expect(g.monatlich).toBe(36_000);
    expect(g.proTag).toBe(700 + 500);
    expect(g.stand).toBe(11_900 + 8_500);
  });
});

describe('Balken', () => {
  it('Positiv: blau = ausgegeben, grau = Zugeflossenes minus Ausgegebenes', () => {
    const b = standBalken({ monatlich: 21_000, zugeflossen: 11_900, ausgegeben: 9_857, stand: 2_043 });
    expect(b).toEqual({ skala: 21_000, segmente: [{ art: 'ausgegeben', cent: 9_857 }, { art: 'rest', cent: 2_043 }] });
  });

  it('Negativ (Pot-Card v2): orange, geteilt in gedeckt und Vorgriff, ohne grau', () => {
    const b = standBalken({ monatlich: 15_000, zugeflossen: 9_000, ausgegeben: 11_000, stand: -2_000 });
    expect(b.segmente).toEqual([
      { art: 'minus', cent: 9_000 },
      { art: 'vorgriff', cent: 2_000 }
    ]);
  });

  it('Negativ mit negativem Uebertrag: alles ist Vorgriff', () => {
    // Uebertrag −5.000, zugeflossen 3.000 → verfuegbar −2.000
    const b = standBalken({ monatlich: 15_000, zugeflossen: 3_000, ausgegeben: 1_000, stand: -3_000 });
    expect(b.segmente).toEqual([
      { art: 'minus', cent: 0 },
      { art: 'vorgriff', cent: 1_000 }
    ]);
  });

  it('Vorschau im Plus entspricht der Figma-Geometrie aus 7:4', () => {
    // Figma: 154,4 | 13,2 | 18,8 px von 329 px fuer 210 €.
    const v = vorschau(pot(21_000), [a(9_857, '2026-11-10')], '2026-11-17', reset, 1_200);
    const px = v.balken.segmente.map((s) => Math.round((s.cent / v.balken.skala) * 329 * 10) / 10);
    expect(v.balken.segmente.map((s) => s.art)).toEqual(['ausgegeben', 'rest', 'diese']);
    expect(px).toEqual([154.4, 13.2, 18.8]);
  });

  it('Vorschau im Vorgriff: [ausgegeben][vorher grau][Vorgriff orange]', () => {
    const v = vorschau(pot(21_000), [a(9_857, '2026-11-10')], '2026-11-17', reset, 3_200);
    expect(v.balken.segmente).toEqual([
      { art: 'ausgegeben', cent: 9_857 },
      { art: 'rest', cent: 2_043 },
      { art: 'vorgriff', cent: 1_157 }
    ]);
  });

  it('Vorschau bei bereits negativem Pot zeigt das Defizit nicht doppelt', () => {
    // 119 € zu, 130 € aus → −11 €. Ausgabe 5 € → −16 €.
    const v = vorschau(pot(21_000), [a(13_000, '2026-11-10')], '2026-11-17', reset, 500);
    const summe = v.balken.segmente.reduce((n, s) => n + s.cent, 0);
    expect(summe).toBe(13_000 + 500);
    expect(v.balken.segmente).toEqual([
      { art: 'ausgegeben', cent: 11_900 },
      { art: 'rest', cent: 0 },
      { art: 'vorgriff', cent: 1_600 }
    ]);
  });
});

describe('Ausgleich', () => {
  it('n = 1 heisst „morgen"', () => {
    const v = vorschau(pot(21_000), [a(9_857, '2026-11-10')], '2026-11-17', reset, 2_043 + 500);
    expect(v.ausgleich).toEqual({ art: 'ausgleich', tage: 1 });
  });

  it('Modus reset: nach dem Zyklusende → „diesen Monat nicht mehr ausgeglichen"', () => {
    // 29. von 30 Tagen, Defizit 50 € bei 7 € pro Tag.
    const v = vorschau(pot(21_000), [a(20_300, '2026-11-10')], '2026-11-29', reset, 5_000);
    expect(v.ausgleich).toEqual({ art: 'nicht-mehr' });
  });

  it('Modus carry: Ausgleich laeuft in den naechsten Zyklus weiter', () => {
    // Im November angelegt, damit kein Uebertrag aus frueheren Zyklen mitspielt.
    const v = vorschau(pot(21_000, '2026-11-01'), [a(20_300, '2026-11-10')], '2026-11-29', carry, 5_000);
    // Stand vorher 0, nachher −50 €. 30.11.: +7, dann Dezember (31 Tage) je ~6,77 €.
    expect(v.ausgleich.art).toBe('ausgleich');
    if (v.ausgleich.art === 'ausgleich') expect(v.ausgleich.tage).toBe(8);
  });

  it('Pot ohne Monatsbetrag gleicht nie aus', () => {
    const v = vorschau(pot(0), [], '2026-11-17', carry, 100);
    expect(v.ausgleich).toEqual({ art: 'nicht-mehr' });
  });
});

describe('Fixkosten-Unterzeilen am 17.11.2026 wie in Figma 11:46', () => {
  const fk = (p: Partial<Fixkosten>): Fixkosten => ({
    id: 'x', name: 'x', cent: 100, kategorieId: 'k', rhythmus: 'monthly', tag: 1, startMonat: 1, ...p
  });
  const h = '2026-11-17';

  it.each([
    [{ tag: 1 }, 'am 1. · abgebucht', false],
    [{ tag: 15 }, 'am 15. · abgebucht', false],
    [{ tag: 20 }, 'am 20. · in 3 Tagen', true],
    [{ tag: 25 }, 'am 25. · in 8 Tagen', true],
    [{ tag: 28 }, 'am 28. · in 11 Tagen', true]
  ])('monatlich %o → „%s"', (p, text, blau) => {
    const z = zeile(fk(p), h);
    expect(z.unterzeile).toBe(text);
    expect(z.bevorstehend).toBe(blau);
    expect(z.rechtsUnten).toBeNull();
  });

  it('heute und morgen', () => {
    expect(zeile(fk({ tag: 17 }), h).unterzeile).toBe('am 17. · heute');
    expect(zeile(fk({ tag: 18 }), h).unterzeile).toBe('am 18. · morgen');
  });

  it('jährlich am 1. März → Monatswert und „59,40 € im Jahr"', () => {
    const z = zeile(fk({ rhythmus: 'yearly', cent: 5_940, tag: 1, startMonat: 3 }), h);
    expect(z.unterzeile).toBe('jährlich am 1. März');
    expect(z.rechtsUnten).toBe('59,40 € im Jahr');
  });

  it('vierteljährlich am 15. im Abbuchungsmonat → „· abgebucht"', () => {
    const z = zeile(fk({ rhythmus: 'quarterly', cent: 5_508, tag: 15, startMonat: 2 }), h);
    expect(z.unterzeile).toBe('vierteljährlich am 15. · abgebucht');
    expect(z.rechtsUnten).toBe('55,08 € im Quartal');
  });

  it('vierteljährlich ausserhalb des Abbuchungsmonats ohne Status', () => {
    expect(zeile(fk({ rhythmus: 'quarterly', tag: 15, startMonat: 1 }), h).unterzeile).toBe('vierteljährlich am 15.');
  });

  it('Abbuchungstag 31 wird auf das Monatsende begrenzt', () => {
    expect(abbuchungstag({ tag: 31 }, 2026, 11)).toBe(30);
    expect(abbuchungstag({ tag: 31 }, 2026, 2)).toBe(28);
    expect(zeile(fk({ tag: 31 }), h).unterzeile).toBe('am 30. · in 13 Tagen');
  });

  it('Abbuchungsmonate im Quartal', () => {
    const q = { rhythmus: 'quarterly' as const, startMonat: 2 };
    expect([1, 2, 3, 4, 5, 8, 11].map((m) => istAbbuchungsmonat(q, m))).toEqual([false, true, false, false, true, true, true]);
  });
});

describe('Zahlenfeld', () => {
  it('hoechstens 5 Vorkommastellen', () => {
    expect(['1', '2', '3', '4', '5', '6'].reduce((e, t) => tippe(e, t as '1'), '')).toBe('12345');
  });
  it('nur ein Komma, „0" vor Komma bleibt', () => {
    expect(tippe(tippe('0', ','), ',')).toBe('0,');
    expect(tippe('0,', '0')).toBe('0,0');
  });
  it('„00" wird nicht', () => expect(tippe('0', '0')).toBe('0'));
  it('Backspace loescht das letzte Zeichen', () => expect(loesche('12,5')).toBe('12,'));
  it('zuCent', () => {
    expect(zuCent('')).toBe(0);
    expect(zuCent('0,')).toBe(0);
    expect(zuCent('12,5')).toBe(1_250);
    expect(zuCent('12,05')).toBe(1_205);
  });
  it('Schnellbetraege', () => {
    expect(addiere('', 500)).toBe('5');
    expect(addiere('12', 1_000)).toBe('22');
    expect(addiere('12,50', 2_000)).toBe('32,50');
    expect(addiere('12,', 500)).toBe('17,');
    expect(addiere('99999', 500)).toBe('99999');
  });
  it('Vorbelegen beim Bearbeiten', () => {
    expect(ausBetrag(1_200)).toBe('12');
    expect(ausBetrag(1_250)).toBe('12,5');
    expect(ausBetrag(1_205)).toBe('12,05');
  });
  it('Hardware-Keyboard', () => {
    expect(tasteVonKey('7')).toBe('7');
    expect(tasteVonKey('.')).toBe(',');
    expect(tasteVonKey('a')).toBeNull();
  });
});

describe('Geld', () => {
  it('Formate', () => {
    expect(euro(2_043)).toBe('20,43 €');
    expect(euro(-2_000)).toBe('-20 €');
    expect(euro(700, { mitPlus: true })).toBe('+7 €');
    expect(euro2(62_000)).toBe('620,00 €');
    expect(euro(123_456_78)).toBe('123.456,78 €');
  });
  it('Teile fuer die Schriftmischung', () => {
    expect(teile(7_643)).toEqual({ vorzeichen: '', ganz: '76', nachkomma: '43' });
    expect(teile(-1_157)).toEqual({ vorzeichen: '-', ganz: '11', nachkomma: '57' });
  });
  it('parseEuro', () => {
    expect(parseEuro('34,99')).toBe(3_499);
    expect(parseEuro('34.99')).toBe(3_499);
    expect(parseEuro('1.234,5')).toBe(123_450);
    expect(parseEuro('620')).toBe(62_000);
    expect(parseEuro('')).toBeNull();
    expect(parseEuro('12,345')).toBeNull();
    expect(parseEuro('abc')).toBeNull();
  });
  it('istTag', () => {
    expect(istTag('2026-02-29')).toBe(false);
    expect(istTag('2028-02-29')).toBe(true);
    expect(istTag('2026-13-01')).toBe(false);
  });
});
