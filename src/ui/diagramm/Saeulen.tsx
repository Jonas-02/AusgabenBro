import { euroGerundet, type Cent } from '../../domain/geld';
import { useAuswahl, useBreite } from './auswahl';
import { achse } from './skala';
import { FARBE, saeulenPfad, Tooltip, type Farbe, type TooltipDaten } from './Teile';
import styles from './Diagramm.module.css';

export interface Saeule {
  schluessel: string;
  /** Beschriftung unter der Saeule (wird nur gezeigt, wenn `zeigeLabel` es will) */
  label: string;
  wert: Cent;
  farbe: Farbe;
  /** Optionaler Vergleichsstrich ueber der Saeule, z. B. das Budget des Monats */
  marke?: Cent | undefined;
  tooltip: TooltipDaten;
}

interface Props {
  saeulen: Saeule[];
  /** Waagrechte Linie quer durchs Diagramm, z. B. der Tagesbetrag */
  referenz?: { wert: Cent; label: string } | undefined;
  zeigeLabel?: ((i: number) => boolean) | undefined;
  hoehe?: number;
  beschreibung: string;
}

const LINKS = 36;
const OBEN = 14;
const UNTEN = 18;

export function Saeulen({ saeulen, referenz, zeigeLabel = () => true, hoehe = 110, beschreibung }: Props) {
  const { ref, breite } = useBreite<HTMLDivElement>();
  const n = Math.max(saeulen.length, 1);
  const plotB = breite - LINKS;
  const band = plotB / n;
  const b = Math.max(2, Math.min(24, band - 2));
  const basis = OBEN + hoehe;
  const max = Math.max(...saeulen.map((s) => Math.max(s.wert, s.marke ?? 0)), referenz?.wert ?? 0, 1);
  const ax = achse(max);
  const y = (c: Cent) => basis - (c / ax.max) * hoehe;
  const xMitte = (i: number) => LINKS + band * i + band / 2;

  const { aktiv, halter, svgProps } = useAuswahl(saeulen.length, (x) => Math.floor((x - LINKS) / band));
  const gewaehlt = aktiv === null ? null : saeulen[aktiv];

  return (
    <div ref={halter} className={styles.halter}>
      <div ref={ref}>
        <svg
          className={styles.svg}
          width={breite}
          height={basis + UNTEN}
          role="img"
          aria-label={`${beschreibung} Mit den Pfeiltasten einzelne Werte ansehen.`}
          {...svgProps}
        >
          {ax.schritte.map((s) => (
            <g key={s}>
              <line className={s === 0 ? styles.basis : styles.gitter} x1={LINKS} x2={breite} y1={y(s)} y2={y(s)} />
              <text className={styles.achse} x={LINKS - 6} y={y(s) + 3.5} textAnchor="end">
                {euroGerundet(s)}
              </text>
            </g>
          ))}

          {saeulen.map((s, i) => {
            const x = xMitte(i) - b / 2;
            const aktivHier = aktiv === i;
            return (
              <g key={s.schluessel}>
                <path
                  d={saeulenPfad(x, y(s.wert), b, basis)}
                  style={{ fill: FARBE[s.farbe], filter: aktivHier ? 'brightness(1.25)' : undefined }}
                />
                {s.marke !== undefined && s.marke > 0 && (
                  <line
                    x1={x - 3}
                    x2={x + b + 3}
                    y1={y(s.marke)}
                    y2={y(s.marke)}
                    style={{ stroke: FARBE.hell, strokeWidth: 2, strokeLinecap: 'round' }}
                  />
                )}
                {zeigeLabel(i) && (
                  <text className={styles.achseText} x={xMitte(i)} y={basis + 13} textAnchor="middle">
                    {s.label}
                  </text>
                )}
              </g>
            );
          })}

          {referenz && referenz.wert > 0 && (
            <g>
              <line className={styles.referenz} x1={LINKS} x2={breite} y1={y(referenz.wert)} y2={y(referenz.wert)} />
              <text className={styles.achse} x={breite} y={y(referenz.wert) - 4} textAnchor="end">
                {referenz.label}
              </text>
            </g>
          )}

          {aktiv !== null && (
            <rect x={LINKS + band * aktiv} y={OBEN} width={band} height={hoehe} style={{ fill: 'rgba(255,255,255,0.04)' }} />
          )}
        </svg>
      </div>
      <Tooltip daten={gewaehlt ? gewaehlt.tooltip : null} x={aktiv === null ? 0 : xMitte(aktiv) + (b / 2) * (xMitte(aktiv) < breite / 2 ? 1 : -1)} breite={breite} />
    </div>
  );
}
