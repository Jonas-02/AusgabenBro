import { ICONS } from './icons/iconData';
import { ABGELEITETE_ICONS } from './icons/abgeleitet';

const ALLE = { ...ICONS, ...ABGELEITETE_ICONS };
export type IconName = keyof typeof ALLE;

/** Icons, die als Pot- oder Kategorie-Symbol waehlbar sind. */
export const WAEHLBARE_ICONS = [
  'einkauf', 'drogen', 'lifestyle', 'sonstiges',
  'wohnen', 'versicherungen', 'abos', 'mobilitaet'
] as const satisfies readonly IconName[];
export type SymbolName = (typeof WAEHLBARE_ICONS)[number];

interface Props {
  name: IconName;
  /** Ueberschreibt die native Groesse aus Figma. Nur fuer abgeleitete Screens. */
  groesse?: number;
  drehung?: number;
  className?: string;
}

export function Icon({ name, groesse, drehung, className }: Props) {
  const daten = ALLE[name];
  const b = groesse ?? daten.breite;
  const h = groesse ?? daten.hoehe;
  return (
    <svg
      className={className}
      width={b}
      height={h}
      viewBox={daten.viewBox}
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flex: 'none', transform: drehung ? `rotate(${drehung}deg)` : undefined }}
      dangerouslySetInnerHTML={{ __html: daten.inhalt }}
    />
  );
}

export function istSymbol(name: string): name is SymbolName {
  return (WAEHLBARE_ICONS as readonly string[]).includes(name);
}
