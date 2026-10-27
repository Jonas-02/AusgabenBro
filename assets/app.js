/* AusgabenBro - Oberflaeche und Verdrahtung. */

import {
  STUFEN, URTEILE, WEN, KATEGORIEN_STANDARD, UNNOETIG_AB,
  betragParsen, zuEuro, eur, eurKurz, prozent,
  heute, monatVon, monatLabel, monatVerschieben, datumLesbar, tageSeit,
  id, esc, stufe, $, $$
} from './kern.js';

import { Store, SPEICHER, lesen, schreiben, configKodieren } from './daten.js';

import {
  monatsAuswertung, verlauf, reueRanking, offeneReue, personenVorschlaege
} from './auswertung.js';

import {
  notwendigkeitsChart, kategorieChart, verlaufChart, spendabelChart, reueChart
} from './charts.js';

const store = new Store();

const ui = {
  ansicht: 'erfassen',
  monat: monatVon(heute()),
  richtung: 'ausgabe',
  kategorie: null,
  notwendigkeit: null,
  fuerWen: 'ich',
  einnahmeTyp: 'einkommen',
  listeSuche: '',
  listeFilter: 'alle',
  zurueckgelegt: new Set()
};

/* ================================================================ Helfer */

function kategorien() {
  const roh = store.daten.config && store.daten.config.kategorien;
  if (roh) {
    try {
      const k = typeof roh === 'string' ? JSON.parse(roh) : roh;
      if (Array.isArray(k) && k.length) return k;
    } catch (err) { /* faellt auf Standard zurueck */ }
  }
  return KATEGORIEN_STANDARD;
}

function kategorienSetzen(liste) {
  store.configSchreiben('kategorien', JSON.stringify(liste));
}

let toastTimer = null;
function toast(text, istFehler) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.toggle('fehler', Boolean(istFehler));
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, istFehler ? 5200 : 2400);
}

/* ================================================================= Theme */

function themeAnwenden(wert) {
  if (wert === 'hell') document.documentElement.setAttribute('data-theme', 'light');
  else if (wert === 'dunkel') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}

