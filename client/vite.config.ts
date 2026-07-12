import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le client se connecte au serveur via l'origine relative : en dev, Vite
// proxifie /socket.io et /api vers le serveur (port 3001). Ainsi la même URL
// marche depuis localhost, l'IP du LAN ou un tunnel, sans reconfiguration.
export default defineConfig({
  plugins: [react()],
  // Pré-bundle les dépendances AU DÉMARRAGE (d'un coup) au lieu de les découvrir à la 1re requête.
  // Sans ça, Vite à froid re-bundle en pleine première ouverture → rechargement complet de la page
  // → écran blanc / « faut relancer ». La liste explicite supprime cette phase surprise.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'qrcode.react', 'socket.io-client'],
  },
  server: {
    host: true, // écoute sur le LAN (les téléphones du même Wi-Fi peuvent se connecter)
    port: Number(process.env.PORT) || 5173, // 5173 par défaut ; honore PORT si un outil l'impose
    // Transforme l'arbre de modules de l'app dès le boot → la 1re ouverture est déjà chaude (pas de compile à la volée).
    warmup: { clientFiles: ['./src/main.tsx'] },
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/api': { target: 'http://localhost:3001' },
    },
  },
});
