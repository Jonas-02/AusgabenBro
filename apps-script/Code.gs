/**
 * AusgabenBro - Backend auf Google Sheets
 *
 * Einrichtung (einmalig):
 *  1. Neue Google Tabelle anlegen -> Erweiterungen -> Apps Script
 *  2. Inhalt dieser Datei in Code.gs einfuegen und speichern
 *  3. Projekteinstellungen -> Scripteigenschaften -> Eigenschaft hinzufuegen
 *     Name:  AUSGABENBRO_TOKEN
 *     Wert:  ein langes, zufaelliges Passwort (z.B. openssl rand -base64 24)
 *  4. Bereitstellen -> Neue Bereitstellung -> Typ "Web-App"
 *     Ausfuehren als: Ich
 *     Zugriff:        Jeder
 *  5. Die /exec-URL kopieren und im Onboarding der App eintragen
 *
 * Die Tabellenblaetter legt das Script beim ersten Zugriff selbst an. Fehlende
 * Spalten werden bei jedem Zugriff ergaenzt - ein spaeteres Schema-Update
 * braucht deshalb keine Migration von Hand.
 */

var TOKEN_PROP = 'AUSGABENBRO_TOKEN';

var SCHEMA = {
  Ausgaben:  ['id', 'erstellt', 'datum', 'betrag', 'kategorie', 'notwendigkeit',
              'stichwort', 'reue', 'reueAm'],
  Einnahmen: ['id', 'erstellt', 'datum', 'betrag', 'quelle', 'notiz'],
  Vorlagen:  ['id', 'name', 'betrag', 'kategorie', 'tag', 'aktiv', 'zuletzt'],
  Config:    ['key', 'value']
};

var TEXT_SPALTEN = ['id', 'erstellt', 'datum', 'reueAm', 'zuletzt'];

// ---------------------------------------------------------------- Einstieg

