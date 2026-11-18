import type { Cent } from './geld';
import { zwischen, type Tag } from './datum';
import type { Ausgabe } from './typen';

export const NOTIZ_MAX = 60;

/** Leerzeichen zusammenfassen, kuerzen; leer → undefined. */
export function bereinige(notiz: string | undefined): string | undefined {
  const t = (notiz ?? '').replace(/\s+/g, ' ').trim().slice(0, NOTIZ_MAX);
  return t === '' ? undefined : t;
}

/** Gruppierungsschluessel: Gross-/Kleinschreibung egal ("zigaretten" = "Zigaretten"). */
export function schluessel(notiz: string): string {
  return notiz.toLocaleLowerCase('de-DE');
}

interface Gruppe {
  schluessel: string;
  name: string;
  summe: Cent;
  anzahl: number;
  zuletzt: string;
}

/** Gruppiert nach Schluessel; angezeigt wird die haeufigste Schreibweise (bei Gleichstand die neueste). */
function gruppiere(ausgaben: readonly Ausgabe[]): Gruppe[] {
  const gruppen = new Map<string, { summe: Cent; anzahl: number; zuletzt: string; schreibweisen: Map<string, { n: number; zuletzt: string }> }>();
  for (const a of ausgaben) {
    const n = bereinige(a.notiz);
    if (!n) continue;
    const k = schluessel(n);
    const g = gruppen.get(k) ?? { summe: 0, anzahl: 0, zuletzt: '', schreibweisen: new Map() };
    g.summe += a.cent;
    g.anzahl++;
    if (a.erfasstUm > g.zuletzt) g.zuletzt = a.erfasstUm;
    const s = g.schreibweisen.get(n) ?? { n: 0, zuletzt: '' };
    s.n++;
    if (a.erfasstUm > s.zuletzt) s.zuletzt = a.erfasstUm;
    g.schreibweisen.set(n, s);
    gruppen.set(k, g);
  }
  return [...gruppen.entries()].map(([k, g]) => {
    const [name] = [...g.schreibweisen.entries()].sort((x, y) => y[1].n - x[1].n || (y[1].zuletzt > x[1].zuletzt ? 1 : -1))[0] as [string, unknown];
    return { schluessel: k, name, summe: g.summe, anzahl: g.anzahl, zuletzt: g.zuletzt };
  });
}

/**
 * Vorschlaege fuers Notizfeld: bisherige Notizen, die im gewaehlten Pot
 * zuerst, dann nach Haeufigkeit und zuletzt genutzt.
 */
export function vorschlaege(ausgaben: readonly Ausgabe[], potId: string | null, max = 30): string[] {
  const imPot = new Set(gruppiere(ausgaben.filter((a) => a.potId === potId)).map((g) => g.schluessel));
  return gruppiere(ausgaben)
    .sort(
      (a, b) =>
        Number(imPot.has(b.schluessel)) - Number(imPot.has(a.schluessel)) || b.anzahl - a.anzahl || (b.zuletzt > a.zuletzt ? 1 : -1)
    )
    .slice(0, max)
    .map((g) => g.name);
}

export interface NotizEintrag {
  schluessel: string;
  name: string;
  summe: Cent;
  anzahl: number;
  /** 0..1 aller Ausgaben im Zeitraum (mit und ohne Notiz) */
  anteil: number;
}

export interface NotizAuswertung {
  eintraege: NotizEintrag[];
  /** Zusammengefasst, was nach den ersten `max` Eintraegen kommt */
  sonstige: { summe: Cent; anzahl: number; arten: number };
  ohneNotiz: { summe: Cent; anzahl: number };
  gesamt: Cent;
}

/** Ausgaben im Zeitraum nach Notiz, groesste Summe zuerst. */
export function nachNotiz(ausgaben: readonly Ausgabe[], potIds: ReadonlySet<string>, von: Tag, bis: Tag, max = 8): NotizAuswertung {
  const imZeitraum = ausgaben.filter((a) => potIds.has(a.potId) && zwischen(a.datum, von, bis));
  const gesamt = imZeitraum.reduce((n, a) => n + a.cent, 0);
  const ohne = imZeitraum.filter((a) => !bereinige(a.notiz));
  const sortiert = gruppiere(imZeitraum).sort((a, b) => b.summe - a.summe || b.anzahl - a.anzahl || a.name.localeCompare(b.name, 'de'));
  const anteil = (c: Cent) => (gesamt > 0 ? c / gesamt : 0);
  const rest = sortiert.slice(max);
  return {
    eintraege: sortiert.slice(0, max).map((g) => ({ schluessel: g.schluessel, name: g.name, summe: g.summe, anzahl: g.anzahl, anteil: anteil(g.summe) })),
    sonstige: { summe: rest.reduce((n, g) => n + g.summe, 0), anzahl: rest.reduce((n, g) => n + g.anzahl, 0), arten: rest.length },
    ohneNotiz: { summe: ohne.reduce((n, a) => n + a.cent, 0), anzahl: ohne.length },
    gesamt
  };
}
