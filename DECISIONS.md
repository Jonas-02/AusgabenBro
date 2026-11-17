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
