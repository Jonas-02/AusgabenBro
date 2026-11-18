import type { Balken as BalkenDaten, SegmentArt } from '../domain/typen';
import styles from './Balken.module.css';

const FARBE: Record<SegmentArt, string> = {
  ausgegeben: 'var(--c-accent)',
  rest: 'var(--c-light)',
  diese: 'var(--c-accent-45)',
  vorgriff: 'var(--c-minus)',
  minus: 'var(--c-minus)'
};

interface Props {
  daten: BalkenDaten;
  hoehe: 28 | 12;
  className?: string | undefined;
}

/**
 * Gesamtbreite entspricht `daten.skala`; ungenutzter Rest bleibt leer.
 * Stossen zwei gleichfarbige Segmente aneinander (gedeckt | Vorgriff),
 * trennt sie eine 1-px-Linie in der Flaechenfarbe (Pot-Card v2, 20:205).
 */
export function Balken({ daten, hoehe, className }: Props) {
  const sichtbar = daten.segmente.filter((s) => s.cent > 0);
  return (
    <div className={[styles.balken, className].filter(Boolean).join(' ')} style={{ height: hoehe }} aria-hidden="true">
      {sichtbar.map((s, i) => {
        const vorher = sichtbar[i - 1];
        const trenner = vorher !== undefined && FARBE[vorher.art] === FARBE[s.art];
        return (
          <div
            key={i}
            className={[styles.segment, trenner ? styles.trenner : null].filter(Boolean).join(' ')}
            data-art={s.art}
            style={{ width: `${(s.cent / daten.skala) * 100}%`, background: FARBE[s.art] }}
          />
        );
      })}
    </div>
  );
}
