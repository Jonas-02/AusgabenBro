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
  className?: string;
}

/** Gesamtbreite entspricht `daten.skala`; ungenutzter Rest bleibt leer. */
export function Balken({ daten, hoehe, className }: Props) {
  return (
    <div className={[styles.balken, className].filter(Boolean).join(' ')} style={{ height: hoehe }} aria-hidden="true">
      {daten.segmente.map((s, i) =>
        s.cent > 0 ? (
          <div
            key={i}
            className={styles.segment}
            data-art={s.art}
            style={{ width: `${(s.cent / daten.skala) * 100}%`, background: FARBE[s.art] }}
          />
        ) : null
      )}
    </div>
  );
}
