import { useEffect, useId, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { Icon } from './Icon';
import styles from './BottomSheet.module.css';

interface Props {
  offen: boolean;
  onSchliessen: () => void;
  titel: string;
  children: ReactNode;
}

type Zustand = 'zu' | 'offen' | 'schliesst';

const DAUER_MS = 300;
const SCHWELLE_ANTEIL = 0.3;
const SCHWELLE_TEMPO = 0.5; // px/ms
const ZIEH_START_PX = 4;

/**
 * Bottom Sheet auf Basis von <dialog> mit showModal(): Fokus bleibt im Sheet,
 * Esc schliesst, der Hintergrund ist gesperrt. Schliessen per X, Esc, Tipp
 * auf den Scrim oder Runterwischen auf Griff und Kopfzeile.
 */
export function BottomSheet({ offen, onSchliessen, titel, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zustand, setZustand] = useState<Zustand>('zu');
  const titelId = useId();
  const zug = useRef<{ startY: number; startT: number; letzteY: number; letzteT: number; dy: number; aktiv: boolean } | null>(null);

  // Oeffnen und Schliessen mit Animation.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (offen && !d.open) {
      d.style.transform = '';
      d.showModal();
      document.documentElement.classList.add('sheet-offen');
      // Erst im naechsten Frame umschalten, sonst startet die Transition nicht.
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setZustand('offen')));
      return () => cancelAnimationFrame(raf);
    }
    if (!offen && d.open) {
      setZustand('schliesst');
      const t = window.setTimeout(() => {
        d.close();
        d.style.transform = '';
        setZustand('zu');
        if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('sheet-offen');
      }, DAUER_MS);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [offen]);

  // Beim Entfernen der Komponente aufraeumen.
  useEffect(
    () => () => {
      if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('sheet-offen');
    },
    []
  );

  function onCancel(e: React.SyntheticEvent) {
    // Esc: selbst schliessen, damit die Animation laeuft.
    e.preventDefault();
    onSchliessen();
  }

  function onKlick(e: React.MouseEvent<HTMLDialogElement>) {
    // Klick auf den Scrim landet beim <dialog> selbst. Safari kennt
    // `closedby` nicht, deshalb dieser Ersatz.
    if (e.target === dialog.current) onSchliessen();
  }

  function ziehStart(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    zug.current = { startY: e.clientY, startT: e.timeStamp, letzteY: e.clientY, letzteT: e.timeStamp, dy: 0, aktiv: false };
  }

  function ziehen(e: PointerEvent<HTMLDivElement>) {
    const z = zug.current;
    const d = dialog.current;
    if (!z || !d) return;
    const dy = Math.max(0, e.clientY - z.startY);
    if (!z.aktiv) {
      if (dy < ZIEH_START_PX) return;
      // Erst jetzt uebernehmen, damit ein Tipp aufs X ein Klick bleibt.
      z.aktiv = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      d.dataset.zieht = 'ja';
    }
    z.dy = dy;
    z.letzteY = e.clientY;
    z.letzteT = e.timeStamp;
    d.style.transform = `translateY(${dy}px)`;
  }

  function ziehEnde(e: PointerEvent<HTMLDivElement>) {
    const z = zug.current;
    const d = dialog.current;
    zug.current = null;
    if (!z || !d || !z.aktiv) return;
    delete d.dataset.zieht;
    const dauer = Math.max(e.timeStamp - z.startT, 1);
    const tempo = z.dy / dauer;
    if (z.dy > d.offsetHeight * SCHWELLE_ANTEIL || tempo > SCHWELLE_TEMPO) {
      onSchliessen();
    } else {
      d.style.transform = ''; // zurueckfedern
    }
  }

  return (
    <dialog
      ref={dialog}
      className={styles.sheet}
      data-zustand={zustand}
      aria-labelledby={titelId}
      onCancel={onCancel}
      onClick={onKlick}
    >
      <div
        className={styles.zug}
        onPointerDown={ziehStart}
        onPointerMove={ziehen}
        onPointerUp={ziehEnde}
        onPointerCancel={ziehEnde}
      >
        <div className={styles.griff} aria-hidden="true" />
        <div className={styles.kopf}>
          <h2 id={titelId} className={styles.titel}>
            {titel}
          </h2>
          <button type="button" className={styles.schliessen} onClick={onSchliessen} aria-label="Schließen">
            <Icon name="close" />
          </button>
        </div>
      </div>
      <div className={styles.inhalt}>{children}</div>
    </dialog>
  );
}
