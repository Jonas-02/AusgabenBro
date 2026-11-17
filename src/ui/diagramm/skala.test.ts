import { describe, expect, it } from 'vitest';
import { achse } from './skala';

describe('Achse', () => {
  it('waehlt runde Schritte mit wenig Leerraum', () => {
    expect(achse(75_000)).toEqual({ max: 75_000, schritte: [0, 25_000, 50_000, 75_000] });
    expect(achse(38_370)).toEqual({ max: 40_000, schritte: [0, 20_000, 40_000] });
    expect(achse(2_500)).toEqual({ max: 3_000, schritte: [0, 1_000, 2_000, 3_000] });
  });

  it('kommt mit 0 und kleinen Werten aus', () => {
    expect(achse(0).max).toBeGreaterThan(0);
    expect(achse(150).schritte.every((s) => s % 100 === 0)).toBe(true);
  });
});
