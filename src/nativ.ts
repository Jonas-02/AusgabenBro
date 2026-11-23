/**
 * Damit sich die Home-Bildschirm-App wie eine native App anfuehlt.
 *
 * Zoom: Safari ignoriert `user-scalable=no` seit iOS 10. Die eigenen
 * Gesten-Ereignisse von Safari (gesturestart/-change/-end) lassen sich aber
 * abbrechen, ebenso Zwei-Finger-Bewegungen. Doppeltipp-Zoom verhindert
 * `touch-action: manipulation` in base.css.
 *
 * Gedrueckt-Zustaende: iOS wendet `:active` nur an, wenn auf der Seite ein
 * touchstart-Listener haengt. Ein leerer, passiver Listener genuegt.
 */
export function wieNativ(doc: Document = document): () => void {
  const abbrechen = (e: Event) => e.preventDefault();
  const zweiFinger = (e: TouchEvent) => {
    if (e.touches.length > 1) e.preventDefault();
  };
  const nichts = () => {};

  const gesten = ['gesturestart', 'gesturechange', 'gestureend'] as const;
  for (const g of gesten) doc.addEventListener(g, abbrechen, { passive: false });
  doc.addEventListener('touchmove', zweiFinger, { passive: false });
  doc.addEventListener('touchstart', nichts, { passive: true });

  return () => {
    for (const g of gesten) doc.removeEventListener(g, abbrechen);
    doc.removeEventListener('touchmove', zweiFinger);
    doc.removeEventListener('touchstart', nichts);
  };
}
