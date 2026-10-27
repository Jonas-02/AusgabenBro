/* Diagramme und Vergleichsbloecke als HTML. Jede Karte bringt eine Legende
   mit Werten und eine aufklappbare Tabelle mit - Farbe traegt nie allein
   die Information. */

import { eur, eurKurz, eurDelta, prozent, esc, monatLabel, STUFEN } from './kern.js';

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

/** Einfaerbung einer Differenz. Bei Ausgaben ist weniger besser, beim Saldo mehr. */
function deltaKlasse(delta, hoeherIstBesser) {
  if (!delta) return 'neutral';
  const gut = hoeherIstBesser ? delta > 0 : delta < 0;
  return gut ? 'besser' : 'schlechter';
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
    STUFEN.map((s) => `<span class="legende-eintrag">
      <span class="legende-punkt" style="background:var(${s.token})"></span>
      ${esc(s.kurz)} <span class="legende-wert">${eurKurz(a.proStufe[s.wert] || 0)}</span>
    </span>`).join('')
  }</div>`;

  const tab = tabelle(['Stufe', 'Bedeutung', 'Betrag', 'Anteil'],
    STUFEN.map((s) => [esc(s.name), esc(s.hinweis), eur(a.proStufe[s.wert] || 0), prozent(a.proStufe[s.wert] || 0, a.gesamt)]));

  return karte('Wofür nach Notwendigkeit', eur(a.gesamt) + ' gesamt', balken + legende, tab);
}

/* ------------------------------- 2./3. Kategorien und Stichwoerter */

/** Gemeinsame Darstellung: Zeile je Eintrag, Balken geteilt in noetig/unnoetig. */
function anteilsListe(eintraege, maxZeilen, restLabel) {
  const sichtbar = eintraege.slice(0, maxZeilen);
  const rest = eintraege.slice(maxZeilen);
  if (rest.length) {
    sichtbar.push({
      name: `${rest.length} ${restLabel}`,
      cent: rest.reduce((s, k) => s + k.cent, 0),
      unnoetig: rest.reduce((s, k) => s + k.unnoetig, 0),
      anzahl: rest.reduce((s, k) => s + (k.anzahl || 0), 0)
    });
  }
  const max = Math.max(...sichtbar.map((k) => k.cent), 1);

  return sichtbar.map((k) => {
    const noetig = k.cent - k.unnoetig;
    const breite = (c) => (c / max * 100).toFixed(3) + '%';
    return `<div class="kat-zeile">
      <div class="kat-kopf">
        <span class="kat-name">${esc(k.name)}</span>
        <span>
          ${k.anzahl ? `<span class="kat-anteil">${k.anzahl}× &middot; </span>` : ''}
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
}

const noetigLegende = `<div class="legende">
  <span class="legende-eintrag"><span class="legende-punkt" style="background:var(--noetig)"></span>Fix, nötig, geplant</span>
  <span class="legende-eintrag"><span class="legende-punkt" style="background:var(--unnoetig)"></span>Impuls &amp; Reue</span>
</div>`;

export function kategorieChart(a, maxZeilen = 8) {
  if (!a.kategorien.length) return karte('Kategorien', '', leer('Noch keine Ausgaben in diesem Monat.'));
  const tab = tabelle(['Kategorie', 'Buchungen', 'Unnötig', 'Gesamt'],
    a.kategorien.map((k) => [esc(k.name), String(k.anzahl), eur(k.unnoetig), eur(k.cent)]));
  return karte('Kategorien', 'größte zuerst',
    anteilsListe(a.kategorien, maxZeilen, 'weitere') + noetigLegende, tab);
}

export function stichwortChart(a, maxZeilen = 10) {
  if (!a.stichwoerter.length) {
    return karte('Stichwörter', '',
      leer('Noch keine Stichwörter. Tipp beim Erfassen eins ein – gleiche Wörter werden automatisch zusammengefasst.'));
  }
  const tab = tabelle(['Stichwort', 'Anzahl', 'Unnötig', 'Gesamt'],
    a.stichwoerter.map((k) => [esc(k.anzeige), String(k.anzahl), eur(k.unnoetig), eur(k.cent)]));
  const liste = a.stichwoerter.map((k) => ({ name: k.anzeige, cent: k.cent, unnoetig: k.unnoetig, anzahl: k.anzahl }));
  return karte('Stichwörter', 'gleiche Wörter zusammengefasst',
    anteilsListe(liste, maxZeilen, 'weitere') + noetigLegende, tab);
}

/* -------------------------------------------- 4. Verlauf ueber 6 Monate */

