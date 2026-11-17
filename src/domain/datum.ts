/**
 * Kalendertage in lokaler Zeit des Geraets, als "YYYY-MM-DD".
 *
 * Tagesdifferenzen werden ueber Date.UTC gerechnet: ein UTC-Tag hat immer
 * 24 Stunden. So zaehlt der Tag der Zeitumstellung (23 bzw. 25 Stunden)
 * trotzdem als genau ein Tag.
 */
export type Tag = string;

const TAG_MS = 86_400_000;
const MONATE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
] as const;

export function tag(jahr: number, monat: number, t: number): Tag {
  return `${String(jahr).padStart(4, '0')}-${String(monat).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
}

export function zerlege(t: Tag): { jahr: number; monat: number; tag: number } {
  const [j, m, d] = t.split('-').map(Number);
  return { jahr: j ?? 0, monat: m ?? 1, tag: d ?? 1 };
}

/** Heutiger Kalendertag in Ortszeit. Ein neuer Tag beginnt um 00:00 Uhr. */
export function heute(jetzt: Date = new Date()): Tag {
  return tag(jetzt.getFullYear(), jetzt.getMonth() + 1, jetzt.getDate());
}

export function istTag(wert: unknown): wert is Tag {
  if (typeof wert !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) return false;
  const { jahr, monat, tag: d } = zerlege(wert);
  return monat >= 1 && monat <= 12 && d >= 1 && d <= tageImMonat(jahr, monat);
}

export function tageImMonat(jahr: number, monat: number): number {
  return new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
}

function utc(t: Tag): number {
  const { jahr, monat, tag: d } = zerlege(t);
  return Date.UTC(jahr, monat - 1, d);
}

/** a − b in ganzen Kalendertagen. */
export function differenz(a: Tag, b: Tag): number {
  return Math.round((utc(a) - utc(b)) / TAG_MS);
}

export function plusTage(t: Tag, n: number): Tag {
  const d = new Date(utc(t) + n * TAG_MS);
  return tag(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Monat davor bzw. danach als { jahr, monat }. */
export function monatVerschieben(jahr: number, monat: number, schritte: number): { jahr: number; monat: number } {
  const index = jahr * 12 + (monat - 1) + schritte;
  return { jahr: Math.floor(index / 12), monat: (index % 12 + 12) % 12 + 1 };
}

export function monatsname(monat: number): string {
  return MONATE[monat - 1] ?? '';
}

export function zwischen(t: Tag, von: Tag, bis: Tag): boolean {
  return t >= von && t <= bis;
}
