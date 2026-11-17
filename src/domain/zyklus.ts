import { differenz, monatVerschieben, plusTage, tag, tageImMonat, zerlege, type Tag } from './datum';

/**
 * Ein Budgetzyklus laeuft vom Zahltag bis zum Tag vor dem naechsten Zahltag.
 * Gibt es den Zahltag in einem Monat nicht (31 im April), gilt der letzte
 * Tag dieses Monats.
 */
export interface Zyklus {
  start: Tag;
  ende: Tag;
  tage: number;
}

export function zahltagIm(jahr: number, monat: number, zahltag: number): number {
  return Math.min(zahltag, tageImMonat(jahr, monat));
}

function startImMonat(jahr: number, monat: number, zahltag: number): Tag {
  return tag(jahr, monat, zahltagIm(jahr, monat, zahltag));
}

/** Der Zyklus, in dem der Tag `t` liegt. */
export function zyklusVon(t: Tag, zahltag: number): Zyklus {
  const { jahr, monat, tag: d } = zerlege(t);
  const s = zahltagIm(jahr, monat, zahltag);
  const startMonat = d >= s ? { jahr, monat } : monatVerschieben(jahr, monat, -1);
  const start = startImMonat(startMonat.jahr, startMonat.monat, zahltag);
  const folge = monatVerschieben(startMonat.jahr, startMonat.monat, 1);
  const ende = plusTage(startImMonat(folge.jahr, folge.monat, zahltag), -1);
  return { start, ende, tage: differenz(ende, start) + 1 };
}

/** 1 am ersten Tag des Zyklus. */
export function tagIndex(t: Tag, z: Zyklus): number {
  return differenz(t, z.start) + 1;
}

export function folgezyklus(z: Zyklus, zahltag: number): Zyklus {
  return zyklusVon(plusTage(z.ende, 1), zahltag);
}

export function vorzyklus(z: Zyklus, zahltag: number): Zyklus {
  return zyklusVon(plusTage(z.start, -1), zahltag);
}
