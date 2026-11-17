import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Schriften selbst gehostet, damit die App offline gleich aussieht.
import '@fontsource/manjari/latin-400.css';
import '@fontsource/momo-trust-display/latin-400.css';

import './styles/tokens.css';
import './styles/base.css';
import { App } from './App';

const wurzel = document.getElementById('root');
if (!wurzel) throw new Error('#root fehlt in index.html');

createRoot(wurzel).render(
  <StrictMode>
    <App />
  </StrictMode>
);
