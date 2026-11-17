import { useId, type Ref } from 'react';
import s from './formular.module.css';

interface Props {
  wert: string;
  onAendern: (wert: string) => void;
  label: string;
  feldRef?: Ref<HTMLInputElement> | undefined;
}

/**
 * Figma 12:196: grosser Betrag in Momo 56 mit "€" in 35 %. Natives Feld mit
 * Dezimaltastatur; ein unsichtbarer Spiegeltext gibt ihm die Breite der Zahl,
 * damit das "€" direkt dahinter steht.
 */
export function BetragsFeld({ wert, onAendern, label, feldRef }: Props) {
  const id = useId();
  return (
    <label className={s.betrag} htmlFor={id}>
      <span className={`${s.spiegel} ende-num`} aria-hidden="true">
        {wert || '0,00'}
      </span>
      <input
        ref={feldRef}
        id={id}
        className={s.betragFeld}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        aria-label={label}
        value={wert}
        onChange={(e) => onAendern(e.target.value.replace(/[^\d.,]/g, '').slice(0, 9))}
      />
      <span className={s.waehrung} aria-hidden="true">
        €
      </span>
    </label>
  );
}

/** Vorbelegung fuer das Feld: "210", "34,99". */
export function alsEingabe(cent: number): string {
  if (cent % 100 === 0) return String(cent / 100);
  const ganz = Math.floor(cent / 100);
  return `${ganz},${String(cent % 100).padStart(2, '0')}`;
}
