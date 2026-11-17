import { useEffect } from 'react';
import styles from './Toast.module.css';

export interface ToastDaten {
  id: number;
  text: string;
  aktion?: { label: string; onClick: () => void };
  dauerMs?: number;
}

interface Props {
  toast: ToastDaten | null;
  onEnde: () => void;
  /** Abstand nach oben, damit der FAB frei bleibt. */
  ueberFab?: boolean;
}

/**
 * Kurzer Hinweis, z. B. "Gespeichert · Rückgängig". Nicht im Figma; aus
 * Karte und Akzentfarbe abgeleitet (siehe DECISIONS.md).
 */
export function Toast({ toast, onEnde, ueberFab = true }: Props) {
  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(onEnde, toast.dauerMs ?? 5000);
    return () => window.clearTimeout(t);
  }, [toast, onEnde]);

  return (
    <div className={`${styles.halter} ${ueberFab ? styles.ueberFab : ''}`} role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className={styles.toast}>
          <span>{toast.text}</span>
          {toast.aktion && (
            <>
              <span className={styles.punkt} aria-hidden="true">·</span>
              <button
                type="button"
                className={styles.aktion}
                onClick={() => {
                  toast.aktion?.onClick();
                  onEnde();
                }}
              >
                {toast.aktion.label}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
