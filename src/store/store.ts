import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Cent } from '../domain/geld';
import { heute, type Tag } from '../domain/datum';
import { zyklusVon } from '../domain/zyklus';
import type { Ausgabe, Fixkosten, Kategorie, Pot, Uebertrag } from '../domain/typen';
import { SCHEMA_VERSION, migriere, type Daten, type Exportdatei } from './schema';
import { leereDaten } from './startwerte';

export interface PotEntwurf {
  name: string;
  symbol: string;
  cent: Cent;
}

interface Aktionen {
  onboardingAbschliessen(name: string, zahltag: number, pots: PotEntwurf[]): void;
  profilSetzen(teil: Partial<Pick<Daten, 'name' | 'motto' | 'zahltag'>> & { uebertrag?: Uebertrag }): void;

  ausgabeHinzufuegen(potId: string, cent: Cent, datum?: Tag): string;
  ausgabeAendern(id: string, teil: { potId: string; cent: Cent }): void;
  ausgabeLoeschen(id: string): Ausgabe | null;
  ausgabeWiederherstellen(a: Ausgabe): void;

  potAnlegen(entwurf: PotEntwurf): void;
  potAendern(id: string, teil: Partial<PotEntwurf>): void;
  /** Loescht den Pot samt Ausgaben und gibt beides fuer "Rueckgaengig" zurueck. */
  potLoeschen(id: string): { pot: Pot; ausgaben: Ausgabe[]; index: number } | null;
  potWiederherstellen(geloescht: { pot: Pot; ausgaben: Ausgabe[]; index: number }): void;
  potVerschieben(id: string, richtung: -1 | 1): void;

  fixkostenSpeichern(fk: Omit<Fixkosten, 'id'> & { id?: string | undefined }): void;
  fixkostenLoeschen(id: string): void;
  kategorieAnlegen(name: string, symbol: string): string;

  importieren(daten: Daten): void;
  exportieren(): Exportdatei;
  allesLoeschen(): void;
}

export type Store = Daten & Aktionen;

function neueId(): string {
  return crypto.randomUUID();
}

function datenAus(s: Store): Daten {
  const { onboardingFertig, name, motto, zahltag, uebertrag, pots, ausgaben, letzterPot, fixkosten, kategorien } = s;
  return { onboardingFertig, name, motto, zahltag, uebertrag, pots, ausgaben, letzterPot, fixkosten, kategorien };
}

/**
 * Neuer Monatsbetrag gilt rueckwirkend fuer den laufenden Zyklus. Ein
 * frueherer Eintrag aus demselben Zyklus wird ersetzt, damit sich bei
 * mehrfachem Aendern keine Eintraege stapeln.
 */
