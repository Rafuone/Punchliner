import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Pas de StrictMode : en dev il double-monte les composants, ce qui crée
// des sockets/salons en double. On veut un seul socket hôte stable.
createRoot(document.getElementById('root')!).render(<App />);
