# AusgabenBro

Ein ausgabenfokussierter Tracker als Notion-Embed. Kein Build, keine
Abhängigkeiten, keine fremden Server: statisches HTML/CSS/JS plus eine
Google-Tabelle als Datenbank.

## Wofür das gut ist

Normale Tracker beantworten „wofür geht mein Geld weg". Diese App beantwortet
zwei Fragen, die Standardtools nicht stellen:

1. **Wie nötig war das?** Jede Ausgabe bekommt eine Stufe von 0 (Fixkosten) bis
   4 (Reue). Daraus entsteht die **Unnötig-Quote**: Anteil Impuls + Reue am
   beeinflussbaren Teil deiner Ausgaben.
2. **Für wen war das?** Nur ich / geteilt / für andere, optional mit Namen.
   Daraus entsteht der **Spendabel-Saldo**: was du für andere zahlst, minus was
   zurückkommt. Pro Person.

Dazu der **Reue-Check**: Ausgaben, die mindestens 7 Tage alt sind, werden
rückblickend mit 👍 / 😐 / 👎 bewertet. Der zeitliche Abstand ist Absicht —
direkt nach dem Kauf fällt die Bewertung systematisch zu positiv aus.
Aus diesen Urteilen entsteht das **Reue-Ranking**: welche Kategorien pro Euro
die meiste Reue produzieren.

Daneben ist es ein vollständiger Tracker: Einnahmen, Fixkosten-Vorlagen,
eigene Kategorien, Monatsnavigation, Suche, Export.

## Einrichtung

### 1. Google-Tabelle und Backend (ca. 10 Minuten)

1. Neue Google Tabelle anlegen, z. B. „AusgabenBro".
2. **Erweiterungen → Apps Script**.
3. Inhalt von [`apps-script/Code.gs`](apps-script/Code.gs) komplett in `Code.gs`
   einfügen (vorhandenen Inhalt ersetzen) und speichern.
4. Token erzeugen, z. B. im Terminal:
   ```
   openssl rand -base64 24
   ```
5. Im Apps Script: **Zahnrad (Projekteinstellungen) → Scripteigenschaften →
   Scripteigenschaft hinzufügen**
   - Eigenschaft: `AUSGABENBRO_TOKEN`
   - Wert: das erzeugte Token
