import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

/** Breite eines Elements, aktualisiert bei Groessenaenderung. */
export function useBreite<T extends HTMLElement>(start = 315) {
  const ref = useRef<T>(null);
  const [breite, setBreite] = useState(start);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const messen = () => setBreite(Math.max(120, Math.round(el.getBoundingClientRect().width)));
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, breite };
}

/**
 * Welcher Datenpunkt gerade gewaehlt ist. Zeiger (Finger, Maus, Stift)
 * waehlt den naechsten Punkt zur x-Position; Pfeiltasten springen, Esc
 * hebt die Auswahl auf. Ein Tipp ausserhalb schliesst die Anzeige.
 */
export function useAuswahl(anzahl: number, xZuIndex: (x: number) => number) {
  const [aktiv, setAktiv] = useState<number | null>(null);
  const halter = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aktiv === null) return undefined;
    const weg = (e: globalThis.PointerEvent) => {
      if (halter.current && !halter.current.contains(e.target as Node)) setAktiv(null);
    };
    document.addEventListener('pointerdown', weg);
    return () => document.removeEventListener('pointerdown', weg);
  }, [aktiv]);

  const ausZeiger = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = xZuIndex(e.clientX - r.left);
    setAktiv(Math.min(anzahl - 1, Math.max(0, i)));
  };

  return {
    aktiv,
    setAktiv,
    halter,
    svgProps: {
      tabIndex: 0,
      onPointerDown: ausZeiger,
      onPointerMove: (e: PointerEvent<SVGSVGElement>) => {
        if (e.pointerType === 'mouse' || e.buttons > 0) ausZeiger(e);
      },
      onPointerLeave: (e: PointerEvent<SVGSVGElement>) => {
        if (e.pointerType === 'mouse') setAktiv(null);
      },
      onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => {
        const n = anzahl - 1;
        const neu: Record<string, number> = {
          ArrowRight: Math.min(n, (aktiv ?? -1) + 1),
          ArrowLeft: Math.max(0, (aktiv ?? n + 1) - 1),
          Home: 0,
          End: n
        };
        if (e.key in neu) {
          e.preventDefault();
          setAktiv(neu[e.key] ?? null);
        } else if (e.key === 'Escape') {
          setAktiv(null);
        }
      },
      onBlur: () => setAktiv(null)
    }
  };
}
