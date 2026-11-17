import { describe, expect, it } from 'vitest';
import { plusTage } from './datum';
import { spruchIndex } from './tagesspruch';
import { SPRUECHE } from '../inhalt/sprueche';

const N = SPRUECHE.length;

describe('Tagesspruch', () => {
  it('bleibt den ganzen Tag gleich', () => {
    expect(spruchIndex('2026-11-17', N)).toBe(spruchIndex('2026-11-17', N));
  });

  it('zeigt in einer Runde jeden Spruch genau einmal', () => {
    const tage = Array.from({ length: N }, (_, i) => spruchIndex(plusTage('2026-01-01', i), N));
    expect(new Set(tage).size).toBe(N);
  });

  it('wiederholt nie denselben Spruch an zwei Tagen hintereinander', () => {
    let vorher = spruchIndex('2025-06-01', N);
    for (let i = 1; i < N * 12; i++) {
      const jetzt = spruchIndex(plusTage('2025-06-01', i), N);
      expect(jetzt).not.toBe(vorher);
      vorher = jetzt;
    }
  });

  it('liefert gueltige Indizes, auch vor dem Startdatum', () => {
    for (const t of ['2020-02-29', '2025-12-31', '2026-01-01', '2031-07-15']) {
      const i = spruchIndex(t, N);
      expect(Number.isInteger(i) && i >= 0 && i < N).toBe(true);
    }
  });

  it('hat 40 bis 50 verschiedene Sprueche', () => {
    expect(N).toBeGreaterThanOrEqual(40);
    expect(N).toBeLessThanOrEqual(50);
    expect(new Set(SPRUECHE).size).toBe(N);
    expect(SPRUECHE.every((s) => s.trim() === s && s.length > 0)).toBe(true);
  });
});
