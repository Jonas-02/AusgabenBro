import { describe, expect, it } from 'vitest';
import { bereinige, nachNotiz, vorschlaege } from './notiz';
import type { Ausgabe } from './typen';

let n = 0;
const a = (potId: string, cent: number, notiz?: string, datum = '2026-11-10'): Ausgabe => ({
  id: `a${++n}`,
  potId,
  cent,
  datum,
  erfasstUm: `${datum}T${String(10 + (n % 10)).padStart(2, '0')}:00:00Z`,
  ...(notiz !== undefined ? { notiz } : {})
});

describe('Notiz', () => {
  it('bereinigt Leerzeichen und leere Eingaben', () => {
    expect(bereinige('  Zigaretten   Marlboro ')).toBe('Zigaretten Marlboro');
    expect(bereinige('   ')).toBeUndefined();
    expect(bereinige(undefined)).toBeUndefined();
    expect(bereinige('x'.repeat(80))).toHaveLength(60);
  });

  it('schlaegt bisherige Notizen vor, die des Pots zuerst', () => {
    const liste = [a('drogen', 800, 'Zigaretten'), a('drogen', 800, 'zigaretten'), a('einkauf', 3_000, 'Rewe'), a('einkauf', 900, 'Rewe'), a('einkauf', 500, 'Rewe')];
    expect(vorschlaege(liste, 'drogen')).toEqual(['zigaretten', 'Rewe']);
    expect(vorschlaege(liste, 'einkauf')).toEqual(['Rewe', 'zigaretten']);
  });

  it('gruppiert ohne Rücksicht auf Gross- und Kleinschreibung, haeufigste Schreibweise gewinnt', () => {
    const liste = [
      a('drogen', 800, 'Zigaretten'),
      a('drogen', 850, 'Zigaretten'),
      a('drogen', 800, 'zigaretten '),
      a('einkauf', 3_000, 'Rewe'),
      a('einkauf', 1_000),
      a('einkauf', 9_999, 'Rewe', '2026-10-01') // ausserhalb des Zeitraums
    ];
    const r = nachNotiz(liste, new Set(['drogen', 'einkauf']), '2026-11-01', '2026-11-17');
    expect(r.gesamt).toBe(6_450);
    expect(r.eintraege).toEqual([
      { schluessel: 'rewe', name: 'Rewe', summe: 3_000, anzahl: 1, anteil: 3_000 / 6_450 },
      { schluessel: 'zigaretten', name: 'Zigaretten', summe: 2_450, anzahl: 3, anteil: 2_450 / 6_450 }
    ]);
    expect(r.ohneNotiz).toEqual({ summe: 1_000, anzahl: 1 });
    expect(r.sonstige).toEqual({ summe: 0, anzahl: 0, arten: 0 });
  });

  it('fasst den Rest nach den ersten Eintraegen zusammen und ignoriert geloeschte Pots', () => {
    const liste = [a('p', 500, 'A'), a('p', 400, 'B'), a('p', 300, 'C'), a('p', 200, 'D'), a('weg', 9_000, 'A')];
    const r = nachNotiz(liste, new Set(['p']), '2026-11-01', '2026-11-30', 2);
    expect(r.eintraege.map((e) => e.name)).toEqual(['A', 'B']);
    expect(r.sonstige).toEqual({ summe: 500, anzahl: 2, arten: 2 });
    expect(r.gesamt).toBe(1_400);
  });
});
