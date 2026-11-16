/* Steuerung statt Rückblick: Tagesbudget, Runway, Burn-Down, Töpfe.
 *
 * Grundgedanke (Puffer zuerst): Sparrate und Notgroschen werden vom Einkommen
 * abgezogen, BEVOR irgendetwas als verfügbar gilt. Was dann bleibt, verteilt
 * sich auf die Resttage. Fixkosten zählen nicht ins Tagesbudget - sie sind
 * bereits abgebucht und nicht steuerbar.
 *
 * Alles in Cent.
 */

import { zuCent, monatVon, tageInMonat, tagVon, isoDatum } from './kern.js';
import { ausgabenImMonat, einnahmenImMonat } from './auswertung.js';

const cent = (satz) => zuCent(satz.betrag);
const summe = (liste) => liste.reduce((s, x) => s + cent(x), 0);

function cfg(daten, schluessel) {
  const c = (daten.config || {})[schluessel];
  return zuCent(Number(c) || 0);
}

/**
 * Kernrechnung für einen Monat. `heuteDatum` wird übergeben statt intern
 * ermittelt, damit die Funktion testbar bleibt.
 */
export function budget(daten, monat, heuteDatum) {
  const istAktuell = monat === monatVon(heuteDatum);
  const tage = tageInMonat(monat);
  const tagHeute = istAktuell ? Math.min(tagVon(heuteDatum), tage) : tage;
  const restTage = Math.max(tage - tagHeute + 1, 1);   // heute zählt mit

  const ausgaben = ausgabenImMonat(daten, monat);
  const fixPosten = ausgaben.filter((a) => Number(a.notwendigkeit) === 0);
  const varPosten = ausgaben.filter((a) => Number(a.notwendigkeit) >= 1);

  // Tatsächlich gebuchte Einnahmen haben Vorrang vor dem geplanten Wert:
  // ein Bonus oder ein Monat mit weniger Gehalt soll sofort durchschlagen.
  const gebucht = summe(einnahmenImMonat(daten, monat));
  const einkommen = gebucht || cfg(daten, 'einkommen');

  const fix = summe(fixPosten);
  const sparrate = cfg(daten, 'sparrate');
  const notgroschen = cfg(daten, 'notgroschen');
  const puffer = sparrate + notgroschen;

  const monatsbudget = einkommen - fix - puffer;
  const ausgegeben = summe(varPosten);
  const rest = monatsbudget - ausgegeben;

  const heuteAusgegeben = istAktuell
    ? summe(varPosten.filter((a) => a.datum === heuteDatum))
    : 0;

  // Das Tagesbudget steht fuer den laufenden Tag fest: es wird aus dem Stand
  // VOR der ersten heutigen Buchung gerechnet. Sonst wuerde eine Ausgabe von
  // 25 EUR die Anzeige um mehr als 25 EUR senken, weil sie zugleich das
  // kuenftige Tagesbudget mindert - verwirrend und demotivierend.
  // Neu verteilt wird erst am naechsten Tag.
  const restVorHeute = monatsbudget - (ausgegeben - heuteAusgegeben);
  const tagesbudget = Math.floor(restVorHeute / restTage);
  const heuteNochFrei = tagesbudget - heuteAusgegeben;

  // Soll-Stand am Ende des heutigen Tages, linear über den Monat verteilt.
  const sollRest = Math.round(monatsbudget * (tage - tagHeute) / tage);
  const abweichung = rest - sollRest;          // positiv = besser als Plan

  // Prognose aus dem bisherigen Tempo.
  const tempo = tagHeute > 0 ? ausgegeben / tagHeute : 0;
  let nullTag = null;
  if (istAktuell && tempo > 0 && rest > 0) {
    const nochTage = Math.floor(rest / tempo);
    if (tagHeute + nochTage < tage) nullTag = tagHeute + nochTage + 1;
  }
  const reichtDurch = istAktuell && (rest > 0) && nullTag === null;

  let ampel;
  if (monatsbudget <= 0) ampel = 'grau';
  else if (rest <= 0 || nullTag !== null) ampel = 'rot';
  else if (abweichung < 0 || heuteNochFrei < 0) ampel = 'gelb';
  else ampel = 'gruen';

  return {
    monat, istAktuell, tage, tagHeute, restTage,
    einkommen, einkommenGeplant: cfg(daten, 'einkommen'), einkommenGebucht: gebucht,
    fix, sparrate, notgroschen, puffer,
    monatsbudget, ausgegeben, rest, restVorHeute,
    tagesbudget, heuteAusgegeben, heuteNochFrei,
    sollRest, abweichung,
    tempo: Math.round(tempo), nullTag, reichtDurch,
    ampel,
    eingerichtet: einkommen > 0,
    anzahlVariabel: varPosten.length
  };
}

