/* Auswertung: aus den Rohdaten die Kennzahlen rechnen, die das Problem
   sichtbar machen. Alles in Cent, damit nichts durch Fliesskomma wegrundet.

   Leitmetrik ist bewusst "Euro unnoetig" und nicht die Quote: die Quote kann
   sinken, waehrend absolut mehr Geld verbrennt (etwa weil die Fixkosten
   gestiegen sind). Am Monatsende fehlen aber Euro, keine Prozentpunkte. */

import {
  zuCent, monatVon, monatVerschieben, letzteMonate, tageSeit,
  normStichwort, istMonat, UNNOETIG_AB, STANDARD_BASELINE
} from './kern.js';

const cent = (satz) => zuCent(satz.betrag);

export function ausgabenImMonat(daten, monat) {
  return (daten.ausgaben || []).filter((a) => monatVon(a.datum) === monat);
}

export function einnahmenImMonat(daten, monat) {
  return (daten.einnahmen || []).filter((e) => monatVon(e.datum) === monat);
}

/* ------------------------------------------------------------ Stichwoerter */

/** Gruppiert nach normalisiertem Stichwort und zeigt die Schreibweise an,
 *  die am haeufigsten benutzt wurde. */
export function stichwortGruppen(ausgaben) {
  const map = new Map();
  for (const a of ausgaben) {
    const schluessel = normStichwort(a.stichwort);
    if (!schluessel) continue;
    const g = map.get(schluessel) || {
      norm: schluessel, cent: 0, unnoetig: 0, anzahl: 0, schreibweisen: new Map()
    };
    const c = cent(a);
    g.cent += c;
    g.anzahl += 1;
    if ((Number(a.notwendigkeit) || 0) >= UNNOETIG_AB) g.unnoetig += c;
    const roh = String(a.stichwort).trim();
    g.schreibweisen.set(roh, (g.schreibweisen.get(roh) || 0) + 1);
    map.set(schluessel, g);
  }

  return Array.from(map.values()).map((g) => {
    let anzeige = g.norm, beste = -1;
    for (const [form, n] of g.schreibweisen) if (n > beste) { beste = n; anzeige = form; }
    return { norm: g.norm, anzeige, cent: g.cent, unnoetig: g.unnoetig, anzahl: g.anzahl };
  }).sort((a, b) => b.cent - a.cent);
}

/** Vorschlaege fuers Eingabefeld: haeufig benutzt und kuerzlich benutzt. */
export function stichwortVorschlaege(daten, anzahl = 8) {
  const letzte = new Map();
  for (const a of daten.ausgaben || []) {
    const k = normStichwort(a.stichwort);
    if (!k) continue;
    const bisher = letzte.get(k);
    if (!bisher || String(a.datum) > bisher) letzte.set(k, String(a.datum));
  }
  const gruppen = stichwortGruppen(daten.ausgaben || []);
  // Haeufigkeit zuerst, bei Gleichstand das zuletzt Benutzte oben.
  return gruppen
    .slice()
    .sort((a, b) => b.anzahl - a.anzahl
                 || String(letzte.get(b.norm) || '').localeCompare(String(letzte.get(a.norm) || '')))
    .slice(0, anzahl);
}

export function alleStichwoerter(daten) {
  return stichwortGruppen(daten.ausgaben || []).map((g) => g.anzeige);
}

/* -------------------------------------------------------- Monatsauswertung */

