import { Icon } from './Icon';
import styles from './Fab.module.css';

interface Props {
  label: 'Ausgabe' | 'Fixkosten';
  onClick: () => void;
}

/** Figma 10:51: schwebender Hinzufuegen-Button ueber der Tab-Leiste. */
export function Fab({ label, onClick }: Props) {
  return (
    <button type="button" className={styles.fab} onClick={onClick} aria-label={`${label} hinzufügen`}>
      <Icon name="plus" />
      <span className={styles.label}>{label}</span>
    </button>
  );
}
