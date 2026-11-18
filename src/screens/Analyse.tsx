import { useMemo, useState } from 'react';
import {
  anstehend,
  kennzahlen,
  monatskosten,
  monatsverlauf,
  potVerteilung,
  WOCHENTAGE,
  WOCHENTAGE_LANG,
  wochentage,
  zyklenVergleich
} from '../domain/analyse';
import { differenz, kurzDatum, langDatum, monatsname, zerlege, type Tag } from '../domain/datum';
import { euro, euro2, type Cent } from '../domain/geld';
import { faelligkeit, faelligkeitText } from '../domain/fixkosten';
import { nachNotiz } from '../domain/notiz';
import type { Ausgabe, Pot } from '../domain/typen';
import { Chip } from '../ui/Chip';
import { useStore } from '../store/store';
import { Betrag } from '../ui/Betrag';
import { Icon, istSymbol } from '../ui/Icon';
import { Karte } from '../ui/Karte';
import { Saeulen, type Saeule } from '../ui/diagramm/Saeulen';
import { Legende, Schluessel, Tabelle } from '../ui/diagramm/Teile';
import { Verlauf } from '../ui/diagramm/Verlauf';
import a from './Analyse.module.css';
import d from './Dashboard.module.css';
import l from './liste.module.css';
import s from './seite.module.css';

const kurz = (t: Tag) => {
  const { tag, monat } = zerlege(t);
  return `${tag}.${monat}.`;
};
const prozent = (x: number) => `${Math.round(x * 100)} %`;

/**
 * Abgeleitet (nicht im Figma): Analyse des laufenden Monats und der Zeit
 * davor. Karten, Kopf und Typografie wie Dashboard 1:2, Listen wie 11:72.
 */
export function Analyse({ heute }: { heute: Tag }) {
  const pots = useStore((x) => x.pots);
  const ausgaben = useStore((x) => x.ausgaben);
  const fixkosten = useStore((x) => x.fixkosten);
  const zahltag = useStore((x) => x.zahltag);
  const uebertrag = useStore((x) => x.uebertrag);

  const daten = useMemo(() => {
    const e = { zahltag, uebertrag };
    const v = monatsverlauf(pots, ausgaben, heute, e);
    return {
      v,
      k: kennzahlen(v, pots, ausgaben, heute),
      verteilung: potVerteilung(pots, ausgaben, heute, e),
      zyklen: zyklenVergleich(pots, ausgaben, heute, e),
      woche: wochentage(pots, ausgaben, heute),
      kosten: monatskosten(pots, fixkosten),
      demnaechst: anstehend(fixkosten, heute, 30)
    };
  }, [pots, ausgaben, fixkosten, heute, zahltag, uebertrag]);
  const { v, k, verteilung, zyklen, woche, kosten, demnaechst } = daten;
  const z = v.zyklus;

  return (
    <main className={s.seite}>
      <h1 className={s.gruss}>
        Analyse
        <span className={s.unter}>
          {kurz(z.start)} – {kurz(z.ende)} · Tag {v.tagIndex} von {z.tage}
        </span>
      </h1>

      {pots.length === 0 ? (
        <Karte>
          <p className={s.leer}>Leg zuerst Pots an, dann gibt es hier etwas zu sehen.</p>
        </Karte>
      ) : (
        <>
          <Prognose v={v} />
          <ProTag v={v} />
          <Kennzahlen k={k} v={v} pots={pots} />
          <Verteilung verteilung={verteilung} gesamt={v.ausgegeben} />
          <Wofuer pots={pots} ausgaben={ausgaben} monatsstart={z.start} heute={heute} />
          <Zyklen zyklen={zyklen} />
          <Wochentage woche={woche} />
        </>
      )}
      <Monatskosten kosten={kosten} demnaechst={demnaechst} heute={heute} />
    </main>
  );
}

/* -------------------------------------------------------------- Prognose */

