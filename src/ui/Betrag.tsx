import { teile, euro, type Cent, type FormatOptionen } from '../domain/geld';
import styles from './Betrag.module.css';

interface Props extends FormatOptionen {
  cent: Cent;
  /** Schriftgroesse in px. */
  groesse: number;
  /**
   * Figma setzt bei den grossen Kartenbetraegen ein Leerzeichen vor das
   * Komma ("76 ,43 €"), um die enge Laufweite auszugleichen. Hier wird der
   * Betrag korrekt formatiert und der Abstand per CSS nachgebildet.
   */
  kommaLuft?: boolean;
  className?: string;
}

/**
 * Betrag in Momo Trust Display. Sichtbar sind einzelne Spans fuer Ziffern,
 * Komma und Waehrung; Screenreader lesen den korrekt formatierten Text.
 */
export function Betrag({ cent, groesse, kommaLuft = false, className, ...format }: Props) {
  const t = teile(cent, format);
  return (
    <span className={[styles.betrag, className].filter(Boolean).join(' ')} style={{ fontSize: groesse }}>
      <span className="nur-screenreader">{euro(cent, format).replace(' ', ' ')}</span>
      <span aria-hidden="true">
        {t.vorzeichen}
        {t.ganz}
        {t.nachkomma !== null && (
          <>
            <span className={kommaLuft ? styles.kommaLuft : undefined}>,</span>
            {t.nachkomma}
          </>
        )}
        {' €'}
      </span>
    </span>
  );
}