function themeUmschalten() {
  const dunkelAktiv = getComputedStyle(document.documentElement)
    .getPropertyValue('color-scheme').trim() === 'dark';
  const neu = dunkelAktiv ? 'hell' : 'dunkel';
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

  $('#notwendigkeit-skala').innerHTML = STUFEN.map((s) =>
    `<button type="button" class="skala-stufe${s.wert === ui.notwendigkeit ? ' aktiv' : ''}"
       style="--stufe:var(${s.token})" data-stufe="${s.wert}" title="${esc(s.hinweis)}">
       <span class="skala-punkt"></span><span>${esc(s.kurz)}</span>
     </button>`).join('');

  $('#notwendigkeit-hint').textContent = ui.notwendigkeit === null
    ? 'bitte wählen' : stufe(ui.notwendigkeit).hinweis;

  $('#personen-liste').innerHTML = personenVorschlaege(store.daten)
    .map((n) => `<option value="${esc(n)}">`).join('');

  const a = monatsAuswertung(store.daten, ui.monat);
  const heuteCent = (store.daten.ausgaben || [])
    .filter((x) => x.datum === heute())
    .reduce((s, x) => s + Math.round((Number(x.betrag) || 0) * 100), 0);

  $('#heute-leiste').innerHTML =
    `<span>Heute <strong>${eur(heuteCent)}</strong></span>
     <span>${esc(monatLabel(ui.monat))} <strong>${eur(a.gesamt)}</strong></span>
     <span>davon unn&ouml;tig <strong style="color:var(${a.quote >= 0.25 ? '--kritisch' : '--text'})">${prozent(a.unnoetig, a.gesamt)}</strong></span>`;

  $('#zuletzt').innerHTML = zuletztHtml();
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
    ? [datumLesbar(p.datum), p.typ === 'erstattung' ? 'Rückzahlung' + (p.person ? ' von ' + p.person : '') : 'Einkommen']
    : [datumLesbar(p.datum), s.kurz, p.fuerWen !== 'ich' ? (WEN[p.fuerWen] || WEN.ich).kurz + (p.person ? ': ' + p.person : '') : null, p.notiz];

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

/* ------------------------------------------------------------ Uebersicht */

function uebersichtZeichnen() {
  const a = monatsAuswertung(store.daten, ui.monat);
  const reihen = verlauf(store.daten, ui.monat, 6);

  const quoteAlarm = a.quoteVariabel >= 0.3;
  $('#kpis').innerHTML = `
    ${kpi('Ausgaben', eurKurz(a.gesamt), a.einkommen ? prozent(a.gesamt, a.einkommen) + ' des Einkommens' : monatLabel(a.monat))}
    ${kpi('Unnötig-Quote', prozent(a.unnoetig, a.variabel), eurKurz(a.unnoetig) + ' von ' + eurKurz(a.variabel) + ' beeinflussbar', quoteAlarm)}
    ${kpi('Spendabel-Saldo', eurKurz(a.spendabelSaldo), a.erstattung ? eurKurz(a.erstattung) + ' zurückbekommen' : 'nichts zurückbekommen', a.spendabelSaldo > 0 && a.gesamt > 0 && a.spendabelSaldo / a.gesamt >= 0.15)}
    ${kpi('Saldo', (a.saldo >= 0 ? '+' : '') + eurKurz(a.saldo), a.einkommen ? 'Einnahmen minus Ausgaben' : 'kein Einkommen erfasst', a.saldo < 0)}
  `;

  const hinweise = hinweiseFuer(a, reihen);

  $('#charts').innerHTML = hinweise
    + notwendigkeitsChart(a)
    + kategorieChart(a)
    + spendabelChart(a)
    + verlaufChart(reihen, ui.monat)
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
function hinweiseFuer(a, reihen) {
  const zeilen = [];

  if (!a.gesamt) return '';

  const top = a.kategorien.filter((k) => k.unnoetig > 0).sort((x, y) => y.unnoetig - x.unnoetig)[0];
  if (top && top.unnoetig > 0) {
    zeilen.push(`<strong>${esc(top.name)}</strong> ist dein größter Impuls-Posten: ${eur(top.unnoetig)} von ${eur(top.cent)} waren Impuls oder Reue.`);
  }

  if (a.spendabelSaldo > 0 && a.gesamt > 0 && a.spendabelSaldo / a.gesamt >= 0.12) {
    zeilen.push(`${eur(a.spendabelSaldo)} dieses Monats gingen für andere drauf – das sind ${prozent(a.spendabelSaldo, a.gesamt)} deiner Ausgaben.`);
  }

  const mitDaten = reihen.filter((r) => r.gesamt > 0);
  if (mitDaten.length >= 3) {
    const schnitt = mitDaten.slice(0, -1).reduce((s, r) => s + r.quote, 0) / Math.max(mitDaten.length - 1, 1);
    const jetzt = mitDaten[mitDaten.length - 1];
    if (jetzt.monat === ui.monat && Math.abs(jetzt.quote - schnitt) > 0.05) {
      const besser = jetzt.quote < schnitt;
      zeilen.push(`Deine Unnötig-Quote liegt ${besser ? 'unter' : 'über'} deinem Schnitt der Vormonate (${prozent(jetzt.quote * 100, 100)} statt ${prozent(schnitt * 100, 100)}).`);
    }
  }

  if (!zeilen.length) return '';
  return zeilen.slice(0, 2).map((t) =>
    `<div class="hinweis-zeile" style="margin-top:10px"><span class="hinweis-icon">→</span><span>${t}</span></div>`
  ).join('');
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
      <div class="reue-wann">vor ${tageSeit(p.datum)} Tagen · ${esc(s.kurz)}${p.fuerWen !== 'ich' ? ' · ' + esc((WEN[p.fuerWen] || WEN.ich).kurz) : ''}</div>
      <div class="reue-betrag">${eur(cent)}</div>
      <div class="reue-wo">${esc(p.kategorie || 'Ohne Kategorie')}${p.notiz ? ' – ' + esc(p.notiz) : ''}${p.person ? ' (' + esc(p.person) + ')' : ''}</div>
      <div class="reue-knoepfe">
        ${URTEILE.map((u) => `<button type="button" class="reue-knopf" style="--urteil:var(${u.token})" data-urteil="${u.wert}" data-satz="${esc(p.id)}">
          <span class="reue-icon">${u.icon}</span><span>${esc(u.label)}</span>
        </button>`).join('')}
      </div>
      <button type="button" class="tabelle-umschalter" data-ueberspringen="${esc(p.id)}">später</button>
    </div>
    <div class="hinweis-zeile"><span class="hinweis-icon">\u{1F4CA}</span><span>Noch <strong>${offen.length}</strong> offen. Jede Bewertung schärft das Reue-Ranking in der Übersicht.</span></div>
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
  if (filter === 'andere')    posten = posten.filter((p) => p.art === 'Ausgaben' && p.fuerWen && p.fuerWen !== 'ich');
  if (filter === 'einnahmen') posten = posten.filter((p) => p.art === 'Einnahmen');

  if (suche) {
    posten = posten.filter((p) => [p.kategorie, p.notiz, p.person, p.quelle]
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

  const vorlagen = store.daten.vorlagen || [];
  $('#vorlagen-liste').innerHTML = vorlagen.length
    ? `<div class="eintrag-liste">${vorlagen.map((v) => `<div class="eintrag">
        <span class="eintrag-balken" style="--stufe:var(--n0)"></span>
        <span class="eintrag-haupt">
          <span class="eintrag-titel">${esc(v.name)}</span>
          <span class="eintrag-meta">${esc(v.kategorie || '')}${v.zuletzt ? ' · zuletzt gebucht ' + esc(monatLabel(v.zuletzt)) : ' · noch nie gebucht'}</span>
        </span>
        <span class="eintrag-betrag">${eur(Math.round((Number(v.betrag) || 0) * 100))}</span>
        <button type="button" class="eintrag-aktion" data-loeschen="${esc(v.id)}" data-blatt="Vorlagen" title="Löschen">&times;</button>
      </div>`).join('')}</div>`
    : `<p class="leer">Noch keine Fixkosten hinterlegt.</p>`;

  $('#kategorie-verwaltung').innerHTML = kats.map((k) =>
    `<span class="chip">${esc(k)}<button type="button" class="chip-loeschen" data-kat-weg="${esc(k)}" title="Entfernen">&times;</button></span>`
  ).join('');

  const offen = store.queue.length;
  $('#daten-info').textContent =
    `${(store.daten.ausgaben || []).length} Ausgaben, ${(store.daten.einnahmen || []).length} Einnahmen lokal.`
    + (offen ? ` ${offen} Änderung(en) warten auf die Tabelle.` : '')
    + (store.zuletztSync ? ` Letzter Abgleich: ${new Date(store.zuletztSync).toLocaleString('de-DE')}.` : '');
}

function fixkostenBuchen() {
  const vorlagen = (store.daten.vorlagen || []).filter((v) => String(v.aktiv) !== 'nein');
  if (!vorlagen.length) { toast('Keine Fixkosten hinterlegt.', true); return; }

  const schonDa = new Set((store.daten.ausgaben || [])
    .filter((a) => monatVon(a.datum) === ui.monat && Number(a.notwendigkeit) === 0)
    .map((a) => String(a.notiz || '').trim()));

  let gebucht = 0;
  for (const v of vorlagen) {
    if (schonDa.has(String(v.name).trim())) continue;
    const tag = Math.min(Math.max(Number(v.tag) || 1, 1), 28);
    store.ausgabeSpeichern({
      id: id(),
      erstellt: new Date().toISOString(),
      datum: ui.monat + '-' + String(tag).padStart(2, '0'),
      betrag: Number(v.betrag) || 0,
      kategorie: v.kategorie || 'Wohnen',
      notwendigkeit: 0,
      fuerWen: 'ich',
      person: '',
      notiz: v.name,
      reue: '',
      reueAm: ''
    });
    store.vorlageSpeichern(Object.assign({}, v, { zuletzt: ui.monat }));
    gebucht++;
  }

  toast(gebucht ? `${gebucht} Fixkosten für ${monatLabel(ui.monat)} gebucht.`
                : `Für ${monatLabel(ui.monat)} ist schon alles gebucht.`, !gebucht);
}

/* --------------------------------------------------------------- Export */

function herunterladen(dateiname, inhalt, typ) {
  try {
    const blob = new Blob([inhalt], { type: typ + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = dateiname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err) {
    toast('Download im Embed blockiert – öffne die Seite in einem eigenen Tab.', true);
  }
}

function csvExport() {
  const spalten = ['datum', 'betrag', 'kategorie', 'notwendigkeit', 'stufe', 'fuerWen', 'person', 'notiz', 'reue'];
  const zeilen = [spalten.join(';')];
  for (const a of store.daten.ausgaben || []) {
    zeilen.push([
      a.datum,
      String(Number(a.betrag) || 0).replace('.', ','),
      a.kategorie, a.notwendigkeit, stufe(a.notwendigkeit).name,
      a.fuerWen, a.person, a.notiz, a.reue
    ].map((f) => `"${String(f == null ? '' : f).replace(/"/g, '""')}"`).join(';'));
  }
  herunterladen('ausgabenbro-' + heute() + '.csv', '﻿' + zeilen.join('\r\n'), 'text/csv');
}

/* ========================================================= Verdrahtung */

function verdrahten() {
  // Tabs
  $$('.tab').forEach((t) => t.addEventListener('click', () => ansichtSetzen(t.dataset.view)));

  // Monatsnavigation
  $('#monat-zurueck').addEventListener('click', () => { ui.monat = monatVerschieben(ui.monat, -1); zeichnen(); });
  $('#monat-vor').addEventListener('click',     () => { ui.monat = monatVerschieben(ui.monat,  1); zeichnen(); });

  $('#theme-toggle').addEventListener('click', themeUmschalten);
  $('#sync-dot').addEventListener('click', () => {
    if (!store.verbunden()) { ansichtSetzen('setup'); return; }
    store.synchronisieren().then((ok) => toast(ok ? 'Abgeglichen.' : (store.fehler || 'Abgleich fehlgeschlagen.'), !ok));
  });

  // Ausgabe / Einnahme umschalten
  $('#richtung').addEventListener('click', (e) => {
    const b = e.target.closest('[data-richtung]');
    if (!b) return;
    ui.richtung = b.dataset.richtung;
    $$('#richtung button').forEach((x) => x.classList.toggle('aktiv', x === b));
    $('#form-ausgabe').hidden  = ui.richtung !== 'ausgabe';
    $('#form-einnahme').hidden = ui.richtung !== 'einnahme';
  });

  // Kategorie-Chips
  $('#kategorie-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-kategorie]');
    if (!b) return;
    ui.kategorie = ui.kategorie === b.dataset.kategorie ? null : b.dataset.kategorie;
    erfassenZeichnen();
  });

  // Notwendigkeits-Skala
  $('#notwendigkeit-skala').addEventListener('click', (e) => {
    const b = e.target.closest('[data-stufe]');
    if (!b) return;
    ui.notwendigkeit = Number(b.dataset.stufe);
    erfassenZeichnen();
  });

  // Fuer wen
  $('#fuer-wen').addEventListener('click', (e) => {
    const b = e.target.closest('[data-wen]');
    if (!b) return;
    ui.fuerWen = b.dataset.wen;
    $$('#fuer-wen button').forEach((x) => x.classList.toggle('aktiv', x === b));
    $('#person').hidden = ui.fuerWen === 'ich';
  });

  // Einnahme-Typ
  $('#einnahme-typ').addEventListener('click', (e) => {
    const b = e.target.closest('[data-typ]');
    if (!b) return;
    ui.einnahmeTyp = b.dataset.typ;
    $$('#einnahme-typ button').forEach((x) => x.classList.toggle('aktiv', x === b));
    const erstattung = ui.einnahmeTyp === 'erstattung';
    $('#e-person').hidden = !erstattung;
    $('#e-person-label').hidden = !erstattung;
  });

  // Ausgabe speichern
  $('#form-ausgabe').addEventListener('submit', (e) => {
    e.preventDefault();
    const cent = betragParsen($('#betrag').value);
    if (!Number.isFinite(cent) || cent <= 0) { toast('Bitte einen Betrag eingeben.', true); $('#betrag').focus(); return; }
    if (!ui.kategorie) { toast('Bitte eine Kategorie wählen.', true); return; }
    if (ui.notwendigkeit === null) { toast('Bitte die Notwendigkeit wählen – das ist der Kern der Auswertung.', true); return; }

    const datum = $('#datum').value || heute();
    store.ausgabeSpeichern({
      id: id(),
      erstellt: new Date().toISOString(),
      datum,
      betrag: zuEuro(cent),
      kategorie: ui.kategorie,
      notwendigkeit: ui.notwendigkeit,
      fuerWen: ui.fuerWen,
      person: ui.fuerWen === 'ich' ? '' : $('#person').value.trim(),
      notiz: $('#notiz').value.trim(),
      reue: '',
      reueAm: ''
    });

    if (monatVon(datum) !== ui.monat) ui.monat = monatVon(datum);
    $('#betrag').value = '';
    $('#notiz').value = '';
    ui.notwendigkeit = null;
    toast(eur(cent) + ' erfasst.');
    $('#betrag').focus();
    zeichnen();
  });

  // Einnahme speichern
  $('#form-einnahme').addEventListener('submit', (e) => {
    e.preventDefault();
    const cent = betragParsen($('#e-betrag').value);
    if (!Number.isFinite(cent) || cent <= 0) { toast('Bitte einen Betrag eingeben.', true); return; }
    const datum = $('#e-datum').value || heute();
    store.einnahmeSpeichern({
      id: id(),
      erstellt: new Date().toISOString(),
      datum,
      betrag: zuEuro(cent),
      typ: ui.einnahmeTyp,
      quelle: $('#e-quelle').value.trim() || (ui.einnahmeTyp === 'erstattung' ? 'Rückzahlung' : 'Einkommen'),
      person: ui.einnahmeTyp === 'erstattung' ? $('#e-person').value.trim() : '',
      notiz: ''
    });
    if (monatVon(datum) !== ui.monat) ui.monat = monatVon(datum);
    $('#e-betrag').value = '';
    toast('+' + eur(cent) + ' erfasst.');
    zeichnen();
  });

  // Loeschen (ueberall per Delegation)
  $('#main').addEventListener('click', (e) => {
    const weg = e.target.closest('[data-loeschen]');
    if (weg) {
      store.loeschen(weg.dataset.blatt, weg.dataset.loeschen);
      toast('Gelöscht.');
      zeichnen();
      return;
    }

    const urteil = e.target.closest('[data-urteil]');
    if (urteil) {
      const satz = (store.daten.ausgaben || []).find((a) => String(a.id) === urteil.dataset.satz);
      if (satz) {
        store.ausgabeSpeichern(Object.assign({}, satz, { reue: urteil.dataset.urteil, reueAm: heute() }));
        zeichnen();
      }
      return;
    }

    const spaeter = e.target.closest('[data-ueberspringen]');
    if (spaeter) {
      // Nur fuer diese Sitzung zuruecklegen - nichts schreiben, nichts verlieren.
      ui.zurueckgelegt.add(spaeter.dataset.ueberspringen);
      reueZeichnen();
      return;
    }

    const katWeg = e.target.closest('[data-kat-weg]');
    if (katWeg) {
      kategorienSetzen(kategorien().filter((k) => k !== katWeg.dataset.katWeg));
      zeichnen();
    }
  });

  // Liste
  $('#liste-suche').addEventListener('input', (e) => { ui.listeSuche = e.target.value; listeZeichnen(); });
  $('#liste-filter').addEventListener('change', (e) => { ui.listeFilter = e.target.value; listeZeichnen(); });

  // Setup: Verbindung
  $('#cfg-speichern').addEventListener('click', async () => {
    const url = $('#cfg-url').value.trim();
    const token = $('#cfg-token').value.trim();
    if (!/^https:\/\/script\.google\.com\/.*\/exec$/.test(url)) {
      toast('Die URL muss mit https://script.google.com/ beginnen und auf /exec enden.', true);
      return;
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
    feld.className = 'eingabe';
    feld.readOnly = true;
    feld.value = link;
    feld.style.marginTop = '8px';
    $('#cfg-status').innerHTML = '<p class="hilfe">Diesen Link in Notion als Embed einbetten. Er enthält dein Token – also nur auf Seiten, die du nicht teilst.</p>';
    $('#cfg-status').appendChild(feld);
    feld.select();
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => toast('Link kopiert.'), () => {});
  });

  // Setup: Vorlagen
  $('#form-vorlage').addEventListener('submit', (e) => {
    e.preventDefault();
    const cent = betragParsen($('#v-betrag').value);
    if (!Number.isFinite(cent) || cent <= 0) { toast('Betrag prüfen.', true); return; }
    store.vorlageSpeichern({
      id: id(),
      name: $('#v-name').value.trim(),
      betrag: zuEuro(cent),
      kategorie: $('#v-kategorie').value,
      notwendigkeit: 0,
      tag: 1,
      aktiv: 'ja',
      zuletzt: ''
    });
    $('#v-name').value = '';
    $('#v-betrag').value = '';
    zeichnen();
  });

  $('#vorlagen-buchen').addEventListener('click', () => { fixkostenBuchen(); zeichnen(); });

  // Setup: Kategorien
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

  // Setup: Daten
  $('#export-json').addEventListener('click', () =>
    herunterladen('ausgabenbro-' + heute() + '.json', JSON.stringify(store.daten, null, 2), 'application/json'));
  $('#export-csv').addEventListener('click', csvExport);
  $('#neu-laden').addEventListener('click', () =>
    store.synchronisieren().then((ok) => { toast(ok ? 'Neu geladen.' : (store.fehler || 'Fehlgeschlagen.'), !ok); zeichnen(); }));

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
    const breite = tooltip.offsetWidth;
    const x = Math.min(Math.max(e.clientX + 12, 8), window.innerWidth - breite - 8);
    const y = e.clientY - tooltip.offsetHeight - 10;
    tooltip.style.left = x + 'px';
    tooltip.style.top = (y < 8 ? e.clientY + 16 : y) + 'px';
  });
  document.addEventListener('mouseleave', () => { tooltip.hidden = true; });

  // Beim Zurueckkommen in den Tab einmal abgleichen.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) store.synchronisieren();
  });
}

/* ============================================================== Startup */

function start() {
  themeAnwenden(lesen(SPEICHER.theme, 'auto'));
  $('#datum').value = heute();
  $('#e-datum').value = heute();

  verdrahten();
  store.abonnieren(() => zeichnen());
  ansichtSetzen('erfassen');

  if (store.verbunden()) {
    store.synchronisieren().then(() => zeichnen());
  } else {
    ansichtSetzen('setup');
    toast('Noch keine Tabelle verbunden – Setup öffnen.');
  }
}

start();
