/* AusgabenBro - Oberflaeche und Verdrahtung. */

import {
  STUFEN, URTEILE, KATEGORIEN_STANDARD, UNNOETIG_AB,
  betragParsen, zuEuro, eur, eurKurz, eurDelta, prozent, normStichwort,
  heute, monatVon, monatLabel, monatVerschieben, datumLesbar, tageSeit,
  id, esc, stufe, $, $$
} from './kern.js';

import { Store, SPEICHER, lesen, schreiben, configKodieren } from './daten.js';

import {
  monatsAuswertung, verlauf, vergleich, reueRanking, offeneReue,
  stichwortVorschlaege, alleStichwoerter, erfassteMonate
} from './auswertung.js';

import {
  notwendigkeitsChart, kategorieChart, stichwortChart, verlaufChart, reueChart,
  leitmetrikBlock, kennzahlenVergleich, deltaListe
} from './charts.js';

const store = new Store();

const LS_AUTO = 'ausgabenbro.autobuchung';

const ui = {
  ansicht: 'erfassen',
  monat: monatVon(heute()),
  richtung: 'ausgabe',
  kategorie: null,
  notwendigkeit: null,
  listeSuche: '',
  listeFilter: 'alle',
  zurueckgelegt: new Set()
};

/* ================================================================ Helfer */

function cfgWert(schluessel, fallback) {
  const c = store.daten.config || {};
  return c[schluessel] === undefined || c[schluessel] === '' ? fallback : c[schluessel];
}

function kategorien() {
  const roh = cfgWert('kategorien', null);
  if (roh) {
    try {
      const k = typeof roh === 'string' ? JSON.parse(roh) : roh;
      if (Array.isArray(k) && k.length) return k;
    } catch (err) { /* faellt auf Standard zurueck */ }
  }
  return KATEGORIEN_STANDARD;
}

function kategorienSetzen(liste) { store.configSchreiben('kategorien', JSON.stringify(liste)); }

function einkommenCent() { return Math.round((Number(cfgWert('einkommen', 0)) || 0) * 100); }

let toastTimer = null;
function toast(text, istFehler) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.toggle('fehler', Boolean(istFehler));
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, istFehler ? 5200 : 2600);
}

/* ================================================================= Theme */

function themeAnwenden(wert) {
  if (wert === 'hell') document.documentElement.setAttribute('data-theme', 'light');
  else if (wert === 'dunkel') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}

function themeUmschalten() {
  const dunkel = getComputedStyle(document.documentElement).getPropertyValue('color-scheme').trim() === 'dark';
  const neu = dunkel ? 'hell' : 'dunkel';
  schreiben(SPEICHER.theme, neu);
  themeAnwenden(neu);
}

/* ============================================================== Ansichten */

