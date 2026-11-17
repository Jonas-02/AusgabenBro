import type { Tagespunkt } from '../../domain/analyse';
import { euro, euroGerundet, type Cent } from '../../domain/geld';
import { kurzDatum } from '../../domain/datum';
import { useAuswahl, useBreite } from './auswahl';
import { achse } from './skala';
import { FARBE, Tooltip, type TooltipDaten } from './Teile';
import styles from './Diagramm.module.css';

interface Props {
  tage: Tagespunkt[];
  tagIndex: number;
  /** Hochgerechnete Ausgaben am Zyklusende, oder null */
  prognose: Cent | null;
  beschreibung: string;
  hoehe?: number;
}

const LINKS = 36;
const RECHTS = 6;
const OBEN = 8;
const UNTEN = 18;

/**
 * Ausgaben seit Zyklusbeginn (Linie mit leichter Flaeche) gegen das bis dahin
 * zugeflossene Budget (hellgraue Linie), dazu die Hochrechnung bis Monatsende
 * (gestrichelt). Eine Achse, ein Massstab.
 */
export function Verlauf({ tage, tagIndex, prognose, beschreibung, hoehe = 130 }: Props) {
  const { ref, breite } = useBreite<HTMLDivElement>();
  const n = tage.length;
  const plotB = breite - LINKS - RECHTS;
  const schritt = n > 1 ? plotB / (n - 1) : plotB;
  const basis = OBEN + hoehe;
  const letzter = tage[n - 1];
  const max = Math.max(letzter?.budget ?? 0, prognose ?? 0, ...tage.map((t) => t.kumuliert), 1);
  const ax = achse(max);
  const x = (i: number) => LINKS + schritt * (i - 1);
  const y = (c: Cent) => basis - (c / ax.max) * hoehe;

  const vergangen = tage.filter((t) => t.vergangen);
  const heute = vergangen[vergangen.length - 1];
  const budgetLinie = tage.map((t) => `${x(t.index)},${y(t.budget)}`).join(' ');
  const ausgabenLinie = vergangen.map((t) => `${x(t.index)},${y(t.kumuliert)}`).join(' ');
  const flaeche = heute ? `M${x(1)},${basis} L${ausgabenLinie.replaceAll(' ', ' L')} L${x(heute.index)},${basis} Z` : '';
  const drueber = heute ? heute.kumuliert > heute.budget : false;

  const prognoseBei = (i: number): Cent | null => {
    if (prognose === null || !heute || i <= heute.index) return null;
    return Math.round(heute.kumuliert + ((prognose - heute.kumuliert) * (i - heute.index)) / (n - heute.index));
  };

  const { aktiv, halter, svgProps } = useAuswahl(n, (px) => Math.round((px - LINKS) / schritt));
  const punkt = aktiv === null ? null : tage[aktiv];
  const tooltip: TooltipDaten | null = punkt
    ? {
        titel: kurzDatum(punkt.tag) + (punkt.index === tagIndex ? ' · heute' : punkt.vergangen ? '' : ' · kommt noch'),
        zeilen: [
          ...(punkt.vergangen
            ? [{ label: 'ausgegeben', wert: euro(punkt.kumuliert), farbe: 'akzent' as const, form: 'linie' as const }]
            : prognoseBei(punkt.index) !== null
              ? [{ label: 'hochgerechnet', wert: euro(prognoseBei(punkt.index) as Cent), farbe: 'akzent' as const, form: 'gestrichelt' as const }]
              : []),
          { label: 'Budget bis dahin', wert: euro(punkt.budget), farbe: 'hell', form: 'linie' }
        ]
      }
    : null;

  const xLabels = [1, Math.ceil(n / 2), n].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div ref={halter} className={styles.halter}>
      <div ref={ref}>
        <svg
          className={styles.svg}
          width={breite}
          height={basis + UNTEN}
          role="img"
          aria-label={`${beschreibung} Mit den Pfeiltasten einzelne Tage ansehen.`}
          {...svgProps}
        >
          {ax.schritte.map((s) => (
            <g key={s}>
              <line className={s === 0 ? styles.basis : styles.gitter} x1={LINKS} x2={breite - RECHTS} y1={y(s)} y2={y(s)} />
              <text className={styles.achse} x={LINKS - 6} y={y(s) + 3.5} textAnchor="end">
                {euroGerundet(s)}
              </text>
            </g>
          ))}
          {xLabels.map((i) => {
            const t = tage[i - 1];
            if (!t) return null;
            return (
              <text
                key={i}
                className={styles.achseText}
                x={x(i)}
                y={basis + 13}
                textAnchor={i === 1 ? 'start' : i === n ? 'end' : 'middle'}
              >
                {kurzDatum(t.tag).replace(/^\w+\.,\s/, '')}
              </text>
            );
          })}

          <polyline
            points={budgetLinie}
            style={{ fill: 'none', stroke: FARBE.hell, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }}
          />
          {flaeche && <path d={flaeche} style={{ fill: FARBE.akzent, opacity: 0.12 }} />}
          {ausgabenLinie && (
            <polyline
              points={ausgabenLinie}
              style={{ fill: 'none', stroke: FARBE.akzent, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' }}
            />
          )}
          {heute && prognose !== null && heute.index < n && (
            <line
              x1={x(heute.index)}
              y1={y(heute.kumuliert)}
              x2={x(n)}
              y2={y(prognose)}
              style={{ stroke: FARBE.akzent, strokeWidth: 2, strokeDasharray: '4 4', strokeLinecap: 'round', opacity: 0.8 }}
            />
          )}

          {punkt && <line className={styles.fadenkreuz} x1={x(punkt.index)} x2={x(punkt.index)} y1={OBEN} y2={basis} />}
          {punkt && (
            <circle cx={x(punkt.index)} cy={y(punkt.budget)} r={4} style={{ fill: FARBE.hell, stroke: 'var(--c-card)', strokeWidth: 2 }} />
          )}
          {punkt && (punkt.vergangen || prognoseBei(punkt.index) !== null) && (
            <circle
              cx={x(punkt.index)}
              cy={y(punkt.vergangen ? punkt.kumuliert : (prognoseBei(punkt.index) as Cent))}
              r={4}
              style={{ fill: FARBE.akzent, stroke: 'var(--c-card)', strokeWidth: 2 }}
            />
          )}
          {heute && !punkt && (
            <circle
              cx={x(heute.index)}
              cy={y(heute.kumuliert)}
              r={4}
              style={{ fill: drueber ? FARBE.minus : FARBE.akzent, stroke: 'var(--c-card)', strokeWidth: 2 }}
            />
          )}
        </svg>
      </div>
      <Tooltip daten={tooltip} x={punkt ? x(punkt.index) : 0} breite={breite} />
    </div>
  );
}
