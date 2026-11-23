# Entscheidungen

Annahmen und Abweichungen, jeweils mit Grund. Figma ist die Quelle für das
Aussehen; wo Figma und Spezifikation sich widersprechen, steht hier, was gilt.

## Werkzeuge und Umgebung

### E2E läuft lokal in Chromium, in der CI in WebKit
Die Spezifikation verlangt Playwright mit WebKit. In der Entwicklungsumgebung
ließ sich WebKit nicht herunterladen (Netzwerk gesperrt), vorinstalliert ist
nur Chromium. Deshalb gibt es zwei Playwright-Projekte:
`webkit-iphone` läuft in der GitHub Action und ist dort Voraussetzung für den
Deploy, `chromium-iphone` dient lokal. Beide nutzen 393×852.

### Offline-Test in WebKit
In der CI bricht Playwright-WebKit ein Neuladen nach `context.setOffline(true)`
mit „WebKit encountered an internal error" ab, obwohl der Service Worker die
Seite da schon kontrolliert. Lokal lässt sich das nicht nachstellen (kein
WebKit). Deshalb zwei Tests: „Service Worker hält alle Dateien für offline
bereit" prüft in beiden Engines, dass HTML, JS, CSS, Manifest, Icons und
Schriften im Cache liegen; „lädt ohne Netz neu" lädt tatsächlich offline neu
und läuft nur in Chromium. Auf dem iPhone selbst ist der Offline-Start einmal
von Hand zu prüfen (Flugmodus, App vom Home-Bildschirm öffnen).

### Audit-Meldungen in `workbox-build`
`npm audit` meldet vier mittlere Schwachstellen in `glob`/`minimatch`, die
`vite-plugin-pwa` über `workbox-build` mitbringt. Beide laufen nur beim Bauen
des Service Workers über die eigenen Dateien, nichts davon wird ausgeliefert.
Der angebotene Fix wäre ein Rückschritt auf `vite-plugin-pwa` 1.x. Belassen.

### Nur Latin-Untermenge der Schriften
`@fontsource/manjari` bringt zusätzlich Malayalam mit (63 KB). Eingebunden ist
nur `latin-400` beider Schriften; das deckt ä, ö, ü, ß und € ab und spart rund
90 KB im Offline-Cache.

## Design-Tokens

### Zusätzliche Farbe `#9D9D9D`
Inaktiver Tab und der Chip „Neue Kategorie" verwenden in Figma `#9D9D9D`.
Steht nicht in der Token-Liste der Spezifikation, Figma gilt.

### Laufweiten vereinheitlicht
Figma ist innerhalb derselben Zeile uneinheitlich: Manjari bei 12 px mal
−0,84 px (−7 %), mal −1,12 px (−9,3 %); Momo bei 12 px mal −1,56 px (−13 %),
mal −2,08 px (−17,3 %). Umgesetzt ist durchgängig die Regel der
Spezifikation: Manjari −7 %, Momo −13 %, als `em`, damit sie mit der
Schriftgröße mitwächst. Der Unterschied liegt bei höchstens 2 px je Zeile.

### Kartenrand
Karten haben in Figma einen 1-px-Rand in `#1E1E1E` auf `#252525`. Übernommen.

## Icons

### Ein Icon je Motiv, Farbe über `currentColor`
Figma exportiert manche Icons mehrfach in verschiedenen Farben (weiß, dunkel
auf blauem Chip, aktiv und inaktiv in der Tab-Leiste). Alle Varianten wurden
maschinell verglichen und sind bis auf die Farbe identisch. Eingebunden ist
jedes Motiv einmal, `scripts/icons-aus-figma.py` ersetzt nur die festen
Farben. Die Original-Exporte liegen in `design/figma/icons/`.

### Zahnrad für die Einstellungen
Nicht im Figma. Die Figma-Icons stammen aus der Lucide-Familie; verwendet ist
deshalb Lucide „settings" im gleichen Strichstil (`src/ui/icons/abgeleitet.ts`).

### „Zurück"-Pfeil
Kein eigenes Icon: der Chevron aus Figma, um 90° gedreht.

### App-Icons
Nicht im Figma. Abgeleitet aus dem Wallet-Icon der Tab-Leiste in `#6598E4` auf
`#1E1E1E`, gerendert mit `npm run icons`.

## Fachlogik

