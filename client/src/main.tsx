import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './battle.css'; // classes .bt-* du CLASH : dispo dans toute l'app (Host/Player), plus seulement le showroom
import { initUiSfx } from './sfx';
import { exchangeSpotifyCode } from './spotify';

// Retour d'auth Spotify en POPUP : si on revient avec ?code (ou ?error) DANS la fenêtre popup, on échange le
// token ICI puis on prévient la fenêtre principale (postMessage + event localStorage) et on se ferme — SANS
// charger l'app. → l'hôte ne « sort » plus de sa partie. On détecte la popup par window.opener OU par le
// marqueur `pl_sp_popup` (fiable même quand COOP neutralise window.opener → symptôme : "ça ne remet pas Spotify").
const spParams = new URLSearchParams(location.search);
const spReturn = spParams.get('code') || spParams.get('error');
const isSpotifyPopup = !!spReturn && ((!!window.opener && window.opener !== window) || localStorage.getItem('pl_sp_popup') === '1');
if (isSpotifyPopup) {
  (async () => {
    try { localStorage.removeItem('pl_sp_popup'); } catch {}
    const error = spParams.get('error') || '';
    const ok = spParams.get('code') ? await exchangeSpotifyCode(spParams.get('code')!) : false;
    try { (window.opener as Window | null)?.postMessage({ __spotify_auth: { ok, error } }, location.origin); } catch {}
    try { localStorage.setItem('pl_sp_done', JSON.stringify({ ok, error, t: Date.now() })); } catch {} // event storage → fenêtre principale
    try { window.close(); } catch {}
    setTimeout(() => { if (!window.closed) location.replace('/host'); }, 500); // si close() est bloqué, on nettoie l'URL
  })();
} else {
  // Pas de StrictMode : en dev il double-monte les composants, ce qui crée
  // des sockets/salons en double. On veut un seul socket hôte stable.
  initUiSfx(); // nappage sonore global (hover + clic sur tout élément interactif)
  createRoot(document.getElementById('root')!).render(<App />);
}
