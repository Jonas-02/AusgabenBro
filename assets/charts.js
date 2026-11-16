/* Diagramme als HTML, nur der Burn-Down als SVG. Jede Karte bringt eine
   Legende mit Werten und eine aufklappbare Tabelle mit - Farbe traegt nie
   allein die Information. */

import { eur, eurKurz, eurDelta, prozent, esc, monatLabel } from './kern.js';

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

const leer = (text) => `<p class="leer">${esc(text)}</p>`;
const tip = (text) => `data-tip="${esc(text)}"`;

const fixLegende = `<div class="legende">
  <span class="legende-eintrag"><span class="legende-punkt" style="background:var(--n1)"></span>Variabel</span>
  <span class="legende-eintrag"><span class="legende-punkt" style="background:var(--n0)"></span>Fixkosten</span>
</div>`;

/* ------------------------------------------------------------ Kategorien */

export function kategorieChart(a, maxZeilen = 8) {
  if (!a.kategorien.length) return karte('Kategorien', '', leer('Noch keine Ausgaben in diesem Monat.'));

  const sichtbar = a.kategorien.slice(0, maxZeilen);
  const rest = a.kategorien.slice(maxZeilen);
  if (rest.length) {
    sichtbar.push({
      name: `${rest.length} weitere`,
      cent: rest.reduce((s, k) => s + k.cent, 0),
      fix: rest.reduce((s, k) => s + k.fix, 0),
      anzahl: rest.reduce((s, k) => s + k.anzahl, 0)
    });
  }

  const max = Math.max(...sichtbar.map((k) => k.cent), 1);

  const zeilen = sichtbar.map((k) => {
    const variabel = k.cent - k.fix;
    const breite = (c) => (c / max * 100).toFixed(3) + '%';
    return `<div class="kat-zeile">
      <div class="kat-kopf">
        <span class="kat-name">${esc(k.name)}</span>
        <span>
          ${k.anzahl ? `<span class="kat-anteil">${k.anzahl}× &middot; </span>` : ''}
          <span class="kat-wert">${eurKurz(k.cent)}</span>
        </span>
      </div>
      <div class="bar-track">
        ${variabel > 0 ? `<div class="bar-seg" style="flex:0 0 ${breite(variabel)};background:var(--n1)" ${tip(`${k.name} – variabel: ${eur(variabel)}`)}></div>` : ''}
        ${k.fix > 0 ? `<div class="bar-seg" style="flex:0 0 ${breite(k.fix)};background:var(--n0)" ${tip(`${k.name} – Fixkosten: ${eur(k.fix)}`)}></div>` : ''}
        <div class="bar-rest"></div>
      </div>
    </div>`;
  }).join('');

  const tab = tabelle(['Kategorie', 'Buchungen', 'Fix', 'Gesamt'],
    a.kategorien.map((k) => [esc(k.name), String(k.anzahl), eur(k.fix), eur(k.cent)]));

  return karte('Kategorien', eur(a.gesamt) + ' gesamt', zeilen + fixLegende, tab);
}

/* --------------------------------------------------------------- Verlauf */

