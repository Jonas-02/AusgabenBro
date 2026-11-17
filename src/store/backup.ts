import type { Tag } from '../domain/datum';
import { leseExport, type Ergebnis, type Exportdatei } from './schema';

export function dateiname(heute: Tag): string {
  return `ausgabenbro-${heute}.json`;
}

export type ExportErgebnis = 'geteilt' | 'geladen' | 'abgebrochen';

/**
 * Sichert die Daten als JSON-Datei. Auf dem iPhone oeffnet das Teilen-Menue
 * ("In Dateien sichern", AirDrop, Mail). Ein Download-Link funktioniert in
 * einer Home-Bildschirm-App nicht zuverlaessig, er ist nur der Rueckfall fuer
 * Browser ohne Datei-Teilen.
 */
export async function exportiere(datei: Exportdatei, heute: Tag): Promise<ExportErgebnis> {
  const json = JSON.stringify(datei, null, 2);
  const name = dateiname(heute);
  const file = new File([json], name, { type: 'application/json' });

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'AusgabenBro-Backup' });
      return 'geteilt';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'abgebrochen';
      // Andere Fehler (z. B. fehlende Nutzergeste): auf Download ausweichen.
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'geladen';
}

export async function leseDatei(file: File): Promise<Ergebnis> {
  if (file.size > 10_000_000) return { ok: false, fehler: 'Die Datei ist zu groß.' };
  return leseExport(await file.text());
}

/** Bittet den Browser, die Daten nicht automatisch zu raeumen (Safari: 7-Tage-Regel). */
export async function speicherSichern(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Laeuft die App vom Home-Bildschirm (eigenes Fenster ohne Safari-Leiste)? */
export function alsAppGestartet(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}