export function monatsAuswertung(daten, monat) {
  const ausgaben  = ausgabenImMonat(daten, monat);
  const einnahmen = einnahmenImMonat(daten, monat);

  const proStufe = [0, 0, 0, 0, 0];
  const katMap = new Map();
  let gesamt = 0;

  for (const a of ausgaben) {
    const c = cent(a);
    gesamt += c;

    const s = Math.min(4, Math.max(0, Number(a.notwendigkeit) || 0));
    proStufe[s] += c;

    const kat = a.kategorie || 'Ohne Kategorie';
    const k = katMap.get(kat) || { name: kat, cent: 0, unnoetig: 0, anzahl: 0 };
    k.cent += c;
    k.anzahl += 1;
    if (s >= UNNOETIG_AB) k.unnoetig += c;
    katMap.set(kat, k);
  }

  const einkommen = einnahmen.reduce((s, e) => s + cent(e), 0);
  const unnoetig = proStufe[3] + proStufe[4];
  const variabel = gesamt - proStufe[0];   // ohne Fixkosten: der beeinflussbare Teil

  return {
    monat, ausgaben, einnahmen,
    gesamt, proStufe, unnoetig, variabel, einkommen,
    kategorien: Array.from(katMap.values()).sort((a, b) => b.cent - a.cent),
    stichwoerter: stichwortGruppen(ausgaben),
    quote:          gesamt   ? unnoetig / gesamt   : 0,
    quoteVariabel:  variabel ? unnoetig / variabel : 0,
    saldo: einkommen - gesamt,
    leer: ausgaben.length === 0 && einnahmen.length === 0
  };
}

/* ----------------------------------------------------------- Monatsvergleich */

/**
 * Startmonat des Vergleichs. Vorrang hat der in der Tabelle hinterlegte Wert,
 * dann der feste Standard. Nur wenn beides fehlt, wird der erste Monat mit
 * Daten genommen - sonst wuerde ein Probemonat zur Messlatte.
 */
export function baselineMonat(daten) {
  const konfiguriert = daten.config && daten.config.baseline;
  if (istMonat(konfiguriert)) return String(konfiguriert);
  if (istMonat(STANDARD_BASELINE)) return STANDARD_BASELINE;
  return erstesDatenMonat(daten);
}

function erstesDatenMonat(daten) {
  let fruehester = null;
  for (const a of daten.ausgaben || []) {
    const m = monatVon(a.datum);
    if (m && (!fruehester || m < fruehester)) fruehester = m;
  }
  for (const e of daten.einnahmen || []) {
    const m = monatVon(e.datum);
    if (m && (!fruehester || m < fruehester)) fruehester = m;
  }
  return fruehester;
}

/** Gibt es Buchungen vor dem Startmonat? Dann weist die App darauf hin. */
export function datenVorBaseline(daten) {
  const basis = baselineMonat(daten);
  if (!basis) return 0;
  return (daten.ausgaben || []).filter((a) => monatVon(a.datum) < basis).length
       + (daten.einnahmen || []).filter((e) => monatVon(e.datum) < basis).length;
}

export function erfassteMonate(daten) {
  const menge = new Set();
  for (const a of daten.ausgaben || [])  { const m = monatVon(a.datum); if (m) menge.add(m); }
  for (const e of daten.einnahmen || []) { const m = monatVon(e.datum); if (m) menge.add(m); }
  return Array.from(menge).sort();
}

/**
 * Stellt drei Monate nebeneinander: den gewaehlten, den Vormonat und die
 * Baseline. Liefert zusaetzlich die Differenzen je Kategorie und Stichwort,
 * sortiert nach der groessten Verschlechterung - das ist die Liste, an der
 * man tatsaechlich etwas aendern kann.
 */
export function vergleich(daten, monat) {
  const basis = baselineMonat(daten);
  const jetzt = monatsAuswertung(daten, monat);
  const vorher = monatsAuswertung(daten, monatVerschieben(monat, -1));
  // Vor dem Startmonat gibt es keine Basis, gegen die sich vergleichen liesse.
  const vorBaseline = Boolean(basis) && monat < basis;
  const start = (basis && !vorBaseline) ? monatsAuswertung(daten, basis) : null;

  const istBaseline = Boolean(basis) && basis === monat;

  const kennzahlen = [
    { schluessel: 'unnoetig', label: '€ unnötig', leit: true,
      jetzt: jetzt.unnoetig, vorher: vorher.unnoetig, start: start ? start.unnoetig : null },
    { schluessel: 'gesamt', label: 'Ausgaben gesamt',
      jetzt: jetzt.gesamt, vorher: vorher.gesamt, start: start ? start.gesamt : null },
    { schluessel: 'variabel', label: 'davon beeinflussbar',
      jetzt: jetzt.variabel, vorher: vorher.variabel, start: start ? start.variabel : null },
    { schluessel: 'saldo', label: 'Saldo', hoeherIstBesser: true,
      jetzt: jetzt.saldo, vorher: vorher.saldo, start: start ? start.saldo : null }
  ];

  return {
    monat, basis, istBaseline, vorBaseline,
    jetzt, vorher, start,
    kennzahlen,
    kategorien: differenzen(jetzt.kategorien, vorher.kategorien, (k) => k.name),
    stichwoerter: differenzen(jetzt.stichwoerter, vorher.stichwoerter, (k) => k.norm, (k) => k.anzeige)
  };
}

