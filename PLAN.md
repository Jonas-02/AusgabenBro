# Plan

Mobile Budget-Web-App nach Figma `avEMvPMNo2Yoy2zJaeIEml`, ausgeliefert über
GitHub Pages, genutzt als Home-Bildschirm-App in Safari auf dem iPhone.

## Schritte

| # | Schritt | Ergebnis | Stand |
|---|---|---|---|
| 1 | Figma einlesen | Referenz-Screenshots aller 5 Frames in `design/figma/`, alle Icons als SVG, Maße und Tokens notiert | erledigt |
| 2 | Grundgerüst | Vite + React + TS strict, Fontsource (selbst gehostet), Tokens als Custom Properties, Zustand mit versioniertem `persist`, Hash-Routing, PWA, GitHub Action | erledigt |
| 3 | Fachlogik | `src/domain/` als reine Funktionen: Geld, Datum, Zyklus, Pot, Vorschau, Fixkosten, Zahlenfeld. Alle Pflichttests aus 3.7 grün, bevor es weitergeht | erledigt |
| 4 | UI-Bausteine | Karte, Balken, Chip, Keypad-Taste, Schnellbetrag, FAB, Tab-Leiste, Bottom Sheet, Betrag mit Schriftmischung, Toast | erledigt |
| 5 | Screens | Dashboard → Ausgaben-Sheet → Fixkosten → Fixkosten-Sheet → abgeleitete Screens (Pot-Verlauf, Bearbeiten/Löschen, Einstellungen, Onboarding) | erledigt |
| 6 | Visuelle Abnahme | Playwright bei 393×852 alle Screens und Zustände fotografieren, gegen `design/figma/` vergleichen, Abweichungen beheben oder in `DECISIONS.md` begründen | erledigt |
| 7 | Doku und Deploy | `README.md`, Push, Deploy prüfen | erledigt |

Abnahme (Prompt, Abschnitt 8): `e2e/masse.spec.ts` prüft alle Figma-Frames
auf 1 px, `e2e/funktion.spec.ts` deckt die übrigen Kriterien ab, beide laufen
vor jedem Deploy in WebKit.

## Architektur

```
src/
  domain/      reine Fachlogik, keine React-Abhängigkeit, alle Tests hier
  store/       Zustand-Store, Schema mit Version und Migration, Startwerte
  ui/          wiederverwendbare Bausteine und Icons
  screens/     Bildschirme und Sheets
  hooks/       Hash-Routing, „heute" mit visibilitychange
  styles/      Tokens und Grundstile
e2e/           Playwright-Tests und Screenshot-Abnahme
design/figma/  Referenz-Screenshots aus Figma
```

## Leitregeln

- Geld immer in ganzen Cent. Keine Fließkommazahlen in der Fachlogik.
- Datum als lokaler Kalendertag `YYYY-MM-DD`. Tagesdifferenzen werden über
  `Date.UTC` gerechnet, damit ein Tag mit 23 oder 25 Stunden trotzdem genau
  ein Tag ist.
- Figma ist die Quelle für das Aussehen. Wo Figma und Spezifikation
  widersprechen, steht die Auflösung in `DECISIONS.md`.