function doGet() {
  return json_({ ok: true, info: 'AusgabenBro API laeuft. Diese Schnittstelle erwartet POST.' });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Ungueltiges JSON im Request-Body.' });
  }

  var erwartet = PropertiesService.getScriptProperties().getProperty(TOKEN_PROP);
  if (!erwartet) {
    return json_({ ok: false, error: 'Kein Token hinterlegt. Scripteigenschaft ' + TOKEN_PROP + ' anlegen.' });
  }
  if (String(req.token || '') !== String(erwartet)) {
    return json_({ ok: false, error: 'Token stimmt nicht.' });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (err) {
    return json_({ ok: false, error: 'Backend ist gerade belegt, bitte nochmal.' });
  }

  try {
    return json_(dispatch_(req));
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function dispatch_(req) {
  switch (req.action) {
    case 'ping':
      return { ok: true, pong: true, tabelle: SpreadsheetApp.getActiveSpreadsheet().getName() };

    case 'sync':
      var angewendet = [];
      var ops = req.ops || [];
      for (var i = 0; i < ops.length; i++) {
        applyOp_(ops[i]);
        angewendet.push(ops[i].opId);
      }
      return { ok: true, angewendet: angewendet, daten: readAll_() };

    default:
      return { ok: false, error: 'Unbekannte Aktion: ' + req.action };
  }
}

// ------------------------------------------------------------- Operationen

function applyOp_(op) {
  switch (op.typ) {
    case 'upsert':    return upsert_(op.blatt, op.datensatz);
    case 'delete':    return remove_(op.blatt, op.id);
    case 'setConfig': return setConfig_(op.key, op.value);
    default: throw new Error('Unbekannter Operationstyp: ' + op.typ);
  }
}

function upsert_(blattName, datensatz) {
  var spalten = SCHEMA[blattName];
  if (!spalten) throw new Error('Unbekanntes Blatt: ' + blattName);
  var blatt = sheet_(blattName);
  var zeile = spalten.map(function (s) {
    return datensatz[s] === undefined || datensatz[s] === null ? '' : datensatz[s];
  });

  var index = findRow_(blatt, String(datensatz.id));
  if (index > 0) blatt.getRange(index, 1, 1, spalten.length).setValues([zeile]);
  else blatt.appendRow(zeile);
}

function remove_(blattName, id) {
  var blatt = sheet_(blattName);
  var index = findRow_(blatt, String(id));
  if (index > 0) blatt.deleteRow(index);
}

function setConfig_(key, value) {
  var blatt = sheet_('Config');
  var index = findRow_(blatt, String(key));
  if (index > 0) blatt.getRange(index, 2).setValue(value);
  else blatt.appendRow([key, value]);
}

// ------------------------------------------------------------------- Lesen

function readAll_() {
  return {
    ausgaben:  readSheet_('Ausgaben'),
    einnahmen: readSheet_('Einnahmen'),
    vorlagen:  readSheet_('Vorlagen'),
    config:    readConfig_()
  };
}

function readSheet_(blattName) {
  var spalten = SCHEMA[blattName];
  var blatt = sheet_(blattName);
  var anzahl = blatt.getLastRow() - 1;
  if (anzahl < 1) return [];

  var werte = blatt.getRange(2, 1, anzahl, spalten.length).getValues();
  var out = [];
  for (var i = 0; i < werte.length; i++) {
    if (String(werte[i][0] || '') === '') continue;
    var obj = {};
    for (var j = 0; j < spalten.length; j++) {
      obj[spalten[j]] = normalise_(spalten[j], werte[i][j]);
    }
    out.push(obj);
  }
  return out;
}

function readConfig_() {
  var blatt = sheet_('Config');
  var anzahl = blatt.getLastRow() - 1;
  var cfg = {};
  if (anzahl < 1) return cfg;
  var werte = blatt.getRange(2, 1, anzahl, 2).getValues();
  for (var i = 0; i < werte.length; i++) {
    var k = String(werte[i][0] || '');
    if (k) cfg[k] = werte[i][1];
  }
  return cfg;
}

/** Sheets macht aus "2026-11-01" gern ein Date-Objekt. Datums- und ID-Felder
 *  kommen deshalb immer als String zurueck, Betraege immer als Zahl. */
function normalise_(spalte, wert) {
  if (wert instanceof Date) {
    return Utilities.formatDate(wert,
      SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  }
  if (spalte === 'betrag') return Number(wert) || 0;
  if (spalte === 'notwendigkeit' || spalte === 'tag') return wert === '' ? '' : Number(wert);
  return wert === '' || wert === null ? '' : String(wert);
}

// ------------------------------------------------------------------ Blaetter

function sheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var blatt = ss.getSheetByName(name);
  if (!blatt) {
    blatt = ss.insertSheet(name);
    initSheet_(blatt, name);
    return blatt;
  }
  if (blatt.getLastRow() === 0) {
    initSheet_(blatt, name);
    return blatt;
  }
  spaltenErgaenzen_(blatt, name);
  return blatt;
}

function initSheet_(blatt, name) {
  var spalten = SCHEMA[name];
  blatt.getRange(1, 1, 1, spalten.length).setValues([spalten]).setFontWeight('bold');
  blatt.setFrozenRows(1);
  for (var i = 0; i < spalten.length; i++) formatSpalte_(blatt, name, spalten[i], i + 1);
}

/** Haengt Spalten an, die im Blatt noch fehlen. Damit ist ein Schema-Update
 *  rueckwaertskompatibel und braucht kein Eingreifen in der Tabelle. */
function spaltenErgaenzen_(blatt, name) {
  var soll = SCHEMA[name];
  var breite = Math.max(blatt.getLastColumn(), 1);
  var ist = blatt.getRange(1, 1, 1, breite).getValues()[0].map(function (v) { return String(v || ''); });

  for (var i = 0; i < soll.length; i++) {
    if (ist.indexOf(soll[i]) >= 0) continue;
    var neueSpalte = blatt.getLastColumn() + 1;
    blatt.getRange(1, neueSpalte).setValue(soll[i]).setFontWeight('bold');
    formatSpalte_(blatt, name, soll[i], neueSpalte);
    ist.push(soll[i]);
  }
}

function formatSpalte_(blatt, name, spalte, index) {
  var zeilen = blatt.getMaxRows() - 1;
  if (zeilen < 1) return;
  if (TEXT_SPALTEN.indexOf(spalte) >= 0) {
    blatt.getRange(2, index, zeilen, 1).setNumberFormat('@');
  } else if (spalte === 'betrag') {
    blatt.getRange(2, index, zeilen, 1).setNumberFormat('#,##0.00 "EUR"');
  }
}

function findRow_(blatt, id) {
  var anzahl = blatt.getLastRow() - 1;
  if (anzahl < 1) return -1;
  var spalte = blatt.getRange(2, 1, anzahl, 1).getValues();
  for (var i = 0; i < spalte.length; i++) {
    if (String(spalte[i][0]) === id) return i + 2;
  }
  return -1;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
