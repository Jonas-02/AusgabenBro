/* Auswertung: die Kennzahlen, die das Cockpit und die Liste brauchen.
   Alles in Cent, damit nichts durch Fliesskomma wegrundet. */

import {
  zuCent, monatVon, letzteMonate, istMonat, istFix, STANDARD_BASELINE
} from './kern.js';

const cent = (satz) => zuCent(satz.betrag);

export function ausgabenImMonat(daten, monat) {
  return (daten.ausgaben || []).filter((a) => monatVon(a.datum) === monat);
}

export function einnahmenImMonat(daten, monat) {
  return (daten.einnahmen || []).filter((e) => monatVon(e.datum) === monat);
}

/* -------------------------------------------------------- Monatsauswertung */

export function monatsAuswertung(daten, monat) {
  const ausgaben  = ausgabenImMonat(daten, monat);
  const einnahmen = einnahmenImMonat(daten, monat);

  const katMap = new Map();
  let gesamt = 0;
  let fix = 0;

  for (const a of ausgaben) {
    const c = cent(a);
    gesamt += c;
    if (istFix(a.notwendigkeit)) fix += c;

    const kat = a.kategorie || 'Ohne Kategorie';
    const k = katMap.get(kat) || { name: kat, cent: 0, fix: 0, anzahl: 0 };
    k.cent += c;
    k.anzahl += 1;
    if (istFix(a.notwendigkeit)) k.fix += c;
    katMap.set(kat, k);
  }

  const einkommen = einnahmen.reduce((s, e) => s + cent(e), 0);

  return {
    monat, ausgaben, einnahmen,
    gesamt, fix, variabel: gesamt - fix, einkommen,
    kategorien: Array.from(katMap.values()).sort((a, b) => b.cent - a.cent),
    saldo: einkommen - gesamt,
    leer: ausgaben.length === 0 && einnahmen.length === 0
  };
}

/* ------------------------------------------------------------- Startmonat */

/**
 * Startmonat der Historie. Vorrang hat der in der Tabelle hinterlegte Wert,
 * dann der feste Standard. Nur wenn beides fehlt, wird der erste Monat mit
 * Daten genommen - sonst wuerde ein Probemonat die Kurve verzerren.
 */
export function baselineMonat(daten) {
  const konfiguriert = daten.config && daten.config.baseline;
  if (istMonat(konfiguriert)) return String(konfiguriert);
  if (istMonat(STANDARD_BASELINE)) return STANDARD_BASELINE;
  return erstesDatenMonat(daten);
}

function erstesDatenMonat(daten) {
  let fruehester = null;
  for (const a of daten.ausgaben || []) {
    const m = monatVon(a.datum);
    if (m && (!fruehester || m < fruehester)) fruehester = m;
  }
  for (const e of daten.einnahmen || []) {
    const m = monatVon(e.datum);
    if (m && (!fruehester || m < fruehester)) fruehester = m;
  }
  return fruehester;
}

/** Gibt es Buchungen vor dem Startmonat? Dann weist die App darauf hin. */
export function datenVorBaseline(daten) {
  const basis = baselineMonat(daten);
  if (!basis) return 0;
  return (daten.ausgaben || []).filter((a) => monatVon(a.datum) < basis).length
       + (daten.einnahmen || []).filter((e) => monatVon(e.datum) < basis).length;
}

export function erfassteMonate(daten) {
  const menge = new Set();
  for (const a of daten.ausgaben || [])  { const m = monatVon(a.datum); if (m) menge.add(m); }
  for (const e of daten.einnahmen || []) { const m = monatVon(e.datum); if (m) menge.add(m); }
  return Array.from(menge).sort();
}

/* ---------------------------------------------------------------- Verlauf */

/** Ausgaben je Monat, aufgeteilt in fix und variabel. */
export function verlauf(daten, bisMonat, anzahl = 6) {
  const basis = baselineMonat(daten);
  return letzteMonate(bisMonat, anzahl)
    .filter((m) => !basis || m >= basis)
    .map((m) => {
      let gesamt = 0, fix = 0;
      for (const e of ausgabenImMonat(daten, m)) {
        const c = cent(e);
        gesamt += c;
        if (istFix(e.notwendigkeit)) fix += c;
      }
      return { monat: m, gesamt, fix, variabel: gesamt - fix };
    });
}
