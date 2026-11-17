import { useEffect, useId, useRef, useState } from 'react';
import { euro, parseEuro, type Cent } from '../domain/geld';
import { proTag } from '../domain/pot';
import { BottomSheet } from '../ui/BottomSheet';
import { istSymbol, type SymbolName } from '../ui/Icon';
import { SymbolWahl } from '../ui/SymbolWahl';
import { BetragsFeld, alsEingabe } from './BetragsFeld';
import s from './formular.module.css';

export interface PotFormular {
  name: string;
  symbol: SymbolName;
  cent: Cent;
}

interface Props {
  offen: boolean;
  /** Vorbelegung beim Bearbeiten; ohne Wert legt das Sheet einen neuen Pot an. */
  start?: { name: string; symbol: string; cent: Cent } | undefined;
  /** Tage im laufenden Zyklus, fuer den Hinweis "etwa x am Tag". */
  zyklusTage: number;
  onSchliessen: () => void;
  onSpeichern: (p: PotFormular) => void;
  onLoeschen?: (() => void) | undefined;
}

/**
 * Abgeleitet (nicht im Figma): Pot anlegen oder bearbeiten. Aufbau wie das
 * Fixkosten-Sheet 12:187: Betrag, Textfeld, Auswahl, Speichern, Loeschen.
 */
export function PotSheet({ offen, start, zyklusTage, onSchliessen, onSpeichern, onLoeschen }: Props) {
  const [betrag, setBetrag] = useState('');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState<SymbolName>('einkauf');
  const [hinweis, setHinweis] = useState<string | null>(null);
  const betragFeld = useRef<HTMLInputElement>(null);
  const nameId = useId();

  useEffect(() => {
    if (!offen) return;
    setHinweis(null);
    setBetrag(start ? alsEingabe(start.cent) : '');
    setName(start?.name ?? '');
    setSymbol(start && istSymbol(start.symbol) ? start.symbol : 'sonstiges');
    // Nur beim Oeffnen vorbelegen.
  }, [offen, start]);

  useEffect(() => {
    if (!hinweis) return undefined;
    const t = window.setTimeout(() => setHinweis(null), 1600);
    return () => window.clearTimeout(t);
  }, [hinweis]);

  const cent = parseEuro(betrag);

  function absenden() {
    if (cent === null || cent <= 0) {
      setHinweis('Betrag eingeben');
      betragFeld.current?.focus();
      return;
    }
    if (!name.trim()) {
      setHinweis('Namen eingeben');
      return;
    }
    onSpeichern({ name: name.trim(), symbol, cent });
  }

  return (
    <BottomSheet offen={offen} onSchliessen={onSchliessen} titel={start ? 'Pot bearbeiten' : 'Neuer Pot'}>
      <div className={s.feldGruppe}>
        <BetragsFeld wert={betrag} onAendern={setBetrag} label="Betrag pro Monat in Euro" feldRef={betragFeld} />
        <p className={s.frage} aria-live="polite">
          im Monat{cent !== null && cent > 0 ? ` · etwa ${euro(proTag(cent, zyklusTage))} am Tag` : ''}
        </p>
      </div>

      <div className={s.feldGruppe}>
        <label className={s.frage} htmlFor={nameId}>
          wie heißt der Pot?
        </label>
        <input
          id={nameId}
          className={s.feld}
          type="text"
          autoComplete="off"
          enterKeyHint="done"
          placeholder="z. B. Einkauf und Haushalt"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className={s.feldGruppe}>
        <p className={s.frage} aria-hidden="true">
          Symbol
        </p>
        <SymbolWahl legende="Symbol des Pots" wert={symbol} onWahl={setSymbol} />
      </div>

      <button type="button" className={s.cta} onClick={absenden}>
        <span>{hinweis ?? 'Pot speichern'}</span>
      </button>

      {onLoeschen && (
        <button type="button" className={s.loeschen} onClick={onLoeschen}>
          Pot löschen
        </button>
      )}
    </BottomSheet>
  );
}
