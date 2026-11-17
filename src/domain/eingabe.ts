import type { Cent } from './geld';

/**
 * Zustandsautomat des eigenen Zahlenfelds. Die Eingabe ist ein String in
 * deutscher Schreibweise ("12,5"), damit Nullen nach dem Komma und ein
 * angefangenes Komma ("12,") sichtbar bleiben.
 */

export const MAX_VORKOMMA = 5;
export const MAX_NACHKOMMA = 2;
export const MAX_CENT: Cent = 9_999_999;

export type Taste = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',';

export function tippe(eingabe: string, taste: Taste): string {
  if (taste === ',') {
    if (eingabe.includes(',')) return eingabe;
    return eingabe === '' ? '0,' : eingabe + ',';
  }
  // Eine fuehrende 0 wird ersetzt, ausser vor dem Komma.
  if (eingabe === '0') return taste;
  const [vor = '', nach] = eingabe.split(',');
  if (nach !== undefined) return nach.length >= MAX_NACHKOMMA ? eingabe : eingabe + taste;
  return vor.length >= MAX_VORKOMMA ? eingabe : eingabe + taste;
}

export function loesche(eingabe: string): string {
  return eingabe.slice(0, -1);
}

export function zuCent(eingabe: string): Cent {
  if (!eingabe) return 0;
  const [vor = '', nach = ''] = eingabe.split(',');
  return Number(vor || '0') * 100 + Number(nach.padEnd(2, '0').slice(0, 2));
}

/**
 * Schnellbetrag addieren. Die Zahl der Nachkommastellen bleibt, wie der
 * Nutzer sie getippt hat: "12,5" + 10 € ergibt "22,5", nicht "22,50".
 */
export function addiere(eingabe: string, cent: Cent): string {
  const summe = zuCent(eingabe) + cent;
  if (summe > MAX_CENT) return eingabe;
  const nach = eingabe.includes(',') ? (eingabe.split(',')[1] ?? '').length : 0;
  return ausCent(summe, nach, eingabe.endsWith(','));
}

export function ausCent(cent: Cent, nachkommastellen: number, kommaBehalten = false): string {
  const ganz = String(Math.trunc(cent / 100));
  if (nachkommastellen === 0) return kommaBehalten ? ganz + ',' : ganz;
  const rest = String(cent % 100).padStart(2, '0').slice(0, nachkommastellen);
  return `${ganz},${rest}`;
}

/** Eingabe zum Bearbeiten einer bestehenden Ausgabe vorbelegen. */
export function ausBetrag(cent: Cent): string {
  if (cent % 100 === 0) return String(cent / 100);
  const rest = cent % 100;
  return ausCent(cent, rest % 10 === 0 ? 1 : 2);
}

/** Zuordnung fuer ein Hardware-Keyboard. */
export function tasteVonKey(key: string): Taste | null {
  if (/^[0-9]$/.test(key)) return key as Taste;
  if (key === ',' || key === '.') return ',';
  return null;
}
