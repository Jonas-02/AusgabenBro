/* AusgabenBro - Oberflaeche und Verdrahtung. */

import {
  KATEGORIEN_STANDARD, istFix, istMonat,
  betragParsen, zuEuro, eur, eurKurz,
  heute, monatVon, monatLabel, monatVerschieben, datumLesbar,
  id, esc, stufe, $, $$
} from './kern.js';

import { Store, SPEICHER, lesen, schreiben, configKodieren } from './daten.js';

import {
  monatsAuswertung, verlauf, baselineMonat, datenVorBaseline
} from './auswertung.js';

import {
  kategorieChart, verlaufChart, burndownChart, topfChart
} from './charts.js';

import {
  budget, burndown, toepfe, topfDefinition, freieKategorien, heuteIso
} from './cockpit.js';

const store = new Store();

const LS_AUTO = 'ausgabenbro.autobuchung';

const ui = {
  ansicht: 'cockpit',
  topfKategorien: new Set(),
  monat: monatVon(heute()),
  richtung: 'ausgabe',
  kategorie: null,
  listeSuche: '',
  listeFilter: 'alle'
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

function toepfeSetzen(liste) { store.configSchreiben('toepfe', JSON.stringify(liste)); }

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
  if (ui.ansicht === 'cockpit')  cockpitZeichnen();
  if (ui.ansicht === 'erfassen') erfassenZeichnen();
  if (ui.ansicht === 'liste')    listeZeichnen();
  if (ui.ansicht === 'setup')    setupZeichnen();
  if (!$('#ampel-widget').hidden) ampelZeichnen();
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

/* -------------------------------------------------------------- Cockpit */

function cockpitZeichnen() {
  const b = budget(store.daten, ui.monat, heuteIso());
  const ziel = $('#cockpit-inhalt');

  if (!b.eingerichtet) {
    ziel.innerHTML = `<div class="card">
      <h2>Noch kein Einkommen hinterlegt</h2>
      <p class="hilfe">Das Cockpit rechnet aus Einkommen minus Fixkosten minus Puffer, wie viel pro Tag \u00fcbrig bleibt. Ohne Einkommen geht das nicht.</p>
      <button type="button" class="btn-primary" data-sprung="setup">Zu den Einstellungen</button>
    </div>`;
    return;
  }

  ziel.innerHTML = kopfBlock(b) + prognoseBlock(b) + kennzahlenBlock(b)
    + '<div id="cockpit-chart"></div>'
    + topfChart(toepfe(store.daten, ui.monat))
    + kategorieChart(monatsAuswertung(store.daten, ui.monat))
    + verlaufChart(verlauf(store.daten, ui.monat, 6), ui.monat);

  burndownZeichnen();
}

/** Die eine gro\u00dfe Zahl. */
function kopfBlock(b) {
  if (!b.istAktuell) {
    return `<section class="cockpit-haupt" data-ampel="${b.rest >= 0 ? 'gruen' : 'rot'}">
      <div class="cockpit-label">\u00dcbrig geblieben im ${esc(monatLabel(b.monat))}</div>
      <div class="cockpit-wert">${eur(b.rest)}</div>
      <div class="cockpit-sub">${eur(b.ausgegeben)} ausgegeben von ${eur(b.monatsbudget)} Budget</div>
    </section>`;
  }

  const ueber = b.heuteNochFrei < 0;
  return `<section class="cockpit-haupt" data-ampel="${b.ampel}">
    <div class="cockpit-label">${ueber ? 'Heute schon dr\u00fcber' : 'Heute noch'}</div>
    <div class="cockpit-wert">${eur(Math.abs(b.heuteNochFrei))}</div>
    <div class="cockpit-sub">
      Tagesbudget ${eur(b.tagesbudget)}${b.heuteAusgegeben ? ' \u00b7 heute ' + eur(b.heuteAusgegeben) + ' ausgegeben' : ' \u00b7 heute noch nichts ausgegeben'}
    </div>
  </section>`;
}

/** Runway: Prognose statt R\u00fcckblick. */
function prognoseBlock(b) {
  if (!b.istAktuell) return '';
  let text, icon = '\u2192';

  if (b.monatsbudget <= 0) {
    text = `Fixkosten und Puffer zusammen sind so hoch wie dein Einkommen. F\u00fcr den Alltag bleibt rechnerisch nichts \u00fcbrig.`;
    icon = '\u26a0';
  } else if (b.rest <= 0) {
    text = `Dein Budget f\u00fcr diesen Monat ist aufgebraucht \u2013 <strong>${eur(-b.rest)} dr\u00fcber</strong>. Noch ${b.restTage} Tag(e) bis zum Monatsende.`;
    icon = '\u26a0';
  } else if (b.nullTag) {
    text = `Bei deinem Tempo von ${eur(b.tempo)} pro Tag bist du am <strong>${b.nullTag}.</strong> bei null \u2013 ${b.tage - b.nullTag + 1} Tage vor Monatsende.`;
    icon = '\u26a0';
  } else if (b.anzahlVariabel < 3) {
    text = `Noch zu wenige Buchungen f\u00fcr eine Prognose. Ab etwa drei Tagen rechnet die App dir aus, wann du bei null w\u00e4rst.`;
  } else {
    text = `Bei deinem Tempo von ${eur(b.tempo)} pro Tag kommst du bis zum Monatsende durch und h\u00e4ttest am Ende noch Luft.`;
  }

  return `<div class="hinweis-zeile"><span class="hinweis-icon">${icon}</span><span>${text}</span></div>`;
}

function kpi(label, wert, sub, alarm) {
  return `<div class="kpi">
    <span class="kpi-label">${esc(label)}</span>
    <span class="kpi-wert${alarm ? ' alarm' : ''}">${esc(wert)}</span>
    <span class="kpi-sub">${esc(sub)}</span>
  </div>`;
}

function kennzahlenBlock(b) {
  return `<div class="kpi-grid">
    ${kpi('Budget', eurKurz(b.monatsbudget), 'nach Fix und Puffer')}
    ${kpi('Ausgegeben', eurKurz(b.ausgegeben), b.tagHeute + '. von ' + b.tage + ' Tagen')}
    ${kpi('\u00dcbrig', eurKurz(b.rest), b.istAktuell ? 'f\u00fcr ' + b.restTage + ' Tag(e)' : 'am Monatsende', b.rest < 0)}
    ${kpi('Puffer', eurKurz(b.puffer), 'vorab zur\u00fcckgelegt')}
  </div>`;
}

/** Das SVG braucht die Pixelbreite, deshalb erst nach dem Einh\u00e4ngen. */
function burndownZeichnen() {
  const halter = $('#cockpit-chart');
  if (!halter) return;
  const breite = halter.clientWidth || 320;
  halter.innerHTML = burndownChart(burndown(store.daten, ui.monat, heuteIso()), breite);
}

/* --------------------------------------------------------- Ampel-Widget */

function ampelZeichnen() {
  const b = budget(store.daten, monatVon(heuteIso()), heuteIso());
  const ziel = $('#ampel-widget');
  const url = location.origin + location.pathname + location.hash;

  if (!b.eingerichtet) {
    ziel.innerHTML = `<a class="ampel-inhalt" data-ampel="grau" href="${esc(url)}" target="_blank" rel="noopener">
      <span class="ampel-punkt"></span>
      <span class="ampel-text"><span class="ampel-sub">Noch nicht eingerichtet \u2013 hier \u00f6ffnen</span></span>
    </a>`;
    return;
  }

  const ueber = b.heuteNochFrei < 0;
  ziel.innerHTML = `<a class="ampel-inhalt" data-ampel="${b.ampel}" href="${esc(url)}" target="_blank" rel="noopener">
    <span class="ampel-punkt"></span>
    <span class="ampel-text">
      <span class="ampel-wert">${ueber ? '\u2212' : ''}${eur(Math.abs(b.heuteNochFrei))}</span>
      <span class="ampel-sub">${ueber ? 'heute dr\u00fcber' : 'heute noch'} \u00b7 ${eur(b.rest)} bis ${b.tage}.</span>
    </span>
  </a>`;
}

/* ------------------------------------------------------------- Erfassen */

function erfassenZeichnen() {
  const aktive = kategorien();
  if (ui.kategorie && !aktive.includes(ui.kategorie)) ui.kategorie = null;

  $('#kategorie-chips').innerHTML = aktive.map((k) =>
    `<button type="button" class="chip${k === ui.kategorie ? ' aktiv' : ''}" data-kategorie="${esc(k)}">${esc(k)}</button>`
  ).join('');

  const a = monatsAuswertung(store.daten, ui.monat);
  const heuteCent = (store.daten.ausgaben || [])
    .filter((x) => x.datum === heute())
    .reduce((s, x) => s + Math.round((Number(x.betrag) || 0) * 100), 0);

  const b = budget(store.daten, ui.monat, heuteIso());
  const ampelFarbe = { gruen: '--gut', gelb: '--warnung', rot: '--kritisch', grau: '--muted' }[b.ampel];
  $('#heute-leiste').innerHTML = b.eingerichtet && b.istAktuell
    ? `<span>Heute noch <strong style="color:var(${ampelFarbe})">${b.heuteNochFrei < 0 ? '\u2212' : ''}${eur(Math.abs(b.heuteNochFrei))}</strong></span>
       <span>\u00dcbrig <strong>${eur(b.rest)}</strong></span>
       <span>${esc(monatLabel(ui.monat))} <strong>${eur(a.gesamt)}</strong></span>`
    : `<span>Heute <strong>${eur(heuteCent)}</strong></span>
       <span>${esc(monatLabel(ui.monat))} <strong>${eur(a.gesamt)}</strong></span>
       <span>variabel <strong>${eurKurz(a.variabel)}</strong></span>`;

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
    : [datumLesbar(p.datum), istFix(p.notwendigkeit) ? 'Fixkosten' : null];

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
  const basis = baselineMonat(store.daten);
  const v = monatsAuswertung(store.daten, vormonat);
  const abschlussZeigen = gesehen !== dieserMonat && !v.leer && (!basis || vormonat >= basis);

  $('#monatsabschluss').innerHTML = abschlussZeigen
    ? `<div class="banner">
        <div class="banner-text">
          <strong>${esc(monatLabel(vormonat))} ist abgeschlossen.</strong>
          ${eur(v.variabel)} variabel bei ${eur(v.gesamt)} Ausgaben, ${eur(v.saldo)} Saldo.
        </div>
        <div class="banner-aktionen">
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

/* ----------------------------------------------------------------- Liste */

function listeZeichnen() {
  const suche = ui.listeSuche.toLowerCase().trim();
  const filter = ui.listeFilter;

  let posten = [
    ...(store.daten.ausgaben  || []).map((x) => ({ ...x, art: 'Ausgaben' })),
    ...(store.daten.einnahmen || []).map((x) => ({ ...x, art: 'Einnahmen' }))
  ].filter((p) => monatVon(p.datum) === ui.monat);

  if (filter === 'variabel')  posten = posten.filter((p) => p.art === 'Ausgaben' && !istFix(p.notwendigkeit));
  if (filter === 'fix')       posten = posten.filter((p) => p.art === 'Ausgaben' && istFix(p.notwendigkeit));
  if (filter === 'einnahmen') posten = posten.filter((p) => p.art === 'Einnahmen');

  if (suche) {
    posten = posten.filter((p) => [p.kategorie, p.quelle]
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
  const basis = baselineMonat(store.daten);
  if (!$('#cfg-baseline').value && basis) $('#cfg-baseline').value = basis;

  const c = store.daten.config || {};
  if (!$('#cfg-sparrate').value && c.sparrate) $('#cfg-sparrate').value = String(c.sparrate).replace('.', ',');
  if (!$('#cfg-notgroschen').value && c.notgroschen) $('#cfg-notgroschen').value = String(c.notgroschen).replace('.', ',');

  const b = budget(store.daten, monatVon(heuteIso()), heuteIso());
  $('#puffer-hinweis').innerHTML = b.eingerichtet
    ? `${eur(b.einkommen)} Einkommen \u2212 ${eur(b.fix)} Fixkosten \u2212 ${eur(b.puffer)} Puffer =
       <strong>${eur(b.monatsbudget)}</strong> f\u00fcr den Alltag, also ${eur(Math.floor(b.monatsbudget / b.tage))} pro Tag.`
    : 'Trag zuerst dein Einkommen ein.';

  toepfeSetupZeichnen();

  const davor = datenVorBaseline(store.daten);
  $('#baseline-hinweis').innerHTML = davor
    ? `Aktuell: <strong>${esc(monatLabel(basis))}</strong>. ${davor} Buchung(en) liegen davor \u2013 sie bleiben erhalten, z\u00e4hlen aber nicht zur Basis und erscheinen nicht im Verlauf.`
    : (basis ? `Aktuell: <strong>${esc(monatLabel(basis))}</strong>.` : '');

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

function toepfeSetupZeichnen() {
  const definition = topfDefinition(store.daten);
  const stand = toepfe(store.daten, monatVon(heuteIso()));

  $('#toepfe-liste').innerHTML = definition.length
    ? `<div class="eintrag-liste">${definition.map((t, i) => {
        const ist = stand.find((x) => x.name === t.name);
        return `<div class="eintrag">
          <span class="eintrag-balken" style="--stufe:var(--noetig)"></span>
          <span class="eintrag-haupt">
            <span class="eintrag-titel">${esc(t.name)}</span>
            <span class="eintrag-meta">${esc((t.kategorien || []).join(', ') || 'keine Kategorie')}</span>
          </span>
          <span class="eintrag-betrag">${eur(Math.round((Number(t.betrag) || 0) * 100))}</span>
          <button type="button" class="eintrag-aktion" data-topf-weg="${i}" title="L\u00f6schen">&times;</button>
        </div>`;
      }).join('')}</div>`
    : `<p class="leer">Noch keine T\u00f6pfe angelegt.</p>`;

  const frei = freieKategorien(store.daten, kategorien());
  $('#t-kategorien').innerHTML = frei.length
    ? frei.map((k) => `<button type="button" class="chip${ui.topfKategorien.has(k) ? ' aktiv' : ''}" data-topf-kat="${esc(k)}">${esc(k)}</button>`).join('')
    : '<span class="hilfe">Alle Kategorien sind schon einem Topf zugeordnet.</span>';
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
  // Ohne eigenes Merkmal je Vorlage dient Kategorie plus Betrag als
  // Fingerabdruck. Zwei Fixkosten mit identischer Kategorie UND identischem
  // Betrag waeren nicht unterscheidbar - dann wird eine davon uebersprungen.
  const fingerabdruck = (kategorie, betrag) =>
    String(kategorie) + '|' + Math.round((Number(betrag) || 0) * 100);
  const vorhandeneFix = new Set((store.daten.ausgaben || [])
    .filter((a) => monatVon(a.datum) === monat && istFix(a.notwendigkeit))
    .map((a) => fingerabdruck(a.kategorie, a.betrag)));

  for (const v of (store.daten.vorlagen || [])) {
    if (String(v.aktiv) === 'nein') continue;
    if (vorhandeneFix.has(fingerabdruck(v.kategorie || 'Wohnen', v.betrag))) continue;
    const tag = Math.min(Math.max(Number(v.tag) || 1, 1), 28);
    const satz = {
      id: id(), erstellt: new Date().toISOString(),
      datum: monat + '-' + String(tag).padStart(2, '0'),
      betrag: Number(v.betrag) || 0,
      kategorie: v.kategorie || 'Wohnen',
      notwendigkeit: 0
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
  const spalten = ['datum', 'betrag', 'kategorie', 'art'];
  const zeilen = [spalten.join(';')];
  for (const a of store.daten.ausgaben || []) {
    zeilen.push([
      a.datum, String(Number(a.betrag) || 0).replace('.', ','),
      a.kategorie, stufe(a.notwendigkeit).name
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
      <p class="hilfe">Alles, was jeden Monat gleich abgeht: Miete, Versicherungen, Abos, Handyvertrag. Wird zu Monatsbeginn automatisch gebucht und bleibt aus dem Tagesbudget heraus.</p>
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
        <p class="hilfe">Das war's. Ab jetzt: Betrag eintippen, Kategorie antippen, speichern.</p>
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
    const schluessel = (t) => String(t || '').trim().toLowerCase();
    const treffer = vorhandene.find((x) => schluessel(x.name) === schluessel(v.name));
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

  $('#form-ausgabe').addEventListener('submit', (e) => {
    e.preventDefault();
    const cent = betragParsen($('#betrag').value);
    if (!Number.isFinite(cent) || cent <= 0) { toast('Bitte einen Betrag eingeben.', true); $('#betrag').focus(); return; }
    if (!ui.kategorie) { toast('Bitte eine Kategorie wählen.', true); return; }

    const datum = $('#datum').value || heute();
    store.ausgabeSpeichern({
      id: id(), erstellt: new Date().toISOString(), datum,
      betrag: zuEuro(cent),
      kategorie: ui.kategorie,
      notwendigkeit: $('#ist-fix').checked ? 0 : 1
    });

    if (monatVon(datum) !== ui.monat) ui.monat = monatVon(datum);
    $('#betrag').value = '';
    $('#ist-fix').checked = false;
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

    const topfWeg = e.target.closest('[data-topf-weg]');
    if (topfWeg) {
      const liste = topfDefinition(store.daten);
      const raus = liste[Number(topfWeg.dataset.topfWeg)];
      liste.splice(Number(topfWeg.dataset.topfWeg), 1);
      toepfeSetzen(liste);
      toast(raus ? 'Topf entfernt: ' + raus.name : 'Entfernt.');
      zeichnen();
      return;
    }

    const sprung = e.target.closest('[data-sprung]');
    if (sprung) { ansichtSetzen(sprung.dataset.sprung); return; }

    const katWeg = e.target.closest('[data-kat-weg]');
    if (katWeg) { kategorienSetzen(kategorien().filter((k) => k !== katWeg.dataset.katWeg)); zeichnen(); return; }

    const banner = e.target.closest('[data-banner]');
    if (banner) {
      const was = banner.dataset.banner;
      if (was === 'abschluss-ok') { store.configSchreiben('abschlussGesehen', monatVon(heute())); zeichnen(); }
      if (was === 'auto-undo') { autoRueckgaengig(); zeichnen(); }
      if (was === 'auto-ok') { schreiben(LS_AUTO, null); zeichnen(); }
    }
  });

  // Kategorie-Auswahl im Topf-Formular
  $('#t-kategorien').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-topf-kat]');
    if (!chip) return;
    const k = chip.dataset.topfKat;
    if (ui.topfKategorien.has(k)) ui.topfKategorien.delete(k); else ui.topfKategorien.add(k);
    chip.classList.toggle('aktiv');
  });

  $('#form-topf').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#t-name').value.trim();
    const cent = betragParsen($('#t-betrag').value);
    if (!name) { toast('Name fehlt.', true); return; }
    if (!Number.isFinite(cent) || cent <= 0) { toast('Limit pruefen.', true); return; }
    if (!ui.topfKategorien.size) { toast('Mindestens eine Kategorie waehlen \u2013 sonst faengt der Topf nichts auf.', true); return; }
    if (topfDefinition(store.daten).some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      toast('Topf mit dem Namen gibt es schon.', true); return;
    }
    toepfeSetzen(topfDefinition(store.daten).concat({
      name, betrag: zuEuro(cent), kategorien: Array.from(ui.topfKategorien)
    }));
    ui.topfKategorien.clear();
    $('#t-name').value = ''; $('#t-betrag').value = '';
    toast('Topf angelegt: ' + name);
    zeichnen();
  });

  $('#cfg-puffer-speichern').addEventListener('click', () => {
    const werte = {};
    for (const [feld, schluessel] of [['#cfg-sparrate', 'sparrate'], ['#cfg-notgroschen', 'notgroschen']]) {
      const roh = $(feld).value.trim();
      if (!roh) { werte[schluessel] = ''; continue; }
      const c = betragParsen(roh);
      if (!Number.isFinite(c) || c < 0) { toast('Betrag pruefen.', true); return; }
      werte[schluessel] = zuEuro(c);
    }
    store.configSchreiben('sparrate', werte.sparrate);
    store.configSchreiben('notgroschen', werte.notgroschen);
    toast('Puffer gespeichert.');
    zeichnen();
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

  $('#cfg-baseline-speichern').addEventListener('click', () => {
    const wert = $('#cfg-baseline').value.trim();
    if (wert && !istMonat(wert)) { toast('Bitte einen Monat w\u00e4hlen.', true); return; }
    store.configSchreiben('baseline', wert);
    toast(wert ? `Startmonat: ${monatLabel(wert)}.` : 'Startmonat zur\u00fcckgesetzt.');
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

  // Das SVG rechnet in Pixeln, also bei Breitenaenderung neu aufbauen.
  let groesseTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(groesseTimer);
    groesseTimer = setTimeout(() => { if (ui.ansicht === 'cockpit') burndownZeichnen(); }, 150);
  });
}

/* ============================================================== Startup */

/** Schlanke Ampel fuer ein kleines Notion-Embed: ?ansicht=ampel */
function istWidget() {
  try { return new URLSearchParams(location.search).get('ansicht') === 'ampel'; }
  catch (err) { return false; }
}

function start() {
  themeAnwenden(lesen(SPEICHER.theme, 'auto'));
  $('#datum').value = heute();
  $('#e-datum').value = heute();

  const widget = istWidget();
  if (widget) {
    document.body.classList.add('nur-widget');
    $('#ampel-widget').hidden = false;
  }

  verdrahten();
  store.abonnieren(() => {
    if (store.status === 'ok') autoBuchen();
    if (widget) { ampelZeichnen(); return; }
    if ($('#onboarding').hidden) zeichnen(); else topbarZeichnen();
  });

  if (!widget) ansichtSetzen('cockpit');

  const fertig = () => {
    if (widget) { autoBuchen(); ampelZeichnen(); return; }
    if (cfgWert('onboarding', '') !== 'fertig') onboardingStarten();
    else { autoBuchen(); zeichnen(); }
  };

  if (store.verbunden()) store.synchronisieren().then(fertig);
  else fertig();
}

start();
