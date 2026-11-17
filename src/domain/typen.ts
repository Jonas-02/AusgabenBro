import type { Cent } from './geld';
import type { Tag } from './datum';

export type Uebertrag = 'reset' | 'carry';

/** Monatsbetrag gilt fuer den ganzen Zyklus, in dem `ab` liegt, und danach. */
export interface Betragsstand {
  ab: Tag;
  cent: Cent;
}

export interface Pot {
  id: string;
  name: string;
  symbol: string;
  betraege: Betragsstand[];
  erstelltAm: Tag;
}

export interface Ausgabe {
  id: string;
  potId: string;
  cent: Cent;
  datum: Tag;
  /** ISO-Zeitstempel der Erfassung, fuer stabile Sortierung am selben Tag. */
  erfasstUm: string;
}

export interface Budgeteinstellung {
  zahltag: number;
  uebertrag: Uebertrag;
}

export type Rhythmus = 'monthly' | 'quarterly' | 'yearly';

export interface Fixkosten {
  id: string;
  name: string;
  cent: Cent;
  kategorieId: string;
  rhythmus: Rhythmus;
  /** Abbuchungstag 1-31, wird auf das Monatsende begrenzt. */
  tag: number;
  /** Erster Abbuchungsmonat 1-12, nur fuer quarterly und yearly relevant. */
  startMonat: number;
}

export interface Kategorie {
  id: string;
  name: string;
  symbol: string;
}

export type SegmentArt = 'ausgegeben' | 'rest' | 'diese' | 'vorgriff' | 'minus';

export interface Segment {
  art: SegmentArt;
  cent: Cent;
}

export interface Balken {
  segmente: Segment[];
  /** Betrag, der 100 % Breite entspricht. */
  skala: Cent;
}
