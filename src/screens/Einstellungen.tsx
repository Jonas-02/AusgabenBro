import { useId, useRef, useState } from 'react';
import { euro } from '../domain/geld';
import { aktuellerMonatsbetrag } from '../domain/pot';
import type { Uebertrag } from '../domain/typen';
import { zyklusVon } from '../domain/zyklus';
import { exportiere, leseDatei } from '../store/backup';
import type { Daten } from '../store/schema';
import { useStore } from '../store/store';
import { Chip } from '../ui/Chip';
import { Icon } from '../ui/Icon';
import { Karte } from '../ui/Karte';
import type { ToastDaten } from '../ui/Toast';
import { Bestaetigung } from './Bestaetigung';
import { HomeHinweis } from './HomeHinweis';
import { PotListe } from './PotListe';
import { PotSheet } from './PotSheet';
import { ZahltagAuswahl } from './ZahltagAuswahl';
import e from './Einstellungen.module.css';
import f from './formular.module.css';
import l from './liste.module.css';
import s from './seite.module.css';

interface Props {
  heute: string;
  zeigeToast: (t: Omit<ToastDaten, 'id'>) => void;
}

const UEBERTRAG: { wert: Uebertrag; label: string; text: string }[] = [
  { wert: 'reset', label: 'neu anfangen', text: 'Jeder Monat startet bei null. Was übrig ist oder fehlt, verfällt am Zahltag.' },
  { wert: 'carry', label: 'mitnehmen', text: 'Rest und Minus wandern in den nächsten Monat.' }
];

/**
 * Abgeleitet (nicht im Figma): Profil, Zahltag, Uebertrag, Pots, Daten.
 * Bausteine aus Dashboard 1:2 (Seitenkopf, Abschnitte), Fixkosten 11:46
 * (Listenzeilen) und Fixkosten-Sheet 12:187 (Felder, Chips, Auswahlzeile).
 */
