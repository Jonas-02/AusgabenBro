import { useEffect, useId, useRef, useState } from 'react';
import { euro } from '../domain/geld';
import { proTag } from '../domain/pot';
import { zyklusVon } from '../domain/zyklus';
import { leseDatei, speicherSichern } from '../store/backup';
import { START_POTS } from '../store/startwerte';
import { useStore, type PotEntwurf } from '../store/store';
import { Icon } from '../ui/Icon';
import { Karte } from '../ui/Karte';
import { Betrag } from '../ui/Betrag';
import type { ToastDaten } from '../ui/Toast';
import { navigiere } from '../hooks/useRoute';
import { HomeHinweis } from './HomeHinweis';
import { ZahlText } from './Meta';
import { PotListe } from './PotListe';
import { PotSheet } from './PotSheet';
import { ZahltagAuswahl } from './ZahltagAuswahl';
import e from './Einstellungen.module.css';
import f from './formular.module.css';
import o from './Onboarding.module.css';
import s from './seite.module.css';

interface Props {
  heute: string;
  zeigeToast: (t: Omit<ToastDaten, 'id'>) => void;
}

type Entwurf = PotEntwurf & { schluessel: string };

let zaehler = 0;
const mitSchluessel = (p: PotEntwurf): Entwurf => ({ ...p, schluessel: `p${++zaehler}` });

/**
 * Abgeleitet (nicht im Figma): erster Start in drei Schritten.
 * 1. Name und Zahltag, 2. Pots (vorbelegt aus Figma 1:2), 3. Home-Bildschirm.
 */
