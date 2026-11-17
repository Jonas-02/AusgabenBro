import { useId } from 'react';
import { Icon, SYMBOL_LABEL, WAEHLBARE_ICONS, type SymbolName } from './Icon';
import styles from './SymbolWahl.module.css';

interface Props {
  wert: SymbolName;
  onWahl: (s: SymbolName) => void;
  legende?: string;
}

/**
 * Abgeleitet (nicht im Figma): Symbol fuer Pot oder neue Kategorie.
 * Echte Radio-Buttons, damit Pfeiltasten und Screenreader funktionieren.
 */
export function SymbolWahl({ wert, onWahl, legende = 'Symbol' }: Props) {
  const name = useId();
  return (
    <fieldset className={styles.gruppe}>
      <legend className="nur-screenreader">{legende}</legend>
      {WAEHLBARE_ICONS.map((n) => (
        <label key={n} className={`${styles.symbol} ${wert === n ? styles.aktiv : ''}`}>
          <input
            type="radio"
            name={name}
            value={n}
            checked={wert === n}
            onChange={() => onWahl(n)}
            className="nur-screenreader"
          />
          <Icon name={n} />
          <span className="nur-screenreader">{SYMBOL_LABEL[n]}</span>
        </label>
      ))}
    </fieldset>
  );
}
