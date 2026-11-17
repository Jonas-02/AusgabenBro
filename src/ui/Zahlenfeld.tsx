import type { Taste } from '../domain/eingabe';
import { Icon } from './Icon';
import styles from './Zahlenfeld.module.css';

interface Props {
  onTaste: (t: Taste) => void;
  onLoeschen: () => void;
}

const REIHEN: Taste[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9']
];

/**
 * Eigenes Zahlenfeld aus <button>-Elementen (Figma 7:164). Es gibt bewusst
 * kein <input>, damit sich die iOS-Tastatur nie oeffnet.
 */
export function Zahlenfeld({ onTaste, onLoeschen }: Props) {
  return (
    <div className={styles.feld} role="group" aria-label="Zahlenfeld">
      {REIHEN.map((reihe) => (
        <div key={reihe[0]} className={styles.reihe}>
          {reihe.map((t) => (
            <Taste key={t} label={t} onClick={() => onTaste(t)} />
          ))}
        </div>
      ))}
      <div className={styles.reihe}>
        <Taste label="," aria="Komma" onClick={() => onTaste(',')} />
        <Taste label="0" onClick={() => onTaste('0')} />
        <button type="button" className={styles.taste} onClick={onLoeschen} aria-label="Löschen">
          <Icon name="delete" />
        </button>
      </div>
    </div>
  );
}

/** Figma 7:2: Zifferntaste. */
function Taste({ label, aria, onClick }: { label: string; aria?: string; onClick: () => void }) {
  return (
    <button type="button" className={`${styles.taste} ${styles.ziffer}`} onClick={onClick} aria-label={aria}>
      {label}
    </button>
  );
}

interface SchnellProps {
  cent: number;
  onClick: () => void;
}

/** Figma 10:56: Schnellbetrag, addiert zum aktuellen Betrag. */
export function Schnellbetrag({ cent, onClick }: SchnellProps) {
  const euro = cent / 100;
  return (
    <button type="button" className={styles.schnell} onClick={onClick} aria-label={`plus ${euro} Euro`}>
      <span className="ende-num">+{euro}&nbsp;€</span>
    </button>
  );
}
