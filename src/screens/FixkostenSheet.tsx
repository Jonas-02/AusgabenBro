import { useEffect, useId, useRef, useState } from 'react';
import { euro2, parseEuro } from '../domain/geld';
import { monatsname } from '../domain/datum';
import { RHYTHMUS_TEXT } from '../domain/fixkosten';
import type { Fixkosten, Rhythmus } from '../domain/typen';
import { useStore } from '../store/store';
import { BottomSheet } from '../ui/BottomSheet';
import { Chip } from '../ui/Chip';
import { Icon, istSymbol, WAEHLBARE_ICONS, type SymbolName } from '../ui/Icon';
import s from './FixkostenSheet.module.css';
import a from './AusgabeSheet.module.css';

export interface FixkostenSheetZustand {
  offen: boolean;
  bearbeiten?: Fixkosten | undefined;
}

interface Props extends FixkostenSheetZustand {
  heute: string;
  onSchliessen: () => void;
  onGespeichert: (neu: boolean) => void;
  onGeloescht: (fk: Fixkosten) => void;
}

const RHYTHMEN: Rhythmus[] = ['monthly', 'quarterly', 'yearly'];
const TAGE = Array.from({ length: 31 }, (_, i) => i + 1);
const MONATE = Array.from({ length: 12 }, (_, i) => i + 1);

