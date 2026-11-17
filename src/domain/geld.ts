/**
 * Geld ist immer ein ganzzahliger Cent-Betrag. Formatiert wird ohne
 * Fliesskomma: Euro- und Cent-Anteil werden getrennt aus der Ganzzahl
 * gewonnen, nur die Tausendergruppierung kommt aus Intl.NumberFormat('de-DE').
 */
export type Cent = number;

const GRUPPIERT = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0, useGrouping: true });

export function istCent(wert: unknown): wert is Cent {
  return typeof wert === 'number' && Number.isSafeInteger(wert);
}

export interface Betragsteile {
  vorzeichen: '' | '-' | '+';
  ganz: string;
  /** Zwei Ziffern oder null, wenn der Betrag glatt ist und nicht erzwungen. */
  nachkomma: string | null;
}

export interface FormatOptionen {
  /** Immer zwei Nachkommastellen, auch bei glatten Betraegen ("620,00"). */
  immerNachkomma?: boolean;
  /** Plus-Zeichen bei positiven Betraegen ("+7 €"). */
  mitPlus?: boolean;
}

export function teile(cent: Cent, optionen: FormatOptionen = {}): Betragsteile {
  const betrag = Math.abs(cent);
  const ganz = Math.trunc(betrag / 100);
  const rest = betrag % 100;
  const vorzeichen = cent < 0 ? '-' : optionen.mitPlus && cent > 0 ? '+' : '';
  const nachkomma = rest !== 0 || optionen.immerNachkomma ? String(rest).padStart(2, '0') : null;
  return { vorzeichen, ganz: GRUPPIERT.format(ganz), nachkomma };
}

/** "20,43 €", glatte Betraege ohne Nachkomma: "20 €", negativ "-20 €". */
export function euro(cent: Cent, optionen: FormatOptionen = {}): string {
  const t = teile(cent, optionen);
  return `${t.vorzeichen}${t.ganz}${t.nachkomma === null ? '' : ',' + t.nachkomma} €`;
}

/** Immer mit zwei Nachkommastellen: "620,00 €". */
export function euro2(cent: Cent): string {
  return euro(cent, { immerNachkomma: true });
}

/** Auf ganze Euro gerundet, mit Tausenderpunkt: "10.154 €". */
export function euroGerundet(cent: Cent): string {
  return euro(Math.round(cent / 100) * 100);
}

/** Liest "34,99", "34.99", "34" oder "1.234,5" und liefert Cent oder null. */
export function parseEuro(text: string): Cent | null {
  const roh = text.trim().replace(/\s|€/g, '');
  if (!roh) return null;
  // Komma ist Dezimaltrenner; steht keins drin, darf ein einzelner Punkt
  // mit hoechstens zwei Ziffern dahinter als Dezimaltrenner gelten.
  let normal: string;
  if (roh.includes(',')) normal = roh.replace(/\./g, '').replace(',', '.');
  else if (/^\d+\.\d{1,2}$/.test(roh)) normal = roh;
  else normal = roh.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normal)) return null;
  const [ganz = '0', bruch = ''] = normal.split('.');
  return Number(ganz) * 100 + Number(bruch.padEnd(2, '0'));
}