function Prognose({ v }: { v: ReturnType<typeof monatsverlauf> }) {
  const p = v.prognose;
  const ende = langDatum(v.zyklus.ende);
  return (
    <section className={s.abschnitt} aria-labelledby="prognose-titel">
      <h2 id="prognose-titel" className={s.abschnittTitel}>
        Hochrechnung
      </h2>
      <Karte className={a.diagrammKarte}>
        <div className={s.kartenKopf}>
          <div className={a.heldBlock}>
            <p className={a.label}>{p ? `bei deinem Tempo bis ${ende}` : 'bisher ausgegeben'}</p>
            <Betrag cent={p ? p.ausgaben : v.ausgegeben} groesse={32} kommaLuft className={p && p.differenz < 0 ? s.minus : undefined} />
          </div>
          <div className={s.meta}>
            <p>
              <span className={s.zahl}>{euro(v.budget)}</span> Budget
            </p>
            {p && (
              <p className={p.differenz < 0 ? s.minus : undefined}>
                <span className={s.zahl}>{euro(Math.abs(p.differenz))}</span> {p.differenz < 0 ? 'drüber' : 'übrig'}
              </p>
            )}
          </div>
        </div>
        <p className={`${d.satz} ${a.satz}`}>
          {v.spielraum.proTag > 0 ? (
            <>
              ab heute höchstens <span className={s.zahl}>{euro(v.spielraum.proTag)}</span> am Tag, dann reicht’s
            </>
          ) : (
            <>dein Budget für diesen Monat ist aufgebraucht</>
          )}
        </p>
        {!p && <p className={`${a.innen} ${a.hinweis}`}>Hochgerechnet wird ab dem 3. Tag, vorher ist ein einzelner Einkauf zu laut.</p>}
        <div className={a.innen}>
          <Legende
            eintraege={[
              { label: 'ausgegeben', farbe: 'akzent', form: 'linie' },
              ...(p ? [{ label: 'hochgerechnet', farbe: 'akzent' as const, form: 'gestrichelt' as const }] : []),
              { label: 'Budget bis dahin', farbe: 'hell', form: 'linie' }
            ]}
          />
        </div>
        <div className={a.innen}>
          <Verlauf
            tage={v.tage}
            tagIndex={v.tagIndex}
            prognose={p ? p.ausgaben : null}
            beschreibung={`Ausgaben seit ${langDatum(v.zyklus.start)}: ${euro(v.ausgegeben)} von bisher ${euro(
              v.tage[v.tagIndex - 1]?.budget ?? 0
            )} Budget.${p ? ` Hochgerechnet ${euro(p.ausgaben)} bis ${ende}.` : ''}`}
          />
        </div>
        <div className={a.innen}>
          <Tabelle
            kopf={['Tag', 'ausgegeben', 'Budget']}
            zeilen={v.tage.filter((t) => t.vergangen).map((t) => [kurzDatum(t.tag), euro2(t.kumuliert), euro2(t.budget)])}
          />
        </div>
      </Karte>
    </section>
  );
}

/* -------------------------------------------------------------- Pro Tag */

function ProTag({ v }: { v: ReturnType<typeof monatsverlauf> }) {
  const saeulen: Saeule[] = v.tage.map((t) => ({
    schluessel: t.tag,
    label: `${zerlege(t.tag).tag}.`,
    wert: t.ausgegeben,
    farbe: t.ausgegeben > v.proTag ? 'minus' : 'akzent',
    tooltip: {
      titel: kurzDatum(t.tag) + (t.index === v.tagIndex ? ' · heute' : t.vergangen ? '' : ' · kommt noch'),
      zeilen: [
        ...(t.vergangen
          ? [{ label: t.ausgegeben > v.proTag ? 'ausgegeben, drüber' : 'ausgegeben', wert: euro(t.ausgegeben), farbe: t.ausgegeben > v.proTag ? ('minus' as const) : ('akzent' as const), form: 'flaeche' as const }]
          : []),
        { label: 'Tagesbudget', wert: euro(v.proTag), farbe: 'hell', form: 'strich' }
      ]
    }
  }));
  return (
    <section className={s.abschnitt} aria-labelledby="protag-titel">
      <h2 id="protag-titel" className={s.abschnittTitel}>
        Pro Tag
      </h2>
      <Karte className={`${a.diagrammKarte} ${a.oben}`}>
        <div className={a.innen}>
          <Legende
            eintraege={[
              { label: 'im Rahmen', farbe: 'akzent', form: 'flaeche' },
              { label: 'über Tagesbudget', farbe: 'minus', form: 'flaeche' },
              { label: 'Tagesbudget', farbe: 'hell', form: 'strich' }
            ]}
          />
        </div>
        <div className={a.innen}>
          <Saeulen
            saeulen={saeulen}
            referenz={{ wert: v.proTag, label: euro(v.proTag) }}
            zeigeLabel={(i) => i === saeulen.length - 1 || (i % 7 === 0 && saeulen.length - 1 - i >= 4)}
            beschreibung={`Ausgaben pro Tag seit ${langDatum(v.zyklus.start)}, Tagesbudget ${euro(v.proTag)}.`}
          />
        </div>
        <div className={a.innen}>
          <Tabelle
            kopf={['Tag', 'ausgegeben']}
            zeilen={v.tage.filter((t) => t.vergangen).map((t) => [kurzDatum(t.tag), t.ausgegeben > v.proTag ? `${euro2(t.ausgegeben)} (drüber)` : euro2(t.ausgegeben)])}
          />
        </div>
      </Karte>
    </section>
  );
}

