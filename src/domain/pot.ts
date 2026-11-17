import type { Cent } from './geld';
import { zwischen, type Tag } from './datum';
import { folgezyklus, tagIndex, zyklusVon, type Zyklus } from './zyklus';
import type { Ausgabe, Balken, Budgeteinstellung, Pot } from './typen';

/** Sicherheitsgrenze fuer Schleifen ueber Zyklen bzw. Tage. */
const MAX_ZYKLEN = 600;
const MAX_TAGE = 400;

/**
 * Bis einschliesslich Tag `index` zugeflossener Betrag. Am letzten Tag
 * ergibt das exakt den Monatsbetrag, es gibt also keine Rundungsdrift.
 */
export function zugeflossen(monatlich: Cent, index: number, zyklusTage: number): Cent {
  if (index <= 0) return 0;
  if (index >= zyklusTage) return monatlich;
  return Math.floor((monatlich * index) / zyklusTage);
}

/** Nur zur Anzeige, auf Cent gerundet. */
export function proTag(monatlich: Cent, zyklusTage: number): Cent {
  return Math.round(monatlich / zyklusTage);
}

/** Monatsbetrag, der fuer den Zyklus `z` gilt. */
export function monatsbetrag(pot: Pot, z: Zyklus): Cent {
  let gilt = pot.betraege[0]?.cent ?? 0;
  for (const b of pot.betraege) if (b.ab <= z.ende) gilt = b.cent;
  return gilt;
}

export function aktuellerMonatsbetrag(pot: Pot): Cent {
  return pot.betraege[pot.betraege.length - 1]?.cent ?? 0;
}

export function ausgegeben(ausgaben: readonly Ausgabe[], potId: string, von: Tag, bis: Tag): Cent {
  let summe = 0;
  for (const a of ausgaben) if (a.potId === potId && zwischen(a.datum, von, bis)) summe += a.cent;
  return summe;
}

/**
 * Ergebnis aller abgeschlossenen Zyklen seit Anlage des Pots. Nur im Modus
 * `carry`; im Modus `reset` startet jeder Zyklus bei 0.
 */
export function uebertrag(pot: Pot, ausgaben: readonly Ausgabe[], aktuell: Zyklus, e: Budgeteinstellung): Cent {
  if (e.uebertrag !== 'carry') return 0;
  let summe = 0;
  let z = zyklusVon(pot.erstelltAm, e.zahltag);
  for (let i = 0; i < MAX_ZYKLEN && z.start < aktuell.start; i++) {
    summe += monatsbetrag(pot, z) - ausgegeben(ausgaben, pot.id, z.start, z.ende);
    z = folgezyklus(z, e.zahltag);
  }
  return summe;
}

export interface PotStand {
  zyklus: Zyklus;
  tagIndex: number;
  monatlich: Cent;
  proTag: Cent;
  zugeflossen: Cent;
  ausgegeben: Cent;
  uebertrag: Cent;
  /** uebertrag + zugeflossen − ausgegeben */
  stand: Cent;
}

export function potStand(pot: Pot, ausgaben: readonly Ausgabe[], heute: Tag, e: Budgeteinstellung): PotStand {
  const zyklus = zyklusVon(heute, e.zahltag);
  const index = tagIndex(heute, zyklus);
  const monatlich = monatsbetrag(pot, zyklus);
  const zu = zugeflossen(monatlich, index, zyklus.tage);
  const aus = ausgegeben(ausgaben, pot.id, zyklus.start, heute);
  const ueb = uebertrag(pot, ausgaben, zyklus, e);
  return {
    zyklus,
    tagIndex: index,
    monatlich,
    proTag: proTag(monatlich, zyklus.tage),
    zugeflossen: zu,
    ausgegeben: aus,
    uebertrag: ueb,
    stand: ueb + zu - aus
  };
}

/**
 * Balken einer Pot-Karte bzw. der Hauptkarte. Gesamtbreite = Monatsbudget.
 * Blau = ausgegeben, Hellgrau = noch verfuegbar vom Zugeflossenen, Rest leer.
 * Bei negativem Stand wird der ausgegebene Teil orange, ohne grauen Teil.
 */
