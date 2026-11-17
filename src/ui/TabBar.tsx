import { Icon } from './Icon';
import styles from './TabBar.module.css';

export type Tab = 'budget' | 'fixkosten';

/** Figma 10:50, Varianten Aktiv=Budget und Aktiv=Fixkosten. */
export function TabBar({ aktiv }: { aktiv: Tab }) {
  return (
    <nav className={styles.leiste} aria-label="Hauptnavigation">
      <a className={styles.tab} href="#/budget" aria-current={aktiv === 'budget' ? 'page' : undefined}>
        <Icon name="wallet" />
        <span className={styles.label}>Budget</span>
      </a>
      <a className={styles.tab} href="#/fixkosten" aria-current={aktiv === 'fixkosten' ? 'page' : undefined}>
        <Icon name="repeat" />
        <span className={styles.label}>Fixkosten</span>
      </a>
    </nav>
  );
}
