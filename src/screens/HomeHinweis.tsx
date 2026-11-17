import { alsAppGestartet } from '../store/backup';
import { Icon } from '../ui/Icon';
import { Karte } from '../ui/Karte';
import h from './HomeHinweis.module.css';

/**
 * Abgeleitet (nicht im Figma): Anleitung "Zum Home-Bildschirm" in drei
 * Schritten. Als Home-Bildschirm-App laeuft AusgabenBro ohne Safari-Leiste,
 * und Safari raeumt die Daten nicht nach 7 Tagen ohne Nutzung weg.
 */
export function HomeHinweis() {
  if (alsAppGestartet()) {
    return (
      <Karte className={h.karte}>
        <p className={h.text}>Du nutzt AusgabenBro schon vom Home-Bildschirm. Deine Daten bleiben auf diesem Gerät.</p>
      </Karte>
    );
  }
  return (
    <Karte className={h.karte}>
      <ol className={h.schritte}>
        <li>
          <span className={h.nr} aria-hidden="true">1</span>
          <span>
            Tippe in Safari auf <Icon name="teilen" className={h.inline} />
            <span className="nur-screenreader">Teilen</span>
          </span>
        </li>
        <li>
          <span className={h.nr} aria-hidden="true">2</span>
          <span>Wähle „Zum Home-Bildschirm“</span>
        </li>
        <li>
          <span className={h.nr} aria-hidden="true">3</span>
          <span>Tippe auf „Hinzufügen“</span>
        </li>
      </ol>
      <p className={h.text}>Deine Daten liegen nur auf diesem Gerät. Sichere sie ab und zu über Einstellungen → Daten exportieren.</p>
    </Karte>
  );
}