6. **Bereitstellen → Neue Bereitstellung → Typ auswählen → Web-App**
   - Ausführen als: **Ich**
   - Zugriff: **Jeder**
   - Bereitstellen, Zugriff genehmigen (die Warnung „nicht überprüfte App" ist
     dein eigenes Script — über „Erweitert → Zu … wechseln" bestätigen).
7. Die **Web-App-URL** kopieren. Sie endet auf `/exec`.

Die vier Tabellenblätter (`Ausgaben`, `Einnahmen`, `Vorlagen`, `Config`) legt
das Script beim ersten Zugriff selbst an.

### 2. App veröffentlichen

GitHub Pages reicht und kostet nichts:

1. Dateien ins Repository pushen.
2. **Settings → Pages → Build and deployment**
   - Source: *Deploy from a branch*
   - Branch: `main`, Ordner `/ (root)` → Save
3. Nach ein paar Minuten liegt die App unter
   `https://<dein-name>.github.io/ausgabenbro/`.

### 3. Verbinden

App öffnen → Tab **Setup** → Web-App-URL und Token eintragen →
**Verbinden & testen**. Der Punkt oben rechts wird grün.

### 4. In Notion einbetten

1. In Setup auf **Embed-Link erzeugen** klicken. Der Link enthält die
   Zugangsdaten im `#`-Fragment und wird in die Zwischenablage kopiert.
2. In Notion `/embed` eingeben, den Link einfügen, Höhe auf ca. 900 px ziehen.

Der Umweg über den Link ist bewusst: Browser behandeln Speicher in einem
fremden iframe getrennt und löschen ihn teilweise automatisch. Steckt die
Konfiguration im Link, überlebt sie das.

> **Diese Notion-Seite nicht öffentlich teilen.** Der Embed-Link enthält dein
> Token, und wer URL und Token hat, kann die Tabelle lesen und beschreiben.

## Sicherheit

- Im Quelltext dieses Repositories stehen **keine Zugangsdaten**. URL und Token
  liegen nur im Browser bzw. im Embed-Link.
- Das Web-App läuft unter deinem Google-Konto und ist auf „Jeder" gestellt —
  das ist technisch nötig, weil ein Browser keine Google-Anmeldung an Apps
  Script durchreichen kann. Geschützt wird der Zugriff ausschließlich durch das
  Token. Entsprechend: langes Token nehmen.
- Token wechseln: Scripteigenschaft ändern, in Setup neu eintragen, neuen
  Embed-Link erzeugen.

## Datenmodell

| Blatt | Spalten |
|---|---|
| `Ausgaben` | id, erstellt, datum, betrag, kategorie, notwendigkeit (0–4), fuerWen (ich/geteilt/andere), person, notiz, reue (gut/neutral/schlecht), reueAm |
| `Einnahmen` | id, erstellt, datum, betrag, typ (einkommen/erstattung), quelle, person, notiz |
| `Vorlagen` | id, name, betrag, kategorie, notwendigkeit, tag, aktiv, zuletzt |
| `Config` | key, value |

Die Tabelle bleibt von Hand lesbar und bearbeitbar. Änderungen dort erscheinen
beim nächsten Abgleich in der App.

## Verhalten bei Verbindungsproblemen

Jede Eingabe wirkt sofort lokal und wandert zusätzlich in eine Warteschlange.
Antwortet die Tabelle nicht, wird der Punkt oben rechts rot, die App bleibt aber
voll bedienbar. Sobald die Verbindung steht — oder du auf den Punkt klickst —
wird alles nachgeschickt. Getestet inklusive Backend-Ausfall mitten im Betrieb.

## Grenzen

- Ein Abgleich dauert je nach Google-Antwortzeit etwa 0,5–2 Sekunden. Die
  Oberfläche wartet nicht darauf.
- Ungesendete Einträge liegen nur in dem Browser, in dem du sie erfasst hast,
  bis der nächste Abgleich klappt.
- Apps-Script-Web-Apps haben Tageskontingente für Laufzeit. Für einen
  persönlichen Tracker ist das unkritisch, bei Dauer-Polling wäre es das nicht —
  die App gleicht deshalb nur bei Änderungen, beim Start und beim Tab-Wechsel ab.
- Keine Bank-Anbindung. Erfassung ist manuell; das ist beim Thema
  Ausgabenbewusstsein eher Feature als Mangel, kostet aber Disziplin.

## Lokal entwickeln

ES-Module brauchen HTTP, `file://` reicht nicht:

```
cd ausgabenbro
python3 -m http.server 8080
```

Dann `http://localhost:8080` öffnen.

```
index.html              Gerüst aller fünf Ansichten
assets/kern.js          Konstanten, Geld- und Datumslogik (alles in Cent)
assets/daten.js         Cache, Warteschlange, Transport zum Backend
assets/auswertung.js    Kennzahlen (Unnötig-Quote, Spendabel-Saldo, Ranking)
assets/charts.js        Diagramme als HTML/CSS
assets/app.js           Ansichten und Ereignisse
assets/style.css        Design-Token und Layout
apps-script/Code.gs     Backend für Google Sheets
```

### Farbwahl

Die Notwendigkeits-Skala ist eine divergierende Skala (nötig ← neutral →
unnötig) und wurde gegen Farbfehlsichtigkeit geprüft: benachbarte Stufen
trennen hell mit ΔE 10,0 (CVD) bzw. 15,7 (Normalsicht), dunkel mit 10,7 bzw.
17,3. Zahlen stehen grundsätzlich neben den Flächen, nie darin, und jedes
Diagramm hat eine Legende mit Werten sowie eine aufklappbare Tabelle — Farbe
trägt nirgends allein die Information.
