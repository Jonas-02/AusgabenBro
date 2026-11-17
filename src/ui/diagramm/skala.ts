/**
 * Runde Achsenschritte in ganzen Euro (0, s, 2s, …). Probiert 2 bis 4
 * Abschnitte und nimmt den, der am wenigsten Leerraum ueber dem Maximum
 * laesst; bei Gleichstand den mit weniger Linien.
 */
export function achse(maxCent: number): { max: number; schritte: number[] } {
  const maxEuro = Math.max(maxCent / 100, 1);
  let beste: { max: number; teile: number; schritt: number } | null = null;
  for (const teile of [2, 3, 4]) {
    const roh = maxEuro / teile;
    const mag = 10 ** Math.floor(Math.log10(roh));
    const faktoren = mag >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10];
    const schritt = Math.max(1, (faktoren.find((f) => f * mag >= roh - 1e-9) ?? 10) * mag);
    const max = schritt * teile;
    if (!beste || max < beste.max) beste = { max, teile, schritt };
  }
  const b = beste as { max: number; teile: number; schritt: number };
  return { max: b.max * 100, schritte: Array.from({ length: b.teile + 1 }, (_, i) => i * b.schritt * 100) };
}