/* ------------------------------------------------------------ Kennzahlen */

function Kennzahlen({ k, v, pots }: { k: ReturnType<typeof kennzahlen>; v: ReturnType<typeof monatsverlauf>; pots: { id: string; name: string }[] }) {
  const potName = k.groesste ? pots.find((p) => p.id === k.groesste?.potId)?.name : undefined;
  return (
    <section className={s.abschnitt} aria-labelledby="kennzahlen-titel">
      <h2 id="kennzahlen-titel" className={s.abschnittTitel}>
        Kennzahlen
      </h2>
      <div className={a.kacheln}>
        <Kachel
          label="Tage ohne Ausgabe"
          wert={String(k.tageOhne)}
          unter={k.abgeschlosseneTage > 0 ? `von ${k.abgeschlosseneTage} ${k.abgeschlosseneTage === 1 ? 'Tag' : 'Tagen'}` : 'noch kein Tag vorbei'}
        />
        <Kachel
          label="über Tagesbudget"
          wert={String(k.tageDrueber)}
          unter={k.tageDrueber === 1 ? 'Tag' : 'Tage'}
          minus={k.tageDrueber > 0}
        />
        <Kachel label="Ø pro Tag" wert={euro(k.schnittProTag)} unter={`Budget ${euro(v.proTag)}`} minus={k.schnittProTag > v.proTag} />
        <Kachel
          label="größte Ausgabe"
          wert={k.groesste ? euro(k.groesste.cent) : '–'}
          unter={k.groesste ? `${potName ?? ''} · ${kurz(k.groesste.datum)}` : 'noch keine'}
        />
      </div>
      <p className={a.fussnote}>
        {k.anzahl === 1 ? '1 Ausgabe' : `${k.anzahl} Ausgaben`} in diesem Monat
        {k.schnittProAusgabe !== null && (
          <>
            , im Schnitt <span className={s.zahl}>{euro(k.schnittProAusgabe)}</span>
          </>
        )}
        .
      </p>
    </section>
  );
}

function Kachel({ label, wert, unter, minus = false }: { label: string; wert: string; unter: string; minus?: boolean }) {
  return (
    <Karte className={a.kachel}>
      <p className={a.label}>{label}</p>
      <p className={`${a.kachelWert} ${minus ? s.minus : ''}`}>{wert}</p>
      <p className={a.kachelUnter}>{unter}</p>
    </Karte>
  );
}

/* ------------------------------------------------------------ Verteilung */

