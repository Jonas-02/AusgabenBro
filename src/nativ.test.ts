import { describe, expect, it } from 'vitest';
import { wieNativ } from './nativ';

function ereignis(typ: string, finger?: number): Event {
  const e = new Event(typ, { cancelable: true });
  if (finger !== undefined) Object.defineProperty(e, 'touches', { value: { length: finger } });
  return e;
}

describe('Wie nativ', () => {
  it('bricht Safaris Zoom-Gesten und Zwei-Finger-Bewegungen ab, ein Finger scrollt weiter', () => {
    const ziel = new EventTarget() as unknown as Document;
    const aufraeumen = wieNativ(ziel);

    for (const typ of ['gesturestart', 'gesturechange', 'gestureend']) {
      const e = ereignis(typ);
      ziel.dispatchEvent(e);
      expect(e.defaultPrevented, typ).toBe(true);
    }
    const zwei = ereignis('touchmove', 2);
    ziel.dispatchEvent(zwei);
    expect(zwei.defaultPrevented).toBe(true);

    const einer = ereignis('touchmove', 1);
    ziel.dispatchEvent(einer);
    expect(einer.defaultPrevented).toBe(false);

    aufraeumen();
    const danach = ereignis('gesturestart');
    ziel.dispatchEvent(danach);
    expect(danach.defaultPrevented).toBe(false);
  });
});