/** Vereinigt zwei Listen ueber einen Schluessel und rechnet die Differenz. */
function differenzen(jetztListe, vorherListe, schluesselVon, anzeigeVon) {
  const anzeige = anzeigeVon || schluesselVon;
  const map = new Map();

  for (const e of jetztListe) {
    map.set(schluesselVon(e), {
      name: anzeige(e), jetzt: e.cent, vorher: 0,
      unnoetigJetzt: e.unnoetig || 0, anzahl: e.anzahl || 0
    });
  }
  for (const e of vorherListe) {
    const k = schluesselVon(e);
    const vorhanden = map.get(k);
    if (vorhanden) vorhanden.vorher = e.cent;
    else map.set(k, { name: anzeige(e), jetzt: 0, vorher: e.cent, unnoetigJetzt: 0, anzahl: 0 });
  }

  return Array.from(map.values())
    .map((e) => Object.assign(e, { delta: e.jetzt - e.vorher }))
    .sort((a, b) => b.delta - a.delta);
}

export function verlauf(daten, bisMonat, anzahl = 6) {
  const basis = baselineMonat(daten);
  return letzteMonate(bisMonat, anzahl)
    .filter((m) => !basis || m >= basis)
    .map((m) => {
    const a = ausgabenImMonat(daten, m);
    let gesamt = 0, unnoetig = 0;
    for (const e of a) {
      const c = cent(e);
      gesamt += c;
      if ((Number(e.notwendigkeit) || 0) >= UNNOETIG_AB) unnoetig += c;
    }
    return { monat: m, gesamt, unnoetig, noetig: gesamt - unnoetig, quote: gesamt ? unnoetig / gesamt : 0 };
  });
}

/* ------------------------------------------------------------------- Reue */

/** Rueckblickende Bewertung je Kategorie, ueber alle Monate.
 *  Nur Kategorien mit genug Bewertungen - darunter ist der Anteil Rauschen. */
export function reueRanking(daten, mindestAnzahl = 3) {
  const map = new Map();
  for (const a of daten.ausgaben || []) {
    if (!a.reue) continue;
    const kat = a.kategorie || 'Ohne Kategorie';
    const k = map.get(kat) || { name: kat, anzahl: 0, schlecht: 0, cent: 0, schlechtCent: 0 };
    const c = cent(a);
    k.anzahl += 1;
    k.cent += c;
    if (a.reue === 'schlecht') { k.schlecht += 1; k.schlechtCent += c; }
    map.set(kat, k);
  }
  return Array.from(map.values())
    .filter((k) => k.anzahl >= mindestAnzahl)
    .map((k) => Object.assign({}, k, { anteil: k.schlecht / k.anzahl }))
    .sort((a, b) => b.schlechtCent - a.schlechtCent || b.anteil - a.anteil);
}

/** Ausgaben, die alt genug fuer eine ehrliche Rueckschau sind.
 *  Fixkosten werden uebersprungen - die bewertet man nicht sinnvoll. */
export function offeneReue(daten, mindestTage = 7) {
  return (daten.ausgaben || [])
    .filter((a) => !a.reue
                && (Number(a.notwendigkeit) || 0) >= 1
                && tageSeit(a.datum) >= mindestTage
                && tageSeit(a.datum) <= 120)
    .sort((a, b) => zuCent(b.betrag) - zuCent(a.betrag));
}
