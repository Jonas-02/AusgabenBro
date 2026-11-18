import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { addiere, ausBetrag, loesche, tasteVonKey, tippe, zuCent, type Taste } from '../domain/eingabe';
import { euro } from '../domain/geld';
import { vorschau, type Ausgleich } from '../domain/pot';
import { NOTIZ_MAX, vorschlaege } from '../domain/notiz';
import type { Ausgabe } from '../domain/typen';
import { useStore } from '../store/store';
import { BottomSheet } from '../ui/BottomSheet';
import { Balken } from '../ui/Balken';
import { Chip } from '../ui/Chip';
import { istSymbol } from '../ui/Icon';
import { Schnellbetrag, Zahlenfeld } from '../ui/Zahlenfeld';
import { ZahlText } from './Meta';
import s from './AusgabeSheet.module.css';
import seite from './seite.module.css';
import f from './formular.module.css';

export interface AusgabeSheetZustand {
  offen: boolean;
  /** Vorbelegter Pot, z. B. aus dem Pot-Verlauf. */
  potId?: string | undefined;
  /** Bearbeiten statt neu anlegen. */
  bearbeiten?: Ausgabe | undefined;
}

interface Props extends AusgabeSheetZustand {
  heute: string;
  onSchliessen: () => void;
  onGespeichert: (id: string, neu: boolean) => void;
  onGeloescht: (a: Ausgabe) => void;
}

const SCHNELL = [500, 1_000, 2_000];

