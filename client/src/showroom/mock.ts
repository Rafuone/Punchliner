// MOCK-SOCKET du showroom : remplace les méthodes du singleton `socket` pour piloter les VRAIS
// composants Host/Player HORS-LIGNE. Principe : les composants bootent en émettant host:reclaim /
// player:join ; on répond avec un objet `state` conforme à snapshot() du serveur → applyState() rend
// l'écran EXACT (même chemin que la reconnexion réelle). Changer de scène = remonter le composant
// (key) après avoir pointé setScene() sur le nouvel état.
import { socket } from '../socket';

type Handler = (...a: any[]) => void;
const handlers: Record<string, Handler[]> = {};
let curScene: () => any = () => ({});
let installed = false;

export function setScene(fn: () => any) { curScene = fn; }

// Pousse un évènement serveur→client vers les handlers enregistrés (pour scènes interactives éventuelles).
export function deliver(ev: string, payload?: any) {
  (handlers[ev] || []).forEach((h) => { try { h(payload); } catch (e) { /* no-op */ } });
}

export function installMock() {
  if (installed) return;
  installed = true;
  const s = socket as any;
  s.connected = true;
  s.io = s.io || { engine: {}, opts: {} };
  s.on = (ev: string, cb: Handler) => { (handlers[ev] || (handlers[ev] = [])).push(cb); return s; };
  s.once = s.on;
  s.off = (ev: string, cb?: Handler) => {
    if (!ev) { for (const k in handlers) delete handlers[k]; }
    else if (!cb) delete handlers[ev];
    else if (handlers[ev]) handlers[ev] = handlers[ev].filter((h) => h !== cb);
    return s;
  };
  s.emit = (ev: string, ...args: any[]) => {
    const ack = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
    try { handleEmit(ev, args, ack); } catch (e) { ack && ack({ ok: true }); }
    return s;
  };
  s.connect = () => s;
  s.disconnect = () => s;
  try { (window as any).__srDeliver = deliver; } catch {} // review : déclencher un event serveur→client (ex. __srDeliver('power:used', {...}))
  // VUE CROISÉE : le parent (showroom) relaie une action d'un appareil vers l'autre iframe → deliver ici.
  try { window.addEventListener('message', (e: any) => { const d = e && e.data; if (d && d.__sr === 'deliver' && d.event) deliver(d.event, d.payload); }); } catch {}
}

function handleEmit(ev: string, args: any[], ack: ((r?: any) => void) | null) {
  const st = curScene() || {};
  const CODE = st.code || 'PUNCH';
  // VUE CROISÉE : relaie l'action du joueur au parent → l'autre iframe (ex. réaction → apparaît sur la TV).
  if (ev === 'player:reaction' || ev === 'player:buzz' || ev === 'player:power') {
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ __sr: 'relay', event: ev, payload: args[0] || {} }, '*'); } catch {}
  }
  switch (ev) {
    case 'host:create': ack && ack({ ok: true, code: CODE, hostToken: 'showroom', poolSize: st.poolSize || 264 }); return;
    case 'host:reclaim': ack && ack({ ok: true, code: CODE, poolSize: st.poolSize || 264, state: st }); return;
    // On renvoie le playerId DEMANDE (la scene le fournit via sa session) au lieu d'un 'me' fixe : sans ca,
    // les ecrans qui comparent l'identite - « je suis duelliste du clash », « j'avais parie », pupitre MJ -
    // rendaient toujours la vue SPECTATEUR au banc d'essai (2026-07-26).
    case 'player:join': ack && ack({ ok: true, playerId: (args[0] && args[0].playerId) || 'me', waiting: !!st.__waiting, state: st }); return;
    case 'player:watch': ack && ack({ players: st.players || [] }); return;
    case 'player:buzz': ack && ack({ ok: true, winner: true, endsAt: Date.now() + 15000, answerMs: 15000 }); return;
    case 'player:answer': ack && ack({ ok: true }); return;
    case 'player:power': ack && ack({ ok: true }); return;
    default: ack && ack({ ok: true }); return;
  }
}
