import { useId } from 'react';
import { Icon } from '../ui/Icon';
import f from './formular.module.css';

const TAGE = Array.from({ length: 31 }, (_, i) => i + 1);

/** Auswahlzeile wie Figma 12:244 ("abgebucht am"), hier fuer den Zahltag. */
export function ZahltagAuswahl({ wert, onWahl }: { wert: number; onWahl: (tag: number) => void }) {
  const id = useId();
  return (
    <label className={f.auswahl} htmlFor={id}>
      <span className={f.frage}>Zahltag</span>
      <span className={f.wert}>
        am {wert}.
        <Icon name="chevronDown" />
      </span>
      <select id={id} className={f.select} value={wert} onChange={(e) => onWahl(Number(e.target.value))}>
        {TAGE.map((t) => (
          <option key={t} value={t}>
            am {t}. des Monats
          </option>
        ))}
      </select>
    </label>
  );
}
