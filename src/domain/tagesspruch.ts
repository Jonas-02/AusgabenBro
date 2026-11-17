import { differenz, type Tag } from './datum';

const START: Tag = '2026-01-01';

/** Kleiner, reproduzierbarer Zufallsgenerator (mulberry32). */
function zufall(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Feste Mischung der Indizes 0..anzahl-1 fuer eine Runde (Fisher-Yates). */
function mischung(anzahl: number, runde: number): number[] {
  const r = zufall(Math.imul(runde, 7_919) + 17);
  const folge = Array.from({ length: anzahl }, (_, i) => i);
  for (let i = anzahl - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [folge[i], folge[j]] = [folge[j] as number, folge[i] as number];
  }
  return folge;
}

/**
 * Welcher Spruch an einem Tag dran ist. Zufaellig gemischt, aber fest pro
 * Tag: Er wechselt um Mitternacht und bleibt bei jedem Oeffnen gleich. Jede
 * Runde zeigt jeden Spruch genau einmal; am Rundenwechsel kommt derselbe
 * nie zweimal hintereinander. Ab drei Spruechen.
 */
export function spruchIndex(t: Tag, anzahl: number): number {
  if (anzahl <= 1) return 0;
  const tagNr = differenz(t, START);
  const runde = Math.floor(tagNr / anzahl);
  const pos = tagNr - runde * anzahl;
  const folge = mischung(anzahl, runde);
  const letzterVorher = mischung(anzahl, runde - 1)[anzahl - 1];
  if (folge[0] === letzterVorher) [folge[0], folge[1]] = [folge[1] as number, folge[0] as number];
  return folge[pos] as number;
}