export function Onboarding({ heute, zeigeToast }: Props) {
  const abschliessen = useStore((x) => x.onboardingAbschliessen);
  const importieren = useStore((x) => x.importieren);
  const [schritt, setSchritt] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [zahltag, setZahltag] = useState(1);
  const [pots, setPots] = useState<Entwurf[]>(() => START_POTS.map((p) => mitSchluessel({ ...p })));
  const [sheet, setSheet] = useState<{ offen: boolean; index?: number | undefined }>({ offen: false });
  const nameId = useId();
  const dateiFeld = useRef<HTMLInputElement>(null);

  const seite = useRef<HTMLElement>(null);
  const erster = useRef(true);

  // Beim Schrittwechsel nach oben und den Fokus auf die neue Ueberschrift.
  useEffect(() => {
    if (erster.current) {
      erster.current = false;
      return;
    }
    window.scrollTo(0, 0);
    seite.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [schritt]);

  const zyklusTage = zyklusVon(heute, zahltag).tage;
  const summe = pots.reduce((n, p) => n + p.cent, 0);
  const bearbeitet = sheet.index !== undefined ? pots[sheet.index] : undefined;

  function fertig() {
    abschliessen(name, zahltag, pots);
    void speicherSichern();
    navigiere({ seite: 'budget' });
  }

  async function sicherungLaden(datei: File | undefined) {
    if (dateiFeld.current) dateiFeld.current.value = '';
    if (!datei) return;
    const r = await leseDatei(datei);
    if (!r.ok) {
      zeigeToast({ text: r.fehler, dauerMs: 6000 });
      return;
    }
    importieren({ ...r.daten, onboardingFertig: true });
    void speicherSichern();
    navigiere({ seite: 'budget' });
    zeigeToast({ text: 'Sicherung geladen' });
  }

  const zurueck =
    schritt > 1 ? (
      <button type="button" className={s.zurueck} onClick={() => setSchritt((x) => (x === 3 ? 2 : 1))}>
        <Icon name="chevronDown" drehung={90} />
        Zurück
      </button>
    ) : null;

  return (
    <main ref={seite} className={`${s.seite} ${o.seite}`}>
      <div className={o.fortschritt} aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= schritt ? o.punktAktiv : o.punkt} />
        ))}
      </div>
      <p className="nur-screenreader">Schritt {schritt} von 3</p>

      {schritt === 1 && (
        <>
          <h1 className={s.gruss} tabIndex={-1}>
            Hallo,
            <span className={s.unter}>schön, dass du da bist</span>
          </h1>
          <p className={o.text}>
            Deine Pots füllen sich jeden Tag ein Stück. So siehst du immer, wie viel heute wirklich drin ist, statt am Monatsende zu
            staunen.
          </p>
          <Karte className={e.formKarte}>
            <div className={f.feldGruppe}>
              <label className={f.frage} htmlFor={nameId}>
                wie heißt du?
              </label>
              <input
                id={nameId}
                className={f.feld}
                type="text"
                autoComplete="given-name"
                enterKeyHint="next"
                maxLength={30}
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
                }}
              />
            </div>
            <ZahltagAuswahl wert={zahltag} onWahl={setZahltag} />
            <p className={e.hinweis}>An diesem Tag kommt dein Geld und dein Budget-Monat beginnt.</p>
          </Karte>
          <div className={o.unten}>
            <button type="button" className={f.cta} onClick={() => setSchritt(2)}>
              <span>Weiter</span>
            </button>
            <button type="button" className={e.abbrechen} onClick={() => dateiFeld.current?.click()}>
              Ich habe eine Sicherung
            </button>
            <input
              ref={dateiFeld}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(ev) => void sicherungLaden(ev.target.files?.[0])}
            />
          </div>
        </>
      )}

      {schritt === 2 && (
        <>
          <div className={s.kopfbereich}>
            {zurueck}
            <h1 className={s.gruss} tabIndex={-1}>
              Deine Pots
              <span className={s.unter}>so viel darfst du im Monat ausgeben</span>
            </h1>
          </div>
          <Karte>
            <div className={s.kartenKopf}>
              <Betrag cent={summe} groesse={32} kommaLuft />
              <div className={s.meta}>
                <p>
                  <ZahlText cent={summe} text="a month" />
                </p>
                <p>
                  <ZahlText cent={proTag(summe, zyklusTage)} text="daily" plus />
                </p>
              </div>
            </div>
          </Karte>
          <p className={o.text}>Tippe einen Pot an, um Betrag, Name oder Symbol zu ändern. Alles lässt sich später in den Einstellungen anpassen.</p>
          <PotListe
            pots={pots}
            zyklusTage={zyklusTage}
            onBearbeiten={(index) => setSheet({ offen: true, index })}
            onVerschieben={(i, r) =>
              setPots((alt) => {
                const neu = [...alt];
                const j = i + r;
                if (j < 0 || j >= neu.length) return alt;
                [neu[i], neu[j]] = [neu[j] as Entwurf, neu[i] as Entwurf];
                return neu;
              })
            }
          />
          <button type="button" className={e.hinzufuegen} onClick={() => setSheet({ offen: true })}>
            <Icon name="plus" />
            <span className="ende-text">Pot hinzufügen</span>
          </button>
          <div className={o.unten}>
            <button
              type="button"
              className={f.cta}
              onClick={() => {
                if (pots.length === 0) {
                  zeigeToast({ text: 'Leg mindestens einen Pot an' });
                  return;
                }
                setSchritt(3);
              }}
            >
              <span>Weiter</span>
            </button>
          </div>
        </>
      )}

      {schritt === 3 && (
        <>
          <div className={s.kopfbereich}>
            {zurueck}
            <h1 className={s.gruss} tabIndex={-1}>
              Fast fertig{name.trim() ? `, ${name.trim()}` : ''}
              <span className={s.unter}>hol dir die App auf den Home-Bildschirm</span>
            </h1>
          </div>
          <HomeHinweis />
          <p className={o.text}>
            Du startest mit <span className={s.zahl}>{euro(summe)}</span> im Monat in {pots.length === 1 ? '1 Pot' : `${pots.length} Pots`}.
          </p>
          <div className={o.unten}>
            <button type="button" className={f.cta} onClick={fertig}>
              <span>Los geht’s</span>
            </button>
          </div>
        </>
      )}

      <PotSheet
        offen={sheet.offen}
        start={bearbeitet}
        zyklusTage={zyklusTage}
        onSchliessen={() => setSheet((z) => ({ ...z, offen: false }))}
        onSpeichern={(p) => {
          setPots((alt) =>
            sheet.index !== undefined ? alt.map((x, i) => (i === sheet.index ? { ...x, ...p } : x)) : [...alt, mitSchluessel(p)]
          );
          setSheet((z) => ({ ...z, offen: false }));
        }}
        onLoeschen={
          sheet.index !== undefined
            ? () => {
                setPots((alt) => alt.filter((_, i) => i !== sheet.index));
                setSheet((z) => ({ ...z, offen: false }));
              }
            : undefined
        }
      />
    </main>
  );
}
