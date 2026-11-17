import { describe, expect, it } from 'vitest';
import { leseExport, migriere, pruefe, SCHEMA_VERSION } from './schema';
import { leereDaten } from './startwerte';

const gueltig = () => ({
  ...leereDaten(),
  onboardingFertig: true,
  name: 'Jonas',
  pots: [{ id: 'p1', name: 'Einkauf', symbol: 'einkauf', betraege: [{ ab: '2026-11-01', cent: 21_000 }], erstelltAm: '2026-11-01' }],
  ausgaben: [{ id: 'a1', potId: 'p1', cent: 1_200, datum: '2026-11-17', erfasstUm: '2026-11-17T10:00:00Z' }],
  letzterPot: 'p1'
});

describe('Schema', () => {
  it('akzeptiert gueltige Daten', () => {
    expect(pruefe(gueltig()).ok).toBe(true);
  });

  it('lehnt Fliesskomma-Betraege ab', () => {
    const d = gueltig();
    d.ausgaben[0]!.cent = 12.5;
    expect(pruefe(d)).toEqual({ ok: false, fehler: 'Eine Ausgabe ist ungültig.' });
  });

  it('lehnt Ausgaben ohne Pot ab', () => {
    const d = gueltig();
    d.ausgaben[0]!.potId = 'weg';
    expect(pruefe(d).ok).toBe(false);
  });

  it('lehnt ungueltige Zahltage ab', () => {
    expect(pruefe({ ...gueltig(), zahltag: 32 }).ok).toBe(false);
  });

  it('setzt einen verwaisten letzten Pot zurueck', () => {
    const r = pruefe({ ...gueltig(), letzterPot: 'gibtsnicht' });
    expect(r.ok && r.daten.letzterPot).toBe(null);
  });

  it('Version 1 bekommt den Tagesspruch eingeschaltet', () => {
    const { tagesspruch: _weg, ...v1 } = gueltig();
    const d = migriere(v1, 1);
    expect(d.tagesspruch).toBe(true);
    expect(d.motto).toBe(v1.motto);
  });

  it('Version 2 behaelt die Wahl', () => {
    expect(migriere({ ...gueltig(), tagesspruch: false }, 2).tagesspruch).toBe(false);
  });

  it('lehnt Daten ohne Tagesspruch-Feld ab', () => {
    const { tagesspruch: _weg, ...ohne } = gueltig();
    expect(pruefe(ohne).ok).toBe(false);
  });

  it('Export und Import ergeben dieselben Daten', () => {
    const datei = { app: 'ausgabenbro', version: SCHEMA_VERSION, exportiertAm: 'x', daten: gueltig() };
    const r = leseExport(JSON.stringify(datei));
    expect(r).toEqual({ ok: true, daten: gueltig() });
  });

  it('erkennt fremde Dateien und kaputtes JSON', () => {
    expect(leseExport('{nein').ok).toBe(false);
    expect(leseExport(JSON.stringify({ app: 'andere', version: 1 })).ok).toBe(false);
  });

  it('verweigert Daten aus einer neueren App-Version', () => {
    expect(() => migriere(gueltig(), SCHEMA_VERSION + 1)).toThrow(/neueren App-Version/);
  });
});
