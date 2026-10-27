# AusgabenBro

Ein ausgabenfokussierter Tracker als Notion-Embed. Kein Build, keine
Abhängigkeiten, keine fremden Server: statisches HTML/CSS/JS plus eine
Google-Tabelle als Datenbank.

## Wofür das gut ist

Normale Tracker beantworten „wofür geht mein Geld weg". Diese App beantwortet
die Frage dahinter: **wie viel davon hätte nicht sein müssen** — und ob es von
Monat zu Monat besser wird.

Jede Ausgabe bekommt eine Notwendigkeitsstufe:

| Stufe | Bedeutung |
|---|---|
| 0 Fix | Läuft automatisch: Miete, Versicherung, Abo |
| 1 Nötig | Hätte so oder so sein müssen |
| 2 Geplant | Bewusst gegönnt, kein Reue-Kandidat |
| 3 Impuls | Spontan, hätte nicht sein müssen |
| 4 Reue | Würde ich rückgängig machen |

Daraus entstehen drei Dinge:

- **€ unnötig** (Leitmetrik): Summe aus Impuls + Reue. Bewusst der absolute
  Euro-Betrag und nicht die Quote — die Quote kann sinken, während absolut
  mehr Geld verbrennt. Am Monatsende fehlen Euro, keine Prozentpunkte.
- **Reue-Check**: Ausgaben ab 7 Tagen Alter werden rückblickend mit
  👍 / 😐 / 👎 bewertet. Der Abstand ist Absicht — direkt nach dem Kauf fällt
  die Bewertung systematisch zu positiv aus.
- **Stichwörter**: ein freies Wort pro Ausgabe („Zigaretten", „Lieferando").
  Gleiche Wörter werden unabhängig von Schreibweise zusammengefasst.
  Kategorien sind grob, Stichwörter sind die Ebene, auf der du entscheidest.

## Die sechs Ansichten

| Tab | Inhalt |
|---|---|
| **Erfassen** | Betrag → Kategorie → Stichwort → Notwendigkeit. Umschalter für Einnahmen. |
| **Übersicht** | Kennzahlen des Monats, Verteilung nach Notwendigkeit, Kategorien, Stichwörter, Reue-Ranking |
| **Vergleich** | Dieser Monat gegen Vormonat gegen Startmonat. Was ist teurer, was günstiger geworden — je Kategorie und je Stichwort. |
| **Reue** | Eine Karte pro Ausgabe, rückblickende Bewertung |
| **Liste** | Alle Buchungen des Monats, Suche und Filter |
| **Setup** | Verbindung, Einkommen, Fixkosten, Kategorien, Export |

Alles ist monatsbasiert. Die Baseline für den Vergleich ist automatisch der
erste Monat, in dem etwas erfasst wurde.

## Was automatisch passiert

Beim ersten Öffnen in einem neuen Monat bucht die App dein hinterlegtes
Einkommen und alle Fixkosten selbst und sagt es dir in einer Zeile mit
Rückgängig-Knopf. Du startest also nie bei null, sondern mit dem fertigen
Gerüst. Doppelbuchungen sind ausgeschlossen: gebucht wird nur, wenn der
Abgleich mit der Tabelle erfolgreich war und der Posten in dem Monat noch
nicht existiert.

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

Die vier Tabellenblätter legt das Script beim ersten Zugriff selbst an.
Fehlende Spalten ergänzt es bei jedem Zugriff — ein späteres Schema-Update
braucht deshalb keine Migration von Hand.

### 2. App veröffentlichen

1. Dateien ins Repository pushen.
2. **Settings → Pages → Build and deployment**
   - Source: *Deploy from a branch*
   - Branch: `main`, Ordner `/ (root)` → Save
3. Nach ein paar Minuten liegt die App unter
   `https://<dein-name>.github.io/AusgabenBro/`.

### 3. Onboarding

Beim ersten Start führt die App durch fünf Schritte: Verbindung, Einkommen,
Fixkosten, Kategorien, fertig. Danach ist alles gespeichert, was sich nicht
monatlich ändert. Wiederholbar über **Setup → Einrichtung erneut**.

Zum Ausprobieren ohne Tabelle gibt es in Schritt 1 den Link
„Erstmal ohne Tabelle ausprobieren" — dann bleiben die Daten nur in diesem
Browser.

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
| `Ausgaben` | id, erstellt, datum, betrag, kategorie, notwendigkeit (0–4), stichwort, reue (gut/neutral/schlecht), reueAm |
| `Einnahmen` | id, erstellt, datum, betrag, quelle, notiz |
| `Vorlagen` | id, name, betrag, kategorie, tag, aktiv, zuletzt |
| `Config` | key, value — `kategorien`, `einkommen`, `onboarding`, `zuletztGebucht`, `abschlussGesehen` |

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
  persönlichen Tracker ist das unkritisch — die App gleicht nur bei Änderungen,
  beim Start und beim Tab-Wechsel ab, nicht im Dauertakt.
