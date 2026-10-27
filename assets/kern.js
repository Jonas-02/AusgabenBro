/* Konstanten, Formatierung, kleine Helfer.
   Geldbetraege werden intern IMMER in Cent (Ganzzahl) gerechnet und nur
   zur Anzeige bzw. beim Schreiben ins Sheet in Euro umgewandelt. */

export const STUFEN = [
  { wert: 0, kurz: 'Fix',     name: 'Fixkosten',       hinweis: 'Läuft automatisch: Miete, Versicherung, Abo', token: '--n0' },
  { wert: 1, kurz: 'Nötig',   name: 'Nötig',          hinweis: 'Hätte so oder so sein müssen',               token: '--n1' },
  { wert: 2, kurz: 'Geplant', name: 'Geplant gegönnt', hinweis: 'Bewusst entschieden, kein Reue-Kandidat',    token: '--n2' },
  { wert: 3, kurz: 'Impuls',  name: 'Impuls',          hinweis: 'Spontan – hätte nicht sein müssen',        token: '--n3' },
  { wert: 4, kurz: 'Reue',    name: 'Reue',            hinweis: 'Würde ich rückgängig machen',              token: '--n4' }
];

export const UNNOETIG_AB = 3;

export const WEN = {
  ich:     { label: 'Nur ich',    kurz: 'ich' },
  geteilt: { label: 'Geteilt',    kurz: 'geteilt' },
  andere:  { label: 'Für andere', kurz: 'für andere' }
};

export const URTEILE = [
  { wert: 'gut',     icon: '\u{1F44D}', label: 'War es wert', token: '--gut' },
  { wert: 'neutral', icon: '\u{1F610}', label: 'Geht so',     token: '--n2' },
  { wert: 'schlecht',icon: '\u{1F44E}', label: 'Verschwendet',token: '--kritisch' }
];

export const KATEGORIEN_STANDARD = [
  'Wohnen', 'Lebensmittel', 'Restaurant & Bar', 'Lieferdienst', 'Transport',
  'Abos', 'Shopping', 'Gesundheit', 'Freizeit', 'Geschenke', 'Reisen', 'Sonstiges'
];

export const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/* ------------------------------------------------------------- Geldwerte */

export function zuCent(euro) {
  return Math.round((Number(euro) || 0) * 100);
}

export function zuEuro(cent) {
  return Math.round(cent) / 100;
}

/** Akzeptiert "12,50", "12.50", "1.234,56", "12" und liefert Cent. */
export function betragParsen(text) {
  if (typeof text === 'number') return zuCent(text);
  let s = String(text || '').trim().replace(/[\s €]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const EUR0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR',
  minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function eur(cent)      { return EUR.format(zuEuro(cent)); }
export function eurKurz(cent)  { return EUR0.format(zuEuro(cent)); }
export function prozent(teil, ganz, stellen = 0) {
  if (!ganz) return '0 %';
  return (teil / ganz * 100).toFixed(stellen).replace('.', ',') + ' %';
}

/* ----------------------------------------------------------------- Datum */

export function heute() {
  const d = new Date();
  return isoDatum(d);
}

export function isoDatum(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function monatVon(datum) { return String(datum || '').slice(0, 7); }

export function monatLabel(monat) {
  const [j, m] = String(monat).split('-');
  return MONATE[Number(m) - 1] + ' ' + j;
}

export function monatVerschieben(monat, schritte) {
  const [j, m] = String(monat).split('-').map(Number);
  const d = new Date(j, m - 1 + schritte, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function letzteMonate(bis, anzahl) {
  const out = [];
  for (let i = anzahl - 1; i >= 0; i--) out.push(monatVerschieben(bis, -i));
  return out;
}

export function tageSeit(datum) {
  const d = new Date(datum + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export function datumLesbar(datum) {
  const diff = tageSeit(datum);
  if (diff === 0) return 'heute';
  if (diff === 1) return 'gestern';
  const d = new Date(datum + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return datum;
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
}

/* -------------------------------------------------------------- Sonstige */

export function id() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function stufe(wert) {
  return STUFEN[Number(wert)] || STUFEN[2];
}

export function $(sel, wurzel = document)  { return wurzel.querySelector(sel); }
export function $$(sel, wurzel = document) { return Array.from(wurzel.querySelectorAll(sel)); }
