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