/** Soll- und Ist-Linie je Tag. Ist bleibt für künftige Tage null. */
export function burndown(daten, monat, heuteDatum) {
  const b = budget(daten, monat, heuteDatum);
  const proTag = new Array(b.tage + 1).fill(0);

  for (const a of ausgabenImMonat(daten, monat)) {
    if (Number(a.notwendigkeit) < 1) continue;
    const t = Math.min(Math.max(tagVon(a.datum), 1), b.tage);
    proTag[t] += cent(a);
  }

  const reihen = [];
  let kumuliert = 0;
  for (let t = 0; t <= b.tage; t++) {
    if (t > 0) kumuliert += proTag[t];
    const sichtbar = !b.istAktuell || t <= b.tagHeute;
    reihen.push({
      tag: t,
      soll: Math.round(b.monatsbudget * (b.tage - t) / b.tage),
      ist: sichtbar ? b.monatsbudget - kumuliert : null,
      ausgegebenAmTag: t > 0 ? proTag[t] : 0
    });
  }
  return { reihen, budget: b };
}

/* ------------------------------------------------------------------ Töpfe */

export function topfDefinition(daten) {
  const roh = (daten.config || {}).toepfe;
  if (!roh) return [];
  try {
    const liste = typeof roh === 'string' ? JSON.parse(roh) : roh;
    return Array.isArray(liste) ? liste.filter((t) => t && t.name) : [];
  } catch (err) { return []; }
}

/**
 * Umschlagprinzip: jede Kategorie gehört zu höchstens einem Topf. Was keinem
 * Topf zugeordnet ist, landet sichtbar in "Nicht zugeordnet" - sonst würde
 * genau dort das Geld versickern, das die Töpfe einsparen sollen.
 */
export function toepfe(daten, monat) {
  const definition = topfDefinition(daten);
  const ausgaben = ausgabenImMonat(daten, monat).filter((a) => Number(a.notwendigkeit) >= 1);

  const zuordnung = new Map();
  definition.forEach((t, i) => (t.kategorien || []).forEach((k) => {
    if (!zuordnung.has(k)) zuordnung.set(k, i);
  }));

  const ergebnis = definition.map((t) => ({
    name: t.name,
    limit: zuCent(Number(t.betrag) || 0),
    kategorien: t.kategorien || [],
    ausgegeben: 0,
    anzahl: 0
  }));
  const frei = { name: 'Nicht zugeordnet', limit: null, kategorien: [], ausgegeben: 0, anzahl: 0 };

  for (const a of ausgaben) {
    const index = zuordnung.get(a.kategorie);
    const ziel = index === undefined ? frei : ergebnis[index];
    ziel.ausgegeben += cent(a);
    ziel.anzahl += 1;
  }

  for (const t of ergebnis) {
    t.rest = t.limit - t.ausgegeben;
    t.anteil = t.limit > 0 ? t.ausgegeben / t.limit : 0;
  }
  if (frei.ausgegeben > 0 || !ergebnis.length) ergebnis.push(frei);
  return ergebnis;
}

/** Kategorien, die noch keinem Topf gehören - für die Einrichtung. */
export function freieKategorien(daten, alleKategorien) {
  const belegt = new Set();
  for (const t of topfDefinition(daten)) (t.kategorien || []).forEach((k) => belegt.add(k));
  return alleKategorien.filter((k) => !belegt.has(k));
}

export function heuteIso() { return isoDatum(new Date()); }
