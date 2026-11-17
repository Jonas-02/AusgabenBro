import { euro2, euroGerundet } from '../domain/geld';
import { monatswert, uebersicht, zeile } from '../domain/fixkosten';
import type { Fixkosten as FixkostenTyp } from '../domain/typen';
import { useStore } from '../store/store';
import { Betrag } from '../ui/Betrag';
import { Karte } from '../ui/Karte';
import { Icon, istSymbol } from '../ui/Icon';
import s from './seite.module.css';
import f from './Fixkosten.module.css';
import l from './liste.module.css';

interface Props {
  heute: string;
  onBearbeiten: (fk: FixkostenTyp) => void;
}

/** Figma 11:46: Uebersicht und Liste nach Kategorie. Getrennt vom Budget. */
export function Fixkosten({ heute, onBearbeiten }: Props) {
  const fixkosten = useStore((x) => x.fixkosten);
  const kategorien = useStore((x) => x.kategorien);
  const u = uebersicht(fixkosten);

  return (
    <main className={s.seite}>
      <h1 className={s.gruss}>
        Fixkosten
        <span className={s.unter}>laufen getrennt von deinem Budget</span>
      </h1>

      <Karte>
        <div className={`${s.kartenKopf} ${f.summe}`}>
          <div className={f.betrag}>
            <Betrag cent={u.proMonat} groesse={32} immerNachkomma />
            <span className={f.proMonat}>pro Monat</span>
          </div>
          <div className={s.meta}>
            <p>
              <span className={s.zahl}>{euroGerundet(u.imJahr)}</span> im Jahr
            </p>
            <p>
              <span className={s.zahl}>{u.anzahl}</span> Posten
            </p>
          </div>
        </div>
      </Karte>

      <section className={s.abschnitt} aria-labelledby="fix-titel">
        <h2 id="fix-titel" className={s.abschnittTitel}>
          Alle Fixkosten
        </h2>

        {fixkosten.length === 0 && (
          <Karte>
            <p className={s.leer}>Noch keine Fixkosten. Leg sie mit „+ Fixkosten" an.</p>
          </Karte>
        )}

        {kategorien.map((k) => {
          const posten = fixkosten.filter((x) => x.kategorieId === k.id).sort((a, b) => a.tag - b.tag || a.name.localeCompare(b.name, 'de'));
          if (posten.length === 0) return null;
          return (
            <div key={k.id} className={s.gruppe}>
              <div className={s.gruppeLabel}>
                {istSymbol(k.symbol) && <Icon name={k.symbol} />}
                <span>{k.name}</span>
              </div>
              <Karte>
                {posten.map((fk) => (
                  <Posten key={fk.id} fk={fk} heute={heute} onClick={() => onBearbeiten(fk)} />
                ))}
              </Karte>
            </div>
          );
        })}
      </section>
    </main>
  );
}

function Posten({ fk, heute, onClick }: { fk: FixkostenTyp; heute: string; onClick: () => void }) {
  const z = zeile(fk, heute);
  return (
    <button type="button" className={l.posten} onClick={onClick}>
      <span className={l.info}>
        <span className={l.name}>{fk.name}</span>
        <span className={`${l.unter} ${z.bevorstehend ? l.bald : ''}`}>{z.unterzeile}</span>
      </span>
      <span className={l.rechts}>
        <span className={l.wert}>{euro2(monatswert(fk))}</span>
        {z.rechtsUnten && <span className={l.unter}>{z.rechtsUnten}</span>}
      </span>
    </button>
  );
}