export function verlaufChart(reihen, aktuellerMonat) {
  const max = Math.max(...reihen.map((r) => r.gesamt), 1);
  if (!reihen.some((r) => r.gesamt > 0)) {
    return karte('Verlauf', 'letzte 6 Monate', leer('Noch keine Historie – kommt mit der Zeit von allein.'));
  }

  const saeulen = reihen.map((r) => `<div class="verlauf-spalte">
      <div class="verlauf-quote">${r.variabel ? eurKurz(r.variabel) : '–'}</div>
      <div class="verlauf-saeule" style="height:${(r.gesamt / max * 100).toFixed(2)}%">
        ${r.variabel > 0 ? `<div class="verlauf-seg" style="flex:0 0 ${(r.variabel / Math.max(r.gesamt, 1) * 100).toFixed(2)}%;background:var(--n1)" ${tip(`${monatLabel(r.monat)} – variabel: ${eur(r.variabel)}`)}></div>` : ''}
        ${r.fix > 0 ? `<div class="verlauf-seg" style="flex:1 1 auto;background:var(--n0)" ${tip(`${monatLabel(r.monat)} – Fixkosten: ${eur(r.fix)}`)}></div>` : ''}
      </div>
    </div>`).join('');

  const achse = `<div class="verlauf-achse">${
    reihen.map((r) => `<span class="${r.monat === aktuellerMonat ? 'jetzt' : ''}">${esc(monatLabel(r.monat).split(' ')[0])}</span>`).join('')
  }</div>`;

  const legende = `<div class="legende">
    <span class="legende-eintrag"><span class="legende-punkt" style="background:var(--n1)"></span>Variabel</span>
    <span class="legende-eintrag"><span class="legende-punkt" style="background:var(--n0)"></span>Fixkosten</span>
    <span class="legende-eintrag" style="color:var(--muted)">Zahl über der Säule = variabler Teil</span>
  </div>`;

  const tab = tabelle(['Monat', 'Variabel', 'Fix', 'Gesamt'],
    reihen.map((r) => [esc(monatLabel(r.monat)), eur(r.variabel), eur(r.fix), eur(r.gesamt)]));

  return karte('Verlauf', 'letzte 6 Monate', `<div class="verlauf">${saeulen}</div>${achse}${legende}`, tab);
}

/* ============================================================== Cockpit */

/**
 * Burn-Down als Inline-SVG. Die Breite kommt in Pixeln herein, damit die
 * Beschriftung in jeder Embed-Breite gleich gross bleibt - ein viewBox-Chart
 * wuerde den Text mitskalieren.
 */
export function burndownChart(daten, breite) {
  const { reihen, budget: b } = daten;
  if (!b.eingerichtet || b.monatsbudget <= 0) {
    return karte('Burn-Down', '', leer('Trag unter Setup dein Einkommen ein, dann rechnet die App mit.'));
  }

  const W = Math.max(Math.round(breite) || 320, 240);
  const H = 158;
  const padL = 46, padR = 12, padT = 16, padB = 22;
  const pw = W - padL - padR;
  const ph = H - padT - padB;

  const sichtbar = reihen.filter((r) => r.ist !== null);
  const werte = reihen.map((r) => r.soll).concat(sichtbar.map((r) => r.ist));
  const yMax = Math.max(...werte, b.monatsbudget);
  const yMin = Math.min(...werte, 0);
  const spanne = Math.max(yMax - yMin, 1);

  const x = (t) => padL + (t / b.tage) * pw;
  const y = (v) => padT + ((yMax - v) / spanne) * ph;

  const pfad = (liste, feld) => liste.map((r, i) =>
    `${i ? 'L' : 'M'}${x(r.tag).toFixed(1)} ${y(r[feld]).toFixed(1)}`).join(' ');

  const nulllinie = yMin < 0
    ? `<line x1="${padL}" y1="${y(0).toFixed(1)}" x2="${W - padR}" y2="${y(0).toFixed(1)}"
         style="stroke:var(--axis)" stroke-width="1"/>` : '';

  const letzter = sichtbar[sichtbar.length - 1];
  const klasse = b.abweichung >= 0 ? 'besser' : 'schlechter';

  const treffer = sichtbar.map((r) => {
    const bx = x(r.tag) - pw / b.tage / 2;
    return `<rect x="${Math.max(bx, padL).toFixed(1)}" y="${padT}"
      width="${(pw / b.tage).toFixed(1)}" height="${ph}" fill="transparent"
      ${tip(`Tag ${r.tag}: ${eur(r.ist)} übrig · Soll ${eur(r.soll)}${r.ausgegebenAmTag ? ' · an dem Tag ' + eur(r.ausgegebenAmTag) : ''}`)}/>`;
  }).join('');

  const svg = `<svg width="${W}" height="${H}" role="img"
      aria-label="Burn-Down: verbleibendes Budget über den Monat">
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + ph}" style="stroke:var(--grid)" stroke-width="1"/>
    ${nulllinie}
    <text x="${padL - 6}" y="${(y(yMax) + 4).toFixed(1)}" text-anchor="end" class="achsen-text">${eurKurz(yMax)}</text>
    <text x="${padL - 6}" y="${(y(Math.max(yMin, 0)) + 4).toFixed(1)}" text-anchor="end" class="achsen-text">${eurKurz(Math.max(yMin, 0))}</text>
    <path d="${pfad(reihen, 'soll')}" fill="none" style="stroke:var(--axis)"
          stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round"/>
    <path d="${pfad(sichtbar, 'ist')}" fill="none" style="stroke:var(--noetig)"
          stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${letzter ? `<circle cx="${x(letzter.tag).toFixed(1)}" cy="${y(letzter.ist).toFixed(1)}" r="4"
         style="fill:var(--noetig);stroke:var(--surface)" stroke-width="2"/>` : ''}
    <text x="${padL}" y="${H - 6}" class="achsen-text">1.</text>
    <text x="${(padL + pw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="achsen-text">${Math.round(b.tage / 2)}.</text>
    <text x="${W - padR}" y="${H - 6}" text-anchor="end" class="achsen-text">${b.tage}.</text>
    ${treffer}
  </svg>`;

  const legende = `<div class="legende">
    <span class="legende-eintrag"><span class="legende-strich ist"></span>Tatsächlich übrig
      <span class="legende-wert">${eur(b.rest)}</span></span>
    <span class="legende-eintrag"><span class="legende-strich soll"></span>Nach Plan
      <span class="legende-wert">${eur(b.sollRest)}</span></span>
    <span class="legende-eintrag ${klasse}">${b.abweichung >= 0 ? 'Du liegst vorn' : 'Du liegst zurück'}:
      <strong>${eurDelta(b.abweichung)}</strong></span>
  </div>`;

  const tab = tabelle(['Tag', 'Nach Plan', 'Tatsächlich', 'An dem Tag'],
    reihen.filter((r) => r.tag > 0).map((r) => [
      String(r.tag) + '.', eur(r.soll), r.ist === null ? '–' : eur(r.ist),
      r.ausgegebenAmTag ? eur(r.ausgegebenAmTag) : '–']));

  return karte('Burn-Down', `${b.tagHeute}. von ${b.tage} Tagen`, svg + legende, tab);
}

