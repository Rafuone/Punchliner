import { io } from 'socket.io-client';

// Sur /showroom (banc d'essai des écrans) on NE se connecte PAS au vrai serveur : un mock-socket
// (src/showroom/mock.ts) prend le relais pour piloter les vrais Host/Player hors-ligne.
const isShowroom = typeof location !== 'undefined' && /\/showroom\/?$/.test(location.pathname);

// Origine relative → marche depuis localhost, l'IP du LAN ou un tunnel.
export const socket = io('/', {
  transports: ['websocket', 'polling'],
  autoConnect: !isShowroom,
});
