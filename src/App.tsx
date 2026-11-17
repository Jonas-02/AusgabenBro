import { useCallback, useState } from 'react';
import { useStore } from './store/store';
import { useHeute } from './hooks/useHeute';
import { useRoute } from './hooks/useRoute';
import type { Ausgabe } from './domain/typen';
import { TabBar } from './ui/TabBar';
import { Fab } from './ui/Fab';
import { Toast, type ToastDaten } from './ui/Toast';
import { Dashboard } from './screens/Dashboard';
import { AusgabeSheet, type AusgabeSheetZustand } from './screens/AusgabeSheet';

let toastZaehler = 0;

export function App() {
  const route = useRoute();
  const heute = useHeute();
  const onboardingFertig = useStore((s) => s.onboardingFertig);
  const ausgabeLoeschen = useStore((s) => s.ausgabeLoeschen);
  const ausgabeWiederherstellen = useStore((s) => s.ausgabeWiederherstellen);

  const [ausgabeSheet, setAusgabeSheet] = useState<AusgabeSheetZustand>({ offen: false });
  const [toast, setToast] = useState<ToastDaten | null>(null);
  const toastEnde = useCallback(() => setToast(null), []);

  const zeigeToast = useCallback((t: Omit<ToastDaten, 'id'>) => setToast({ ...t, id: ++toastZaehler }), []);

  const ausgabeGespeichert = useCallback(
    (id: string, neu: boolean) => {
      setAusgabeSheet({ offen: false });
      zeigeToast(
        neu
          ? { text: 'Gespeichert', aktion: { label: 'Rückgängig', onClick: () => ausgabeLoeschen(id) } }
          : { text: 'Änderung gespeichert' }
      );
    },
    [ausgabeLoeschen, zeigeToast]
  );

  const ausgabeGeloescht = useCallback(
    (a: Ausgabe) => {
      setAusgabeSheet({ offen: false });
      zeigeToast({ text: 'Gelöscht', aktion: { label: 'Rückgängig', onClick: () => ausgabeWiederherstellen(a) } });
    },
    [ausgabeWiederherstellen, zeigeToast]
  );

  if (!onboardingFertig) {
    return <p style={{ padding: 28 }}>Onboarding folgt.</p>;
  }

  const tab = route.seite === 'fixkosten' ? 'fixkosten' : 'budget';

  return (
    <>
      {route.seite === 'budget' && <Dashboard heute={heute} />}

      {route.seite !== 'einstellungen' && (
        <Fab
          label={tab === 'fixkosten' ? 'Fixkosten' : 'Ausgabe'}
          onClick={() =>
            tab === 'budget' &&
            setAusgabeSheet({ offen: true, potId: route.seite === 'pot' ? route.id : undefined })
          }
        />
      )}
      <TabBar aktiv={tab} />
      <Toast toast={toast} onEnde={toastEnde} />

      <AusgabeSheet
        {...ausgabeSheet}
        heute={heute}
        onSchliessen={() => setAusgabeSheet((z) => ({ ...z, offen: false }))}
        onGespeichert={ausgabeGespeichert}
        onGeloescht={ausgabeGeloescht}
      />
    </>
  );
}
