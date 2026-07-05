import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { Server } from 'socket.io';
import { SEED_TRACKS } from './tracks.js';
import { gradeAnswer, speedMult, normalize } from './match.js';
import { POWERS, firstLetters } from './powers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// SERVER_PORT (pas PORT) pour ne pas être capté par un outil qui injecte PORT (ex. preview)
const PORT = process.env.SERVER_PORT || 3001;

const PREVIEW_MS = 30000; // durée d'un extrait Deezer
const HOST_GRACE_MS = 120000; // délai avant de fermer un salon dont l'hôte a disparu

// Difficulté = QUELS morceaux tombent (popularité via le rank Deezer), PAS la durée.
// Le son joue toujours généreusement ; offset = on démarre en plein milieu sur les niveaux durs.
const DIFFICULTY = {
  facile:    { label: 'Grand public', tier: 'top',  windowMs: 30000, mult: 1.0, offset: false },
  normal:    { label: 'Connaisseur',  tier: 'high', windowMs: 26000, mult: 1.3, offset: false },
  difficile: { label: 'Digger',       tier: 'mid',  windowMs: 22000, mult: 1.6, offset: true },
  puriste:   { label: 'Puriste',      tier: 'deep', windowMs: 20000, mult: 2.0, offset: true },
};
const MODES = ['multi', 'buzzer'];

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