export function verlaufChart(reihen, aktuellerMonat) {
  const max = Math.max(...reihen.map((r) => r.gesamt), 1);
  if (!reihen.some((r) => r.gesamt > 0)) {
    return karte('Verlauf', 'letzte 6 Monate', leer('Noch keine Historie – kommt mit der Zeit von allein.'));
  }

  const saeulen = reihen.map((r) => `<div class="verlauf-spalte">
      <div class="verlauf-quote">${r.unnoetig ? eurKurz(r.unnoetig) : '–'}</div>
      <div class="verlauf-saeule" style="height:${(r.gesamt / max * 100).toFixed(2)}%">
        ${r.unnoetig > 0 ? `<div class="verlauf-seg" style="flex:0 0 ${(r.unnoetig / Math.max(r.gesamt, 1) * 100).toFixed(2)}%;background:var(--unnoetig)" ${tip(`${monatLabel(r.monat)} – Impuls/Reue: ${eur(r.unnoetig)}`)}></div>` : ''}
        ${r.noetig > 0 ? `<div class="verlauf-seg" style="flex:1 1 auto;background:var(--noetig)" ${tip(`${monatLabel(r.monat)} – nötig/geplant: ${eur(r.noetig)}`)}></div>` : ''}
      </div>
    </div>`).join('');

  const achse = `<div class="verlauf-achse">${
    reihen.map((r) => `<span class="${r.monat === aktuellerMonat ? 'jetzt' : ''}">${esc(monatLabel(r.monat).split(' ')[0])}</span>`).join('')
  }</div>`;

  const legende = `<div class="legende">
    <span class="legende-eintrag"><span class="legende-punkt" style="background:var(--unnoetig)"></span>Impuls &amp; Reue</span>
    <span class="legende-eintrag"><span class="legende-punkt" style="background:var(--noetig)"></span>Fix, nötig, geplant</span>
    <span class="legende-eintrag" style="color:var(--muted)">Zahl über der Säule = € unnötig</span>
  </div>`;

  const tab = tabelle(['Monat', 'Unnötig', 'Quote', 'Gesamt'],
    reihen.map((r) => [esc(monatLabel(r.monat)), eur(r.unnoetig), prozent(r.unnoetig, r.gesamt), eur(r.gesamt)]));

  return karte('Verlauf', 'letzte 6 Monate', `<div class="verlauf">${saeulen}</div>${achse}${legende}`, tab);
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

/* ============================================================ Vergleich */

/** Hero-Block mit der Leitmetrik und den beiden Differenzen. */
export function leitmetrikBlock(v) {
  const k = v.kennzahlen[0];
  const dVor = k.jetzt - k.vorher;
  const dStart = k.start === null ? null : k.jetzt - k.start;
  const vormonatName = monatLabel(v.vorher.monat);

  let zeilen;
  if (v.istBaseline) {
    zeilen = `<span class="leit-delta neutral">Das ist dein Startmonat – ab hier wird verglichen.</span>`;
  } else {
    zeilen = `
      <span class="leit-delta ${deltaKlasse(dVor)}">${eurDelta(dVor)} ggü. ${esc(vormonatName)}</span>
      ${dStart === null ? '' : `<span class="leit-delta ${deltaKlasse(dStart)}">${eurDelta(dStart)} ggü. Start (${esc(monatLabel(v.basis))})</span>`}`;
  }

  return `<section class="leit">
    <div class="leit-label">€ unnötig im ${esc(monatLabel(v.monat))}</div>
    <div class="leit-wert">${eur(v.jetzt.unnoetig)}</div>
    <div class="leit-deltas">${zeilen}</div>
    <div class="leit-fuss">Impuls + Reue, ohne Fixkosten. Das ist das Geld, das am Monatsende fehlt.</div>
  </section>`;
}

/** Kennzahlentabelle: Start | Vormonat | dieser Monat, mit Differenz. */
export function kennzahlenVergleich(v) {
  const zeilen = v.kennzahlen.map((k) => {
    const d = k.jetzt - k.vorher;
    return `<tr${k.leit ? ' class="leit-zeile"' : ''}>
      <th scope="row">${esc(k.label)}</th>
      <td>${k.start === null ? '–' : eurKurz(k.start)}</td>
      <td>${eurKurz(k.vorher)}</td>
      <td>
        <span class="vgl-jetzt">${eurKurz(k.jetzt)}</span>
        ${v.istBaseline ? '' : `<span class="vgl-delta ${deltaKlasse(d, k.hoeherIstBesser)}">${eurDelta(d)}</span>`}
      </td>
    </tr>`;
  }).join('');

  return `<section class="chart-karte">
    <div class="chart-kopf"><span class="chart-titel">Kennzahlen im Vergleich</span></div>
    <div class="tabelle-scroll">
      <table class="tabelle vgl-tabelle">
        <thead><tr>
          <th>Kennzahl</th>
          <th>Start${v.basis ? ' (' + esc(monatLabel(v.basis).split(' ')[0]) + ')' : ''}</th>
          <th>${esc(monatLabel(v.vorher.monat).split(' ')[0])}</th>
          <th>${esc(monatLabel(v.monat).split(' ')[0])}</th>
        </tr></thead>
        <tbody>${zeilen}</tbody>
      </table>
    </div>
  </section>`;
}

/** Was ist teurer geworden, was billiger - die eigentlich handlungsleitende Liste. */
export function deltaListe(titel, eintraege, hinweisLeer, maxZeilen = 8) {
  const relevant = eintraege.filter((e) => e.delta !== 0 || e.jetzt > 0);
  if (!relevant.length) {
    return karte(titel, '', leer(hinweisLeer));
  }

  const schlechter = relevant.filter((e) => e.delta > 0).slice(0, maxZeilen);
  const besser = relevant.filter((e) => e.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, maxZeilen);

  const block = (liste, ueberschrift, klasse) => liste.length ? `
    <div class="delta-gruppe">
      <div class="feld-label">${esc(ueberschrift)}</div>
      ${liste.map((e) => `<div class="delta-zeile">
        <span class="delta-name">${esc(e.name)}</span>
        <span class="delta-jetzt">${eurKurz(e.jetzt)}</span>
        <span class="vgl-delta ${klasse}">${eurDelta(e.delta)}</span>
      </div>`).join('')}
    </div>` : '';

  const tab = tabelle(['Name', 'Vormonat', 'Dieser Monat', 'Differenz'],
    relevant.map((e) => [esc(e.name), eur(e.vorher), eur(e.jetzt), eurDelta(e.delta)]));

  return karte(titel, 'gegenüber Vormonat',
    block(schlechter, 'Teurer geworden', 'schlechter') + block(besser, 'Günstiger geworden', 'besser'),
    tab);
}
