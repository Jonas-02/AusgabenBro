import { useMemo } from 'react';
import { gesamt, potStand, standBalken, type PotStand } from '../domain/pot';
import type { Pot } from '../domain/typen';
import { useStore } from '../store/store';
import { Betrag } from '../ui/Betrag';
import { Balken } from '../ui/Balken';
import { Karte } from '../ui/Karte';
import { Icon, istSymbol } from '../ui/Icon';
import { navigiere } from '../hooks/useRoute';
import { MonatTagMeta } from './Meta';
import { euro } from '../domain/geld';
import s from './seite.module.css';
import d from './Dashboard.module.css';

/** Figma 1:2: Begruessung, Hauptkarte, "Deine Pots". */
export function Dashboard({ heute }: { heute: string }) {
  const name = useStore((x) => x.name);
  const motto = useStore((x) => x.motto);
  const pots = useStore((x) => x.pots);
  const ausgaben = useStore((x) => x.ausgaben);
  const zahltag = useStore((x) => x.zahltag);
  const uebertrag = useStore((x) => x.uebertrag);

  const staende = useMemo(
    () => pots.map((p) => ({ pot: p, stand: potStand(p, ausgaben, heute, { zahltag, uebertrag }) })),
    [pots, ausgaben, heute, zahltag, uebertrag]
  );
  const g = gesamt(staende.map((x) => x.stand));

  return (
    <main className={s.seite}>
      <div className={s.kopfbereich}>
        <h1 className={s.gruss}>
          {name ? `Hallo ${name},` : 'Hallo,'}
          {motto && <span className={s.unter}>{motto}</span>}
        </h1>
        <a className={s.zahnrad} href="#/einstellungen" aria-label="Einstellungen">
          <Icon name="settings" />
        </a>

        <Karte className={d.hauptkarte}>
          <div className={s.kartenKopf}>
            <Betrag cent={g.stand} groesse={32} kommaLuft className={g.stand < 0 ? s.minus : undefined} />
            <MonatTagMeta monatlich={g.monatlich} proTag={g.proTag} />
          </div>
          <div className={d.verlauf}>
            <p className={d.satz}>
              du hast <span className={s.zahl}>{euro(g.ausgegeben)}</span> von{' '}
              <span className={`${s.zahl} ${d.blau}`}>{euro(g.zugeflossen)}</span> ausgegeben
            </p>
            <Balken daten={standBalken(g)} hoehe={28} />
          </div>
        </Karte>
      </div>

      <section className={s.abschnitt} aria-labelledby="pots-titel">
        <h2 id="pots-titel" className={s.abschnittTitel}>
          Deine Pots
        </h2>
        {staende.length === 0 && (
          <Karte>
            <p className={s.leer}>Noch keine Pots. Leg sie in den Einstellungen an.</p>
          </Karte>
        )}
        {staende.map(({ pot, stand }) => (
          <PotKarte key={pot.id} pot={pot} stand={stand} />
        ))}
      </section>
    </main>
  );
}

export function PotKarte({ pot, stand, klickbar = true }: { pot: Pot; stand: PotStand; klickbar?: boolean }) {
  const negativ = stand.stand < 0;
  return (
    <div className={s.gruppe}>
      <div className={s.gruppeLabel}>
        {istSymbol(pot.symbol) && <Icon name={pot.symbol} />}
        <span>{pot.name}</span>
      </div>
      <Karte
        className={d.potkarte}
        {...(klickbar ? { onClick: () => navigiere({ seite: 'pot', id: pot.id }), label: `${pot.name}: Ausgaben ansehen` } : {})}
      >
        <div className={s.kartenKopf}>
          <Betrag cent={stand.stand} groesse={25} kommaLuft className={negativ ? s.minus : undefined} />
          <MonatTagMeta monatlich={stand.monatlich} proTag={stand.proTag} />
        </div>
        <Balken daten={standBalken(stand)} hoehe={28} />
      </Karte>
    </div>
  );
}
