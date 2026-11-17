import type { ReactNode } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import f from './formular.module.css';
import e from './Einstellungen.module.css';

interface Props {
  offen: boolean;
  titel: string;
  children: ReactNode;
  aktion: string;
  gefahr?: boolean;
  onBestaetigen: () => void;
  onSchliessen: () => void;
}

/** Abgeleitet: Rueckfrage als Sheet, Hauptknopf wie Figma 7:184. */
export function Bestaetigung({ offen, titel, children, aktion, gefahr = false, onBestaetigen, onSchliessen }: Props) {
  return (
    <BottomSheet offen={offen} onSchliessen={onSchliessen} titel={titel}>
      <div className={e.bestaetigungText}>{children}</div>
      <button type="button" className={`${f.cta} ${gefahr ? e.gefahr : ''}`} onClick={onBestaetigen}>
        <span>{aktion}</span>
      </button>
      <button type="button" className={e.abbrechen} onClick={onSchliessen}>
        Abbrechen
      </button>
    </BottomSheet>
  );
}
