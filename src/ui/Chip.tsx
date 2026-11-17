import { Icon, type IconName } from './Icon';
import styles from './Chip.module.css';

interface Props {
  label: string;
  aktiv?: boolean;
  icon?: IconName;
  /** "Neue Kategorie": grauer Text, kein Auswahlzustand. */
  gedimmt?: boolean;
  onClick: () => void;
  /** Bei Auswahl-Chips aria-pressed setzen. */
  auswahl?: boolean;
}

export function Chip({ label, aktiv = false, icon, gedimmt = false, onClick, auswahl = true }: Props) {
  return (
    <button
      type="button"
      className={[styles.chip, icon ? styles.mitIcon : null, aktiv ? styles.aktiv : null, gedimmt ? styles.gedimmt : null]
        .filter(Boolean)
        .join(' ')}
      aria-pressed={auswahl ? aktiv : undefined}
      onClick={onClick}
    >
      {icon && <Icon name={icon} />}
      <span className={styles.label}>{label}</span>
    </button>
  );
}