export function Einstellungen({ heute, zeigeToast }: Props) {
  const st = useStore();
  const ids = { name: useId(), motto: useId(), uebertrag: useId() };
  const zyklusTage = zyklusVon(heute, st.zahltag).tage;
  const summe = st.pots.reduce((n, p) => n + aktuellerMonatsbetrag(p), 0);

  const [potSheet, setPotSheet] = useState<{ offen: boolean; index?: number | undefined }>({ offen: false });
  const [importDaten, setImportDaten] = useState<Daten | null>(null);
  const [loeschenFrage, setLoeschenFrage] = useState(false);
  const dateiFeld = useRef<HTMLInputElement>(null);

  const bearbeitet = potSheet.index !== undefined ? st.pots[potSheet.index] : undefined;

  async function exportieren() {
    const r = await exportiere(st.exportieren(), heute);
    if (r === 'geladen') zeigeToast({ text: 'Sicherung heruntergeladen' });
    if (r === 'geteilt') zeigeToast({ text: 'Sicherung erstellt' });
  }

  async function dateiGewaehlt(datei: File | undefined) {
    if (dateiFeld.current) dateiFeld.current.value = '';
    if (!datei) return;
    const r = await leseDatei(datei);
    if (!r.ok) {
      zeigeToast({ text: r.fehler, dauerMs: 6000 });
      return;
    }
    setImportDaten(r.daten);
  }

  function importBestaetigt() {
    if (!importDaten) return;
    const vorher = st.exportieren().daten;
    st.importieren({ ...importDaten, onboardingFertig: true });
    setImportDaten(null);
    zeigeToast({ text: 'Importiert', aktion: { label: 'Rückgängig', onClick: () => st.importieren(vorher) } });
  }

  function allesLoeschen() {
    const vorher = st.exportieren().daten;
    setLoeschenFrage(false);
    st.allesLoeschen();
    zeigeToast({ text: 'Alles gelöscht', aktion: { label: 'Rückgängig', onClick: () => st.importieren(vorher) }, dauerMs: 8000 });
  }

  return (
    <main className={`${s.seite} ${e.seite}`}>
      <div className={s.kopfbereich}>
        <a className={s.zurueck} href="#/budget">
          <Icon name="chevronDown" drehung={90} />
          Budget
        </a>
        <h1 className={s.gruss}>
          Einstellungen
          <span className={s.unter}>alles bleibt auf diesem Gerät</span>
        </h1>
      </div>

      <section className={s.abschnitt} aria-labelledby="profil-titel">
        <h2 id="profil-titel" className={s.abschnittTitel}>
          Über dich
        </h2>
        <Karte className={e.formKarte}>
          <div className={f.feldGruppe}>
            <label className={f.frage} htmlFor={ids.name}>
              dein Name
            </label>
            <input
              id={ids.name}
              className={f.feld}
              type="text"
              autoComplete="given-name"
              enterKeyHint="done"
              maxLength={30}
              value={st.name}
              onChange={(ev) => st.profilSetzen({ name: ev.target.value })}
            />
          </div>
          <div className={f.feldGruppe}>
            <p className={f.frage}>unter deinem Namen</p>
            <div className={f.chips}>
              <Chip label="täglicher Spruch" aktiv={st.tagesspruch} onClick={() => st.profilSetzen({ tagesspruch: true })} />
              <Chip label="eigenes Motto" aktiv={!st.tagesspruch} onClick={() => st.profilSetzen({ tagesspruch: false })} />
            </div>
          </div>
          {st.tagesspruch ? (
            <p className={e.hinweis}>Jeden Tag ein neuer Spruch. Nett ist anders.</p>
          ) : (
            <div className={f.feldGruppe}>
              <label className={f.frage} htmlFor={ids.motto}>
                dein Motto
              </label>
              <input
                id={ids.motto}
                className={f.feld}
                type="text"
                autoComplete="off"
                enterKeyHint="done"
                maxLength={60}
                value={st.motto}
                onChange={(ev) => st.profilSetzen({ motto: ev.target.value })}
              />
            </div>
          )}
          <ZahltagAuswahl wert={st.zahltag} onWahl={(z) => st.profilSetzen({ zahltag: z })} />
          <p className={e.hinweis}>An diesem Tag beginnt dein Budget-Monat. Gibt es den Tag nicht, zählt der letzte Tag des Monats.</p>
        </Karte>
      </section>

      <section className={s.abschnitt} aria-labelledby={ids.uebertrag}>
        <h2 id={ids.uebertrag} className={s.abschnittTitel}>
          Am Monatsende
        </h2>
        <Karte className={e.formKarte}>
          <p className={f.frage}>was passiert mit dem Rest?</p>
          <div className={f.chips}>
            {UEBERTRAG.map((u) => (
              <Chip key={u.wert} label={u.label} aktiv={st.uebertrag === u.wert} onClick={() => st.profilSetzen({ uebertrag: u.wert })} />
            ))}
          </div>
          <p className={e.hinweis}>{UEBERTRAG.find((u) => u.wert === st.uebertrag)?.text}</p>
        </Karte>
      </section>

      <section className={s.abschnitt} aria-labelledby="pots-verwalten">
        <div className={e.titelZeile}>
          <h2 id="pots-verwalten" className={s.abschnittTitel}>
            Deine Pots
          </h2>
          <p className={e.summe} aria-live="polite">
            <span className={s.zahl}>{euro(summe)}</span> im Monat
          </p>
        </div>
        <PotListe
          pots={st.pots.map((p) => ({ schluessel: p.id, name: p.name, symbol: p.symbol, cent: aktuellerMonatsbetrag(p) }))}
          zyklusTage={zyklusTage}
          onBearbeiten={(index) => setPotSheet({ offen: true, index })}
          onVerschieben={(index, r) => {
            const p = st.pots[index];
            if (p) st.potVerschieben(p.id, r);
          }}
        />
        <button type="button" className={e.hinzufuegen} onClick={() => setPotSheet({ offen: true })}>
          <Icon name="plus" />
          <span className="ende-text">Pot hinzufügen</span>
        </button>
      </section>

      <section className={s.abschnitt} aria-labelledby="daten-titel">
        <h2 id="daten-titel" className={s.abschnittTitel}>
          Deine Daten
        </h2>
        <Karte>
          <button type="button" className={l.posten} onClick={exportieren}>
            <span className={l.info}>
              <span className={l.name}>Daten exportieren</span>
              <span className={l.unter}>als Datei sichern, z. B. in iCloud Drive</span>
            </span>
          </button>
          <button type="button" className={l.posten} onClick={() => dateiFeld.current?.click()}>
            <span className={l.info}>
              <span className={l.name}>Daten importieren</span>
              <span className={l.unter}>aus einer Sicherung, ersetzt alles hier</span>
            </span>
          </button>
          <button type="button" className={l.posten} onClick={() => setLoeschenFrage(true)}>
            <span className={l.info}>
              <span className={`${l.name} ${s.minus}`}>Alle Daten löschen</span>
              <span className={l.unter}>setzt die App auf den Anfang zurück</span>
            </span>
          </button>
        </Karte>
        <input
          ref={dateiFeld}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(ev) => void dateiGewaehlt(ev.target.files?.[0])}
        />
      </section>

      <section className={s.abschnitt} aria-labelledby="app-titel">
        <h2 id="app-titel" className={s.abschnittTitel}>
          Als App nutzen
        </h2>
        <HomeHinweis />
      </section>

      <PotSheet
        offen={potSheet.offen}
        start={bearbeitet ? { name: bearbeitet.name, symbol: bearbeitet.symbol, cent: aktuellerMonatsbetrag(bearbeitet) } : undefined}
        zyklusTage={zyklusTage}
        onSchliessen={() => setPotSheet((z) => ({ ...z, offen: false }))}
        onSpeichern={(p) => {
          if (bearbeitet) st.potAendern(bearbeitet.id, p);
          else st.potAnlegen(p);
          setPotSheet((z) => ({ ...z, offen: false }));
        }}
        onLoeschen={
          bearbeitet
            ? () => {
                const weg = st.potLoeschen(bearbeitet.id);
                setPotSheet((z) => ({ ...z, offen: false }));
                if (!weg) return;
                const n = weg.ausgaben.length;
                zeigeToast({
                  text: n === 0 ? 'Pot gelöscht' : `Pot und ${n === 1 ? '1 Ausgabe' : `${n} Ausgaben`} gelöscht`,
                  aktion: { label: 'Rückgängig', onClick: () => st.potWiederherstellen(weg) }
                });
              }
            : undefined
        }
      />

      <Bestaetigung
        offen={importDaten !== null}
        titel="Sicherung importieren?"
        aktion="Importieren"
        onBestaetigen={importBestaetigt}
        onSchliessen={() => setImportDaten(null)}
      >
        {importDaten && (
          <p>
            Die Sicherung enthält {importDaten.pots.length} Pots, {importDaten.ausgaben.length} Ausgaben und {importDaten.fixkosten.length}{' '}
            Fixkosten. Sie ersetzt alles, was gerade auf diesem Gerät ist.
          </p>
        )}
      </Bestaetigung>

      <Bestaetigung
        offen={loeschenFrage}
        titel="Alle Daten löschen?"
        aktion="Alles löschen"
        gefahr
        onBestaetigen={allesLoeschen}
        onSchliessen={() => setLoeschenFrage(false)}
      >
        <p>Pots, Ausgaben, Fixkosten und Einstellungen werden von diesem Gerät gelöscht. Exportiere vorher, wenn du sie behalten willst.</p>
      </Bestaetigung>
    </main>
  );
}