### Vorgriff-Balken folgt der Formel, nicht den Figma-Pixeln
In `7:198` ist der graue Teil 22 px breit. Nach der Regel aus 3.5
(`max(before, 0)` = 20,43 € von 210 € auf 329 px) wären es 32 px; der orange
Teil (18 px = 11,57 €) stimmt dagegen. Die Formel ist in sich schlüssig
(ausgegeben + vorher = zugeflossen), deshalb gilt sie. Für `7:4` stimmt die
Formel mit Figma auf 0,1 px überein (154,4 / 13,2 / 18,8 px) – das ist als
Test hinterlegt.

### Vorgriff bei einem Pot, der schon im Minus ist
Die Regel `[spent][max(before,0)][−after]` zeigt das bestehende Defizit
doppelt, wenn `before < 0` ist: es steckt schon in `spent` und noch einmal in
`−after`. Der blaue Teil wird deshalb auf den Zufluss begrenzt
(`min(spent, before + spent)`). Für `before ≥ 0` ändert das nichts, die
Gesamtbreite ist immer `spent + amount`.

### Balken über 100 %
Übersteigen die Segmente den Monatsbetrag (sehr großer Vorgriff), wird der
Balken auf die Summe skaliert statt abgeschnitten. Sonst würde ausgerechnet
der orange Teil verschwinden.

### Monatsbetrag ändern
Jeder Pot speichert eine Liste `{ ab, cent }`. Ein Betrag gilt für den ganzen
Zyklus, in dem `ab` liegt, und alle späteren – also rückwirkend für den
laufenden Zyklus, wie gefordert. Frühere Zyklen behalten ihren alten Betrag,
was im Modus `carry` für einen korrekten Übertrag nötig ist.

### Übertrag (`carry`)
Summiert `Monatsbetrag − Ausgaben` aller abgeschlossenen Zyklen ab dem Zyklus,
in dem der Pot angelegt wurde. Ändert der Nutzer den Zahltag, werden auch die
vergangenen Zyklen mit dem neuen Zahltag geschnitten; eine Historie des
Zahltags wird nicht geführt.

### Ausgleich im Modus `carry`
Die Suche nach `n` läuft über das Zyklusende hinaus in den nächsten Zyklus mit
dessen Monatsbetrag und Länge weiter. Im Modus `reset` endet sie am Zyklusende
mit „diesen Monat nicht mehr ausgeglichen". Obergrenze 400 Tage.

### Fixkosten: Abbuchung am heutigen Tag
Die Spezifikation sagt „abgebucht, wenn der Tag schon erreicht ist", nennt
aber zugleich „heute" für 0 Tage – beides zusammen geht nicht. Umgesetzt: Tag
vor heute → „abgebucht", heute → „heute", morgen → „morgen".

### Fixkosten jährlich: Status im Abbuchungsmonat
Für vierteljährliche Posten verlangt die Spezifikation im Abbuchungsmonat
„· abgebucht" bzw. „· in n Tagen". Für jährliche schweigt sie. Ergänzt wird
derselbe Zusatz, damit eine jährliche Abbuchung nicht unbemerkt kommt.

### Schnellbeträge
+5 / +10 / +20 € behalten die Zahl der getippten Nachkommastellen bei:
„12,5" → „22,5", „12,50" → „32,50". Überschreitet das Ergebnis 99.999,99 €,
passiert nichts.

## Typografie im Browser

### Laufweite pro Element
`letter-spacing: -0.07em` am `body` würde einmal bei 16 px zu −1,12 px
ausgerechnet und als fester Wert vererbt; ein 12-px-Text bekäme −9,3 % statt
−7 %. Die Laufweite wird deshalb über `:where(*)` an jedem Element relativ zu
dessen eigener Schriftgröße berechnet. Elemente in Momo geben ihren Wert an
Kind-Elemente weiter.

### Nachlaufende Laufweite
CSS setzt die Laufweite auch hinter das letzte Zeichen, Figma nicht. Bei
Momo 14 px sind das 1,82 px pro Textbox. Wo die Breite einer Box zählt
(Chips, Schnellbeträge, FAB, Betrag vor dem Cursor), wird das mit
`.ende-text` / `.ende-num` ausgeglichen.

