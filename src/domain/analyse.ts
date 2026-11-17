import type { Cent } from './geld';
import { monatVerschieben, plusTage, tag as tagAus, zerlege, zwischen, type Tag } from './datum';
import { abbuchungstag, istAbbuchungsmonat, uebersicht } from './fixkosten';
import { aktuellerMonatsbetrag, monatsbetrag, potStand, zugeflossen } from './pot';
import type { Ausgabe, Budgeteinstellung, Fixkosten, Pot } from './typen';
import { folgezyklus, tagIndex, zyklusVon, type Zyklus } from './zyklus';

/** Ab diesem Zyklustag wird hochgerechnet; davor ist ein einzelner Einkauf zu laut. */
export const PROGNOSE_AB_TAG = 3;
const MAX_ZYKLEN = 600;

/* --------------------------------------------------------- Monatsverlauf */

export interface Tagespunkt {
  tag: Tag;
  /** 1-basiert, wie tagIndex */
  index: number;
  /** An diesem Tag ausgegeben (0 fuer kommende Tage). */
  ausgegeben: Cent;
  /** Seit Zyklusbeginn ausgegeben, bis einschliesslich dieses Tages. */
  kumuliert: Cent;
  /** Bis zu diesem Tag zugeflossen, plus Uebertrag. */
  budget: Cent;
  vergangen: boolean;
}

export interface Monatsverlauf {
  zyklus: Zyklus;
  tagIndex: number;
  /** Monatsbudget aller Pots plus Uebertrag. */
  budget: Cent;
  /** Summe der Tagesbetraege aller Pots. */
  proTag: Cent;
  ausgegeben: Cent;
  tage: Tagespunkt[];
  /** Lineare Hochrechnung der Ausgaben bis Zyklusende, ab PROGNOSE_AB_TAG. */
  prognose: { ausgaben: Cent; differenz: Cent } | null;
  /** Was ab heute (einschliesslich) pro Tag noch geht, damit das Budget reicht. */
  spielraum: { gesamt: Cent; tage: number; proTag: Cent };
}

function potIds(pots: readonly Pot[]): Set<string> {
  return new Set(pots.map((p) => p.id));
}

export function monatsverlauf(pots: readonly Pot[], ausgaben: readonly Ausgabe[], heute: Tag, e: Budgeteinstellung): Monatsverlauf {
  const z = zyklusVon(heute, e.zahltag);
  const idx = tagIndex(heute, z);
  const ids = potIds(pots);
  const staende = pots.map((p) => potStand(p, ausgaben, heute, e));
  const uebertragSumme = staende.reduce((n, s) => n + s.uebertrag, 0);
  const monatlich = pots.map((p) => monatsbetrag(p, z));
  const budget = monatlich.reduce((n, m) => n + m, 0) + uebertragSumme;
  const proTag = staende.reduce((n, s) => n + s.proTag, 0);

  const proDatum = new Map<Tag, Cent>();
  for (const a of ausgaben) {
    if (ids.has(a.potId) && zwischen(a.datum, z.start, heute)) proDatum.set(a.datum, (proDatum.get(a.datum) ?? 0) + a.cent);
  }

  const tage: Tagespunkt[] = [];
  let kumuliert = 0;
  for (let i = 1; i <= z.tage; i++) {
    const t = plusTage(z.start, i - 1);
    const vergangen = i <= idx;
    const amTag = vergangen ? (proDatum.get(t) ?? 0) : 0;
    kumuliert += amTag;
    const zu = monatlich.reduce((n, m) => n + zugeflossen(m, i, z.tage), 0);
    tage.push({ tag: t, index: i, ausgegeben: amTag, kumuliert, budget: uebertragSumme + zu, vergangen });
  }

  const ausgegebenSumme = staende.reduce((n, s) => n + s.ausgegeben, 0);
  const prognose =
    idx >= PROGNOSE_AB_TAG
      ? (() => {
          const hoch = Math.round((ausgegebenSumme * z.tage) / idx);
          return { ausgaben: hoch, differenz: budget - hoch };
        })()
      : null;

  const restTage = z.tage - idx + 1;
  const gesamt = budget - ausgegebenSumme;
  return {
    zyklus: z,
    tagIndex: idx,
    budget,
    proTag,
    ausgegeben: ausgegebenSumme,
    tage,
    prognose,
    spielraum: { gesamt, tage: restTage, proTag: gesamt > 0 ? Math.floor(gesamt / restTage) : 0 }
  };
}