/** Umschlaege: ein Balken je Topf, Ueberziehung deutlich markiert. */
export function topfChart(liste) {
  if (!liste.length) {
    return karte('Töpfe', '', leer('Noch keine Töpfe. Unter Setup anlegen – ein Limit fürs Essen, eins fürs Spontane.'));
  }

  const zeilen = liste.map((t) => {
    const ohneLimit = t.limit === null || t.limit <= 0;
    const anteil = ohneLimit ? 0 : Math.min(t.ausgegeben / t.limit, 1);
    const drueber = !ohneLimit && t.ausgegeben > t.limit;
    const farbe = drueber ? '--kritisch' : (anteil > 0.85 ? '--warnung' : '--noetig');

    return `<div class="kat-zeile">
      <div class="kat-kopf">
        <span class="kat-name">${esc(t.name)}</span>
        <span>
          ${ohneLimit
            ? '<span class="kat-anteil">ohne Limit &middot; </span>'
            : `<span class="kat-anteil ${drueber ? 'schlechter' : ''}">${
                drueber ? eurKurz(-t.rest) + ' drüber' : eurKurz(t.rest) + ' frei'} &middot; </span>`}
          <span class="kat-wert">${eurKurz(t.ausgegeben)}${ohneLimit ? '' : ' / ' + eurKurz(t.limit)}</span>
        </span>
      </div>
      ${ohneLimit ? '' : `<div class="bar-track">
        <div class="bar-seg" style="flex:0 0 ${(anteil * 100).toFixed(2)}%;background:var(${farbe})" ${
          tip(`${t.name}: ${eur(t.ausgegeben)} von ${eur(t.limit)} (${prozent(t.ausgegeben, t.limit)})`)}></div>
        <div class="bar-rest"></div>
      </div>`}
    </div>`;
  }).join('');

  const tab = tabelle(['Topf', 'Limit', 'Ausgegeben', 'Frei'],
    liste.map((t) => [esc(t.name), t.limit === null ? '–' : eur(t.limit),
      eur(t.ausgegeben), t.limit === null ? '–' : eur(t.rest)]));

  return karte('Töpfe', 'Limit je Bereich', zeilen, tab);
}
