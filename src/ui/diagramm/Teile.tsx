import type { CSSProperties, ReactNode } from 'react';
import styles from './Diagramm.module.css';

export const FARBE = {
  akzent: 'var(--c-accent)',
  akzent45: 'var(--c-accent-45)',
  minus: 'var(--c-minus)',
  hell: 'var(--c-light)',
  grau: 'var(--c-inactive)'
} as const;
export type Farbe = keyof typeof FARBE;

export interface LegendenEintrag {
  label: string;
  farbe: Farbe;
  form: 'linie' | 'gestrichelt' | 'flaeche' | 'strich';
}

export function Legende({ eintraege }: { eintraege: LegendenEintrag[] }) {
  return (
    <ul className={styles.legende} aria-hidden="true">
      {eintraege.map((e) => (
        <li key={e.label}>
          <Schluessel farbe={e.farbe} form={e.form} />
          {e.label}
        </li>
      ))}
    </ul>
  );
}

export function Schluessel({ farbe, form }: { farbe: Farbe; form: LegendenEintrag['form'] }) {
  const c = FARBE[farbe];
  const stil: CSSProperties =
    form === 'flaeche'
      ? { width: 10, height: 10, borderRadius: 2, background: c }
      : form === 'strich'
        ? { width: 10, height: 2, background: c }
        : form === 'gestrichelt'
          ? { width: 14, height: 0, borderTop: `2px dashed ${c}` }
          : { width: 14, height: 2, borderRadius: 1, background: c };
  return <span className={styles.schluessel} style={stil} />;
}

export interface TooltipDaten {
  titel: string;
  zeilen: { label: string; wert: string; farbe?: Farbe | undefined; form?: LegendenEintrag['form'] | undefined }[];
}

/** Sichtbare Anzeige (fuer Screenreader stumm) plus Live-Region mit demselben Inhalt. */
export function Tooltip({ daten, x, breite }: { daten: TooltipDaten | null; x: number; breite: number }) {
  const text = daten ? `${daten.titel}: ${daten.zeilen.map((z) => `${z.label} ${z.wert}`).join(', ')}` : '';
  return (
    <>
      {daten && (
        <div
          className={styles.tooltip}
          aria-hidden="true"
          style={x < breite / 2 ? { left: x + 12 } : { right: breite - x + 12 }}
        >
          <div className={styles.tooltipTitel}>{daten.titel}</div>
          {daten.zeilen.map((z) => (
            <div key={z.label} className={styles.tooltipZeile}>
              {z.farbe && <Schluessel farbe={z.farbe} form={z.form ?? 'linie'} />}
              <span className={styles.tooltipWert}>{z.wert}</span>
              <span>{z.label}</span>
            </div>
          ))}
        </div>
      )}
      <span className="nur-screenreader" aria-live="polite">
        {text}
      </span>
    </>
  );
}

export function Tabelle({ kopf, zeilen, titel = 'Werte als Tabelle' }: { kopf: string[]; zeilen: ReactNode[][]; titel?: string }) {
  return (
    <details className={styles.tabelle}>
      <summary>{titel}</summary>
      <table>
        <thead>
          <tr>
            {kopf.map((k) => (
              <th key={k} scope="col">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z, i) => (
            <tr key={i}>
              {z.map((zelle, j) => (
                <td key={j}>{zelle}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Saeule mit 4 px Radius am Datenende, eckig an der Grundlinie. */
export function saeulenPfad(x: number, y: number, b: number, basis: number): string {
  const h = basis - y;
  if (h <= 0 || b <= 0) return '';
  const r = Math.min(4, b / 2, h);
  return `M${x},${basis}V${y + r}Q${x},${y} ${x + r},${y}H${x + b - r}Q${x + b},${y} ${x + b},${y + r}V${basis}Z`;
}