/* ----------------------------------------------------------- Verteilung */

export interface PotAnteil {
  potId: string;
  name: string;
  symbol: string;
  ausgegeben: Cent;
  /** 0..1 der Ausgaben im Zyklus */
  anteil: number;
}

/** Ausgaben im laufenden Zyklus je Pot, groesste zuerst. */
export function potVerteilung(pots: readonly Pot[], ausgaben: readonly Ausgabe[], heute: Tag, e: Budgeteinstellung): PotAnteil[] {
  const z = zyklusVon(heute, e.zahltag);
  const roh = pots.map((p, i) => {
    let summe = 0;
    for (const a of ausgaben) if (a.potId === p.id && zwischen(a.datum, z.start, heute)) summe += a.cent;
    return { p, i, summe };
  });
  const gesamt = roh.reduce((n, r) => n + r.summe, 0);
  return roh
    .sort((a, b) => b.summe - a.summe || a.i - b.i)
    .map(({ p, summe }) => ({ potId: p.id, name: p.name, symbol: p.symbol, ausgegeben: summe, anteil: gesamt > 0 ? summe / gesamt : 0 }));
}

/* ------------------------------------------------------ Zyklusvergleich */

export interface Zyklusergebnis {
  zyklus: Zyklus;
  ausgegeben: Cent;
  budget: Cent;
  laufend: boolean;
}

/** Die letzten `anzahl` Zyklen seit dem ersten Pot bzw. der ersten Ausgabe. */
export function zyklenVergleich(
  pots: readonly Pot[],
  ausgaben: readonly Ausgabe[],
  heute: Tag,
  e: Budgeteinstellung,
  anzahl = 6
): Zyklusergebnis[] {
  if (pots.length === 0) return [];
  const ids = potIds(pots);
  const erster = [...pots.map((p) => p.erstelltAm), ...ausgaben.filter((a) => ids.has(a.potId)).map((a) => a.datum)].reduce((m, t) =>
    t < m ? t : m
  );
  const aktuell = zyklusVon(heute, e.zahltag);
  const liste: Zyklusergebnis[] = [];
  let z = zyklusVon(erster < heute ? erster : heute, e.zahltag);
  for (let i = 0; i < MAX_ZYKLEN && z.start <= aktuell.start; i++) {
    const bis = z.ende < heute ? z.ende : heute;
    let summe = 0;
    for (const a of ausgaben) if (ids.has(a.potId) && zwischen(a.datum, z.start, bis)) summe += a.cent;
    const budget = pots.filter((p) => p.erstelltAm <= z.ende).reduce((n, p) => n + monatsbetrag(p, z), 0);
    liste.push({ zyklus: z, ausgegeben: summe, budget, laufend: z.start === aktuell.start });
    z = folgezyklus(z, e.zahltag);
  }
  return liste.slice(-anzahl);
}

/* ------------------------------------------------------------ Wochentage */

export const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
export const WOCHENTAGE_LANG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const;

/** 0 = Montag … 6 = Sonntag */
export function wochentag(t: Tag): number {
  const { jahr, monat, tag } = zerlege(t);
  return (new Date(Date.UTC(jahr, monat - 1, tag)).getUTCDay() + 6) % 7;
}

export interface Wochentagswert {
  wochentag: number;
  summe: Cent;
  /** Wie oft dieser Wochentag im Zeitraum vorkam */
  tage: number;
  /** Durchschnitt pro Vorkommen, null wenn er noch nie vorkam */
  schnitt: Cent | null;
}