function Verteilung({ verteilung, gesamt }: { verteilung: ReturnType<typeof potVerteilung>; gesamt: Cent }) {
  const max = Math.max(...verteilung.map((x) => x.ausgegeben), 1);
  return (
    <section className={s.abschnitt} aria-labelledby="verteilung-titel">
      <h2 id="verteilung-titel" className={s.abschnittTitel}>
        Wohin dein Geld geht
      </h2>
      <Karte className={a.listeKarte}>
        {gesamt === 0 ? (
          <p className={a.hinweis}>In diesem Monat noch nichts ausgegeben.</p>
        ) : (
          <ul className={a.balkenListe}>
            {verteilung.map((x) => (
              <li key={x.potId}>
                <div className={a.balkenKopf}>
                  <span className={a.balkenName}>
                    {istSymbol(x.symbol) && <Icon name={x.symbol} />}
                    {x.name}
                  </span>
                  <span className={a.balkenWert}>
                    <span className={s.zahl}>{euro(x.ausgegeben)}</span>
                    <span className={a.anteil}> · {prozent(x.anteil)}</span>
                  </span>
                </div>
                <div className={a.balkenSpur} aria-hidden="true">
                  {x.ausgegeben > 0 && <div className={a.balken} style={{ width: `${(x.ausgegeben / max) * 100}%` }} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Karte>
    </section>
  );
}

/* ---------------------------------------------------------------- Wofuer */

const TAGE_PRO_MONAT = 365.25 / 12;

/** Ausgaben nach Notiz ("Zigaretten", "Rewe"), fuer den Monat oder seit Beginn. */
function Wofuer({ pots, ausgaben, monatsstart, heute }: { pots: readonly Pot[]; ausgaben: readonly Ausgabe[]; monatsstart: Tag; heute: Tag }) {
  const [zeitraum, setZeitraum] = useState<'monat' | 'alles'>('monat');
  const ids = useMemo(() => new Set(pots.map((p) => p.id)), [pots]);
  const erster = useMemo(
    () => ausgaben.filter((x) => ids.has(x.potId) && x.datum <= heute).reduce<Tag | null>((m, x) => (m === null || x.datum < m ? x.datum : m), null),
    [ausgaben, ids, heute]
  );
  const von = zeitraum === 'monat' ? monatsstart : (erster ?? monatsstart);
  const tage = differenz(heute, von) + 1;
  const r = useMemo(() => nachNotiz(ausgaben, ids, von, heute, 8), [ausgaben, ids, von, heute]);
  const max = Math.max(...r.eintraege.map((e) => e.summe), r.sonstige.summe, r.ohneNotiz.summe, 1);
  const proMonat = (c: Cent) => (zeitraum === 'alles' && tage >= 28 ? ` · ≈ ${euro(Math.round((c * TAGE_PRO_MONAT) / tage))} im Monat` : '');
  const zeile = (name: string, summe: Cent, anzahl: number, farbe: string, extra = '') => (
    <li key={name}>
      <div className={a.balkenKopf}>
        <span className={a.balkenName}>{name}</span>
        <span className={a.balkenWert}>
          <span className={s.zahl}>{euro(summe)}</span>
          <span className={a.anteil}> · {prozent(r.gesamt > 0 ? summe / r.gesamt : 0)}</span>
        </span>
      </div>
      <div className={a.balkenSpur} aria-hidden="true">
        {summe > 0 && <div className={a.balken} style={{ width: `${(summe / max) * 100}%`, background: farbe }} />}
      </div>
      <p className={a.balkenUnter}>
        {anzahl}× · Ø {euro(Math.round(summe / Math.max(anzahl, 1)))}
        {extra}
      </p>
    </li>
  );

  return (
    <section className={s.abschnitt} aria-labelledby="wofuer-titel">
      <h2 id="wofuer-titel" className={s.abschnittTitel}>
        Wofür
      </h2>
      <div className={a.zeitraum} role="group" aria-label="Zeitraum">
        <Chip label="dieser Monat" aktiv={zeitraum === 'monat'} onClick={() => setZeitraum('monat')} />
        <Chip label="seit Beginn" aktiv={zeitraum === 'alles'} onClick={() => setZeitraum('alles')} />
      </div>
      <Karte className={a.listeKarte}>
        {r.eintraege.length === 0 ? (
          <p className={a.hinweis}>
            {r.gesamt === 0
              ? 'In diesem Zeitraum noch nichts ausgegeben.'
              : 'Noch keine Notizen. Schreib beim Erfassen dazu, wofür: Dann siehst du hier zum Beispiel, was dich Zigaretten kosten.'}
          </p>
        ) : (
          <ul className={a.balkenListe}>
            {r.eintraege.map((e) => zeile(e.name, e.summe, e.anzahl, 'var(--c-accent)', proMonat(e.summe)))}
            {r.sonstige.arten > 0 &&
              zeile(`${r.sonstige.arten} weitere`, r.sonstige.summe, r.sonstige.anzahl, 'var(--c-accent-45)')}
            {r.ohneNotiz.anzahl > 0 && zeile('ohne Notiz', r.ohneNotiz.summe, r.ohneNotiz.anzahl, 'var(--c-inactive)')}
          </ul>
        )}
      </Karte>
      {zeitraum === 'alles' && tage < 28 && r.eintraege.length > 0 && (
        <p className={a.fussnote}>Hochrechnung pro Monat ab 4 Wochen Daten, bisher {tage === 1 ? '1 Tag' : `${tage} Tage`}.</p>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- Zyklen */

function Zyklen({ zyklen }: { zyklen: ReturnType<typeof zyklenVergleich> }) {
  const name = (t: Tag) => monatsname(zerlege(t).monat).slice(0, 3);
  const saeulen: Saeule[] = zyklen.map((x) => {
    const drueber = x.ausgegeben > x.budget;
    const farbe = drueber ? 'minus' : x.laufend ? 'akzent45' : 'akzent';
    return {
      schluessel: x.zyklus.start,
      label: name(x.zyklus.start),
      wert: x.ausgegeben,
      farbe,
      marke: x.budget,
      tooltip: {
        titel: `${kurz(x.zyklus.start)} – ${kurz(x.zyklus.ende)}${x.laufend ? ' · läuft' : ''}`,
        zeilen: [
          { label: drueber ? 'ausgegeben, drüber' : 'ausgegeben', wert: euro(x.ausgegeben), farbe, form: 'flaeche' },
          { label: 'Budget', wert: euro(x.budget), farbe: 'hell', form: 'strich' }
        ]
      }
    };
  });
  return (
    <section className={s.abschnitt} aria-labelledby="zyklen-titel">
      <h2 id="zyklen-titel" className={s.abschnittTitel}>
        Monate im Vergleich
      </h2>
      <Karte className={`${a.diagrammKarte} ${a.oben}`}>
        <div className={a.innen}>
          <Legende
            eintraege={[
              { label: 'ausgegeben', farbe: 'akzent', form: 'flaeche' },
              { label: 'läuft noch', farbe: 'akzent45', form: 'flaeche' },
              { label: 'drüber', farbe: 'minus', form: 'flaeche' },
              { label: 'Budget', farbe: 'hell', form: 'strich' }
            ]}
          />
        </div>
        <div className={a.innen}>
          <Saeulen saeulen={saeulen} beschreibung={`Ausgaben und Budget der letzten ${zyklen.length} Monate.`} />
        </div>
        {zyklen.length < 2 && <p className={`${a.innen} ${a.hinweis}`}>Ab dem nächsten Monat siehst du hier den Vergleich.</p>}
        <div className={a.innen}>
          <Tabelle
            kopf={['Monat', 'ausgegeben', 'Budget']}
            zeilen={zyklen.map((x) => [`${kurz(x.zyklus.start)} – ${kurz(x.zyklus.ende)}`, euro2(x.ausgegeben), euro2(x.budget)])}
          />
        </div>
      </Karte>
    </section>
  );
}

/* ------------------------------------------------------------ Wochentage */

function Wochentage({ woche }: { woche: ReturnType<typeof wochentage> }) {
  const max = Math.max(...woche.werte.map((w) => w.schnitt ?? 0));
  const saeulen: Saeule[] = woche.werte.map((w) => {
    const spitze = max > 0 && w.schnitt === max;
    return {
      schluessel: WOCHENTAGE[w.wochentag] as string,
      label: WOCHENTAGE[w.wochentag] as string,
      wert: w.schnitt ?? 0,
      farbe: spitze ? 'akzent' : 'akzent45',
      tooltip: {
        titel: WOCHENTAGE_LANG[w.wochentag] as string,
        zeilen: [{ label: `im Schnitt (${w.tage}×)`, wert: w.schnitt === null ? '–' : euro(w.schnitt), farbe: spitze ? 'akzent' : 'akzent45', form: 'flaeche' }]
      }
    };
  });
  const spitzenTag = woche.werte.find((w) => max > 0 && w.schnitt === max);
  return (
    <section className={s.abschnitt} aria-labelledby="woche-titel">
      <h2 id="woche-titel" className={s.abschnittTitel}>
        Wochentage
      </h2>
      <Karte className={`${a.diagrammKarte} ${a.oben}`}>
        <p className={`${a.innen} ${a.satzFrei}`}>
          {spitzenTag ? (
            <>
              Am meisten gibst du am <strong className={a.stark}>{WOCHENTAGE_LANG[spitzenTag.wochentag]}</strong> aus, im Schnitt{' '}
              <span className={s.zahl}>{euro(spitzenTag.schnitt ?? 0)}</span>.
            </>
          ) : (
            'Noch keine Ausgaben.'
          )}
        </p>
        <div className={a.innen}>
          <Saeulen saeulen={saeulen} hoehe={90} beschreibung="Durchschnittliche Ausgaben je Wochentag." />
        </div>
        {woche.tage < 28 && (
          <p className={`${a.innen} ${a.hinweis}`}>
            Erst {woche.tage} {woche.tage === 1 ? 'Tag' : 'Tage'} Daten. Aussagekräftig wird das nach ein paar Wochen.
          </p>
        )}
        <div className={a.innen}>
          <Tabelle
            kopf={['Wochentag', 'im Schnitt', 'Tage']}
            zeilen={woche.werte.map((w) => [WOCHENTAGE_LANG[w.wochentag], w.schnitt === null ? '–' : euro2(w.schnitt), String(w.tage)])}
          />
        </div>
      </Karte>
    </section>
  );
}

/* --------------------------------------------------------- Monatskosten */

function Monatskosten({
  kosten,
  demnaechst,
  heute
}: {
  kosten: ReturnType<typeof monatskosten>;
  demnaechst: ReturnType<typeof anstehend>;
  heute: Tag;
}) {
  const anteilBudget = kosten.gesamt > 0 ? kosten.budget / kosten.gesamt : 0;
  return (
    <section className={s.abschnitt} aria-labelledby="kosten-titel">
      <h2 id="kosten-titel" className={s.abschnittTitel}>
        Was dich ein Monat kostet
      </h2>
      <Karte className={a.listeKarte}>
        <Betrag cent={kosten.gesamt} groesse={32} kommaLuft />
        {kosten.gesamt > 0 && (
          <div className={a.segmente} aria-hidden="true">
            {kosten.budget > 0 && <div style={{ flexGrow: anteilBudget, background: 'var(--c-accent)' }} />}
            {kosten.fixkosten > 0 && <div style={{ flexGrow: 1 - anteilBudget, background: 'var(--c-inactive)' }} />}
          </div>
        )}
        <ul className={a.kostenListe}>
          <li>
            <Schluessel farbe="akzent" form="flaeche" />
            <span>Budget der Pots</span>
            <span className={s.zahl}>{euro(kosten.budget)}</span>
          </li>
          <li>
            <Schluessel farbe="grau" form="flaeche" />
            <span>Fixkosten pro Monat</span>
            <span className={s.zahl}>{euro(kosten.fixkosten)}</span>
          </li>
        </ul>
      </Karte>

      <h3 className={a.unterTitel}>In den nächsten 30 Tagen abgebucht</h3>
      {demnaechst.length === 0 ? (
        <Karte>
          <p className={s.leer}>Nichts geplant.</p>
        </Karte>
      ) : (
        <Karte>
          {demnaechst.map(({ fixkosten: fk, datum }) => {
            const n = differenz(datum, heute);
            const wann = n <= 1 ? faelligkeitText(faelligkeit(n, 0)) : `in ${n} Tagen`;
            return (
              <div key={fk.id} className={`${l.posten} ${a.zeile}`}>
                <span className={l.info}>
                  <span className={l.name}>{fk.name}</span>
                  <span className={`${l.unter} ${n <= 3 ? l.bald : ''}`}>
                    {kurzDatum(datum)} · {wann}
                  </span>
                </span>
                <span className={l.rechts}>
                  <span className={l.wert}>{euro2(fk.cent)}</span>
                </span>
              </div>
            );
          })}
        </Karte>
      )}
    </section>
  );
}