export function standBalken(s: { monatlich: Cent; zugeflossen: Cent; ausgegeben: Cent; stand: Cent }): Balken {
  const skala = Math.max(s.monatlich, s.ausgegeben, 1);
  if (s.stand < 0) return { skala, segmente: [{ art: 'minus', cent: s.ausgegeben }] };
  return {
    skala,
    segmente: [
      { art: 'ausgegeben', cent: s.ausgegeben },
      { art: 'rest', cent: Math.max(s.zugeflossen - s.ausgegeben, 0) }
    ]
  };
}

export interface Gesamtstand {
  stand: Cent;
  ausgegeben: Cent;
  zugeflossen: Cent;
  monatlich: Cent;
  proTag: Cent;
}

export function gesamt(staende: readonly PotStand[]): Gesamtstand {
  const g: Gesamtstand = { stand: 0, ausgegeben: 0, zugeflossen: 0, monatlich: 0, proTag: 0 };
  for (const s of staende) {
    g.stand += s.stand;
    g.ausgegeben += s.ausgegeben;
    g.zugeflossen += s.zugeflossen;
    g.monatlich += s.monatlich;
    g.proTag += s.proTag;
  }
  return g;
}

/* ------------------------------------------------------------- Vorschau */

export type Ausgleich =
  | { art: 'plus' }
  | { art: 'ausgleich'; tage: number }
  | { art: 'nicht-mehr' };

export interface Vorschau {
  vorher: Cent;
  nachher: Cent;
  proTag: Cent;
  balken: Balken;
  ausgleich: Ausgleich;
}

/**
 * Live-Vorschau im Ausgaben-Sheet: was eine Ausgabe von `betrag` mit dem Pot
 * macht, und wann ein Vorgriff durch den taeglichen Zufluss ausgeglichen ist.
 */
export function vorschau(
  pot: Pot,
  ausgaben: readonly Ausgabe[],
  heute: Tag,
  e: Budgeteinstellung,
  betrag: Cent
): Vorschau {
  const s = potStand(pot, ausgaben, heute, e);
  const vorher = s.stand;
  const nachher = vorher - betrag;
  return {
    vorher,
    nachher,
    proTag: s.proTag,
    balken: vorschauBalken(s, betrag),
    ausgleich: nachher >= 0 ? { art: 'plus' } : ausgleichNach(pot, s, e, -nachher)
  };
}

function vorschauBalken(s: PotStand, betrag: Cent): Balken {
  const vorher = s.stand;
  const nachher = vorher - betrag;
  const segmente: Balken['segmente'] =
    nachher >= 0
      ? [
          { art: 'ausgegeben', cent: s.ausgegeben },
          { art: 'rest', cent: nachher },
          { art: 'diese', cent: betrag }
        ]
      : [
          // Ist der Pot schon vorher im Minus, waere "ausgegeben" groesser als
          // der Zufluss und das Defizit wuerde doppelt gezeigt. Deshalb wird
          // Blau auf den Zufluss begrenzt; die Summe bleibt ausgegeben + betrag.
          { art: 'ausgegeben', cent: Math.max(Math.min(s.ausgegeben, vorher + s.ausgegeben), 0) },
          { art: 'rest', cent: Math.max(vorher, 0) },
          { art: 'vorgriff', cent: -nachher }
        ];
  const summe = segmente.reduce((n, x) => n + x.cent, 0);
  return { segmente, skala: Math.max(s.monatlich, summe, 1) };
}

/**
 * Kleinste Zahl n ≥ 1 an Tagen, nach denen der Zufluss das Defizit deckt.
 * Im Modus `reset` endet die Suche am Zyklusende, im Modus `carry` laeuft
 * sie in die naechsten Zyklen weiter.
 */
function ausgleichNach(pot: Pot, s: PotStand, e: Budgeteinstellung, defizit: Cent): Ausgleich {
  let z = s.zyklus;
  let index = s.tagIndex;
  let monatlich = s.monatlich;
  let kumuliert = 0;
  for (let n = 1; n <= MAX_TAGE; n++) {
    index++;
    if (index > z.tage) {
      if (e.uebertrag === 'reset') return { art: 'nicht-mehr' };
      z = folgezyklus(z, e.zahltag);
      monatlich = monatsbetrag(pot, z);
      index = 1;
    }
    kumuliert += zugeflossen(monatlich, index, z.tage) - zugeflossen(monatlich, index - 1, z.tage);
    if (kumuliert >= defizit) return { art: 'ausgleich', tage: n };
  }
  return { art: 'nicht-mehr' };
}
