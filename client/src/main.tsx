import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './battle.css'; // classes .bt-* du CLASH : dispo dans toute l'app (Host/Player), plus seulement le showroom
import { initUiSfx } from './sfx';

// Pas de StrictMode : en dev il double-monte les composants, ce qui crée
// des sockets/salons en double. On veut un seul socket hôte stable.
initUiSfx(); // nappage sonore global (hover + clic sur tout élément interactif)
createRoot(document.getElementById('root')!).render(<App />);
