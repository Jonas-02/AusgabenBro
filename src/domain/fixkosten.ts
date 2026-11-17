import { euro2, type Cent } from './geld';
import { monatsname, tageImMonat, zerlege, type Tag } from './datum';
import type { Fixkosten, Rhythmus } from './typen';

/** Fixkosten laufen getrennt vom Budget; nichts hier fliesst in Pots ein. */

export function monatswert(fk: Pick<Fixkosten, 'cent' | 'rhythmus'>): Cent {
  switch (fk.rhythmus) {
    case 'monthly':
      return fk.cent;
    case 'quarterly':
      return Math.round(fk.cent / 3);
    case 'yearly':
      return Math.round(fk.cent / 12);
  }
}

export interface FixkostenUebersicht {
  proMonat: Cent;
  /** Summe × 12, auf ganze Euro gerundet (in Cent). */
  imJahr: Cent;
  anzahl: number;
}

export function uebersicht(liste: readonly Fixkosten[]): FixkostenUebersicht {
  const proMonat = liste.reduce((s, fk) => s + monatswert(fk), 0);
  return { proMonat, imJahr: Math.round((proMonat * 12) / 100) * 100, anzahl: liste.length };
}

/** Abbuchungstag im gegebenen Monat, auf das Monatsende begrenzt. */
export function abbuchungstag(fk: Pick<Fixkosten, 'tag'>, jahr: number, monat: number): number {
  return Math.min(fk.tag, tageImMonat(jahr, monat));
}

export function istAbbuchungsmonat(fk: Pick<Fixkosten, 'rhythmus' | 'startMonat'>, monat: number): boolean {
  switch (fk.rhythmus) {
    case 'monthly':
      return true;
    case 'quarterly':
      return (((monat - fk.startMonat) % 3) + 3) % 3 === 0;
    case 'yearly':
      return monat === fk.startMonat;
  }
}

export type Faelligkeit =
  | { art: 'abgebucht' }
  | { art: 'heute' }
  | { art: 'morgen' }
  | { art: 'in'; tage: number };

/**
 * Stand im aktuellen Kalendermonat. Ein Tag, der vor heute liegt, gilt als
 * abgebucht; der heutige Tag zeigt "heute" (siehe DECISIONS.md).
 */
export function faelligkeit(abbuchung: number, heuteTag: number): Faelligkeit {
  const n = abbuchung - heuteTag;
  if (n < 0) return { art: 'abgebucht' };
  if (n === 0) return { art: 'heute' };
  if (n === 1) return { art: 'morgen' };
  return { art: 'in', tage: n };
}

export function faelligkeitText(f: Faelligkeit): string {
  switch (f.art) {
    case 'abgebucht':
      return 'abgebucht';
    case 'heute':
      return 'heute';
    case 'morgen':
      return 'morgen';
    case 'in':
      return `in ${f.tage} Tagen`;
  }
}

export interface Zeile {
  unterzeile: string;
  /** Blau, wenn die Abbuchung in diesem Monat noch bevorsteht. */
  bevorstehend: boolean;
  /** Zweite Zeile rechts unter dem Monatswert, nur bei Quartal und Jahr. */
  rechtsUnten: string | null;
}

export function zeile(fk: Fixkosten, heute: Tag): Zeile {
  const { jahr, monat, tag } = zerlege(heute);
  const d = abbuchungstag(fk, jahr, monat);
  const imMonat = istAbbuchungsmonat(fk, monat);
  const f = imMonat ? faelligkeit(d, tag) : null;
  const status = f ? ` · ${faelligkeitText(f)}` : '';
  const bevorstehend = f !== null && f.art !== 'abgebucht';

  switch (fk.rhythmus) {
    case 'monthly':
      return { unterzeile: `am ${d}.${status}`, bevorstehend, rechtsUnten: null };
    case 'quarterly':
      return {
        unterzeile: `vierteljährlich am ${imMonat ? d : fk.tag}.${status}`,
        bevorstehend,
        rechtsUnten: `${euro2(fk.cent)} im Quartal`
      };
    case 'yearly':
      return {
        unterzeile: `jährlich am ${imMonat ? d : fk.tag}. ${monatsname(fk.startMonat)}${status}`,
        bevorstehend,
        rechtsUnten: `${euro2(fk.cent)} im Jahr`
      };
  }
}

export const RHYTHMUS_TEXT: Record<Rhythmus, string> = {
  monthly: 'monatlich',
  quarterly: 'vierteljährlich',
  yearly: 'jährlich'
};