/** Durchschnittliche Ausgaben je Wochentag, vom ersten Pot bzw. der ersten Ausgabe bis heute. */
export function wochentage(pots: readonly Pot[], ausgaben: readonly Ausgabe[], heute: Tag): { werte: Wochentagswert[]; tage: number } {
  const ids = potIds(pots);
  const relevant = ausgaben.filter((a) => ids.has(a.potId) && a.datum <= heute);
  const kandidaten = [...pots.map((p) => p.erstelltAm), ...relevant.map((a) => a.datum)];
  const werte: Wochentagswert[] = WOCHENTAGE.map((_, i) => ({ wochentag: i, summe: 0, tage: 0, schnitt: null }));
  if (kandidaten.length === 0) return { werte, tage: 0 };
  const von = kandidaten.reduce((m, t) => (t < m ? t : m));
  let anzahlTage = 0;
  for (let t = von; t <= heute; t = plusTage(t, 1)) {
    (werte[wochentag(t)] as Wochentagswert).tage++;
    anzahlTage++;
  }
  for (const a of relevant) if (a.datum >= von) (werte[wochentag(a.datum)] as Wochentagswert).summe += a.cent;
  for (const w of werte) w.schnitt = w.tage > 0 ? Math.round(w.summe / w.tage) : null;
  return { werte, tage: anzahlTage };
}

/* ------------------------------------------------------------ Kennzahlen */

export interface Kennzahlen {
  anzahl: number;
  schnittProAusgabe: Cent | null;
  schnittProTag: Cent;
  groesste: Ausgabe | null;
  /** Abgeschlossene Tage (vor heute) ohne Ausgabe */
  tageOhne: number;
  abgeschlosseneTage: number;
  /** Tage bis einschliesslich heute mit mehr Ausgaben als dem Tagesbetrag */
  tageDrueber: number;
}

export function kennzahlen(v: Monatsverlauf, pots: readonly Pot[], ausgaben: readonly Ausgabe[], heute: Tag): Kennzahlen {
  const ids = potIds(pots);
  const imZyklus = ausgaben.filter((a) => ids.has(a.potId) && zwischen(a.datum, v.zyklus.start, heute));
  const groesste = imZyklus.reduce<Ausgabe | null>((g, a) => (!g || a.cent > g.cent ? a : g), null);
  const abgeschlossen = v.tage.filter((t) => t.index < v.tagIndex);
  return {
    anzahl: imZyklus.length,
    schnittProAusgabe: imZyklus.length > 0 ? Math.round(v.ausgegeben / imZyklus.length) : null,
    schnittProTag: Math.round(v.ausgegeben / v.tagIndex),
    groesste,
    tageOhne: abgeschlossen.filter((t) => t.ausgegeben === 0).length,
    abgeschlosseneTage: abgeschlossen.length,
    tageDrueber: v.tage.filter((t) => t.vergangen && t.ausgegeben > v.proTag).length
  };
}

/* ------------------------------------------------------------- Fixkosten */

/** Naechste Abbuchung ab heute (einschliesslich). */
export function naechsteAbbuchung(fk: Fixkosten, heute: Tag): Tag {
  const { jahr, monat } = zerlege(heute);
  for (let k = 0; k <= 12; k++) {
    const m = monatVerschieben(jahr, monat, k);
    if (!istAbbuchungsmonat(fk, m.monat)) continue;
    const d = tagAus(m.jahr, m.monat, abbuchungstag(fk, m.jahr, m.monat));
    if (d >= heute) return d;
  }
  // Unerreichbar: jeder Rhythmus bucht innerhalb von 12 Monaten ab.
  return heute;
}

export interface Abbuchung {
  fixkosten: Fixkosten;
  datum: Tag;
}

/** Abbuchungen in den naechsten `tage` Tagen (heute eingeschlossen), nach Datum. */
export function anstehend(liste: readonly Fixkosten[], heute: Tag, tage = 30): Abbuchung[] {
  const bis = plusTage(heute, tage - 1);
  return liste
    .map((fk) => ({ fixkosten: fk, datum: naechsteAbbuchung(fk, heute) }))
    .filter((a) => a.datum <= bis)
    .sort((a, b) => (a.datum === b.datum ? a.fixkosten.name.localeCompare(b.fixkosten.name, 'de') : a.datum < b.datum ? -1 : 1));
}

/** Was ein Monat insgesamt kostet: Budget der Pots plus Fixkosten. */
export function monatskosten(pots: readonly Pot[], fixkosten: readonly Fixkosten[]): { budget: Cent; fixkosten: Cent; gesamt: Cent } {
  const budget = pots.reduce((n, p) => n + aktuellerMonatsbetrag(p), 0);
  const fix = uebersicht(fixkosten).proMonat;
  return { budget, fixkosten: fix, gesamt: budget + fix };
}
