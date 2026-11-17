import { euro, type Cent } from '../domain/geld';
import { proTag } from '../domain/pot';
import { Icon, istSymbol } from '../ui/Icon';
import { Karte } from '../ui/Karte';
import l from './liste.module.css';
import s from './seite.module.css';
import p from './PotListe.module.css';

export interface PotZeile {
  schluessel: string;
  name: string;
  symbol: string;
  cent: Cent;
}

interface Props {
  pots: readonly PotZeile[];
  zyklusTage: number;
  onBearbeiten: (index: number) => void;
  onVerschieben: (index: number, richtung: -1 | 1) => void;
}

/**
 * Abgeleitet (nicht im Figma): Pots verwalten, als Listenzeilen wie die
 * Fixkosten 11:72. Rechts zwei Pfeile fuer die Reihenfolge.
 */
export function PotListe({ pots, zyklusTage, onBearbeiten, onVerschieben }: Props) {
  if (pots.length === 0) {
    return (
      <Karte>
        <p className={s.leer}>Noch keine Pots.</p>
      </Karte>
    );
  }
  return (
    <Karte>
      <ul className={p.liste}>
        {pots.map((pot, i) => (
          <li key={pot.schluessel} className={p.zeile}>
            <button type="button" className={`${l.posten} ${p.inhalt}`} onClick={() => onBearbeiten(i)}>
              <span className={`${l.info} ${p.links}`}>
                <span className={p.titel}>
                  {istSymbol(pot.symbol) && <Icon name={pot.symbol} />}
                  <span className={l.name}>{pot.name}</span>
                </span>
                <span className={l.unter}>etwa {euro(proTag(pot.cent, zyklusTage))} am Tag</span>
              </span>
              <span className={l.rechts}>
                <span className={l.wert}>{euro(pot.cent)}</span>
                <span className={l.unter}>im Monat</span>
              </span>
            </button>
            <span className={p.ordnung}>
              <button
                type="button"
                className={p.pfeil}
                disabled={i === 0}
                aria-label={`${pot.name} nach oben`}
                onClick={() => onVerschieben(i, -1)}
              >
                <Icon name="chevronDown" drehung={180} />
              </button>
              <button
                type="button"
                className={p.pfeil}
                disabled={i === pots.length - 1}
                aria-label={`${pot.name} nach unten`}
                onClick={() => onVerschieben(i, 1)}
              >
                <Icon name="chevronDown" />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Karte>
  );
}