/** Figma 12:187: Betrag, Name, Kategorie, Rhythmus, Abbuchungstag. */
export function FixkostenSheet({ offen, bearbeiten, heute, onSchliessen, onGespeichert, onGeloescht }: Props) {
  const kategorien = useStore((x) => x.kategorien);
  const speichern = useStore((x) => x.fixkostenSpeichern);
  const loeschen = useStore((x) => x.fixkostenLoeschen);
  const kategorieAnlegen = useStore((x) => x.kategorieAnlegen);

  const [betrag, setBetrag] = useState('');
  const [name, setName] = useState('');
  const [kategorieId, setKategorieId] = useState('');
  const [rhythmus, setRhythmus] = useState<Rhythmus>('monthly');
  const [tag, setTag] = useState(1);
  const [startMonat, setStartMonat] = useState(1);
  const [neueKat, setNeueKat] = useState<{ name: string; symbol: SymbolName } | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const betragFeld = useRef<HTMLInputElement>(null);
  const ids = { betrag: useId(), name: useId(), tag: useId(), monat: useId(), kat: useId() };

  useEffect(() => {
    if (!offen) return;
    setHinweis(null);
    setNeueKat(null);
    if (bearbeiten) {
      setBetrag(euro2(bearbeiten.cent).replace(/\s*€$/, '').replace(/ /g, ''));
      setName(bearbeiten.name);
      setKategorieId(bearbeiten.kategorieId);
      setRhythmus(bearbeiten.rhythmus);
      setTag(bearbeiten.tag);
      setStartMonat(bearbeiten.startMonat);
    } else {
      const monat = Number(heute.slice(5, 7));
      setBetrag('');
      setName('');
      setKategorieId(kategorien[0]?.id ?? '');
      setRhythmus('monthly');
      setTag(Number(heute.slice(8, 10)));
      setStartMonat(monat);
    }
    // Absichtlich nur beim Oeffnen vorbelegen.
  }, [offen, bearbeiten]);

  useEffect(() => {
    if (!hinweis) return undefined;
    const t = window.setTimeout(() => setHinweis(null), 1600);
    return () => window.clearTimeout(t);
  }, [hinweis]);

  function absenden() {
    const cent = parseEuro(betrag);
    if (cent === null || cent <= 0) {
      setHinweis('Betrag eingeben');
      betragFeld.current?.focus();
      return;
    }
    if (!name.trim()) {
      setHinweis('Wofür? eingeben');
      return;
    }
    let kat = kategorieId;
    if (neueKat) {
      if (!neueKat.name.trim()) {
        setHinweis('Kategorie benennen');
        return;
      }
      kat = kategorieAnlegen(neueKat.name, neueKat.symbol);
    }
    if (!kat) {
      setHinweis('Kategorie wählen');
      return;
    }
    speichern({ id: bearbeiten?.id, name: name.trim(), cent, kategorieId: kat, rhythmus, tag, startMonat });
    onGespeichert(!bearbeiten);
  }

  const monatLabel = rhythmus === 'quarterly' ? 'erste Abbuchung im' : 'abgebucht im';

  return (
    <BottomSheet offen={offen} onSchliessen={onSchliessen} titel={bearbeiten ? 'Fixkosten bearbeiten' : 'Neue Fixkosten'}>
      <label className={s.betrag} htmlFor={ids.betrag}>
        <span className={`${s.spiegel} ende-num`} aria-hidden="true">
          {betrag || '0,00'}
        </span>
        <input
          ref={betragFeld}
          id={ids.betrag}
          className={s.betragFeld}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          aria-label="Betrag in Euro"
          value={betrag}
          onChange={(e) => setBetrag(e.target.value.replace(/[^\d.,]/g, '').slice(0, 9))}
        />
        <span className={s.waehrung} aria-hidden="true">
          €
        </span>
      </label>

      <div className={s.feldGruppe}>
        <label className={a.frage} htmlFor={ids.name}>
          wofür?
        </label>
        <input
          id={ids.name}
          className={s.feld}
          type="text"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="z. B. Internet"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className={s.feldGruppe} role="group" aria-labelledby={ids.kat}>
        <p id={ids.kat} className={a.frage}>
          Kategorie
        </p>
        <div className={a.chips}>
          {kategorien.map((k) => (
            <Chip
              key={k.id}
              label={k.name}
              icon={istSymbol(k.symbol) ? k.symbol : undefined}
              aktiv={!neueKat && k.id === kategorieId}
              onClick={() => {
                setNeueKat(null);
                setKategorieId(k.id);
              }}
            />
          ))}
          <Chip
            label="Neue Kategorie"
            icon="neueKategorie"
            gedimmt={!neueKat}
            aktiv={!!neueKat}
            onClick={() => setNeueKat((n) => n ?? { name: '', symbol: 'sonstiges' })}
          />
        </div>
        {neueKat && (
          <div className={s.neueKategorie}>
            <input
              className={s.feld}
              type="text"
              autoFocus
              placeholder="Name der Kategorie"
              aria-label="Name der neuen Kategorie"
              maxLength={40}
              value={neueKat.name}
              onChange={(e) => setNeueKat({ ...neueKat, name: e.target.value })}
            />
            <div className={s.symbole} role="radiogroup" aria-label="Symbol">
              {WAEHLBARE_ICONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={neueKat.symbol === n}
                  aria-label={n}
                  className={`${s.symbol} ${neueKat.symbol === n ? s.symbolAktiv : ''}`}
                  onClick={() => setNeueKat({ ...neueKat, symbol: n })}
                >
                  <Icon name={n} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={s.feldGruppe} role="group" aria-label="Wie oft?">
        <p className={a.frage}>wie oft?</p>
        <div className={a.chips}>
          {RHYTHMEN.map((r) => (
            <Chip key={r} label={RHYTHMUS_TEXT[r]} aktiv={r === rhythmus} onClick={() => setRhythmus(r)} />
          ))}
        </div>
      </div>

      <label className={s.auswahl} htmlFor={ids.tag}>
        <span className={a.frage}>abgebucht am</span>
        <span className={s.wert}>
          {tag}. des Monats
          <Icon name="chevronDown" />
        </span>
        <select id={ids.tag} className={s.select} value={tag} onChange={(e) => setTag(Number(e.target.value))}>
          {TAGE.map((t) => (
            <option key={t} value={t}>
              {t}. des Monats
            </option>
          ))}
        </select>
      </label>

      {rhythmus !== 'monthly' && (
        <label className={s.auswahl} htmlFor={ids.monat}>
          <span className={a.frage}>{monatLabel}</span>
          <span className={s.wert}>
            {monatsname(startMonat)}
            <Icon name="chevronDown" />
          </span>
          <select id={ids.monat} className={s.select} value={startMonat} onChange={(e) => setStartMonat(Number(e.target.value))}>
            {MONATE.map((m) => (
              <option key={m} value={m}>
                {monatsname(m)}
              </option>
            ))}
          </select>
        </label>
      )}

      <button type="button" className={a.cta} onClick={absenden}>
        <span>{hinweis ?? 'Fixkosten speichern'}</span>
      </button>

      {bearbeiten && (
        <button
          type="button"
          className={a.loeschen}
          onClick={() => {
            loeschen(bearbeiten.id);
            onGeloescht(bearbeiten);
          }}
        >
          Löschen
        </button>
      )}
    </BottomSheet>
  );
}
