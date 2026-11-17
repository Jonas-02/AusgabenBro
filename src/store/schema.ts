import { istCent } from '../domain/geld';
import { istTag } from '../domain/datum';
import type { Ausgabe, Fixkosten, Kategorie, Pot, Rhythmus, Uebertrag } from '../domain/typen';

/**
 * Gespeicherter Zustand. Jede Strukturaenderung erhoeht SCHEMA_VERSION und
 * bekommt einen Schritt in `migriere`.
 */
export const SCHEMA_VERSION = 2;

export interface Daten {
  onboardingFertig: boolean;
  name: string;
  motto: string;
  /** Unter dem Namen: taeglich wechselnder Spruch statt des eigenen Mottos. Seit Version 2. */
  tagesspruch: boolean;
  zahltag: number;
  uebertrag: Uebertrag;
  pots: Pot[];
  ausgaben: Ausgabe[];
  letzterPot: string | null;
  fixkosten: Fixkosten[];
  kategorien: Kategorie[];
}

export interface Exportdatei {
  app: 'ausgabenbro';
  version: number;
  exportiertAm: string;
  daten: Daten;
}

/** Ueberfuehrt aeltere gespeicherte Staende in die aktuelle Struktur. */
export function migriere(gespeichert: unknown, vonVersion: number): Daten {
  let stand = gespeichert as Record<string, unknown>;
  // Version 2: Tagesspruch, fuer bestehende Daten eingeschaltet.
  if (vonVersion < 2 && stand && typeof stand === 'object' && !('tagesspruch' in stand)) stand = { ...stand, tagesspruch: true };
  if (vonVersion > SCHEMA_VERSION) {
    throw new Error(`Daten stammen aus einer neueren App-Version (${vonVersion}).`);
  }
  const geprueft = pruefe(stand);
  if (!geprueft.ok) throw new Error(geprueft.fehler);
  stand = geprueft.daten as unknown as Record<string, unknown>;
  return stand as unknown as Daten;
}

/* --------------------------------------------------------------- Pruefung */

export type Ergebnis = { ok: true; daten: Daten } | { ok: false; fehler: string };

const RHYTHMEN: readonly Rhythmus[] = ['monthly', 'quarterly', 'yearly'];

function istText(x: unknown): x is string {
  return typeof x === 'string';
}

function istGanzzahl(x: unknown, min: number, max: number): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
}

function pruefePot(x: unknown): x is Pot {
  const p = x as Pot;
  return (
    !!p && istText(p.id) && istText(p.name) && istText(p.symbol) && istTag(p.erstelltAm) &&
    Array.isArray(p.betraege) && p.betraege.length > 0 &&
    p.betraege.every((b) => istTag(b?.ab) && istCent(b?.cent) && b.cent >= 0)
  );
}

function pruefeAusgabe(x: unknown): x is Ausgabe {
  const a = x as Ausgabe;
  return !!a && istText(a.id) && istText(a.potId) && istCent(a.cent) && a.cent > 0 && istTag(a.datum) && istText(a.erfasstUm);
}

function pruefeFixkosten(x: unknown): x is Fixkosten {
  const f = x as Fixkosten;
  return (
    !!f && istText(f.id) && istText(f.name) && istCent(f.cent) && f.cent >= 0 && istText(f.kategorieId) &&
    RHYTHMEN.includes(f.rhythmus) && istGanzzahl(f.tag, 1, 31) && istGanzzahl(f.startMonat, 1, 12)
  );
}

function pruefeKategorie(x: unknown): x is Kategorie {
  const k = x as Kategorie;
  return !!k && istText(k.id) && istText(k.name) && istText(k.symbol);
}

export function pruefe(x: unknown): Ergebnis {
  const d = x as Partial<Daten> | null;
  if (!d || typeof d !== 'object') return { ok: false, fehler: 'Keine gültigen Daten.' };
  if (typeof d.onboardingFertig !== 'boolean') return { ok: false, fehler: 'Feld „onboardingFertig" fehlt.' };
  if (!istText(d.name) || !istText(d.motto)) return { ok: false, fehler: 'Name oder Motto fehlen.' };
  if (typeof d.tagesspruch !== 'boolean') return { ok: false, fehler: 'Feld „tagesspruch" fehlt.' };
  if (!istGanzzahl(d.zahltag, 1, 31)) return { ok: false, fehler: 'Zahltag muss zwischen 1 und 31 liegen.' };
  if (d.uebertrag !== 'reset' && d.uebertrag !== 'carry') return { ok: false, fehler: 'Übertrag ist ungültig.' };
  if (!Array.isArray(d.pots) || !d.pots.every(pruefePot)) return { ok: false, fehler: 'Ein Pot ist ungültig.' };
  if (!Array.isArray(d.ausgaben) || !d.ausgaben.every(pruefeAusgabe)) return { ok: false, fehler: 'Eine Ausgabe ist ungültig.' };
  if (!Array.isArray(d.fixkosten) || !d.fixkosten.every(pruefeFixkosten)) return { ok: false, fehler: 'Ein Fixkosten-Posten ist ungültig.' };
  if (!Array.isArray(d.kategorien) || !d.kategorien.every(pruefeKategorie)) return { ok: false, fehler: 'Eine Kategorie ist ungültig.' };
  if (d.letzterPot !== null && !istText(d.letzterPot)) return { ok: false, fehler: '„letzterPot" ist ungültig.' };

  const potIds = new Set(d.pots.map((p) => p.id));
  if (d.ausgaben.some((a) => !potIds.has(a.potId))) return { ok: false, fehler: 'Eine Ausgabe gehört zu keinem Pot.' };
  const katIds = new Set(d.kategorien.map((k) => k.id));
  if (d.fixkosten.some((f) => !katIds.has(f.kategorieId))) return { ok: false, fehler: 'Ein Fixkosten-Posten hat keine Kategorie.' };

  return {
    ok: true,
    daten: {
      onboardingFertig: d.onboardingFertig,
      name: d.name,
      motto: d.motto,
      tagesspruch: d.tagesspruch,
      zahltag: d.zahltag,
      uebertrag: d.uebertrag,
      pots: d.pots,
      ausgaben: d.ausgaben,
      letzterPot: d.letzterPot && potIds.has(d.letzterPot) ? d.letzterPot : null,
      fixkosten: d.fixkosten,
      kategorien: d.kategorien
    }
  };
}

/** Liest eine Exportdatei; akzeptiert auch aeltere Versionen. */
export function leseExport(text: string): Ergebnis {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return { ok: false, fehler: 'Die Datei ist kein gültiges JSON.' };
  }
  const datei = roh as Partial<Exportdatei>;
  if (datei?.app !== 'ausgabenbro' || typeof datei.version !== 'number') {
    return { ok: false, fehler: 'Das ist keine Exportdatei dieser App.' };
  }
  try {
    return { ok: true, daten: migriere(datei.daten, datei.version) };
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Unbekannter Fehler.' };
  }
}
