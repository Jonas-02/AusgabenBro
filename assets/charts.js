/* Diagramme als HTML. Jede Karte bringt eine Legende mit Werten und eine
   aufklappbare Tabelle mit - Farbe traegt nie allein die Information. */

import { eur, eurKurz, prozent, esc, monatLabel, STUFEN } from './kern.js';

function karte(titel, unter, inhalt, tabelleHtml) {
  return `<section class="chart-karte">
    <div class="chart-kopf">
      <span class="chart-titel">${esc(titel)}</span>
      ${unter ? `<span class="chart-unter">${esc(unter)}</span>` : ''}
    </div>
    ${inhalt}
    ${tabelleHtml ? `<details class="tabelle-aufklapp"><summary>Als Tabelle</summary>${tabelleHtml}</details>` : ''}
  </section>`;
}

function tabelle(kopf, zeilen) {
  if (!zeilen.length) return '';
  return `<table class="tabelle"><thead><tr>${
    kopf.map((h) => `<th>${esc(h)}</th>`).join('')
  }</tr></thead><tbody>${
    zeilen.map((z) => `<tr>${z.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;
}

function leer(text) {
  return `<p class="leer">${esc(text)}</p>`;
}

function tip(text) {
  return `data-tip="${esc(text)}"`;
}

/* ------------------------------------- 1. Verteilung nach Notwendigkeit */

export function notwendigkeitsChart(a) {
  if (!a.gesamt) return karte('Wofür nach Notwendigkeit', '', leer('Noch keine Ausgaben in diesem Monat.'));

  const segmente = STUFEN
    .map((s) => ({ s, cent: a.proStufe[s.wert] || 0 }))
    .filter((x) => x.cent > 0);

  const balken = `<div class="bar-track gross">${
    segmente.map((x) => `<div class="bar-seg" style="flex:0 0 ${(x.cent / a.gesamt * 100).toFixed(3)}%;background:var(${x.s.token})" ${
      tip(`${x.s.name}: ${eur(x.cent)} (${prozent(x.cent, a.gesamt)})`)
    }></div>`).join('')
  }</div>`;

  const legende = `<div class="legende">${
    STUFEN.map((s) => {
      const c = a.proStufe[s.wert] || 0;
      return `<span class="legende-eintrag">
        <span class="legende-punkt" style="background:var(${s.token})"></span>
        ${esc(s.kurz)} <span class="legende-wert">${eurKurz(c)}</span>
      </span>`;
    }).join('')
  }</div>`;

  const tab = tabelle(['Stufe', 'Bedeutung', 'Betrag', 'Anteil'],
    STUFEN.map((s) => [esc(s.name), esc(s.hinweis), eur(a.proStufe[s.wert] || 0), prozent(a.proStufe[s.wert] || 0, a.gesamt)]));

  return karte('Wofür nach Notwendigkeit', eur(a.gesamt) + ' gesamt', balken + legende, tab);
}

/* --------------------------------------------- 2. Kategorien, aufgeteilt */

export function kategorieChart(a, maxZeilen = 8) {
  if (!a.kategorien.length) return karte('Kategorien', '', leer('Noch keine Ausgaben in diesem Monat.'));

  const sichtbar = a.kategorien.slice(0, maxZeilen);
  const rest = a.kategorien.slice(maxZeilen);
  if (rest.length) {
    sichtbar.push({
      name: `${rest.length} weitere`,
      cent: rest.reduce((s, k) => s + k.cent, 0),
      unnoetig: rest.reduce((s, k) => s + k.unnoetig, 0),
      anzahl: rest.reduce((s, k) => s + k.anzahl, 0)
    });
  }

  const max = Math.max(...sichtbar.map((k) => k.cent), 1);

  const zeilen = sichtbar.map((k) => {
    const noetig = k.cent - k.unnoetig;
    const breite = (c) => (c / max * 100).toFixed(3) + '%';
    return `<div class="kat-zeile">
      <div class="kat-kopf">
        <span class="kat-name">${esc(k.name)}</span>
        <span>
          ${k.unnoetig ? `<span class="kat-anteil">${prozent(k.unnoetig, k.cent)} unnötig &middot; </span>` : ''}
          <span class="kat-wert">${eurKurz(k.cent)}</span>
        </span>
      </div>
      <div class="bar-track">
        ${noetig > 0 ? `<div class="bar-seg" style="flex:0 0 ${breite(noetig)};background:var(--noetig)" ${tip(`${k.name} – nötig/geplant: ${eur(noetig)}`)}></div>` : ''}
        ${k.unnoetig > 0 ? `<div class="bar-seg" style="flex:0 0 ${breite(k.unnoetig)};background:var(--unnoetig)" ${tip(`${k.name} – Impuls/Reue: ${eur(k.unnoetig)}`)}></div>` : ''}
        <div class="bar-rest"></div>
      </div>
    </div>`;
  }).join('');

  const legende = `<div class="legende">
    <span class="legende-eintrag"><span class="legende-punkt" style="background:var(--noetig)"></span>Fix, nötig, geplant</span>
    <span class="legende-eintrag"><span class="legende-punkt" style="background:var(--unnoetig)"></span>Impuls &amp; Reue</span>
  </div>`;

  const tab = tabelle(['Kategorie', 'Buchungen', 'Unnötig', 'Gesamt'],
    a.kategorien.map((k) => [esc(k.name), String(k.anzahl), eur(k.unnoetig), eur(k.cent)]));

  return karte('Kategorien', 'größte zuerst', zeilen + legende, tab);
}

/* -------------------------------------------- 3. Verlauf ueber 6 Monate */

export function verlaufChart(reihen, aktuellerMonat) {
  const max = Math.max(...reihen.map((r) => r.gesamt), 1);
  if (!reihen.some((r) => r.gesamt > 0)) {
    return karte('Verlauf', 'letzte 6 Monate', leer('Noch keine Historie – kommt mit der Zeit von allein.'));
  }

  const saeulen = reihen.map((r) => {
    const hoehe = (c) => (c / max * 100).toFixed(2) + '%';
    return `<div class="verlauf-spalte">
      <div class="verlauf-quote">${r.gesamt ? prozent(r.unnoetig, r.gesamt) : '–'}</div>
      <div class="verlauf-saeule" style="height:${hoehe(r.gesamt)}">
        ${r.unnoetig > 0 ? `<div class="verlauf-seg" style="flex:0 0 ${(r.unnoetig / Math.max(r.gesamt, 1) * 100).toFixed(2)}%;background:var(--unnoetig)" ${tip(`${monatLabel(r.monat)} – Impuls/Reue: ${eur(r.unnoetig)}`)}></div>` : ''}
        ${r.noetig > 0 ? `<div class="verlauf-seg" style="flex:1 1 auto;background:var(--noetig)" ${tip(`${monatLabel(r.monat)} – nötig/geplant: ${eur(r.noetig)}`)}></div>` : ''}
      </div>
    </div>`;
  }).join('');

  const achse = `<div class="verlauf-achse">${
    reihen.map((r) => `<span class="${r.monat === aktuellerMonat ? 'jetzt' : ''}">${esc(monatLabel(r.monat).split(' ')[0])}</span>`).join('')
  }</div>`;

  const legende = `<div class="legende">
    <span class="legende-eintrag"><span class="legende-punkt" style="background:var(--unnoetig)"></span>Impuls &amp; Reue</span>
    <span class="legende-eintrag"><span class="legende-punkt" style="background:var(--noetig)"></span>Fix, nötig, geplant</span>
    <span class="legende-eintrag" style="color:var(--muted)">Prozentzahl über der Säule = Unnötig-Quote</span>
  </div>`;

  const tab = tabelle(['Monat', 'Unnötig', 'Quote', 'Gesamt'],
    reihen.map((r) => [esc(monatLabel(r.monat)), eur(r.unnoetig), prozent(r.unnoetig, r.gesamt), eur(r.gesamt)]));

  return karte('Verlauf', 'letzte 6 Monate', `<div class="verlauf">${saeulen}</div>${achse}${legende}`, tab);
}

/* ------------------------------------------ 4. Fuer wen & Spendabel-Saldo */

export function spendabelChart(a) {
  const teile = [
    { label: 'Nur ich', cent: a.proWen.ich,     token: '--n1' },
    { label: 'Geteilt', cent: a.proWen.geteilt, token: '--n2' },
    { label: 'Für andere', cent: a.proWen.andere, token: '--n4' }
  ];
  if (!a.gesamt) return karte('Für wen', '', leer('Noch keine Ausgaben in diesem Monat.'));

  const balken = `<div class="bar-track gross">${
    teile.filter((t) => t.cent > 0).map((t) => `<div class="bar-seg" style="flex:0 0 ${(t.cent / a.gesamt * 100).toFixed(3)}%;background:var(${t.token})" ${
      tip(`${t.label}: ${eur(t.cent)} (${prozent(t.cent, a.gesamt)})`)
    }></div>`).join('')
  }</div>`;

  const legende = `<div class="legende">${
    teile.map((t) => `<span class="legende-eintrag">
      <span class="legende-punkt" style="background:var(${t.token})"></span>
      ${esc(t.label)} <span class="legende-wert">${eurKurz(t.cent)}</span>
    </span>`).join('')
  }</div>`;

  let personen = '';
  if (a.personen.length) {
    const max = Math.max(...a.personen.map((p) => Math.abs(p.saldo)), 1);
    personen = `<div style="margin-top:12px">
      <div class="feld-label" style="margin-bottom:5px">Saldo je Person</div>
      ${a.personen.slice(0, 6).map((p) => `<div class="person-zeile">
        <span class="person-name">${esc(p.name)}</span>
        <span class="person-bar"><span class="bar-track">
          ${p.saldo !== 0 ? `<span class="bar-seg" style="flex:0 0 ${(Math.abs(p.saldo) / max * 100).toFixed(2)}%;background:var(${p.saldo > 0 ? '--n4' : '--gut'})" ${
            tip(`${p.name}: ${eur(p.gezahlt)} von dir gezahlt, ${eur(p.erstattet)} zurück`)
          }></span>` : ''}<span class="bar-rest"></span>
        </span></span>
        <span class="person-wert" style="color:var(${p.saldo > 0 ? '--kritisch' : '--gut-text'})">${p.saldo > 0 ? '−' : '+'}${eurKurz(Math.abs(p.saldo))}</span>
      </div>`).join('')}
      <p class="hilfe" style="margin-top:6px">Rot = du hast für diese Person mehr gezahlt, als du zurückbekommen hast. Geteilte Ausgaben zählen zur Hälfte.</p>
    </div>`;
  }

  const tab = tabelle(['Person', 'Du gezahlt', 'Zurück', 'Saldo'],
    a.personen.map((p) => [esc(p.name), eur(p.gezahlt), eur(p.erstattet), eur(p.saldo)]));

  return karte('Für wen', eur(a.fuerAndere) + ' nicht nur für dich', balken + legende + personen, tab);
}

/* ----------------------------------------------------- 5. Reue-Ranking */

export function reueChart(ranking) {
  if (!ranking.length) {
    return karte('Reue-Ranking', 'ab 3 Bewertungen je Kategorie',
      leer('Noch zu wenige Rückblicke. Bewerte im Tab „Reue“ ein paar Ausgaben.'));
  }

  const max = Math.max(...ranking.map((k) => k.schlechtCent), 1);

  const zeilen = ranking.slice(0, 8).map((k) => `<div class="kat-zeile">
    <div class="kat-kopf">
      <span class="kat-name">${esc(k.name)}</span>
      <span>
        <span class="kat-anteil">${k.schlecht}/${k.anzahl} als verschwendet &middot; </span>
        <span class="kat-wert">${eurKurz(k.schlechtCent)}</span>
      </span>
    </div>
    <div class="bar-track">
      ${k.schlechtCent > 0 ? `<div class="bar-seg" style="flex:0 0 ${(k.schlechtCent / max * 100).toFixed(2)}%;background:var(--kritisch)" ${
        tip(`${k.name}: ${eur(k.schlechtCent)} rückblickend als verschwendet bewertet`)
      }></div>` : ''}
      <div class="bar-rest"></div>
    </div>
  </div>`).join('');

  const legende = `<div class="legende">
    <span class="legende-eintrag"><span class="legende-punkt" style="background:var(--kritisch)"></span>
    \u{1F44E} rückblickend als verschwendet bewertet</span>
  </div>`;

  const tab = tabelle(['Kategorie', 'Bewertet', '\u{1F44E}', 'Verschwendet'],
    ranking.map((k) => [esc(k.name), String(k.anzahl), String(k.schlecht), eur(k.schlechtCent)]));

  return karte('Reue-Ranking', 'ab 3 Bewertungen je Kategorie', zeilen + legende, tab);
}
