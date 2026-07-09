import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './battle.css'; // classes .bt-* du CLASH : dispo dans toute l'app (Host/Player), plus seulement le showroom
import { initUiSfx } from './sfx';

// Retour d'auth Spotify en POPUP : si on est dans la fenêtre popup (ouvrant = window.opener) et qu'on revient
// avec ?code (ou ?error), on renvoie le résultat à la fenêtre principale et on se ferme — SANS charger l'app.
// → l'hôte ne « sort » plus de sa partie (avant : redirection pleine page = rechargement = état perdu).
const spParams = new URLSearchParams(location.search);
if (window.opener && window.opener !== window && (spParams.get('code') || spParams.get('error'))) {
  try { window.opener.postMessage({ __spotify_auth: { code: spParams.get('code'), error: spParams.get('error') } }, location.origin); } catch {}
  window.close();
} else {
  // Pas de StrictMode : en dev il double-monte les composants, ce qui crée
  // des sockets/salons en double. On veut un seul socket hôte stable.
  initUiSfx(); // nappage sonore global (hover + clic sur tout élément interactif)
  createRoot(document.getElementById('root')!).render(<App />);
}
