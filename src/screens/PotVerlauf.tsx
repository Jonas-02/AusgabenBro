import { useMemo } from 'react';
import { kurzDatum, langDatum, relativerTag, zwischen } from '../domain/datum';
import { euro2 } from '../domain/geld';
import { potStand } from '../domain/pot';
import type { Ausgabe } from '../domain/typen';
import { useStore } from '../store/store';
import { Icon } from '../ui/Icon';
import { Karte } from '../ui/Karte';
import { StandKarte } from './Dashboard';
import l from './liste.module.css';
import s from './seite.module.css';

interface Props {
  potId: string;
  heute: string;
  onBearbeiten: (a: Ausgabe) => void;
}

const UHRZEIT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });

/**
 * Abgeleitet (nicht im Figma): Ausgaben eines Pots im laufenden Zyklus.
 * Kopf wie Dashboard 1:2, Liste wie Fixkosten 11:46.
 */
export function PotVerlauf({ potId, heute, onBearbeiten }: Props) {
  const pot = useStore((x) => x.pots.find((p) => p.id === potId));
  const ausgaben = useStore((x) => x.ausgaben);
  const zahltag = useStore((x) => x.zahltag);
  const uebertrag = useStore((x) => x.uebertrag);

  const stand = useMemo(
    () => (pot ? potStand(pot, ausgaben, heute, { zahltag, uebertrag }) : null),
    [pot, ausgaben, heute, zahltag, uebertrag]
  );

  const liste = useMemo(() => {
    if (!stand) return [];
    return ausgaben
      .filter((a) => a.potId === potId && zwischen(a.datum, stand.zyklus.start, heute))
      .sort((a, b) => (a.datum === b.datum ? b.erfasstUm.localeCompare(a.erfasstUm) : b.datum.localeCompare(a.datum)));
  }, [ausgaben, potId, stand, heute]);

  if (!pot || !stand) {
    return (
      <main className={s.seite}>
        <Zurueck />
        <h1 className={s.gruss}>Diesen Pot gibt es nicht mehr.</h1>
      </main>
    );
  }

  return (
    <main className={s.seite}>
      <div className={s.kopfbereich}>
        <Zurueck />
        <h1 className={s.gruss}>
          {pot.name}
          <span className={s.unter}>seit {langDatum(stand.zyklus.start)}</span>
        </h1>
        <StandKarte stand={stand} />
      </div>

      <section className={s.abschnitt} aria-labelledby="verlauf-titel">
        <h2 id="verlauf-titel" className={s.abschnittTitel}>
          {liste.length === 1 ? '1 Ausgabe' : `${liste.length} Ausgaben`}
        </h2>
        {liste.length === 0 ? (
          <Karte>
            <p className={s.leer}>In diesem Monat noch nichts ausgegeben.</p>
          </Karte>
        ) : (
          <Karte>
            {liste.map((a) => (
              <button key={a.id} type="button" className={l.posten} onClick={() => onBearbeiten(a)}>
                <span className={l.info}>
                  <span className={l.name}>{kurzDatum(a.datum)}</span>
                  <span className={l.unter}>
                    {[relativerTag(a.datum, heute), `${UHRZEIT.format(new Date(a.erfasstUm))} Uhr`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={l.rechts}>
                  <span className={l.wert}>{euro2(a.cent)}</span>
                </span>
              </button>
            ))}
          </Karte>
        )}
      </section>
    </main>
  );
}

function Zurueck() {
  return (
    <a className={s.zurueck} href="#/budget">
      <Icon name="chevronDown" drehung={90} />
      Budget
    </a>
  );
}
