import type { ReactNode } from 'react';
import styles from './Karte.module.css';

interface Props {
  children: ReactNode;
  className?: string | undefined;
  /** Macht die ganze Karte antippbar. */
  onClick?: (() => void) | undefined;
  label?: string | undefined;
}

export function Karte({ children, className, onClick, label }: Props) {
  const klasse = [styles.karte, onClick ? styles.klickbar : null, className].filter(Boolean).join(' ');
  if (onClick) {
    return (
      <button type="button" className={klasse} onClick={onClick} aria-label={label}>
        {children}
      </button>
    );
  }
  return <div className={klasse}>{children}</div>;
}
