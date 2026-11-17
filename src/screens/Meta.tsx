import { euro, type Cent } from '../domain/geld';
import s from './seite.module.css';

/**
 * Zahl in Momo, Wort in Manjari, z. B. "750 € a month". Figma mischt die
 * Schriften innerhalb einer Zeile; so wird es nachgebildet.
 */
export function ZahlText({ cent, text, plus = false, vorne = false }: { cent: Cent; text: string; plus?: boolean; vorne?: boolean }) {
  const zahl = <span className={s.zahl}>{euro(cent, { mitPlus: plus })}</span>;
  return vorne ? (
    <>
      {text} {zahl}
    </>
  ) : (
    <>
      {zahl} {text}
    </>
  );
}

/** Rechte Spalte einer Betragskarte: "{monatlich} a month" / "+{daily} daily". */
export function MonatTagMeta({ monatlich, proTag }: { monatlich: Cent; proTag: Cent }) {
  return (
    <div className={s.meta}>
      <p>
        <ZahlText cent={monatlich} text="a month" />
      </p>
      <p>
        <ZahlText cent={proTag} text="daily" plus />
      </p>
    </div>
  );
}