- Keine Bank-Anbindung. Erfassung ist manuell; das ist beim Thema
  Ausgabenbewusstsein eher Feature als Mangel, kostet aber Disziplin.

## Lokal entwickeln

ES-Module brauchen HTTP, `file://` reicht nicht:

```
python3 -m http.server 8080
```

```
index.html              Gerüst aller Ansichten plus Onboarding-Overlay
assets/kern.js          Konstanten, Geld- und Datumslogik (alles in Cent)
assets/daten.js         Cache, Warteschlange, Transport zum Backend
assets/auswertung.js    Kennzahlen, Stichwort-Gruppierung, Monatsvergleich
assets/charts.js        Diagramme und Vergleichsblöcke als HTML/CSS
assets/app.js           Ansichten, Ereignisse, Onboarding, Automatikbuchung
assets/style.css        Design-Token und Layout
apps-script/Code.gs     Backend für Google Sheets
```

### Design

Die Oberfläche folgt dem Figma-Kit **Maglo – Financial Management Web UI Kit
(Community)**. Die Werte stammen aus den Figma-Variablen der Datei, nicht aus
dem Augenmaß.

| Rolle | Hell | Dunkel | Quelle im Kit |
|---|---|---|---|
| Seitenfläche | `#FAFAFA` | `#1C1A2E` | Gray 1 / Dark BG |
| Karte | `#FFFFFF` | `#201E34` | Pure White / Dark 1 |
| Feld, Chip, Pille | `#F8F8F8` | `#282541` | Gray 2 / Dark 2 |
| Text primär | `#1B212D` | `#FFFFFF` | Text 1 |
| Text sekundär | `#78778B` | `#929EAE` | Text 3 / Text 2 |
| Akzent | `#C8EE44` | `#C8EE44` | Primary Color |
| Positiv | `#29A073` | `#34C08F` | Secondary Color |
| Radius Karte / Pille | 10 px / 6 px | — | Kit |
| Schrift | Kumbh Sans 400/500/600/700 | — | Kit |

Alles liegt als CSS-Custom-Property im `:root`-Block von `assets/style.css`,
je einmal für hell und dunkel. Der Rest des Stylesheets referenziert nur
Rollen, keine Hex-Werte.

#### Bewusste Abweichungen

Sieben Stellen weichen vom Kit ab. Jede hat einen Grund:

1. **Limette trägt keine Daten.** `#C8EE44` hat auf Weiß 1,33:1 Kontrast. Im
   Kit ist das die Füllung der „Expenses"-Linie im Chart — als bedeutungs-
   tragende Fläche ist das nicht lesbar. Limette wird hier nur für Button,
   aktiven Tab und Markenpunkt benutzt, immer mit dunkler Schrift darauf.
2. **Aktiver Tab als gefüllte Pille**, nicht als Unterstrich. Ein 2 px breiter
   Limettenstrich wäre auf Weiß praktisch unsichtbar. Die Pille ist ohnehin
   die Lösung, die das Kit in seinem Sidebar verwendet.
3. **Fokusring** ist in hell `#1B212D` statt Limette, aus demselben Grund.
4. **Die fünfstufige Notwendigkeits-Skala gibt es im Kit nicht.** Sie wurde aus
   Secondary Color und Dark 2 abgeleitet und mit `validate_palette.js` geprüft:
   benachbarte Stufen trennen hell mit ΔE 12,1 (Farbfehlsichtigkeit) und 16,8
   (Normalsicht), dunkel mit 8,8 und 16,5 — Schwellen sind 8 bzw. 15.
   „Geplant" und „Impuls" liegen unter 3:1 Kontrast; deshalb steht an jeder
   Fläche eine sichtbare Beschriftung und jede Karte hat eine Tabellenansicht.
   Farbe trägt nirgends allein die Information.
5. **Warn- und Fehlerfarbe** (`#E8923B`, `#CE2F2F`) sind abgeleitet; das Kit
   hinterlegt dafür keine Variablen.
6. **Grundschriftgröße 15 px** statt der 14 px aus dem Kit. Maglo ist ein
   Desktop-Dashboard, diese App läuft primär auf dem Telefon.
7. **Zeilenhöhe 1,45** im Fließtext statt der im Kit hinterlegten 100 %.
   Deutsche Komposita brechen sonst unleserlich um.