/* ------------------------------------------------------------------ */
/* Pool de morceaux (Deezer)                                           */
/* ------------------------------------------------------------------ */
let POOL = [];
async function resolveTrack(seed) {
  const tryFetch = async (q) => {
    const r = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=4`, { headers: { 'User-Agent': 'punchline-party-game' } });
    if (!r.ok) return [];
    return (await r.json())?.data || [];
  };
  const want = normalize(seed.artist);
  // garde-fou : on n'accepte que si l'artiste renvoyé correspond au seed (évite les mauvais matchs / titres non-FR)
  const pick = (list) => list.find((h) => h.preview && (() => { const a = normalize(h.artist?.name || ''); return a && (a.includes(want) || want.includes(a)); })());
  let hit = pick(await tryFetch(`artist:"${seed.artist}" track:"${seed.title}"`));
  if (!hit) hit = pick(await tryFetch(`artist:"${seed.artist}" ${seed.title}`));
  if (!hit) return null;
  return { id: hit.id, title: hit.title_short || hit.title, artist: hit.artist?.name || seed.artist, cover: hit.album?.cover_medium || hit.album?.cover || '', preview: hit.preview, rank: hit.rank || 0 };
}
async function loadPool() {
  console.log(`[deezer] résolution de ${SEED_TRACKS.length} morceaux…`);
  const out = [];
  for (let i = 0; i < SEED_TRACKS.length; i += 6) {
    const res = await Promise.allSettled(SEED_TRACKS.slice(i, i + 6).map(resolveTrack));
    for (const r of res) if (r.status === 'fulfilled' && r.value) out.push(r.value);
    await new Promise((r) => setTimeout(r, 350));
  }
  POOL = out;
  console.log(`[deezer] ${POOL.length}/${SEED_TRACKS.length} morceaux jouables.`);
}
// Sous-ensemble du pool selon la popularité voulue (rank Deezer trié décroissant)
function poolForTier(tier) {
  const s = [...POOL].sort((a, b) => (b.rank || 0) - (a.rank || 0));
  const N = s.length;
  if (tier === 'top') return s.slice(0, Math.max(6, Math.ceil(N * 0.55))); // les plus streamés
  if (tier === 'mid') return s.slice(Math.floor(N * 0.25));                // on retire le très grand public
  if (tier === 'deep') return s.slice(Math.floor(N * 0.45));               // le fond du bac
  return s;                                                                // high = tout
}
function pickPlaylist(n, tier) {
  const src = poolForTier(tier);
  return [...src].sort(() => Math.random() - 0.5).slice(0, Math.min(n, src.length));
}

/* ------------------------------------------------------------------ */
/* Salons                                                              */
/* ------------------------------------------------------------------ */
const rooms = new Map();
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => {
  let c;
  do { c = Array.from({ length: 4 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join(''); } while (rooms.has(c));
  return c;
};
const genId = () => crypto.randomBytes(8).toString('hex');

function publicPlayers(room) {
  return [...room.players.values()]
    .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, connected: p.connected, charge: p.charge, charges: p.charges || 0, isMJ: !!p.isMJ }))
    .sort((a, b) => b.score - a.score);
}
const connectedCount = (room) => [...room.players.values()].filter((p) => p.connected).length;

function emitLobby(room) {
  io.to(room.code).emit('lobby', {
    code: room.code, phase: room.phase, players: publicPlayers(room),
    round: room.roundIndex + 1, totalRounds: room.totalRounds, settings: room.settings,
  });
}

// Snapshot pour qu'un client (re)connecté reprenne au bon écran
function snapshot(room, isHost) {
  const s = { code: room.code, phase: room.phase, roundIndex: room.roundIndex, totalRounds: room.totalRounds, settings: room.settings, players: publicPlayers(room) };
  if (room.phase === 'playing' && room.current) {
    s.round = { roundIndex: room.roundIndex, total: room.totalRounds, endsAt: room.roundEndsAt, durationMs: room.windowMs, mode: room.settings.mode, difficulty: room.diffLabel };
    if (isHost) Object.assign(s.round, { preview: room.current.preview, startAt: room.startAt });
    if (room.settings.mode === 'buzzer') s.buzz = { winnerId: room.buzz.winnerId, winnerName: room.buzz.winnerName, open: room.buzz.open, lockedOut: [...room.buzz.lockedOut] };
  } else if (room.phase === 'reveal') {
    s.reveal = room.lastReveal;
  } else if (room.phase === 'final') {
    s.final = { scores: publicPlayers(room) };
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Boucle de jeu                                                       */
/* ------------------------------------------------------------------ */
function beginRound(room) {
  room.phase = 'countdown';
  const seconds = 5;
  clearTimeout(room.cdTimer);
  io.to(room.hostId).emit('round:countdown', { seconds, index: room.roundIndex, total: room.totalRounds });
  io.to(room.code).emit('round:countdown', { seconds });
  room.cdTimer = setTimeout(() => startRound(room), seconds * 1000);
}

function startRound(room) {
  if (room.phase !== 'countdown') return; // annulé pendant le décompte
  room.phase = 'playing';
  room.current = room.playlist[room.roundIndex];
  room.answers = new Map();
  const diff = DIFFICULTY[room.settings.difficulty] || DIFFICULTY.normal;
  room.windowMs = diff.windowMs;
  room.diffLabel = diff.label;
  room.mult = diff.mult;
  // niveaux durs : on démarre l'extrait en plein milieu (pas l'intro reconnaissable)
  const maxOffset = Math.max(0, PREVIEW_MS - diff.windowMs - 1000);
  room.startAt = diff.offset ? Math.floor(Math.random() * Math.min(14000, maxOffset)) : 0;
  room.roundEndsAt = Date.now() + diff.windowMs;
  room.buzz = { winnerId: null, winnerName: null, open: true, lockedOut: new Set() };
  clearTimeout(room.buzzTimer);
  room.mjDouble = false; room.mjPlus = false;

  const base = { index: room.roundIndex, total: room.totalRounds, endsAt: room.roundEndsAt, durationMs: diff.windowMs, mode: room.settings.mode, difficulty: diff.label };
  io.to(room.hostId).emit('round:host', { ...base, preview: room.current.preview, startAt: room.startAt });
  io.to(room.code).emit('round:go', base);
  clearTimeout(room.timer);
  room.timer = setTimeout(() => endRound(room), diff.windowMs);
}

// Remplit la jauge de pouvoir de chaque joueur en fin de manche selon la règle choisie
function fillCharges(room) {
  const rule = room.settings.rebalance || 'comeback';
  const sorted = [...room.players.values()].sort((a, b) => b.score - a.score);
  const N = sorted.length;
  sorted.forEach((p, rank) => {
    let add = 30;
    if (N > 1 && rule !== 'off') {
      const fromBottom = (N - 1 - rank) / (N - 1); // dernier = 1, premier = 0
      const t = rule === 'comeback' ? fromBottom : 1 - fromBottom;
      add = 18 + t * 44; // ~18 (favorisé) → ~62 (à la traîne, en comeback)
    }
    p.charge = (p.charge || 0) + Math.round(add);
    while (p.charge >= 100 && (p.charges || 0) < 5) { p.charges = (p.charges || 0) + 1; p.charge -= 100; }
    if (p.charge > 100) p.charge = 100;
  });
}

function endRound(room) {
  clearTimeout(room.timer);
  clearTimeout(room.buzzTimer);
  if (room.phase !== 'playing') return;
  room.phase = 'reveal';
  const results = [];
  for (const p of room.players.values()) {
    const a = room.answers.get(p.id);
    const points = a ? a.points : 0;
    p.score = Math.max(0, p.score + points);
    results.push({ id: p.id, name: p.name, avatar: p.avatar, points, titleHit: a?.titleHit || false, artistHit: a?.artistHit || false });
  }
  results.sort((a, b) => b.points - a.points);
  fillCharges(room);
  // delta de rang (monte/descend) vs la manche précédente
  const ranked = [...room.players.values()].filter((p) => !p.isMJ).sort((a, b) => b.score - a.score);
  const newRank = new Map(); ranked.forEach((p, i) => newRank.set(p.id, i));
  const scores = publicPlayers(room).map((sp) => {
    const prev = room.prevRanks ? room.prevRanks.get(sp.id) : null;
    const cur = newRank.get(sp.id);
    return { ...sp, rankDelta: (prev == null || cur == null) ? 0 : prev - cur };
  });
  room.prevRanks = newRank;
  room.lastReveal = {
    roundIndex: room.roundIndex, total: room.totalRounds,
    track: { title: room.current.title, artist: room.current.artist, cover: room.current.cover },
    results, scores,
  };
  io.to(room.code).emit('round:reveal', room.lastReveal);
}

function nextRound(room) {
  if (room.roundIndex + 1 < room.totalRounds) { room.roundIndex += 1; beginRound(room); }
  else { room.phase = 'final'; io.to(room.code).emit('game:final', { scores: publicPlayers(room) }); }
}

/* ------------------------------------------------------------------ */
/* Socket.IO                                                           */
/* ------------------------------------------------------------------ */
io.on('connection', (socket) => {
  socket.data = { roomCode: null, role: null, playerId: null };

  socket.on('host:create', (_p, cb) => {
    const code = makeCode();
    const hostToken = genId();
    rooms.set(code, {
      code, hostId: socket.id, hostToken, hostConnected: true, hostGrace: null,
      phase: 'lobby', players: new Map(), playlist: [], roundIndex: 0, totalRounds: 8,
      settings: { difficulty: 'normal', mode: 'multi', mj: false, rebalance: 'comeback' },
      current: null, answers: new Map(), timer: null, buzzTimer: null, lastReveal: null, createdAt: Date.now(),
    });
    socket.join(code);
    socket.data = { roomCode: code, role: 'host', playerId: null };
    cb?.({ ok: true, code, hostToken, poolSize: POOL.length, difficulties: Object.fromEntries(Object.entries(DIFFICULTY).map(([k, v]) => [k, v.label])), maxRounds: POOL.length });
    emitLobby(rooms.get(code));
  });

  socket.on('host:reclaim', ({ code, hostToken }, cb) => {
    const room = rooms.get(String(code || '').toUpperCase());
    if (!room || room.hostToken !== hostToken) return cb?.({ error: 'Salon introuvable.' });
    clearTimeout(room.hostGrace); room.hostGrace = null;
    room.hostId = socket.id; room.hostConnected = true;
    socket.join(room.code);
    socket.data = { roomCode: room.code, role: 'host', playerId: null };
    cb?.({ ok: true, code: room.code, poolSize: POOL.length, state: snapshot(room, true) });
    emitLobby(room);
  });

  socket.on('player:join', ({ code, name, avatar, playerId }, cb) => {
    code = String(code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return cb?.({ error: "Ce code n'existe pas." });

    // Reconnexion : le joueur existe déjà (même playerId) → on le réattache, partie en cours OK
    if (playerId && room.players.has(playerId)) {
      const p = room.players.get(playerId);
      p.connected = true; p.socketId = socket.id;
      if (name) p.name = String(name).trim().slice(0, 16) || p.name;
      if (avatar) p.avatar = avatar;
      socket.join(code);
      socket.data = { roomCode: code, role: 'player', playerId };
      cb?.({ ok: true, playerId, reconnected: true, state: snapshot(room, false) });
      emitLobby(room);
      return;
    }
    // Nouveau joueur : uniquement dans le lobby
    if (room.phase !== 'lobby') return cb?.({ error: 'La partie a déjà commencé — impossible de rejoindre en cours.' });
    const pid = playerId || genId();
    const clean = String(name || '').trim().slice(0, 16) || 'Anonyme';
    room.players.set(pid, { id: pid, name: clean, avatar: avatar || null, score: 0, connected: true, socketId: socket.id, charge: 0, charges: 1, armed: null, shield: false });
    socket.join(code);
    socket.data = { roomCode: code, role: 'player', playerId: pid };
    cb?.({ ok: true, playerId: pid, state: snapshot(room, false) });
    emitLobby(room);
  });

  socket.on('host:start', ({ rounds, difficulty, mode, mj, rebalance } = {}, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return cb?.({ error: 'Non autorisé.' });
    if (!POOL.length) return cb?.({ error: 'Aucun morceau disponible (réseau ?).' });
    if (room.players.size < 1) return cb?.({ error: 'Il faut au moins un joueur.' });
    room.settings = {
      difficulty: DIFFICULTY[difficulty] ? difficulty : 'normal',
      mode: MODES.includes(mode) ? mode : 'multi',
      mj: !!mj,
      rebalance: ['comeback', 'snowball', 'off'].includes(rebalance) ? rebalance : 'comeback',
    };
    for (const p of room.players.values()) { p.charge = 0; p.charges = 1; p.armed = null; p.shield = false; p.isMJ = false; }
    room.mjDouble = false; room.mjPlus = false; room.mjId = null;
    if (room.settings.mj) {
      const mj = [...room.players.values()].find((p) => p.connected) || [...room.players.values()][0];
      if (mj) { mj.isMJ = true; room.mjId = mj.id; }
    }
    const diff = DIFFICULTY[room.settings.difficulty] || DIFFICULTY.normal;
    room.playlist = pickPlaylist(rounds || 8, diff.tier);
    room.totalRounds = room.playlist.length;
    room.roundIndex = 0;
    room.prevRanks = null;
    cb?.({ ok: true });
    beginRound(room);
  });

  // Mode multi : chacun soumet sa réponse quand il veut
  socket.on('player:answer', ({ text }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || room.settings.mode !== 'multi') return cb?.({ error: 'Pas de manche en cours.' });
    const p = room.players.get(socket.data.playerId);
    if (!p) return cb?.({ error: 'Joueur inconnu.' });
    const g = gradeAnswer(text, room.current);
    let points = g.base ? Math.round(g.base * speedMult(room.roundEndsAt - Date.now(), room.windowMs) * room.mult) : 0;
    if (points > 0 && p.armed) { points = p.armed === 'double' ? points * 2 : points + 100; p.armed = null; }
    if (points > 0 && room.mjPlus) { points += 100; room.mjPlus = false; }
    if (points > 0 && room.mjDouble) points *= 2;
    const prev = room.answers.get(p.id);
    if (!prev || points > prev.points) room.answers.set(p.id, { points, titleHit: g.titleHit, artistHit: g.artistHit });
    cb?.({ ok: true, points, titleHit: g.titleHit, artistHit: g.artistHit });
    io.to(room.hostId).emit('player:answered', { id: p.id, name: p.name });
    // le son continue de tourner : on ne coupe plus la manche dès que tout le monde a répondu
  });

  // Mode buzzer : le premier qui buzze prend la main (lockout)
  socket.on('player:buzz', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || room.settings.mode !== 'buzzer') return cb?.({ error: 'Pas de buzzer.' });
    const p = room.players.get(socket.data.playerId);
    if (!p) return cb?.({ error: 'Joueur inconnu.' });
    if (!room.buzz.open || room.buzz.winnerId || room.buzz.lockedOut.has(p.id)) return cb?.({ error: 'Buzzer indisponible.' });
    room.buzz.winnerId = p.id; room.buzz.winnerName = p.name; room.buzz.open = false;
    cb?.({ ok: true, winner: true });
    io.to(room.code).emit('buzz:winner', { id: p.id, name: p.name });
    // le gagnant a 8 s pour répondre, sinon il est verrouillé et le buzzer rouvre
    clearTimeout(room.buzzTimer);
    room.buzzTimer = setTimeout(() => buzzerFail(room, p.id), 8000);
  });

  socket.on('buzzer:answer', ({ text }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || room.settings.mode !== 'buzzer') return;
    const p = room.players.get(socket.data.playerId);
    if (!p || room.buzz.winnerId !== p.id) return cb?.({ error: 'Ce n\'est pas ton tour.' });
    clearTimeout(room.buzzTimer);
    const g = gradeAnswer(text, room.current);
    if (g.base > 0) {
      let points = Math.round(g.base * room.mult) + 50; // bonus buzzer
      if (p.armed) { points = p.armed === 'double' ? points * 2 : points + 100; p.armed = null; }
      if (room.mjPlus) { points += 100; room.mjPlus = false; }
      if (room.mjDouble) points *= 2;
      room.answers.set(p.id, { points, titleHit: g.titleHit, artistHit: g.artistHit });
      cb?.({ ok: true, correct: true, points });
      endRound(room);
    } else {
      cb?.({ ok: true, correct: false });
      buzzerFail(room, p.id);
    }
  });

  function buzzerFail(room, pid) {
    if (room.phase !== 'playing' || room.buzz.winnerId !== pid) return;
    room.buzz.lockedOut.add(pid);
    room.buzz.winnerId = null; room.buzz.winnerName = null; room.buzz.open = true;
    io.to(room.code).emit('buzz:open', { lockedOut: [...room.buzz.lockedOut] });
    // tout le monde a raté → fin de manche
    const active = [...room.players.values()].filter((p) => p.connected && !room.buzz.lockedOut.has(p.id));
    if (active.length === 0) endRound(room);
  }

  // Activation d'un pouvoir de rappeur (1x/partie)
  socket.on('player:power', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ error: 'Pas de partie.' });
    const p = room.players.get(socket.data.playerId);
    if (!p) return cb?.({ error: 'Joueur inconnu.' });
    if ((p.charges || 0) < 1) return cb?.({ error: 'Aucune charge de pouvoir.' });
    const pw = POWERS[p.avatar];
    if (!pw) return cb?.({ error: 'Ce perso n\'a pas de pouvoir.' });
    let detail = null;
    // cohérence : les pouvoirs qui ne peuvent RIEN faire ne consomment PAS la charge
    if (pw.type === 'steal') {
      const leader = [...room.players.values()].filter((x) => x.id !== p.id && x.connected && x.score > 0).sort((a, b) => b.score - a.score)[0];
      if (!leader) return cb?.({ error: 'Personne à voler pour l\'instant.' });
      const amt = Math.min(100, leader.score);
      leader.score -= amt; p.score += amt;
      detail = { stoleFrom: leader.name, amount: amt };
    } else if (pw.type === 'hint') {
      if (room.phase !== 'playing' || !room.current) return cb?.({ error: 'Attends une manche en cours.' });
      detail = { hint: { title: firstLetters(room.current.title), artist: firstLetters(room.current.artist) } };
    } else if (pw.type === 'double') p.armed = 'double';
    else if (pw.type === 'bonus') p.armed = 'bonus';
    else if (pw.type === 'shield') p.shield = true;
    p.charges -= 1;
    io.to(room.hostId).emit('power:used', { name: p.name, avatar: p.avatar, power: pw.name });
    io.to(room.code).emit('scores:update', { scores: publicPlayers(room) });
    cb?.({ ok: true, type: pw.type, power: pw.name, detail, charges: p.charges, charge: p.charge });
  });

  // ---- Maître du jeu (pupitre) ----
  const isMj = (room) => room && room.mjId && room.mjId === socket.data.playerId;
  socket.on('mj:next', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!isMj(room) || room.phase !== 'reveal') return cb?.({ error: 'Pas au bon moment.' });
    cb?.({ ok: true });
    nextRound(room);
  });
  socket.on('mj:power', ({ type } = {}, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!isMj(room)) return cb?.({ error: 'Non autorisé.' });
    if (type === 'double') room.mjDouble = true;
    else if (type === 'plus') room.mjPlus = true;
    else return cb?.({ error: 'Pouvoir inconnu.' });
    io.to(room.hostId).emit('power:used', { name: 'Maître du jeu', power: type === 'double' ? '×2 la manche' : '+100 au prochain' });
    cb?.({ ok: true });
  });
  socket.on('mj:award', ({ playerId } = {}, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!isMj(room)) return cb?.({ error: 'Non autorisé.' });
    const t = room.players.get(playerId);
    if (!t) return cb?.({ error: 'Joueur inconnu.' });
    t.score += 100;
    io.to(room.code).emit('scores:update', { scores: publicPlayers(room) });
    io.to(room.hostId).emit('power:used', { name: 'Maître du jeu', power: `+100 à ${t.name}` });
    cb?.({ ok: true });
  });

  socket.on('host:next', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id || room.phase !== 'reveal') return cb?.({ error: 'Pas au bon moment.' });
    cb?.({ ok: true });
    nextRound(room);
  });

  socket.on('host:restart', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return cb?.({ error: 'Non autorisé.' });
    room.phase = 'lobby'; room.roundIndex = 0;
    for (const p of room.players.values()) { p.score = 0; p.charge = 0; p.charges = 1; p.armed = null; p.shield = false; }
    cb?.({ ok: true });
    emitLobby(room);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    if (socket.data.role === 'host' && room.hostId === socket.id) {
      // on ne ferme pas tout de suite : l'hôte peut rafraîchir / revenir
      room.hostConnected = false;
      clearTimeout(room.hostGrace);
      room.hostGrace = setTimeout(() => {
        clearTimeout(room.timer); clearTimeout(room.buzzTimer);
        io.to(room.code).emit('room:closed', { reason: "L'hôte a quitté la partie." });
        rooms.delete(room.code);
      }, HOST_GRACE_MS);
      return;
    }
    const p = room.players.get(socket.data.playerId);
    if (p && p.socketId === socket.id) { p.connected = false; p.socketId = null; emitLobby(room); }
  });
});

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */
app.get('/api/health', (_req, res) => res.json({ ok: true, pool: POOL.length, rooms: rooms.size }));
function lanIp() {
  const cands = [];
  for (const list of Object.values(os.networkInterfaces())) for (const ni of list || []) if (ni.family === 'IPv4' && !ni.internal) cands.push(ni.address);
  const pref = (a) => (a.startsWith('192.168.') ? 2 : a.startsWith('10.') || a.startsWith('172.') ? 1 : 0);
  return cands.sort((a, b) => pref(b) - pref(a))[0] || null;
}
app.get('/api/net', (_req, res) => res.json({ ip: lanIp() }));
app.get('/api/pool', (_req, res) => res.json(POOL.map((t) => ({ artist: t.artist, title: t.title, rank: t.rank })).sort((a, b) => b.rank - a.rank)));

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

httpServer.listen(PORT, '0.0.0.0', () => { console.log(`[server] PUNCHLINE sur http://0.0.0.0:${PORT}`); loadPool(); });
