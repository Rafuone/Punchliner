import { io } from 'socket.io-client';

// Origine relative → marche depuis localhost, l'IP du LAN ou un tunnel.
export const socket = io('/', {
  transports: ['websocket', 'polling'],
});