function mitNeuemBetrag(pot: Pot, cent: Cent, zahltag: number, tag: Tag): Pot {
  const aktuell = zyklusVon(tag, zahltag);
  const frueher = pot.betraege.filter((b) => b.ab < aktuell.start);
  // Gab es vorher nichts (Pot in diesem Zyklus angelegt), bleibt `ab` der
  // Anlagetag, damit der Uebertrag nicht in die Vergangenheit greift.
  const ab = frueher.length === 0 ? pot.erstelltAm : tag;
  return { ...pot, betraege: [...frueher, { ab, cent }] };
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...leereDaten(),

      onboardingAbschliessen(name, zahltag, pots) {
        const t = heute();
        set({
          onboardingFertig: true,
          name: name.trim(),
          zahltag,
          pots: pots.map((p) => ({
            id: neueId(),
            name: p.name.trim(),
            symbol: p.symbol,
            betraege: [{ ab: t, cent: p.cent }],
            erstelltAm: t
          }))
        });
      },

      profilSetzen(teil) {
        set((s) => ({
          name: teil.name ?? s.name,
          motto: teil.motto ?? s.motto,
          zahltag: teil.zahltag ?? s.zahltag,
          uebertrag: teil.uebertrag ?? s.uebertrag
        }));
      },

      ausgabeHinzufuegen(potId, cent, datum = heute()) {
        const id = neueId();
        set((s) => ({
          ausgaben: [...s.ausgaben, { id, potId, cent, datum, erfasstUm: new Date().toISOString() }],
          letzterPot: potId
        }));
        return id;
      },

      ausgabeAendern(id, teil) {
        set((s) => ({ ausgaben: s.ausgaben.map((a) => (a.id === id ? { ...a, ...teil } : a)) }));
      },

      ausgabeLoeschen(id) {
        const a = get().ausgaben.find((x) => x.id === id) ?? null;
        if (a) set((s) => ({ ausgaben: s.ausgaben.filter((x) => x.id !== id) }));
        return a;
      },

      ausgabeWiederherstellen(a) {
        set((s) => (s.ausgaben.some((x) => x.id === a.id) ? s : { ausgaben: [...s.ausgaben, a] }));
      },

      potAnlegen(entwurf) {
        const t = heute();
        set((s) => ({
          pots: [
            ...s.pots,
            { id: neueId(), name: entwurf.name.trim(), symbol: entwurf.symbol, betraege: [{ ab: t, cent: entwurf.cent }], erstelltAm: t }
          ]
        }));
      },

      potAendern(id, teil) {
        set((s) => ({
          pots: s.pots.map((p) => {
            if (p.id !== id) return p;
            let neu: Pot = { ...p, name: teil.name?.trim() ?? p.name, symbol: teil.symbol ?? p.symbol };
            const bisher = p.betraege[p.betraege.length - 1]?.cent;
            if (teil.cent !== undefined && teil.cent !== bisher) neu = mitNeuemBetrag(neu, teil.cent, s.zahltag, heute());
            return neu;
          })
        }));
      },

      potLoeschen(id) {
        const s = get();
        const index = s.pots.findIndex((p) => p.id === id);
        const pot = s.pots[index];
        if (!pot) return null;
        const ausgaben = s.ausgaben.filter((a) => a.potId === id);
        set({
          pots: s.pots.filter((p) => p.id !== id),
          ausgaben: s.ausgaben.filter((a) => a.potId !== id),
          letzterPot: s.letzterPot === id ? null : s.letzterPot
        });
        return { pot, ausgaben, index };
      },

      potWiederherstellen({ pot, ausgaben, index }) {
        set((s) => {
          if (s.pots.some((p) => p.id === pot.id)) return s;
          const pots = [...s.pots];
          pots.splice(Math.min(index, pots.length), 0, pot);
          const vorhanden = new Set(s.ausgaben.map((a) => a.id));
          return { pots, ausgaben: [...s.ausgaben, ...ausgaben.filter((a) => !vorhanden.has(a.id))] };
        });
      },

      potVerschieben(id, richtung) {
        set((s) => {
          const i = s.pots.findIndex((p) => p.id === id);
          const j = i + richtung;
          if (i < 0 || j < 0 || j >= s.pots.length) return s;
          const pots = [...s.pots];
          [pots[i], pots[j]] = [pots[j] as Pot, pots[i] as Pot];
          return { pots };
        });
      },

      fixkostenSpeichern(fk) {
        set((s) => {
          if (fk.id && s.fixkosten.some((x) => x.id === fk.id)) {
            return { fixkosten: s.fixkosten.map((x) => (x.id === fk.id ? ({ ...fk, id: x.id } as Fixkosten) : x)) };
          }
          return { fixkosten: [...s.fixkosten, { ...fk, id: neueId() }] };
        });
      },

      fixkostenLoeschen(id) {
        set((s) => ({ fixkosten: s.fixkosten.filter((x) => x.id !== id) }));
      },

      kategorieAnlegen(name, symbol) {
        const k: Kategorie = { id: neueId(), name: name.trim(), symbol };
        set((s) => ({ kategorien: [...s.kategorien, k] }));
        return k.id;
      },

      importieren(daten) {
        set({ ...daten });
      },

      exportieren() {
        return { app: 'ausgabenbro', version: SCHEMA_VERSION, exportiertAm: new Date().toISOString(), daten: datenAus(get()) };
      },

      allesLoeschen() {
        set({ ...leereDaten() });
      }
    }),
    {
      name: 'ausgabenbro',
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => datenAus(s),
      migrate: (gespeichert, version) => migriere(gespeichert, version) as Store
    }
  )
);