### Gemischte Schriften in einer Zeile
Manjari und Momo haben unterschiedliche Ober- und Unterlängen. In einer
gemischten Zeile („du hast 380,32 € von 425 € ausgegeben") wächst die
Zeilenbox dadurch auf 18 statt 16 px. Kurze Zeilen (Meta-Spalte, Statuszeile)
haben deshalb eine feste Höhe. Der Satz in der Hauptkarte muss bei großer
Schrift umbrechen dürfen; dort tragen die Momo-Zahlen `line-height: 0` und
damit nichts zur Zeilenhöhe bei. Ergebnis: 16 px wie im Figma, mehrzeilig
wenn nötig.

### Textbreiten
Die Abnahme in `e2e/masse.spec.ts` prüft Positionen und Höhen auf 1 px.
Breiten von Textboxen (Chips, Schnellbeträge, FAB) dürfen bis 3 px abweichen:
Browser und Figma messen Glyphen minimal unterschiedlich, das lässt sich nicht
für alle Zeichenfolgen gleichzeitig ausgleichen.

### Leere Betragseingabe
Ohne Eingabe zeigt das Ausgaben-Sheet eine „0" in 35 % Deckkraft vor dem
Cursor. Nicht im Figma; ohne Platzhalter stünde nur „| €".

### Hinweis „Betrag eingeben"
Ein Toast außerhalb des `<dialog>` liegt unter dem Top Layer und wäre nicht
sichtbar. Der Hinweis erscheint deshalb 1,6 Sekunden lang als Beschriftung
des Speichern-Buttons. Die Höhe des Sheets bleibt dabei gleich.

## Pot-Card v2 (Figma `20:187`)

Ersetzt die Pot-Karten aus `1:2`: Icon und Name stehen in der Karte (Manjari
14 statt 11), Innenabstand 12, Karte 107 px hoch, Abstand zwischen Karten
weiter 12 px. Geprüft in `e2e/masse.spec.ts` und per Bildvergleich
(`design/figma/20-187_pot-card-v2.png`).

- **Rechter Rand 18 statt 12 px.** In Figma ist die linke Spalte fest 202 px
  breit und die Monat/Tag-Spalte folgt mit 6 px Abstand; dadurch endet sie
  6 px vor dem Innenrand. Übernommen wie gezeichnet; falls symmetrisch
  gemeint, ist es eine Zeile (`.potKopf` in `Dashboard.module.css`).
- **Minus-Balken zweigeteilt.** Figma zeigt für „Drogen" zwei orange Teile
  mit 1-px-Trennlinie in Kartenfarbe. Gedeutet als: links der Teil, der bis
  heute zugeflossen war, rechts der Vorgriff (= das Minus). Das entspricht
  der Vorgriff-Logik im Ausgaben-Sheet. Die Figma-Breiten (233 | 39 px) sind
  wie in `1:2` Platzhalter; die App rechnet aus den Beträgen (85 € | 20 €
  von 150 € → 190 | 45 px).
- **Name 2 px tiefer als mittig.** Figma setzt die 11-px-Textzeile oben an
  die Textbox; gemessen und per `translateY(2px)` nachgebildet.

## Abgeleitete Screens

Nicht im Figma, aus dessen Formensprache gebaut. Neue Farben, Schriften oder
Radien gibt es nicht.

| Screen | Woraus abgeleitet |
| --- | --- |
| Pot-Verlauf (`#/pot/:id`) | Seitenkopf und Hauptkarte aus Dashboard `1:2`, Liste aus Fixkosten `11:72`. Zeigt die Ausgaben des laufenden Zyklus, neueste oben. Tipp öffnet das Ausgaben-Sheet im Bearbeiten-Modus. |
| Ausgabe bearbeiten | Ausgaben-Sheet `7:4` mit Titel „Ausgabe bearbeiten", Knopf „Änderung speichern" und orangem „Löschen" darunter. |
| Fixkosten bearbeiten | Fixkosten-Sheet `12:187`, vorbelegt, mit „Löschen". |
| Einstellungen (`#/einstellungen`) | Abschnitte wie „Deine Pots" `1:2`, Felder und Auswahlzeile aus `12:187`, Chips aus `7:4`, Listenzeilen aus `11:72`. |
| Pot anlegen/bearbeiten | Sheet nach `12:187`: großer Betrag, Textfeld, Symbolwahl, Speichern, Löschen. |
| Symbolwahl | Quadratische Flächen im Stil der Chips, aktiv in Akzentblau. Echte Radio-Buttons (Pfeiltasten, Screenreader). |
| Rückfrage (Import, Alles löschen) | Bottom Sheet mit Text, Hauptknopf `7:184` (bei „Alles löschen" in `#F59E6F`) und „Abbrechen". |
| Onboarding | Drei Schritte mit Fortschrittsstrichen in Balkenfarben: Name und Zahltag, Pots (vorbelegt mit den Figma-Werten), Home-Bildschirm-Hinweis. |
| Toast „Gespeichert · Rückgängig" | Kartenfläche mit Akzentfarbe für die Aktion, über dem FAB. |
| Zurück-Link | Akzentblau wie das Motto, Chevron um 90° gedreht. |

### Löschen und Rückgängig
Ausgaben, Fixkosten und Pots werden sofort gelöscht, der Toast bietet
5 Sekunden lang „Rückgängig". Ein Pot nimmt seine Ausgaben mit (sonst hingen
sie an keinem Pot mehr); „Rückgängig" stellt beides an alter Stelle wieder
her. Nur „Alle Daten löschen" und „Importieren" fragen vorher nach, weil sie
alles ersetzen. Beide lassen sich danach trotzdem 8 bzw. 5 Sekunden lang
rückgängig machen.

### Nur Ausgaben löschen
Nachträglicher Wunsch: Einstellungen → „Alle Ausgaben löschen" entfernt alle
Ausgaben samt Notizen; Pots (Name, Symbol, aktueller Betrag, Reihenfolge),
Fixkosten, Kategorien und Einstellungen bleiben. Zusätzlich beginnen die Pots
heute neu (`erstelltAm` und Betragsverlauf). Ohne das würden im Modus
„mitnehmen" die geleerten Vormonate als voll gespart zählen (Übertrag =
Monatsbetrag × Monate), und der Monatsvergleich zeigte leere Monate. Der
laufende Monat ändert sich dadurch nicht: Zugeflossen wird wie immer ab
Zyklusbeginn. Mit Rückfrage und 8 Sekunden „Rückgängig".