/** Figma 7:4 / 7:198: Betrag, Schnellbetraege, Pot-Wahl, Vorschau, Zahlenfeld. */
export function AusgabeSheet({ offen, potId, bearbeiten, heute, onSchliessen, onGespeichert, onGeloescht }: Props) {
  const pots = useStore((x) => x.pots);
  const ausgaben = useStore((x) => x.ausgaben);
  const zahltag = useStore((x) => x.zahltag);
  const uebertrag = useStore((x) => x.uebertrag);
  const letzterPot = useStore((x) => x.letzterPot);
  const hinzufuegen = useStore((x) => x.ausgabeHinzufuegen);
  const aendern = useStore((x) => x.ausgabeAendern);
  const loeschen = useStore((x) => x.ausgabeLoeschen);

  const [eingabe, setEingabe] = useState('');
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [notiz, setNotiz] = useState('');
  const listeId = useId();

  // Beim Oeffnen vorbelegen: bearbeiteter Betrag bzw. zuletzt genutzter Pot.
  useEffect(() => {
    if (!offen) return;
    setHinweis(null);
    if (bearbeiten) {
      setEingabe(ausBetrag(bearbeiten.cent));
      setGewaehlt(bearbeiten.potId);
      setNotiz(bearbeiten.notiz ?? '');
    } else {
      setEingabe('');
      setNotiz('');
      const vorschlag = potId ?? letzterPot;
      setGewaehlt(pots.some((p) => p.id === vorschlag) ? (vorschlag as string) : (pots[0]?.id ?? null));
    }
    // Absichtlich nur beim Oeffnen: spaetere Store-Aenderungen sollen die
    // laufende Eingabe nicht ueberschreiben.
  }, [offen, bearbeiten, potId]);

  const pot = pots.find((p) => p.id === gewaehlt) ?? null;
  const cent = zuCent(eingabe);

  // Beim Bearbeiten zaehlt die alte Fassung der Ausgabe nicht mit.
  const basis = useMemo(
    () => (bearbeiten ? ausgaben.filter((a) => a.id !== bearbeiten.id) : ausgaben),
    [ausgaben, bearbeiten]
  );
  const v = pot ? vorschau(pot, basis, heute, { zahltag, uebertrag }, cent) : null;

  const speichern = useCallback(() => {
    if (!pot) return;
    if (cent <= 0) {
      setHinweis('Betrag eingeben');
      return;
    }
    if (bearbeiten) {
      aendern(bearbeiten.id, { potId: pot.id, cent, notiz });
      onGespeichert(bearbeiten.id, false);
    } else {
      onGespeichert(hinzufuegen(pot.id, cent, { notiz }), true);
    }
  }, [pot, cent, notiz, bearbeiten, aendern, hinzufuegen, onGespeichert]);

  const vorschlagsliste = useMemo(() => (offen ? vorschlaege(ausgaben, gewaehlt) : []), [offen, ausgaben, gewaehlt]);

  // Hinweis "Betrag eingeben" nach kurzer Zeit wieder zuruecknehmen.
  useEffect(() => {
    if (!hinweis) return undefined;
    const t = window.setTimeout(() => setHinweis(null), 1600);
    return () => window.clearTimeout(t);
  }, [hinweis]);

  const taste = useCallback((t: Taste) => setEingabe((e) => tippe(e, t)), []);
  const rueck = useCallback(() => setEingabe((e) => loesche(e)), []);

  // Hardware-Keyboard: Ziffern, Komma/Punkt, Backspace, Enter. Esc schliesst
  // ueber das cancel-Ereignis des Dialogs.
  const speichernRef = useRef(speichern);
  speichernRef.current = speichern;
  useEffect(() => {
    if (!offen) return undefined;
    const taste = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Im Notizfeld gehoeren Ziffern und Ruecktaste dem Text, nicht dem Betrag.
      const ziel = e.target as HTMLElement | null;
      if (ziel && (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA' || ziel.isContentEditable)) return;
      const t = tasteVonKey(e.key);
      if (t) {
        e.preventDefault();
        setEingabe((x) => tippe(x, t));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setEingabe((x) => loesche(x));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        speichernRef.current();
      }
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [offen]);

  return (
    <BottomSheet offen={offen} onSchliessen={onSchliessen} titel={bearbeiten ? 'Ausgabe bearbeiten' : 'Neue Ausgabe'}>
      <div className={s.betragBlock}>
        <div className={s.eingabe} aria-live="polite" aria-atomic="true">
          <span className="nur-screenreader">Betrag: {euro(cent).replace(' ', ' ')}</span>
          <span className={`${s.ziffern} ${eingabe ? '' : s.leer} ende-num`} aria-hidden="true">
            {eingabe || '0'}
          </span>
          <span className={s.cursor} aria-hidden="true" />
          <span className={s.waehrung} aria-hidden="true">
            €
          </span>
        </div>
        <div className={s.schnell}>
          {SCHNELL.map((c) => (
            <Schnellbetrag key={c} cent={c} onClick={() => setEingabe((e) => addiere(e, c))} />
          ))}
        </div>
      </div>

      <div className={s.potWahl}>
        <p className={f.frage}>aus welchem Pot?</p>
        <div className={f.chips}>
          {pots.map((p) => (
            <Chip
              key={p.id}
              label={p.name}
              icon={istSymbol(p.symbol) ? p.symbol : undefined}
              aktiv={p.id === gewaehlt}
              onClick={() => setGewaehlt(p.id)}
            />
          ))}
        </div>
        <input
          className={`${f.feld} ${s.notiz}`}
          type="text"
          list={listeId}
          aria-label="Notiz"
          placeholder="wofür? z. B. Zigaretten"
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
          maxLength={NOTIZ_MAX}
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        />
        <datalist id={listeId}>
          {vorschlagsliste.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </div>

      {pot && v && (
        <div className={s.auswirkung} aria-live="polite">
          <div className={s.kopf}>
            <div className={s.danach}>
              <p className={f.frage}>danach in {pot.name}</p>
              <p className={`${s.nachher} ${v.nachher < 0 ? seite.minus : ''}`}>{euro(v.nachher)}</p>
            </div>
            <div className={s.vorher}>
              <p>
                <ZahlText cent={v.vorher} text="vorher" vorne />
              </p>
              <p>
                <ZahlText cent={v.proTag} text="daily" plus />
              </p>
            </div>
          </div>
          <Balken daten={v.balken} hoehe={12} />
          <Statuszeile ausgleich={v.ausgleich} />
        </div>
      )}

      <Zahlenfeld onTaste={taste} onLoeschen={rueck} />

      <button type="button" className={f.cta} onClick={speichern} aria-describedby={hinweis ? 'betrag-hinweis' : undefined}>
        <span id={hinweis ? 'betrag-hinweis' : undefined}>{hinweis ?? (bearbeiten ? 'Änderung speichern' : 'Ausgabe speichern')}</span>
      </button>

      {bearbeiten && (
        <button
          type="button"
          className={f.loeschen}
          onClick={() => {
            const weg = loeschen(bearbeiten.id);
            if (weg) onGeloescht(weg);
          }}
        >
          Löschen
        </button>
      )}
    </BottomSheet>
  );
}

/** Immer vorhanden und mit fester Hoehe, damit beim Tippen nichts springt. */
function Statuszeile({ ausgleich }: { ausgleich: Ausgleich }) {
  if (ausgleich.art === 'plus') return <p className={s.status}>bleibt im Plus</p>;
  if (ausgleich.art === 'nicht-mehr') return <p className={`${s.status} ${s.statusMinus}`}>diesen Monat nicht mehr ausgeglichen</p>;
  if (ausgleich.tage === 1) return <p className={`${s.status} ${s.statusMinus}`}>morgen wieder ausgeglichen</p>;
  return (
    <p className={`${s.status} ${s.statusMinus}`}>
      in <span className={seite.zahl}>{ausgleich.tage}</span> Tagen wieder ausgeglichen
    </p>
  );
}
