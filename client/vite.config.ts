import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Le client se connecte au serveur via l'origine relative : en dev, Vite
// proxifie /socket.io et /api vers le serveur (port 3001). Ainsi la même URL
// marche depuis localhost, l'IP du LAN ou un tunnel, sans reconfiguration.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // écoute sur le LAN (les téléphones du même Wi-Fi peuvent se connecter)
    port: Number(process.env.PORT) || 5173, // 5173 par défaut ; honore PORT si un outil l'impose
    proxy: {
      '/socket.io': { target: 'http://localhost:3001', ws: true },
      '/api': { target: 'http://localhost:3001' },
    },
  },
});