### Pot mitten im Zyklus anlegen
Die Formel aus 3.3 rechnet ab Zyklusbeginn. Ein am 17. angelegter Pot hat
damit sofort 17/30 seines Monatsbetrags. Das passt zum Onboarding (der
Monat läuft ja schon) und hält die Formel einfach. Im Modus `carry` zählt der
Übertrag erst ab dem Anlage-Zyklus.

### Datensicherung
Export erzeugt `ausgabenbro-JJJJ-MM-TT.json`. Auf dem iPhone öffnet sich das
Teilen-Menü („In Dateien sichern"), weil ein Download-Link in einer
Home-Bildschirm-App nicht zuverlässig funktioniert; andere Browser laden die
Datei herunter. Import prüft Format, Version und Verweise und zeigt vor dem
Ersetzen, was die Datei enthält. Im Onboarding gibt es „Ich habe eine
Sicherung" für den Gerätewechsel. `navigator.storage.persist()` wird beim
Abschluss des Onboardings angefragt (bzw. nach einem Import).

### Tagesspruch statt Motto
Nachträglicher Wunsch: Unter „Hallo {Name}," steht standardmäßig ein
täglich wechselnder Spruch (47 Stück in `src/inhalt/sprueche.ts`, bewusst
derb). In den Einstellungen lässt sich auf das eigene Motto zurückschalten.
Der Spruch wechselt um Mitternacht und bleibt den Tag über gleich; jede Runde
zeigt jeden Spruch einmal, in fester Zufallsreihenfolge, ohne Wiederholung
an zwei Tagen hintereinander (`src/domain/tagesspruch.ts`). Figma zeigt eine
Zeile; Sprüche dürfen zwei Zeilen haben, ein E2E-Test prüft das für alle bei
393 px. Neues Feld `tagesspruch` → Schema-Version 2; ältere Daten und
Sicherungen werden migriert und bekommen den Spruch eingeschaltet.

### Analyse-Seite (`#/analyse`)
Nachträglicher Wunsch. Erreichbar über einen **dritten Tab** „Analyse"; die
Tab-Leiste in Figma `10:50` hat nur zwei. Das Icon ist Lucide
„chart-column" im Strichstil der Figma-Icons. Inhalt, von oben nach unten:

| Abschnitt | Form | Warum diese Form |
| --- | --- | --- |
| Hochrechnung | Zahl + Linie (ausgegeben kumuliert vs. zugeflossenes Budget, gestrichelt hochgerechnet) | Die eine Frage „reicht's bis zum Zahltag?" als Zahl, der Verlauf als Kontext. Eine Achse. |
| Pro Tag | Säulen je Tag mit Tagesbudget als Linie, Orange = drüber | Zeigt die Ausreißer-Tage. |
| Kennzahlen | 4 Kacheln | Einzelwerte, kein Diagramm nötig. |
| Wohin dein Geld geht | Rangliste mit Balken, eine Farbe | Anteile vergleichen; kein Kreisdiagramm (schlecht ablesbar bei ähnlichen Werten). |
| Monate im Vergleich | Säulen je Zyklus, Strich = Budget | Trend über bis zu 6 Monate. |
| Wochentage | Säulen, höchster Tag hervorgehoben | Muster („am Wochenende teuer"). |
| Was dich ein Monat kostet | Summe + dünner geteilter Balken, Liste der Abbuchungen in 30 Tagen | Budget und Fixkosten zusammen, sonst nirgends sichtbar. |

Farben nur aus den Tokens: Blau = ausgegeben, Hellgrau = Budget bzw.
zugeflossen (wie im Balken der Pot-Karten), Orange = drüber, `#9D9D9D` für
Fixkosten. Geprüft mit dem Palettenprüfer: Blau und Hellgrau ΔE 23 (Ziel ≥ 8)
auch bei Rot-Grün-Schwäche, alle Marken ≥ 3:1 zur Karte. Die Prüfregeln für
bunte Kategorien-Paletten (Helligkeitsband, Mindest-Sättigung) greifen hier
nicht: Grau ist bewusst neutral, Blau ist die Figma-Akzentfarbe.

Jedes Diagramm: Antippen bzw. Pfeiltasten zeigen den Wert, Screenreader lesen
ihn über eine Live-Region vor, und „Werte als Tabelle" zeigt alle Zahlen ohne
Grafik. Nichts ist nur über Farbe oder nur über Antippen erreichbar.

**Hochrechnung:** bewusst einfach, linear: bisherige Ausgaben ÷ vergangene
Tage × Tage im Zyklus. Das ist eine Extrapolation, keine Vorhersage; ein
großer Einkauf am Monatsanfang verzerrt sie. Deshalb erst ab Tag 3. Der
„Spielraum" ist (Budget − Ausgaben) ÷ verbleibende Tage einschließlich heute.
**Wochentage** mitteln über alle Tage seit dem ersten Pot, auch Tage ohne
Ausgabe; unter 4 Wochen steht ein Hinweis, dass die Werte wenig aussagen.

### Notizen an Ausgaben
Nachträglicher Wunsch. Optionales Feld `notiz` (max. 60 Zeichen, Leerzeichen
bereinigt) → Schema-Version 3; ältere Daten und Sicherungen bleiben gültig.

- **Im Ausgaben-Sheet** steht das Feld unter den Pot-Chips, Stil wie Figma
  `12:201`, aber **36 statt 40 px hoch und 8 statt 14 px Abstand**: Auf dem
  iPhone 14 Pro hat das Sheet höchstens 781 px (852 − 59 Dynamic Island − 12).
  Mit 40 px und 14 px Abstand wären es 786 px, „Speichern" läge außerhalb.
  So sind es 776 px. Alles über dem Feld rückt gegenüber `7:4` um 44 px nach
  oben, alles darunter bleibt pixelgleich (`e2e/masse.spec.ts`).
- Die 3-Tap-Erfassung bleibt: Die Notiz ist optional.
- Solange das Notizfeld den Fokus hat, ignoriert der Hardware-Tastatur-Listener
  des Zahlenfelds Ziffern und Rücktaste; Enter schließt nur die Tastatur.
- **Vorschläge** über `<datalist>` (iOS zeigt sie über der Tastatur): frühere
  Notizen, die des gewählten Pots zuerst. Das hält die Schreibweise einheitlich,
  sonst zerfällt „Zigaretten" in der Auswertung in mehrere Einträge.
- **Auswertung „Wofür"** in der Analyse: gruppiert ohne Rücksicht auf Groß-/
  Kleinschreibung, angezeigt wird die häufigste Schreibweise. Die 8 größten
  Posten einzeln, der Rest als „n weitere", dazu „ohne Notiz" in Grau.
  Umschaltbar „dieser Monat" / „seit Beginn"; ab 4 Wochen Daten mit
  Hochrechnung pro Monat (Summe × 30,44 / Tage). Synonyme („Kippen" vs.
  „Zigaretten") werden nicht zusammengeführt; dafür sind die Vorschläge da.

### Texte aus dem Figma
„a month" und „daily" bleiben englisch, wie im Figma. Das Start-Motto ist
der Figma-Text und in den Einstellungen änderbar.

## Barrierefreiheit

### Kontraste (WCAG 2.1, berechnet mit den Token-Farben)

| Vordergrund | auf Karte `#252525` | auf Hintergrund `#1E1E1E` |
| --- | --- | --- |
| Weiß | 15,3:1 | 16,7:1 |
| Weiß 60 % | 6,5:1 | 6,8:1 |
| Akzent `#6598E4` | 5,2:1 | 5,7:1 |
| Minus `#F59E6F` | 7,3:1 | 7,9:1 |
| Inaktiv `#9D9D9D` | 5,7:1 | 6,2:1 |
| `#1E1E1E` auf Akzent (Knöpfe, aktive Chips) | 5,7:1 | |
| Weiß 35 % | 3,1:1 | 3,2:1 |

Alles über 4,5:1 bis auf Weiß 35 %. Das steht im Figma nur für „€" und die
leere „0" im großen Betrag (56 px, große Schrift, Grenze 3:1, erfüllt).
Platzhalter in Textfeldern (16 px) sind deshalb abweichend 60 % statt 35 %.

### Laufweite unter 14 px bleibt bei −7 %
Die Spezifikation erlaubt 0 statt −7 % für Text unter 14 px, „sofern das die
Optik nicht spürbar verändert". Es verändert sie spürbar: −7 % sind bei 11 px
0,77 px je Zeichen, bei 12 px 0,84 px. „am 20. · in 3 Tagen" würde 15 px
breiter, „du hast 105 € von 85 € ausgegeben" rund 20 px. Damit stimmen Chips,
Zeilen und Umbrüche nicht mehr mit Figma überein. Die Bedingung ist nicht
erfüllt, die Laufweite bleibt. Belegt ist, dass etwas weitere Laufweite das
Worterkennen leicht beschleunigt (Perea, Moret-Tatay & Gómez 2011, Acta
Psychologica 137); der Effekt liegt im Bereich weniger Millisekunden. Die
Umstellung wäre eine Zeile in `src/styles/base.css`.

### Screenreader
Beträge haben einen unsichtbaren, korrekt formatierten Text („76,43 €"),
die sichtbaren Einzel-Spans sind `aria-hidden`. Pot-Karten nennen Namen und
Stand („Drogen: -20 € im Minus. Ausgaben ansehen"). Betrag und Vorschau im
Sheet sind `aria-live="polite"`. Die Rücktaste im Zahlenfeld heißt „Letzte
Ziffer löschen", damit sie nicht mit „Löschen" (Ausgabe löschen) verwechselt
wird. Nach jedem Onboarding-Schritt springt der Fokus auf die neue
Überschrift.

## Große Schrift

Die App nutzt feste Pixelgrößen wie Figma. iOS-Dynamic-Type wirkt in Safari
nur auf Seiten mit Systemschrift-Schlüsselwörtern, hier also nicht. Was
wirkt, ist der Safari-Seitenzoom (aA). 150 % entsprechen 262 CSS-Pixeln
Breite; so testen `e2e/funktion.spec.ts` (kein seitliches Überlaufen) und
`e2e/visuell.spec.ts` (Screenshots `gross_*`). Dafür dürfen Kartenköpfe,
der Satz in der Hauptkarte und Namen in Listen umbrechen, und Inhalte im
Sheet schrumpfen nicht mehr, wenn das Sheet scrollt. Bei 393 px ändert sich
dadurch nichts (Maße-Test grün).

Bewusst gekürzt mit „…" bleibt der Pot-Name in „danach in …" im
Ausgaben-Sheet: Würde er umbrechen, änderte sich die Sheet-Höhe beim
Wechseln des Pots. Der volle Name steht im gewählten Chip direkt darüber.

