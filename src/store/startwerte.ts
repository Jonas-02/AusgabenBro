import type { Kategorie } from '../domain/typen';
import type { Daten } from './schema';

/** Vorbelegung im Onboarding, Werte aus Figma 1:2. */
export const START_POTS = [
  { name: 'Einkauf und Haushalt', symbol: 'einkauf', cent: 21_000 },
  { name: 'Drogen', symbol: 'drogen', cent: 15_000 },
  { name: 'Lifestyle und Kleidung', symbol: 'lifestyle', cent: 14_000 },
  { name: 'Sonstiges und Ausgehen', symbol: 'sonstiges', cent: 25_000 }
] as const;

/** Standard-Kategorien der Fixkosten aus Figma 11:46. */
export const START_KATEGORIEN: Kategorie[] = [
  { id: 'wohnen', name: 'Wohnen', symbol: 'wohnen' },
  { id: 'versicherungen', name: 'Versicherungen und Beiträge', symbol: 'versicherungen' },
  { id: 'abos', name: 'Abos und Verträge', symbol: 'abos' },
  { id: 'mobilitaet', name: 'Mobilität', symbol: 'mobilitaet' }
];

export const START_MOTTO = 'Hör auf dir Zigaretten zu kaufen';

export function leereDaten(): Daten {
  return {
    onboardingFertig: false,
    name: '',
    motto: START_MOTTO,
    zahltag: 1,
    uebertrag: 'reset',
    pots: [],
    ausgaben: [],
    letzterPot: null,
    fixkosten: [],
    kategorien: START_KATEGORIEN.map((k) => ({ ...k }))
  };
}
