/* Auswertung: aus den Rohdaten die Kennzahlen rechnen, die das Problem
   sichtbar machen. Alles in Cent, damit nichts durch Fliesskomma wegrundet. */

import { zuCent, monatVon, UNNOETIG_AB, letzteMonate, tageSeit } from './kern.js';

const cent = (satz) => zuCent(satz.betrag);

/** Anteil einer geteilten Ausgabe, der als "fuer andere" gilt. */
export const GETEILT_ANTEIL = 0.5;

export function ausgabenImMonat(daten, monat) {
  return (daten.ausgaben || []).filter((a) => monatVon(a.datum) === monat);
}

export function einnahmenImMonat(daten, monat) {
  return (daten.einnahmen || []).filter((e) => monatVon(e.datum) === monat);
}

export function monatsAuswertung(daten, monat) {
  const ausgaben  = ausgabenImMonat(daten, monat);
  const einnahmen = einnahmenImMonat(daten, monat);

  const proStufe = [0, 0, 0, 0, 0];
  const proWen = { ich: 0, geteilt: 0, andere: 0 };
  const katMap = new Map();
  const personMap = new Map();

  let gesamt = 0;
  let fuerAndere = 0;

  for (const a of ausgaben) {
    const c = cent(a);
    gesamt += c;

    const s = Math.min(4, Math.max(0, Number(a.notwendigkeit) || 0));
    proStufe[s] += c;

    const wen = proWen[a.fuerWen] !== undefined ? a.fuerWen : 'ich';
    proWen[wen] += c;

    if (wen === 'andere')  fuerAndere += c;
    if (wen === 'geteilt') fuerAndere += Math.round(c * GETEILT_ANTEIL);

    const kat = a.kategorie || 'Ohne Kategorie';
    const k = katMap.get(kat) || { name: kat, cent: 0, unnoetig: 0, anzahl: 0 };
    k.cent += c;
    k.anzahl += 1;
    if (s >= UNNOETIG_AB) k.unnoetig += c;
    katMap.set(kat, k);

    if (a.person && wen !== 'ich') {
      const name = String(a.person).trim();
      const p = personMap.get(name) || { name, gezahlt: 0, erstattet: 0, anzahl: 0 };
      p.gezahlt += (wen === 'andere') ? c : Math.round(c * GETEILT_ANTEIL);
      p.anzahl += 1;
      personMap.set(name, p);
    }
  }

  let einkommen = 0;
  let erstattung = 0;
  for (const e of einnahmen) {
    const c = cent(e);
    if (e.typ === 'erstattung') {
      erstattung += c;
      const name = String(e.person || '').trim();
      if (name) {
        const p = personMap.get(name) || { name, gezahlt: 0, erstattet: 0, anzahl: 0 };
        p.erstattet += c;
        personMap.set(name, p);
      }
    } else {
      einkommen += c;
    }
  }

  const unnoetig = proStufe[3] + proStufe[4];
  const variabel = gesamt - proStufe[0];   // ohne Fixkosten: der beeinflussbare Teil

  const kategorien = Array.from(katMap.values()).sort((a, b) => b.cent - a.cent);
  const personen = Array.from(personMap.values())
    .map((p) => Object.assign({}, p, { saldo: p.gezahlt - p.erstattet }))
    .sort((a, b) => b.saldo - a.saldo);

  return {
    monat, ausgaben, einnahmen,
    gesamt, proStufe, proWen, kategorien, personen,
    unnoetig, variabel,
    quote:         gesamt ? unnoetig / gesamt : 0,
    quoteVariabel: variabel ? unnoetig / variabel : 0,
    quoteEinkommen: einkommen ? unnoetig / einkommen : 0,
    fuerAndere, erstattung, einkommen,
    spendabelSaldo: fuerAndere - erstattung,
    saldo: einkommen + erstattung - gesamt
  };
}

export function verlauf(daten, bisMonat, anzahl = 6) {
  return letzteMonate(bisMonat, anzahl).map((m) => {
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

/** Rueckblickende Bewertung je Kategorie, ueber alle Monate.
 *  Nur Kategorien mit genug Bewertungen, sonst ist der Anteil Rauschen. */
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

export function personenVorschlaege(daten) {
  const namen = new Set();
  for (const a of daten.ausgaben || []) if (a.person) namen.add(String(a.person).trim());
  for (const e of daten.einnahmen || []) if (e.person) namen.add(String(e.person).trim());
  namen.delete('');
  return Array.from(namen).sort((a, b) => a.localeCompare(b, 'de'));
}