function ansichtSetzen(name) {
  ui.ansicht = name;
  $$('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === name)));
  $$('.view').forEach((v) => { v.hidden = v.dataset.view !== name; });
  zeichnen();
}

function zeichnen() {
  topbarZeichnen();
  reueBadgeZeichnen();
  if (ui.ansicht === 'erfassen')   erfassenZeichnen();
  if (ui.ansicht === 'uebersicht') uebersichtZeichnen();
  if (ui.ansicht === 'vergleich')  vergleichZeichnen();
  if (ui.ansicht === 'reue')       reueZeichnen();
  if (ui.ansicht === 'liste')      listeZeichnen();
  if (ui.ansicht === 'setup')      setupZeichnen();
}

function topbarZeichnen() {
  $('#monat-label').textContent = monatLabel(ui.monat);
  const punkt = $('#sync-dot');
  punkt.dataset.status = store.status;
  const offen = store.queue.length;
  punkt.title = {
    ok:      'Mit der Tabelle synchron' + (store.zuletztSync ? ' (' + new Date(store.zuletztSync).toLocaleTimeString('de-DE') + ')' : ''),
    sync:    'Synchronisiere' + (offen ? ' – ' + offen + ' offen' : '') + '…',
    fehler:  'Fehler: ' + (store.fehler || 'unbekannt') + (offen ? ' – ' + offen + ' Änderung(en) warten lokal' : ''),
    offline: 'Nicht verbunden – im Tab Setup einrichten'
  }[store.status] || '';
}

function reueBadgeZeichnen() {
  const offen = offeneReue(store.daten).length;
  const badge = $('#reue-badge');
  badge.textContent = String(offen);
  badge.hidden = offen === 0;
}

/* ------------------------------------------------------------- Erfassen */

function erfassenZeichnen() {
  const aktive = kategorien();
  if (ui.kategorie && !aktive.includes(ui.kategorie)) ui.kategorie = null;

  $('#kategorie-chips').innerHTML = aktive.map((k) =>
    `<button type="button" class="chip${k === ui.kategorie ? ' aktiv' : ''}" data-kategorie="${esc(k)}">${esc(k)}</button>`
  ).join('');

  const aktuell = normStichwort($('#stichwort').value);
  $('#stichwort-chips').innerHTML = stichwortVorschlaege(store.daten, 6).map((g) =>
    `<button type="button" class="chip${g.norm === aktuell ? ' aktiv' : ''}" data-stichwort="${esc(g.anzeige)}">${esc(g.anzeige)}</button>`
  ).join('');

  $('#stichwort-liste').innerHTML = alleStichwoerter(store.daten)
    .map((w) => `<option value="${esc(w)}">`).join('');

  $('#notwendigkeit-skala').innerHTML = STUFEN.map((s) =>
    `<button type="button" class="skala-stufe${s.wert === ui.notwendigkeit ? ' aktiv' : ''}"
       style="--stufe:var(${s.token})" data-stufe="${s.wert}" title="${esc(s.hinweis)}">
       <span class="skala-punkt"></span><span>${esc(s.kurz)}</span>
     </button>`).join('');

  $('#notwendigkeit-hint').textContent = ui.notwendigkeit === null
    ? 'bitte wählen' : stufe(ui.notwendigkeit).hinweis;

  const a = monatsAuswertung(store.daten, ui.monat);
  const heuteCent = (store.daten.ausgaben || [])
    .filter((x) => x.datum === heute())
    .reduce((s, x) => s + Math.round((Number(x.betrag) || 0) * 100), 0);

  $('#heute-leiste').innerHTML =
    `<span>Heute <strong>${eur(heuteCent)}</strong></span>
     <span>${esc(monatLabel(ui.monat))} <strong>${eur(a.gesamt)}</strong></span>
     <span>unn&ouml;tig <strong style="color:var(${a.unnoetig > 0 ? '--kritisch' : '--text'})">${eurKurz(a.unnoetig)}</strong></span>`;

  $('#zuletzt').innerHTML = zuletztHtml();
  bannerZeichnen();
}

function zuletztHtml() {
  const posten = [
    ...(store.daten.ausgaben  || []).map((x) => ({ ...x, art: 'Ausgaben' })),
    ...(store.daten.einnahmen || []).map((x) => ({ ...x, art: 'Einnahmen' }))
  ].sort((x, y) => String(y.erstellt || '').localeCompare(String(x.erstellt || ''))).slice(0, 5);

  if (!posten.length) return '';
  return `<div class="gruppe-kopf">Zuletzt erfasst</div>
    <div class="eintrag-liste">${posten.map(eintragHtml).join('')}</div>`;
}

function eintragHtml(p) {
  const istEinnahme = p.art === 'Einnahmen';
  const cent = Math.round((Number(p.betrag) || 0) * 100);
  const s = istEinnahme ? null : stufe(p.notwendigkeit);
  const meta = istEinnahme
    ? [datumLesbar(p.datum), p.quelle]
    : [datumLesbar(p.datum), s.kurz, p.stichwort];

  return `<div class="eintrag">
    <span class="eintrag-balken" style="--stufe:var(${istEinnahme ? '--gut' : s.token})"></span>
    <span class="eintrag-haupt">
      <span class="eintrag-titel">${esc(istEinnahme ? (p.quelle || 'Einnahme') : (p.kategorie || 'Ohne Kategorie'))}</span>
      <span class="eintrag-meta">${esc(meta.filter(Boolean).join(' · '))}</span>
    </span>
    <span class="eintrag-betrag${istEinnahme ? ' plus' : ''}">${istEinnahme ? '+' : ''}${eur(cent)}</span>
    <button type="button" class="eintrag-aktion" data-loeschen="${esc(p.id)}" data-blatt="${p.art}" title="Löschen">&times;</button>
  </div>`;
}

/* --------------------------------------------------------------- Banner */

function bannerZeichnen() {
  // Monatsabschluss des Vormonats, einmal pro Monat.
  const dieserMonat = monatVon(heute());
  const vormonat = monatVerschieben(dieserMonat, -1);
  const gesehen = cfgWert('abschlussGesehen', '');
  const v = monatsAuswertung(store.daten, vormonat);

  $('#monatsabschluss').innerHTML = (gesehen !== dieserMonat && !v.leer)
    ? `<div class="banner">
        <div class="banner-text">
          <strong>${esc(monatLabel(vormonat))} ist abgeschlossen.</strong>
          ${eur(v.unnoetig)} unnötig bei ${eur(v.gesamt)} Ausgaben.
        </div>
        <div class="banner-aktionen">
          <button type="button" class="btn-ghost" data-banner="vergleich">Vergleich ansehen</button>
          <button type="button" class="btn-ghost" data-banner="abschluss-ok">Ok</button>
        </div>
      </div>`
    : '';

  // Automatikbuchung mit Rueckgaengig-Moeglichkeit.
  const auto = lesen(LS_AUTO, null);
  let autoText = '';
  if (auto && auto.monat === dieserMonat && auto.posten && auto.posten.length) {
    const fix  = auto.posten.filter((p) => p.blatt === 'Ausgaben');
    const eink = auto.posten.filter((p) => p.blatt === 'Einnahmen');
    const summe = (liste) => liste.reduce((s, p) => s + p.cent, 0);
    const teile = [];
    if (fix.length)  teile.push(`<strong>${fix.length} Fixkosten</strong> (${eur(summe(fix))})`);
    if (eink.length) teile.push(`<strong>Einkommen</strong> (${eur(summe(eink))})`);
    autoText = `Für ${esc(monatLabel(dieserMonat))} automatisch gebucht: ${teile.join(' und ')}.`;
  }

  $('#autobuchung').innerHTML = autoText
    ? `<div class="banner">
        <div class="banner-text">${autoText}</div>
        <div class="banner-aktionen">
          <button type="button" class="btn-ghost" data-banner="auto-undo">Rückgängig</button>
          <button type="button" class="btn-ghost" data-banner="auto-ok">Passt</button>
        </div>
      </div>`
    : '';
}

/* ------------------------------------------------------------ Uebersicht */

function uebersichtZeichnen() {
  const a = monatsAuswertung(store.daten, ui.monat);

  $('#kpis').innerHTML = `
    ${kpi('€ unnötig', eurKurz(a.unnoetig), 'Impuls + Reue', a.unnoetig > 0)}
    ${kpi('Ausgaben', eurKurz(a.gesamt), a.einkommen ? prozent(a.gesamt, a.einkommen) + ' des Einkommens' : monatLabel(a.monat))}
    ${kpi('Unnötig-Quote', prozent(a.unnoetig, a.variabel), 'vom beeinflussbaren Teil')}
    ${kpi('Saldo', (a.saldo >= 0 ? '+' : '') + eurKurz(a.saldo), a.einkommen ? 'Einnahmen minus Ausgaben' : 'kein Einkommen erfasst', a.saldo < 0)}
  `;

  $('#charts').innerHTML = hinweiseFuer(a)
    + notwendigkeitsChart(a)
    + kategorieChart(a)
    + stichwortChart(a)
    + reueChart(reueRanking(store.daten));
}

function kpi(label, wert, sub, alarm) {
  return `<div class="kpi">
    <span class="kpi-label">${esc(label)}</span>
    <span class="kpi-wert${alarm ? ' alarm' : ''}">${esc(wert)}</span>
    <span class="kpi-sub">${esc(sub)}</span>
  </div>`;
}

/** Ein bis zwei konkrete Saetze statt eines Zahlenfriedhofs. */
function hinweiseFuer(a) {
  if (!a.gesamt) return '';
  const zeilen = [];

  const topKat = a.kategorien.filter((k) => k.unnoetig > 0).sort((x, y) => y.unnoetig - x.unnoetig)[0];
  if (topKat) {
    zeilen.push(`<strong>${esc(topKat.name)}</strong> ist dein größter Impuls-Posten: ${eur(topKat.unnoetig)} von ${eur(topKat.cent)}.`);
  }

  const topWort = a.stichwoerter.filter((w) => w.anzahl >= 2)[0];
  if (topWort) {
    zeilen.push(`<strong>${esc(topWort.anzeige)}</strong>: ${eur(topWort.cent)} in ${topWort.anzahl} Buchungen – im Schnitt ${eur(Math.round(topWort.cent / topWort.anzahl))} pro Mal.`);
  }

  if (!zeilen.length) return '';
  return zeilen.slice(0, 2).map((t) =>
    `<div class="hinweis-zeile" style="margin-top:10px"><span class="hinweis-icon">→</span><span>${t}</span></div>`
  ).join('');
}

/* ------------------------------------------------------------- Vergleich */

function vergleichZeichnen() {
  const monate = erfassteMonate(store.daten);
  const ziel = $('#vergleich-inhalt');

  if (!monate.length) {
    ziel.innerHTML = `<div class="card">
      <h2>Noch nichts zu vergleichen</h2>
      <p class="hilfe">Sobald der erste Monat erfasst ist, wird er zur Basis. Ab dem zweiten Monat siehst du hier, was besser und was schlechter geworden ist.</p>
    </div>`;
    return;
  }

  const v = vergleich(store.daten, ui.monat);
  ziel.innerHTML =
      leitmetrikBlock(v)
    + kennzahlenVergleich(v)
    + deltaListe('Kategorien', v.kategorien, 'In diesem und im Vormonat nichts erfasst.')
    + deltaListe('Stichwörter', v.stichwoerter, 'Noch keine Stichwörter vergeben.')
    + verlaufChart(verlauf(store.daten, ui.monat, 6), ui.monat);
}

/* ------------------------------------------------------------------ Reue */

function reueZeichnen() {
  const alle = offeneReue(store.daten);
  let offen = alle.filter((a) => !ui.zurueckgelegt.has(String(a.id)));
  if (!offen.length && alle.length) { ui.zurueckgelegt.clear(); offen = alle; }
  const ziel = $('#reue-inhalt');

  if (!offen.length) {
    ziel.innerHTML = `<div class="card">
      <h2>Nichts zu bewerten</h2>
      <p class="hilfe">Hier tauchen Ausgaben auf, sobald sie mindestens 7 Tage alt sind. Der Abstand ist Absicht: direkt nach dem Kauf fällt die Bewertung systematisch zu positiv aus.</p>
    </div>
    ${reueChart(reueRanking(store.daten))}`;
    return;
  }

  const p = offen[0];
  const cent = Math.round((Number(p.betrag) || 0) * 100);
  const s = stufe(p.notwendigkeit);

  ziel.innerHTML = `
    <div class="reue-karte">
      <div class="reue-wann">vor ${tageSeit(p.datum)} Tagen · ${esc(s.kurz)}</div>
      <div class="reue-betrag">${eur(cent)}</div>
      <div class="reue-wo">${esc(p.kategorie || 'Ohne Kategorie')}${p.stichwort ? ' – ' + esc(p.stichwort) : ''}</div>
      <div class="reue-knoepfe">
        ${URTEILE.map((u) => `<button type="button" class="reue-knopf" style="--urteil:var(${u.token})" data-urteil="${u.wert}" data-satz="${esc(p.id)}">
          <span class="reue-icon">${u.icon}</span><span>${esc(u.label)}</span>
        </button>`).join('')}
      </div>
      <button type="button" class="tabelle-umschalter" data-ueberspringen="${esc(p.id)}">später</button>
    </div>
    <div class="hinweis-zeile"><span class="hinweis-icon">\u{1F4CA}</span><span>Noch <strong>${offen.length}</strong> offen. Jede Bewertung schärft das Reue-Ranking.</span></div>
    ${reueChart(reueRanking(store.daten))}`;
}

/* ----------------------------------------------------------------- Liste */

function listeZeichnen() {
  const suche = ui.listeSuche.toLowerCase().trim();
  const filter = ui.listeFilter;

  let posten = [
    ...(store.daten.ausgaben  || []).map((x) => ({ ...x, art: 'Ausgaben' })),
    ...(store.daten.einnahmen || []).map((x) => ({ ...x, art: 'Einnahmen' }))
  ].filter((p) => monatVon(p.datum) === ui.monat);

  if (filter === 'unnoetig')  posten = posten.filter((p) => p.art === 'Ausgaben' && (Number(p.notwendigkeit) || 0) >= UNNOETIG_AB);
  if (filter === 'einnahmen') posten = posten.filter((p) => p.art === 'Einnahmen');

  if (suche) {
    posten = posten.filter((p) => [p.kategorie, p.stichwort, p.quelle]
      .filter(Boolean).join(' ').toLowerCase().includes(suche));
  }

  posten.sort((x, y) => String(y.datum).localeCompare(String(x.datum))
                     || String(y.erstellt || '').localeCompare(String(x.erstellt || '')));

  if (!posten.length) {
    $('#liste-inhalt').innerHTML = `<p class="leer">Keine Einträge für diesen Filter.</p>`;
    return;
  }

  const gruppen = new Map();
  for (const p of posten) {
    if (!gruppen.has(p.datum)) gruppen.set(p.datum, []);
    gruppen.get(p.datum).push(p);
  }

  const summe = posten.filter((p) => p.art === 'Ausgaben')
    .reduce((s, p) => s + Math.round((Number(p.betrag) || 0) * 100), 0);

  $('#liste-inhalt').innerHTML =
    `<div class="heute-leiste"><span>${posten.length} Eintr&auml;ge</span><span>Ausgaben <strong>${eur(summe)}</strong></span></div>` +
    Array.from(gruppen.entries()).map(([datum, liste]) =>
      `<div class="gruppe-kopf">${esc(datumLesbar(datum))}</div>
       <div class="eintrag-liste">${liste.map(eintragHtml).join('')}</div>`
    ).join('');
}

/* ----------------------------------------------------------------- Setup */

function setupZeichnen() {
  if (store.cfg) {
    if (!$('#cfg-url').value) $('#cfg-url').value = store.cfg.url || '';
    if (!$('#cfg-token').value) $('#cfg-token').value = store.cfg.token || '';
  }
  if (!$('#cfg-einkommen').value) {
    const e = einkommenCent();
    if (e) $('#cfg-einkommen').value = String(zuEuro(e)).replace('.', ',');
  }

  const status = $('#cfg-status');
  if (store.status === 'ok') {
    status.innerHTML = `<p class="hilfe" style="color:var(--gut-text)">Verbunden. ${(store.daten.ausgaben || []).length} Ausgaben, ${(store.daten.einnahmen || []).length} Einnahmen in der Tabelle.</p>`;
  } else if (store.status === 'fehler') {
    status.innerHTML = `<p class="hilfe" style="color:var(--kritisch)">${esc(store.fehler || 'Fehler')}</p>`;
  } else if (!store.verbunden()) {
    status.innerHTML = `<p class="hilfe">Noch nicht verbunden – Einträge bleiben nur in diesem Browser.</p>`;
  } else {
    status.innerHTML = '';
  }

  const kats = kategorien();
  $('#v-kategorie').innerHTML = kats.map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join('');

  $('#vorlagen-liste').innerHTML = vorlagenListeHtml(store.daten.vorlagen || []);

  $('#kategorie-verwaltung').innerHTML = kats.map((k) =>
    `<span class="chip">${esc(k)}<button type="button" class="chip-loeschen" data-kat-weg="${esc(k)}" title="Entfernen">&times;</button></span>`
  ).join('');

  const offen = store.queue.length;
  $('#daten-info').textContent =
    `${(store.daten.ausgaben || []).length} Ausgaben, ${(store.daten.einnahmen || []).length} Einnahmen lokal.`
    + (offen ? ` ${offen} Änderung(en) warten auf die Tabelle.` : '')
    + (store.zuletztSync ? ` Letzter Abgleich: ${new Date(store.zuletztSync).toLocaleString('de-DE')}.` : '');
}

function vorlagenListeHtml(vorlagen) {
  if (!vorlagen.length) return `<p class="leer">Noch keine Fixkosten hinterlegt.</p>`;
  const summe = vorlagen.reduce((s, v) => s + Math.round((Number(v.betrag) || 0) * 100), 0);
  return `<div class="eintrag-liste">${vorlagen.map((v) => `<div class="eintrag">
      <span class="eintrag-balken" style="--stufe:var(--n0)"></span>
      <span class="eintrag-haupt">
        <span class="eintrag-titel">${esc(v.name)}</span>
        <span class="eintrag-meta">${esc(v.kategorie || '')} · am ${esc(String(v.tag || 1))}.</span>
      </span>
      <span class="eintrag-betrag">${eur(Math.round((Number(v.betrag) || 0) * 100))}</span>
      <button type="button" class="eintrag-aktion" data-loeschen="${esc(v.id)}" data-blatt="Vorlagen" title="Löschen">&times;</button>
    </div>`).join('')}</div>
    <p class="hilfe">Summe: <strong>${eur(summe)}</strong> pro Monat.</p>`;
}

/* ------------------------------------------------- Automatische Buchungen */

/**
 * Bucht Einkommen und Fixkosten fuer den laufenden Monat. Laeuft nur nach
 * einem erfolgreichen Abgleich, damit zwei Geraete nicht beide buchen, und
 * prueft zusaetzlich gegen bereits vorhandene Eintraege.
 */
let buchtGerade = false;

function autoBuchen() {
  // Jede Buchung meldet eine Aenderung, die wieder hier landen wuerde -
  // bis die Config am Ende geschrieben ist, greift der Monatsschutz nicht.
  if (buchtGerade) return;
  if (cfgWert('onboarding', '') !== 'fertig') return;
  // Eingerichtet, aber noch nicht abgeglichen: erst den Stand der Tabelle
  // abwarten, sonst bucht ein zweites Geraet dieselben Posten nochmal.
  if (store.verbunden() && store.status !== 'ok') return;

  const monat = monatVon(heute());
  if (cfgWert('zuletztGebucht', '') === monat) return;

  buchtGerade = true;
  try {
    autoBuchenIntern(monat);
  } finally {
    buchtGerade = false;
  }
}

function autoBuchenIntern(monat) {
  const posten = [];
  const vorhandeneFix = new Set((store.daten.ausgaben || [])
    .filter((a) => monatVon(a.datum) === monat && Number(a.notwendigkeit) === 0)
    .map((a) => normStichwort(a.stichwort)));

  for (const v of (store.daten.vorlagen || [])) {
    if (String(v.aktiv) === 'nein') continue;
    if (vorhandeneFix.has(normStichwort(v.name))) continue;
    const tag = Math.min(Math.max(Number(v.tag) || 1, 1), 28);
    const satz = {
      id: id(), erstellt: new Date().toISOString(),
      datum: monat + '-' + String(tag).padStart(2, '0'),
      betrag: Number(v.betrag) || 0,
      kategorie: v.kategorie || 'Wohnen',
      notwendigkeit: 0, stichwort: v.name, reue: '', reueAm: ''
    };
    store.ausgabeSpeichern(satz);
    posten.push({ blatt: 'Ausgaben', id: satz.id, cent: Math.round(satz.betrag * 100) });
  }

  const eink = einkommenCent();
  const schonGebucht = (store.daten.einnahmen || [])
    .some((e) => monatVon(e.datum) === monat && String(e.quelle || '').startsWith('Einkommen'));
  if (eink > 0 && !schonGebucht) {
    const satz = {
      id: id(), erstellt: new Date().toISOString(), datum: monat + '-01',
      betrag: zuEuro(eink), quelle: 'Einkommen', notiz: 'automatisch gebucht'
    };
    store.einnahmeSpeichern(satz);
    posten.push({ blatt: 'Einnahmen', id: satz.id, cent: eink });
  }

  store.configSchreiben('zuletztGebucht', monat);

  if (posten.length) {
    schreiben(LS_AUTO, { monat, posten });
  }
}

function autoRueckgaengig() {
  const auto = lesen(LS_AUTO, null);
  if (!auto) return;
  for (const p of auto.posten) store.loeschen(p.blatt, p.id);
  schreiben(LS_AUTO, null);
  store.configSchreiben('zuletztGebucht', '');
  toast(`${auto.posten.length} automatische Buchungen entfernt.`);
}

/* --------------------------------------------------------------- Export */

function herunterladen(dateiname, inhalt, typ) {
  try {
    const blob = new Blob([inhalt], { type: typ + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = dateiname;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err) {
    toast('Download im Embed blockiert – öffne die Seite in einem eigenen Tab.', true);
  }
}

function csvExport() {
  const spalten = ['datum', 'betrag', 'kategorie', 'stichwort', 'notwendigkeit', 'stufe', 'reue'];
  const zeilen = [spalten.join(';')];
  for (const a of store.daten.ausgaben || []) {
    zeilen.push([
      a.datum, String(Number(a.betrag) || 0).replace('.', ','),
      a.kategorie, a.stichwort, a.notwendigkeit, stufe(a.notwendigkeit).name, a.reue
    ].map((f) => `"${String(f == null ? '' : f).replace(/"/g, '""')}"`).join(';'));
  }
  herunterladen('ausgabenbro-' + heute() + '.csv', '﻿' + zeilen.join('\r\n'), 'text/csv');
}

/* ============================================================ Onboarding */

const ob = { index: 0, einkommen: '', vorlagen: [], kategorien: null, uebersprungen: false };

const OB_SCHRITTE = [
  {
    titel: 'Verbindung zur Tabelle',
    render: () => `
      <p class="hilfe">Die App speichert alles in deiner eigenen Google-Tabelle. Beide Werte stehen in der Anleitung (README, Schritt 1).</p>
      <label class="feld-label" for="ob-url">Web-App-URL (endet auf /exec)</label>
      <input type="url" id="ob-url" class="eingabe" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(store.cfg ? store.cfg.url : '')}">
      <label class="feld-label" for="ob-token">Token</label>
      <input type="password" id="ob-token" class="eingabe" placeholder="dein Token" value="${esc(store.cfg ? store.cfg.token : '')}">
      <button type="button" class="tabelle-umschalter" data-ob="ueberspringen">Erstmal ohne Tabelle ausprobieren</button>`,
    weiter: async () => {
      const url = $('#ob-url').value.trim();
      const token = $('#ob-token').value.trim();
      if (!url && !token) { toast('URL und Token eintragen – oder unten ohne Tabelle fortfahren.', true); return false; }
      if (!/^https:\/\/script\.google\.com\/.*\/exec$/.test(url)) {
        toast('Die URL muss mit https://script.google.com/ beginnen und auf /exec enden.', true); return false;
      }
      $('#ob-weiter').disabled = true;
      $('#ob-weiter').textContent = 'Teste…';
      const ok = await store.configSetzen({ url, token });
      $('#ob-weiter').disabled = false;
      $('#ob-weiter').textContent = 'Weiter';
      if (!ok) { toast(store.fehler || 'Verbindung fehlgeschlagen.', true); return false; }
      // Wer schon eingerichtet war, muss den Rest nicht nochmal durchlaufen.
      if (cfgWert('onboarding', '') === 'fertig') { onboardingBeenden(false); return false; }
      return true;
    }
  },
  {
    titel: 'Monatliches Einkommen',
    render: () => `
      <p class="hilfe">Dein normales Netto pro Monat. Wird ab jetzt zu Monatsbeginn automatisch gebucht – Abweichungen trägst du einfach nach.</p>
      <label class="betrag-feld"><span class="betrag-waehrung">&euro;</span>
        <input type="text" id="ob-einkommen" inputmode="decimal" placeholder="0,00" value="${esc(ob.einkommen)}" aria-label="Monatliches Einkommen">
      </label>`,
    weiter: () => {
      const roh = $('#ob-einkommen').value.trim();
      if (roh) {
        const c = betragParsen(roh);
        if (!Number.isFinite(c) || c < 0) { toast('Betrag prüfen.', true); return false; }
        ob.einkommen = roh;
      } else { ob.einkommen = ''; }
      return true;
    }
  },
  {
    titel: 'Fixkosten',
    render: () => `
      <p class="hilfe">Alles, was jeden Monat gleich abgeht: Miete, Versicherungen, Abos, Handyvertrag. Wird automatisch als Stufe&nbsp;0 gebucht und aus der Unnötig-Quote herausgerechnet.</p>
      <div id="ob-vorlagen">${obVorlagenHtml()}</div>
      <div class="vorlage-form">
        <input type="text" id="ob-v-name" class="eingabe" placeholder="Bezeichnung">
        <input type="text" id="ob-v-betrag" class="eingabe" inputmode="decimal" placeholder="Betrag">
        <select id="ob-v-kategorie" class="eingabe">${
          (ob.kategorien || kategorien()).map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join('')
        }</select>
        <button type="button" class="btn-ghost" data-ob="vorlage-add">Hinzuf&uuml;gen</button>
      </div>`,
    weiter: () => true
  },
  {
    titel: 'Kategorien',
    render: () => `
      <p class="hilfe">Grobe Schubladen reichen – die Feinheit kommt später über Stichwörter. Du kannst das jederzeit ändern.</p>
      <div class="chips" id="ob-kategorien">${
        (ob.kategorien || kategorien()).map((k) =>
          `<span class="chip">${esc(k)}<button type="button" class="chip-loeschen" data-ob-kat-weg="${esc(k)}">&times;</button></span>`
        ).join('')
      }</div>
      <div class="vorlage-form">
        <input type="text" id="ob-k-name" class="eingabe" placeholder="Neue Kategorie">
        <button type="button" class="btn-ghost" data-ob="kat-add">Hinzuf&uuml;gen</button>
      </div>`,
    weiter: () => true
  },
  {
    titel: 'Fertig',
    render: () => {
      const kats = ob.kategorien || kategorien();
      const fix = ob.vorlagen.reduce((s, v) => s + Math.round((Number(v.betrag) || 0) * 100), 0);
      const eink = ob.einkommen ? betragParsen(ob.einkommen) : 0;
      return `
        <p class="hilfe">Das war's. Ab jetzt: Betrag, Kategorie, Stichwort, Notwendigkeit – vier Taps pro Ausgabe.</p>
        <div class="ob-zusammenfassung">
          <div><span>Einkommen</span><strong>${eink ? eur(eink) : '–'}</strong></div>
          <div><span>Fixkosten</span><strong>${ob.vorlagen.length} Posten, ${eur(fix)}</strong></div>
          <div><span>Rechnerisch frei</span><strong>${eink ? eur(eink - fix) : '–'}</strong></div>
          <div><span>Kategorien</span><strong>${kats.length}</strong></div>
        </div>
        <p class="hilfe">Einkommen und Fixkosten für ${esc(monatLabel(monatVon(heute())))} werden gleich gebucht.</p>`;
    },
    weiter: () => { onboardingAbschliessen(); return false; }
  }
];

function obVorlagenHtml() {
  if (!ob.vorlagen.length) return `<p class="leer">Noch nichts eingetragen.</p>`;
  return `<div class="eintrag-liste">${ob.vorlagen.map((v, i) => `<div class="eintrag">
    <span class="eintrag-balken" style="--stufe:var(--n0)"></span>
    <span class="eintrag-haupt">
      <span class="eintrag-titel">${esc(v.name)}</span>
      <span class="eintrag-meta">${esc(v.kategorie)}</span>
    </span>
    <span class="eintrag-betrag">${eur(Math.round((Number(v.betrag) || 0) * 100))}</span>
    <button type="button" class="eintrag-aktion" data-ob-v-weg="${i}">&times;</button>
  </div>`).join('')}</div>`;
}

function onboardingZeichnen() {
  const schritt = OB_SCHRITTE[ob.index];
  $('#ob-fortschritt').innerHTML = OB_SCHRITTE.map((s, i) =>
    `<span class="ob-punkt${i === ob.index ? ' aktiv' : ''}${i < ob.index ? ' erledigt' : ''}"></span>`
  ).join('') + `<span class="ob-schritt-name">${esc(schritt.titel)}</span>`;
  $('#ob-inhalt').innerHTML = schritt.render();
  $('#ob-zurueck').hidden = ob.index === 0;
  $('#ob-weiter').textContent = ob.index === OB_SCHRITTE.length - 1 ? 'Loslegen' : 'Weiter';
}

function onboardingStarten() {
  ob.index = 0;
  ob.vorlagen = (store.daten.vorlagen || []).map((v) => ({ name: v.name, betrag: v.betrag, kategorie: v.kategorie, tag: v.tag || 1 }));
  ob.kategorien = kategorien().slice();
  const e = einkommenCent();
  ob.einkommen = e ? String(zuEuro(e)).replace('.', ',') : '';
  $('#onboarding').hidden = false;
  onboardingZeichnen();
}

function onboardingBeenden(meldung) {
  $('#onboarding').hidden = true;
  if (meldung) toast(meldung);
  ansichtSetzen('erfassen');
}

function onboardingAbschliessen() {
  const vorhandene = store.daten.vorlagen || [];
  const behalten = new Set();

  for (const v of ob.vorlagen) {
    const treffer = vorhandene.find((x) => normStichwort(x.name) === normStichwort(v.name));
    const satz = {
      id: treffer ? treffer.id : id(),
      name: v.name, betrag: Number(v.betrag) || 0,
      kategorie: v.kategorie, tag: v.tag || 1, aktiv: 'ja',
      zuletzt: treffer ? treffer.zuletzt : ''
    };
    behalten.add(satz.id);
    store.vorlageSpeichern(satz);
  }
  for (const alt of vorhandene) if (!behalten.has(alt.id)) store.loeschen('Vorlagen', alt.id);

  if (ob.kategorien && ob.kategorien.length) kategorienSetzen(ob.kategorien);
  store.configSchreiben('einkommen', ob.einkommen ? zuEuro(betragParsen(ob.einkommen)) : '');
  store.configSchreiben('onboarding', 'fertig');
  store.configSchreiben('zuletztGebucht', '');

  autoBuchen();
  onboardingBeenden('Eingerichtet. Los geht’s.');
}

function onboardingVerdrahten() {
  $('#ob-weiter').addEventListener('click', async () => {
    const schritt = OB_SCHRITTE[ob.index];
    const weiter = await schritt.weiter();
    if (weiter === false) return;
    ob.index = Math.min(ob.index + 1, OB_SCHRITTE.length - 1);
    onboardingZeichnen();
  });

  $('#ob-zurueck').addEventListener('click', () => {
    ob.index = Math.max(ob.index - 1, 0);
    onboardingZeichnen();
  });

  $('#onboarding').addEventListener('click', (e) => {
    const aktion = e.target.closest('[data-ob]');
    if (aktion) {
      if (aktion.dataset.ob === 'ueberspringen') {
        ob.uebersprungen = true;
        ob.index = 1;
        onboardingZeichnen();
        toast('Ohne Tabelle: Daten bleiben nur in diesem Browser.');
      }
      if (aktion.dataset.ob === 'vorlage-add') {
        const name = $('#ob-v-name').value.trim();
        const cent = betragParsen($('#ob-v-betrag').value);
        if (!name) { toast('Bezeichnung fehlt.', true); return; }
        if (!Number.isFinite(cent) || cent <= 0) { toast('Betrag prüfen.', true); return; }
        ob.vorlagen.push({ name, betrag: zuEuro(cent), kategorie: $('#ob-v-kategorie').value, tag: 1 });
        $('#ob-v-name').value = ''; $('#ob-v-betrag').value = '';
        $('#ob-vorlagen').innerHTML = obVorlagenHtml();
        $('#ob-v-name').focus();
      }
      if (aktion.dataset.ob === 'kat-add') {
        const name = $('#ob-k-name').value.trim();
        if (!name) return;
        ob.kategorien = ob.kategorien || kategorien().slice();
        if (!ob.kategorien.includes(name)) ob.kategorien.push(name);
        $('#ob-k-name').value = '';
        onboardingZeichnen();
      }
      return;
    }

    const vWeg = e.target.closest('[data-ob-v-weg]');
    if (vWeg) {
      ob.vorlagen.splice(Number(vWeg.dataset.obVWeg), 1);
      $('#ob-vorlagen').innerHTML = obVorlagenHtml();
      return;
    }

    const kWeg = e.target.closest('[data-ob-kat-weg]');
    if (kWeg) {
      ob.kategorien = (ob.kategorien || kategorien()).filter((k) => k !== kWeg.dataset.obKatWeg);
      onboardingZeichnen();
    }
  });
}

/* ========================================================= Verdrahtung */

function verdrahten() {
  $$('.tab').forEach((t) => t.addEventListener('click', () => ansichtSetzen(t.dataset.view)));

  $('#monat-zurueck').addEventListener('click', () => { ui.monat = monatVerschieben(ui.monat, -1); zeichnen(); });
  $('#monat-vor').addEventListener('click',     () => { ui.monat = monatVerschieben(ui.monat,  1); zeichnen(); });

  $('#theme-toggle').addEventListener('click', themeUmschalten);
  $('#sync-dot').addEventListener('click', () => {
    if (!store.verbunden()) { ansichtSetzen('setup'); return; }
    store.synchronisieren().then((ok) => toast(ok ? 'Abgeglichen.' : (store.fehler || 'Abgleich fehlgeschlagen.'), !ok));
  });

  $('#richtung').addEventListener('click', (e) => {
    const b = e.target.closest('[data-richtung]');
    if (!b) return;
    ui.richtung = b.dataset.richtung;
    $$('#richtung button').forEach((x) => x.classList.toggle('aktiv', x === b));
    $('#form-ausgabe').hidden  = ui.richtung !== 'ausgabe';
    $('#form-einnahme').hidden = ui.richtung !== 'einnahme';
  });

  $('#kategorie-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-kategorie]');
    if (!b) return;
    ui.kategorie = ui.kategorie === b.dataset.kategorie ? null : b.dataset.kategorie;
    erfassenZeichnen();
  });

  $('#stichwort-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-stichwort]');
    if (!b) return;
    const feld = $('#stichwort');
    feld.value = normStichwort(feld.value) === normStichwort(b.dataset.stichwort) ? '' : b.dataset.stichwort;
    erfassenZeichnen();
  });
  $('#stichwort').addEventListener('input', () => {
    const aktuell = normStichwort($('#stichwort').value);
    $$('#stichwort-chips .chip').forEach((c) =>
      c.classList.toggle('aktiv', normStichwort(c.dataset.stichwort) === aktuell));
  });

  $('#notwendigkeit-skala').addEventListener('click', (e) => {
    const b = e.target.closest('[data-stufe]');
    if (!b) return;
    ui.notwendigkeit = Number(b.dataset.stufe);
    erfassenZeichnen();
  });

  $('#form-ausgabe').addEventListener('submit', (e) => {
    e.preventDefault();
    const cent = betragParsen($('#betrag').value);
    if (!Number.isFinite(cent) || cent <= 0) { toast('Bitte einen Betrag eingeben.', true); $('#betrag').focus(); return; }
    if (!ui.kategorie) { toast('Bitte eine Kategorie wählen.', true); return; }
    if (ui.notwendigkeit === null) { toast('Bitte die Notwendigkeit wählen – das ist der Kern der Auswertung.', true); return; }

    const datum = $('#datum').value || heute();
    store.ausgabeSpeichern({
      id: id(), erstellt: new Date().toISOString(), datum,
      betrag: zuEuro(cent),
      kategorie: ui.kategorie,
      notwendigkeit: ui.notwendigkeit,
      stichwort: $('#stichwort').value.trim(),
      reue: '', reueAm: ''
    });

    if (monatVon(datum) !== ui.monat) ui.monat = monatVon(datum);
    $('#betrag').value = '';
    $('#stichwort').value = '';
    ui.notwendigkeit = null;
    toast(eur(cent) + ' erfasst.');
    $('#betrag').focus();
    zeichnen();
  });

  $('#form-einnahme').addEventListener('submit', (e) => {
    e.preventDefault();
    const cent = betragParsen($('#e-betrag').value);
    if (!Number.isFinite(cent) || cent <= 0) { toast('Bitte einen Betrag eingeben.', true); return; }
    const datum = $('#e-datum').value || heute();
    store.einnahmeSpeichern({
      id: id(), erstellt: new Date().toISOString(), datum,
      betrag: zuEuro(cent),
      quelle: $('#e-quelle').value.trim() || 'Einnahme',
      notiz: ''
    });
    if (monatVon(datum) !== ui.monat) ui.monat = monatVon(datum);
    $('#e-betrag').value = '';
    toast('+' + eur(cent) + ' erfasst.');
    zeichnen();
  });

  // Delegation fuer alles, was in neu gerenderten Bloecken sitzt.
  $('#main').addEventListener('click', (e) => {
    const weg = e.target.closest('[data-loeschen]');
    if (weg) { store.loeschen(weg.dataset.blatt, weg.dataset.loeschen); toast('Gelöscht.'); zeichnen(); return; }

    const urteil = e.target.closest('[data-urteil]');
    if (urteil) {
      const satz = (store.daten.ausgaben || []).find((a) => String(a.id) === urteil.dataset.satz);
      if (satz) { store.ausgabeSpeichern({ ...satz, reue: urteil.dataset.urteil, reueAm: heute() }); zeichnen(); }
      return;
    }

    const spaeter = e.target.closest('[data-ueberspringen]');
    if (spaeter) { ui.zurueckgelegt.add(spaeter.dataset.ueberspringen); reueZeichnen(); return; }

    const katWeg = e.target.closest('[data-kat-weg]');
    if (katWeg) { kategorienSetzen(kategorien().filter((k) => k !== katWeg.dataset.katWeg)); zeichnen(); return; }

    const banner = e.target.closest('[data-banner]');
    if (banner) {
      const was = banner.dataset.banner;
      if (was === 'vergleich') { store.configSchreiben('abschlussGesehen', monatVon(heute())); ui.monat = monatVerschieben(monatVon(heute()), -1); ansichtSetzen('vergleich'); }
      if (was === 'abschluss-ok') { store.configSchreiben('abschlussGesehen', monatVon(heute())); zeichnen(); }
      if (was === 'auto-undo') { autoRueckgaengig(); zeichnen(); }
      if (was === 'auto-ok') { schreiben(LS_AUTO, null); zeichnen(); }
    }
  });

  $('#liste-suche').addEventListener('input', (e) => { ui.listeSuche = e.target.value; listeZeichnen(); });
  $('#liste-filter').addEventListener('change', (e) => { ui.listeFilter = e.target.value; listeZeichnen(); });

  $('#cfg-speichern').addEventListener('click', async () => {
    const url = $('#cfg-url').value.trim();
    const token = $('#cfg-token').value.trim();
    if (!/^https:\/\/script\.google\.com\/.*\/exec$/.test(url)) {
      toast('Die URL muss mit https://script.google.com/ beginnen und auf /exec enden.', true); return;
    }
    if (!token) { toast('Token fehlt.', true); return; }
    const ok = await store.configSetzen({ url, token });
    toast(ok ? 'Verbunden.' : (store.fehler || 'Verbindung fehlgeschlagen.'), !ok);
    zeichnen();
  });

  $('#cfg-link').addEventListener('click', () => {
    if (!store.verbunden()) { toast('Erst verbinden.', true); return; }
    const link = location.origin + location.pathname + '#c=' + configKodieren(store.cfg);
    const feld = document.createElement('input');
    feld.className = 'eingabe'; feld.readOnly = true; feld.value = link; feld.style.marginTop = '8px';
    $('#cfg-status').innerHTML = '<p class="hilfe">Diesen Link in Notion als Embed einbetten. Er enthält dein Token – also nur auf Seiten, die du nicht teilst.</p>';
    $('#cfg-status').appendChild(feld);
    feld.select();
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => toast('Link kopiert.'), () => {});
  });

  $('#cfg-einkommen-speichern').addEventListener('click', () => {
    const roh = $('#cfg-einkommen').value.trim();
    const cent = roh ? betragParsen(roh) : 0;
    if (roh && (!Number.isFinite(cent) || cent < 0)) { toast('Betrag prüfen.', true); return; }
    store.configSchreiben('einkommen', roh ? zuEuro(cent) : '');
    toast('Einkommen gespeichert.');
    zeichnen();
  });

  $('#form-vorlage').addEventListener('submit', (e) => {
    e.preventDefault();
    const cent = betragParsen($('#v-betrag').value);
    if (!Number.isFinite(cent) || cent <= 0) { toast('Betrag prüfen.', true); return; }
    store.vorlageSpeichern({
      id: id(), name: $('#v-name').value.trim(), betrag: zuEuro(cent),
      kategorie: $('#v-kategorie').value, tag: 1, aktiv: 'ja', zuletzt: ''
    });
    $('#v-name').value = ''; $('#v-betrag').value = '';
    zeichnen();
  });

  $('#vorlagen-buchen').addEventListener('click', () => {
    store.configSchreiben('zuletztGebucht', '');
    autoBuchen();
    toast('Gebucht, falls noch nicht vorhanden.');
    zeichnen();
  });

  $('#form-kategorie').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#k-name').value.trim();
    if (!name) return;
    const liste = kategorien();
    if (liste.includes(name)) { toast('Gibt es schon.', true); return; }
    kategorienSetzen(liste.concat(name));
    $('#k-name').value = '';
    zeichnen();
  });

  $('#export-json').addEventListener('click', () =>
    herunterladen('ausgabenbro-' + heute() + '.json', JSON.stringify(store.daten, null, 2), 'application/json'));
  $('#export-csv').addEventListener('click', csvExport);
  $('#neu-laden').addEventListener('click', () =>
    store.synchronisieren().then((ok) => { toast(ok ? 'Neu geladen.' : (store.fehler || 'Fehlgeschlagen.'), !ok); zeichnen(); }));
  $('#onboarding-neu').addEventListener('click', onboardingStarten);

  onboardingVerdrahten();

  // Tooltips
  const tooltip = $('#tooltip');
  document.addEventListener('mouseover', (e) => {
    const ziel = e.target.closest('[data-tip]');
    if (!ziel) { tooltip.hidden = true; return; }
    tooltip.textContent = ziel.dataset.tip;
    tooltip.hidden = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (tooltip.hidden) return;
    const x = Math.min(Math.max(e.clientX + 12, 8), window.innerWidth - tooltip.offsetWidth - 8);
    const y = e.clientY - tooltip.offsetHeight - 10;
    tooltip.style.left = x + 'px';
    tooltip.style.top = (y < 8 ? e.clientY + 16 : y) + 'px';
  });

  document.addEventListener('visibilitychange', () => { if (!document.hidden) store.synchronisieren(); });
}

/* ============================================================== Startup */

function start() {
  themeAnwenden(lesen(SPEICHER.theme, 'auto'));
  $('#datum').value = heute();
  $('#e-datum').value = heute();

  verdrahten();
  store.abonnieren(() => {
    if (store.status === 'ok') autoBuchen();
    if ($('#onboarding').hidden) zeichnen(); else topbarZeichnen();
  });
  ansichtSetzen('erfassen');

  const fertig = () => {
    if (cfgWert('onboarding', '') !== 'fertig') onboardingStarten();
    else { autoBuchen(); zeichnen(); }
  };

  if (store.verbunden()) store.synchronisieren().then(fertig);
  else fertig();
}

start();
