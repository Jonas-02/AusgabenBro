import { useEffect, useState } from 'react';
import { heute, type Tag } from '../domain/datum';

/**
 * Heutiger Kalendertag in Ortszeit. iOS friert Web-Apps im Hintergrund ein,
 * deshalb wird beim Zurueckkehren (visibilitychange, pageshow, focus) und
 * um Mitternacht neu berechnet.
 */
export function useHeute(): Tag {
  const [tag, setTag] = useState<Tag>(() => heute());

  useEffect(() => {
    let timer = 0;
    const pruefen = () => setTag((alt) => (heute() === alt ? alt : heute()));

    const bisMitternacht = () => {
      const jetzt = new Date();
      const morgen = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + 1, 0, 0, 1);
      timer = window.setTimeout(() => {
        pruefen();
        bisMitternacht();
      }, morgen.getTime() - jetzt.getTime());
    };

    const sichtbar = () => {
      if (document.visibilityState === 'visible') pruefen();
    };

    bisMitternacht();
    document.addEventListener('visibilitychange', sichtbar);
    window.addEventListener('pageshow', pruefen);
    window.addEventListener('focus', pruefen);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', sichtbar);
      window.removeEventListener('pageshow', pruefen);
      window.removeEventListener('focus', pruefen);
    };
  }, []);

  return tag;
}
