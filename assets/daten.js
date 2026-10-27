/* Datenschicht: lokaler Cache + Schreib-Warteschlange + Google-Sheets-Backend.
 *
 * Entwurfsentscheidungen:
 *  - Jede Aenderung wirkt SOFORT lokal und wird zusaetzlich in eine Queue gelegt.
 *    Die App bleibt dadurch benutzbar, auch wenn das Sheet gerade nicht antwortet.
 *  - Ein Sync schickt alle offenen Operationen in EINEM Request und bekommt den
 *    kompletten Datenstand zurueck. Der Server ist die Wahrheit; noch nicht
 *    bestaetigte Operationen werden danach erneut lokal angewendet.
 *  - Content-Type ist bewusst text/plain: damit bleibt der POST ein "simple
 *    request" und der Browser schickt keinen Preflight, den Apps Script nicht
 *    beantworten kann.
 */

import { id } from './kern.js';

const LS = {
  cfg:   'ausgabenbro.cfg',
  cache: 'ausgabenbro.cache',
  queue: 'ausgabenbro.queue',
  theme: 'ausgabenbro.theme'
};

const BLATT_ZU_FELD = {
  Ausgaben: 'ausgaben',
  Einnahmen: 'einnahmen',
  Vorlagen: 'vorlagen'
};

export function lesen(schluessel, fallback) {
  try {
    const roh = localStorage.getItem(schluessel);
    return roh ? JSON.parse(roh) : fallback;
  } catch (err) { return fallback; }
}

export function schreiben(schluessel, wert) {
  try { localStorage.setItem(schluessel, JSON.stringify(wert)); return true; }
  catch (err) { return false; }
}

export const SPEICHER = LS;

function leereDaten() {
  return { ausgaben: [], einnahmen: [], vorlagen: [], config: {} };
}

/* --------------------------------------------------- Konfiguration laden */

/** Liest die Verbindungsdaten aus dem URL-Fragment (#c=...) oder localStorage.
 *  Das Fragment ist der robustere Weg: es steckt im Notion-Embed-Link und
 *  ueberlebt auch ein geloeschtes localStorage im iframe. */
export function configLaden() {
  const ausHash = hashConfig();
  if (ausHash) {
    schreiben(LS.cfg, ausHash);
    return ausHash;
  }
  return lesen(LS.cfg, null);
}

function hashConfig() {
  try {
    const treffer = /[#&]c=([^&]+)/.exec(location.hash || '');
    if (!treffer) return null;
    const json = decodeURIComponent(escape(atob(treffer[1].replace(/-/g, '+').replace(/_/g, '/'))));
    const cfg = JSON.parse(json);
    return cfg && cfg.url && cfg.token ? cfg : null;
  } catch (err) { return null; }
}

export function configKodieren(cfg) {
  const json = JSON.stringify({ url: cfg.url, token: cfg.token });
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* ------------------------------------------------------------- Transport */

async function ruf(cfg, nutzlast) {
  const antwort = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ token: cfg.token }, nutzlast)),
    redirect: 'follow'
  });
  if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
  const text = await antwort.text();
  let daten;
  try { daten = JSON.parse(text); }
  catch (err) { throw new Error('Unerwartete Antwort – ist die URL wirklich die /exec-Adresse und der Zugriff auf "Jeder" gestellt?'); }
  if (!daten.ok) throw new Error(daten.error || 'Unbekannter Fehler vom Backend');
  return daten;
}

/* ----------------------------------------------------------------- Store */

export class Store {
  constructor() {
    this.cfg    = configLaden();
    this.daten  = lesen(LS.cache, leereDaten());
    this.queue  = lesen(LS.queue, []);
    this.status = 'offline';
    this.fehler = null;
    this.zuletztSync = lesen('ausgabenbro.syncZeit', null);
    this._hoerer = new Set();
    this._laeuft = false;
    this._nachholen = false;
  }

  abonnieren(fn) { this._hoerer.add(fn); return () => this._hoerer.delete(fn); }
  melden() { this._hoerer.forEach((fn) => fn(this)); }

  _setStatus(status, fehler) {
    this.status = status;
    this.fehler = fehler || null;
    this.melden();
  }

  verbunden() { return Boolean(this.cfg && this.cfg.url && this.cfg.token); }

  async configSetzen(cfg) {
    this.cfg = cfg;
    schreiben(LS.cfg, cfg);
    return this.synchronisieren();
  }

  /* ------------------------------------------------------- Mutationen */

  mutieren(op) {
    op.opId = id();
    lokalAnwenden(this.daten, op);
    this.queue.push(op);
    this._sichern();
    this.melden();
    this.synchronisieren();
  }

  ausgabeSpeichern(satz) { this.mutieren({ typ: 'upsert', blatt: 'Ausgaben',  datensatz: satz }); }
  einnahmeSpeichern(satz){ this.mutieren({ typ: 'upsert', blatt: 'Einnahmen', datensatz: satz }); }
  vorlageSpeichern(satz) { this.mutieren({ typ: 'upsert', blatt: 'Vorlagen',  datensatz: satz }); }
  loeschen(blatt, satzId){ this.mutieren({ typ: 'delete', blatt, id: satzId }); }
  configSchreiben(key, value) { this.mutieren({ typ: 'setConfig', key, value }); }

  /* ------------------------------------------------------------- Sync */

  async synchronisieren() {
    if (!this.verbunden()) { this._setStatus('offline'); return false; }
    if (this._laeuft) { this._nachholen = true; return false; }

    this._laeuft = true;
    this._setStatus('sync');
    const gesendet = this.queue.slice();

    try {
      const antwort = await ruf(this.cfg, { action: 'sync', ops: gesendet });
      const bestaetigt = new Set(antwort.angewendet || []);
      this.queue = this.queue.filter((op) => !bestaetigt.has(op.opId));
      this.daten = antwort.daten || leereDaten();
      // Was waehrend des Requests dazukam, nochmal lokal drueberlegen.
      this.queue.forEach((op) => lokalAnwenden(this.daten, op));
      this.zuletztSync = new Date().toISOString();
      schreiben('ausgabenbro.syncZeit', this.zuletztSync);
      this._sichern();
      this._setStatus(this.queue.length ? 'sync' : 'ok');
      return true;
    } catch (err) {
      this._setStatus('fehler', err.message || String(err));
      return false;
    } finally {
      this._laeuft = false;
      if (this._nachholen) { this._nachholen = false; this.synchronisieren(); }
    }
  }

  _sichern() {
    schreiben(LS.cache, this.daten);
    schreiben(LS.queue, this.queue);
  }
}

/** Wendet eine Operation auf einen lokalen Datenstand an. */
function lokalAnwenden(daten, op) {
  if (op.typ === 'setConfig') {
    daten.config = daten.config || {};
    daten.config[op.key] = op.value;
    return;
  }
  const feld = BLATT_ZU_FELD[op.blatt];
  if (!feld) return;
  daten[feld] = daten[feld] || [];

  if (op.typ === 'upsert') {
    const index = daten[feld].findIndex((z) => String(z.id) === String(op.datensatz.id));
    if (index >= 0) daten[feld][index] = Object.assign({}, daten[feld][index], op.datensatz);
    else daten[feld].push(Object.assign({}, op.datensatz));
  } else if (op.typ === 'delete') {
    daten[feld] = daten[feld].filter((z) => String(z.id) !== String(op.id));
  }
}
