import type { IconDaten } from './iconData';

// Icons, die im Figma fehlen, aber fuer abgeleitete Screens noetig sind.
// Die Figma-Icons stammen aus der Lucide-Familie; diese hier auch, im
// selben Strichstil (round caps/joins). Siehe DECISIONS.md.
export const ABGELEITETE_ICONS = {
  // Lucide "settings", fuer den Zugang zu den Einstellungen.
  settings: {
    viewBox: '0 0 24 24',
    breite: 20,
    hoehe: 20,
    inhalt:
      '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.75"/>'
  },
  // Lucide "share", wie das Teilen-Symbol in Safari. Fuer den
  // Home-Bildschirm-Hinweis.
  teilen: {
    viewBox: '0 0 24 24',
    breite: 18,
    hoehe: 18,
    inhalt:
      '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 6l-4-4-4 4M12 2v13" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>'
  }
} satisfies Record<string, IconDaten>;
