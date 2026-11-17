# AusgabenBro

Budget-App fürs iPhone. Jeder Pot (z. B. „Einkauf und Haushalt", 210 € im
Monat) füllt sich jeden Tag ein Stück. Du siehst also nicht, was vom Monat
übrig ist, sondern was **heute** wirklich drin ist. Gibst du mehr aus,
zeigt die App, wann der Pot wieder im Plus ist. Fixkosten laufen getrennt
davon.

Unter der Begrüßung steht jeden Tag ein neuer Spruch, der dich fürs
Geldausgeben auslacht. Wer's netter mag, schaltet in den Einstellungen auf
ein eigenes Motto um.

Läuft komplett im Browser, ohne Konto und ohne Server. Die Daten bleiben auf
dem Gerät.

**App:** https://jonas-02.github.io/AusgabenBro/

## Auf dem iPhone installieren

1. Die App-Adresse in **Safari** öffnen und unten auf **Teilen** tippen
   (Quadrat mit Pfeil nach oben).
2. **„Zum Home-Bildschirm"** wählen (eventuell im Menü nach unten scrollen).
3. Oben rechts auf **„Hinzufügen"** tippen.

Danach startet AusgabenBro vom Home-Bildschirm wie eine normale App, ohne
Safari-Leiste und auch offline.

Warum das wichtig ist: In einem normalen Safari-Tab darf iOS die Daten einer
Website löschen, wenn sie 7 Tage nicht benutzt wurde. Apps auf dem
Home-Bildschirm sind davon ausgenommen.

## Daten sichern

Die Daten liegen nur auf diesem einen Gerät. Sichere sie ab und zu:

1. Dashboard → Zahnrad oben rechts → **Daten exportieren**.
2. Im Teilen-Menü **„In Dateien sichern"** wählen (z. B. iCloud Drive).

Wiederherstellen: Einstellungen → **Daten importieren** und die Datei
auswählen. Auf einem neuen Gerät geht das schon im ersten Schritt des
Onboardings über **„Ich habe eine Sicherung"**.

## Entwicklung

Voraussetzung: Node.js 22.

```bash
npm ci
npm run dev        # Entwicklungsserver, http://localhost:5173/AusgabenBro/
npm test           # Unit-Tests der Fachlogik (Vitest)
npm run typecheck
npm run e2e        # Playwright: baut, startet die Vorschau, testet
```

`npm run e2e` hat zwei Projekte bei 393×852 (iPhone 14 Pro):
`webkit-iphone` (wie in der CI) und `chromium-iphone`. Einzeln:
`npx playwright test --project=webkit-iphone`. WebKit einmalig installieren
mit `npx playwright install webkit`.

| Ordner | Inhalt |
| --- | --- |
| `src/domain/` | Fachlogik ohne React: Zyklus, Pots, Vorschau, Fixkosten, Zahlenfeld. Alles in Cent. |
| `src/store/` | Zustand-Store mit `localStorage`, Schema-Version, Migration, Export/Import |
| `src/ui/` | Bausteine aus Figma: Karte, Balken, Chip, Zahlenfeld, FAB, Tab-Leiste, Bottom Sheet |
| `src/screens/` | Dashboard, Ausgaben-Sheet, Fixkosten, Fixkosten-Sheet, abgeleitete Screens |
| `e2e/` | `masse` (Pixel-Abgleich mit Figma), `funktion` (Abnahmekriterien), `visuell` (Screenshots) |
| `design/figma/` | Referenz-Screenshots und Original-Icons aus Figma |

Die Screenshots der E2E-Läufe landen in `e2e/screenshots/aktuell/`. Ein
Seite-an-Seite-Vergleich mit Figma:
`node scripts/vergleich.mjs design/figma/1-2_dashboard.png e2e/screenshots/aktuell/webkit-iphone/1-2_dashboard.png vergleich.png`

Weitere Dokumente: [`PLAN.md`](PLAN.md) (Aufbau und Vorgehen),
[`DECISIONS.md`](DECISIONS.md) (Annahmen und Abweichungen vom Figma).

## Deploy

Jeder Push auf `main` startet `.github/workflows/deploy.yml`:
Typecheck → Unit-Tests → E2E in WebKit → Build → GitHub Pages. Schlägt ein
Test fehl, wird nicht veröffentlicht.

Einmalig im Repository einstellen: **Settings → Pages → Build and deployment
→ Source: „GitHub Actions"**. Steht dort „Deploy from a branch", veröffentlicht
GitHub zusätzlich den ungebauten Quellcode und überschreibt die App.

Der Pfad `/AusgabenBro/` steht in `vite.config.ts` (`base`). Wird das
Repository umbenannt, muss er mitgeändert werden.
