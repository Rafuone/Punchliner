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
import { pickQuiz, buildQuizRound } from './quiz.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// SERVER_PORT (pas PORT) pour ne pas être capté par un outil qui injecte PORT (ex. preview)
const PORT = process.env.SERVER_PORT || 3001;

const PREVIEW_MS = 30000; // durée d'un extrait Deezer
const QUIZ_MS = 22000; // durée d'une question de quiz (QCM)
const HOST_GRACE_MS = 120000; // délai avant de fermer un salon dont l'hôte a disparu

// Difficulté = QUELS morceaux tombent (popularité via le rank Deezer), PAS la durée.
// Le son joue toujours généreusement ; offset = on démarre en plein milieu sur les niveaux durs.
const DIFFICULTY = {
  facile:    { label: 'Grand public', tier: 'top',  windowMs: 30000, mult: 1.0, offset: false },
  normal:    { label: 'Connaisseur',  tier: 'high', windowMs: 26000, mult: 1.3, offset: false },
  difficile: { label: 'Digger',       tier: 'mid',  windowMs: 22000, mult: 1.6, offset: true },
  puriste:   { label: 'Puriste',      tier: 'deep', windowMs: 20000, mult: 2.0, offset: true },
};
const MODES = ['multi', 'buzzer', 'quiz'];

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
    s.round = { index: room.roundIndex, roundIndex: room.roundIndex, total: room.totalRounds, endsAt: room.roundEndsAt, durationMs: room.windowMs, mode: room.settings.mode, difficulty: room.diffLabel, mj: room.settings.mj };
    if (room.settings.mode === 'quiz' && room.quiz) {
      s.round.quiz = isHost ? room.quiz : { id: room.quiz.id, cat: room.quiz.cat, q: room.quiz.q, choices: room.quiz.choices };
    } else {
      if (isHost) Object.assign(s.round, { preview: room.current.preview, startAt: room.startAt });
      if (room.settings.mode === 'buzzer') s.buzz = { winnerId: room.buzz.winnerId, winnerName: room.buzz.winnerName, open: room.buzz.open, lockedOut: [...room.buzz.lockedOut] };
    }
  } else if (room.phase === 'prep') {
    s.round = { index: room.roundIndex, roundIndex: room.roundIndex, total: room.totalRounds, endsAt: room.prepEndsAt, mode: room.settings.mode, difficulty: (DIFFICULTY[room.settings.difficulty] || DIFFICULTY.normal).label, prep: true };
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
  // le morceau est choisi MAINTENANT (avant la fenêtre pouvoirs → le hint peut révéler ses lettres)
  room.current = room.playlist[room.roundIndex];
  room.muted = new Set();
  room.ready = new Set();
  room.firstScorerId = null; // 1er à trouver cette manche (pour firstblood)
  room.jam = null;           // brouillage (pouvoir jam) posé pour cette manche
  for (const pl of room.players.values()) { pl.armed = null; pl.safety = false; pl.nofault = false; pl.selfBonus = 0; } // veteranUntil / streak / decayUses persistent
  clearTimeout(room.cdTimer);
  const diffLabel = (DIFFICULTY[room.settings.difficulty] || DIFFICULTY.normal).label;
  // Fenêtre d'activation des pouvoirs AVANT la musique (sinon on active en connaissant déjà la réponse).
  const powerPhase = (room.settings.mode === 'multi' || room.settings.mode === 'buzzer') && !room.settings.mj;
  if (powerPhase) {
    room.phase = 'prep';
    const seconds = 10;
    room.prepEndsAt = Date.now() + seconds * 1000;
    const info = { index: room.roundIndex, total: room.totalRounds, endsAt: room.prepEndsAt, seconds, mode: room.settings.mode, difficulty: diffLabel };
    io.to(room.code).emit('round:prep', info);
    io.to(room.hostId).emit('round:prep', info);
    room.cdTimer = setTimeout(() => startRound(room), seconds * 1000);
  } else {
    // quiz / Maître du jeu : pas de pouvoirs → décompte direct
    room.phase = 'countdown';
    const seconds = 5;
    io.to(room.hostId).emit('round:countdown', { seconds, index: room.roundIndex, total: room.totalRounds });
    io.to(room.code).emit('round:countdown', { seconds });
    room.cdTimer = setTimeout(() => startRound(room), seconds * 1000);
  }
}

// La fenêtre pouvoirs se ferme dès que tout le monde a activé ou passé.
function checkPrepDone(room) {
  if (!room || room.phase !== 'prep') return;
  const active = [...room.players.values()].filter((p) => p.connected && !p.isMJ);
  if (active.length && active.every((p) => room.ready.has(p.id))) {
    clearTimeout(room.cdTimer);
    startRound(room);
  }
}

function startRound(room) {
  if (room.phase !== 'countdown' && room.phase !== 'prep') return; // annulé pendant décompte / fenêtre pouvoirs
  room.phase = 'playing';
  room.current = room.playlist[room.roundIndex];
  room.answers = new Map();
  room.buzz = { winnerId: null, winnerName: null, open: true, lockedOut: new Set() };
  clearTimeout(room.buzzTimer);
  room.mjDouble = false; room.mjPlus = false;
  room.mjRoundPoints = new Map(); // points donnés par le MJ sur cette manche (pour l'affichage à la révélation)
  // NB : muted / armed / safety sont posés en amont (beginRound + fenêtre pouvoirs), on ne les remet PAS à zéro ici

  // ---- Mode Quiz : QCM de culture, pas d'audio ----
  if (room.settings.mode === 'quiz') {
    room.windowMs = QUIZ_MS; room.diffLabel = 'Culture'; room.mult = 1;
    room.quiz = buildQuizRound(room.current);
    room.roundEndsAt = Date.now() + QUIZ_MS;
    const base = { index: room.roundIndex, total: room.totalRounds, endsAt: room.roundEndsAt, durationMs: QUIZ_MS, mode: 'quiz', difficulty: 'Culture', mj: false };
    io.to(room.hostId).emit('round:host', { ...base, quiz: room.quiz }); // l'hôte a la bonne réponse (pour la révélation)
    io.to(room.code).emit('round:go', { ...base, quiz: { id: room.quiz.id, cat: room.quiz.cat, q: room.quiz.q, choices: room.quiz.choices } });
    clearTimeout(room.timer);
    room.timer = setTimeout(() => endRound(room), QUIZ_MS);
    return;
  }

  // ---- Modes audio (blind test / buzzer) ----
  const diff = DIFFICULTY[room.settings.difficulty] || DIFFICULTY.normal;
  room.windowMs = diff.windowMs;
  room.diffLabel = diff.label;
  room.mult = diff.mult;
  // niveaux durs : on démarre l'extrait en plein milieu (pas l'intro reconnaissable)
  const maxOffset = Math.max(0, PREVIEW_MS - diff.windowMs - 1000);
  room.startAt = diff.offset ? Math.floor(Math.random() * Math.min(14000, maxOffset)) : 0;
  room.roundEndsAt = Date.now() + diff.windowMs;

  const base = { index: room.roundIndex, total: room.totalRounds, endsAt: room.roundEndsAt, durationMs: diff.windowMs, mode: room.settings.mode, difficulty: diff.label, mj: room.settings.mj, jam: room.jam ? { by: room.jam.by, ms: room.jam.ms } : null };
  io.to(room.hostId).emit('round:host', { ...base, preview: room.current.preview, startAt: room.startAt });
  io.to(room.code).emit('round:go', base);
  // le Maître du jeu voit la réponse (lui seul) pour arbitrer à la voix
  if (room.mjId) { const a = room.players.get(room.mjId); if (a?.socketId) io.to(a.socketId).emit('mj:track', { title: room.current.title, artist: room.current.artist, cover: room.current.cover }); }
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
    let points, titleHit = false, artistHit = false;
    if (room.settings.mj) {
      // en mode MJ, les points sont donnés à la voix et déjà appliqués au score en direct
      points = room.mjRoundPoints?.get(p.id) || 0;
    } else {
      const a = room.answers.get(p.id);
      points = a ? a.points : 0;
      titleHit = a?.titleHit || false; artistHit = a?.artistHit || false;
      const vet = p.veteranUntil != null && room.roundIndex <= p.veteranUntil; // vétéran increvable actif
      if (room.muted?.has(p.id)) points = 0;                       // sabotage : muselé cette manche
      if (p.safety && points < p.safety) points = p.safety;        // filet : plancher garanti (auditeurs)
      if (vet && points < (p.veteranFloor || 4000)) points = p.veteranFloor || 4000; // gratte garanti du vétéran
      if (p.armed?.type === 'wager') points -= (p.armed.penalty || 15000); // quitte ou double raté
      p.score = Math.max(0, p.score + points);
      p.armed = null; p.safety = false; p.nofault = false; p.selfBonus = 0; // les pouvoirs de manche expirent
      p.streak = points > 0 ? (p.streak || 0) + 1 : 0;             // série de bonnes manches (momentum)
    }
    results.push({ id: p.id, name: p.name, avatar: p.avatar, points, titleHit, artistHit });
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
  const isQuiz = room.settings.mode === 'quiz';
  room.lastReveal = {
    roundIndex: room.roundIndex, total: room.totalRounds,
    track: isQuiz ? null : { title: room.current.title, artist: room.current.artist, cover: room.current.cover },
    quiz: isQuiz ? room.quiz : null,
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
      // le MJ qui revient en cours de manche doit récupérer la réponse
      if (p.isMJ && room.phase === 'playing' && room.current) io.to(socket.id).emit('mj:track', { title: room.current.title, artist: room.current.artist, cover: room.current.cover });
      return;
    }
    // Nouveau joueur : uniquement dans le lobby
    if (room.phase !== 'lobby') return cb?.({ error: 'La partie a déjà commencé — impossible de rejoindre en cours.' });
    // Perso unique : impossible de prendre un rappeur déjà choisi par un autre joueur connecté
    if (avatar && [...room.players.values()].some((x) => x.connected && x.avatar === avatar)) return cb?.({ error: 'Ce rappeur est déjà pris — choisis-en un autre.' });
    const pid = playerId || genId();
    const clean = String(name || '').trim().slice(0, 16) || 'Anonyme';
    room.players.set(pid, { id: pid, name: clean, avatar: avatar || null, score: 0, connected: true, socketId: socket.id, charge: 0, charges: 1, armed: null, shield: false });
    socket.join(code);
    socket.data = { roomCode: code, role: 'player', playerId: pid };
    cb?.({ ok: true, playerId: pid, state: snapshot(room, false) });
    emitLobby(room);
  });

  // Le joueur qui choisit son perso "observe" le salon pour voir en direct les persos déjà pris.
  socket.on('player:watch', ({ code } = {}, cb) => {
    code = String(code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return cb?.({ error: "Ce code n'existe pas." });
    socket.join(code); // reçoit les 'lobby' → grise les persos pris en temps réel
    cb?.({ ok: true, players: publicPlayers(room) });
  });

  socket.on('host:start', ({ rounds, difficulty, mode, mj, mjId, rebalance } = {}, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return cb?.({ error: 'Non autorisé.' });
    const wantMode = MODES.includes(mode) ? mode : 'multi';
    const isQuiz = wantMode === 'quiz';
    const useMj = !!mj && !isQuiz; // le quiz est objectif (QCM) : pas de Maître du jeu
    if (!isQuiz && !POOL.length) return cb?.({ error: 'Aucun morceau disponible (réseau ?).' });
    if (room.players.size < 1) return cb?.({ error: 'Il faut au moins un joueur.' });
    if (useMj && room.players.size < 2) return cb?.({ error: 'Le mode Maître du jeu demande au moins 2 joueurs (1 anime, 1 joue).' });
    room.settings = {
      difficulty: DIFFICULTY[difficulty] ? difficulty : 'normal',
      mode: wantMode,
      mj: useMj,
      rebalance: ['comeback', 'snowball', 'off'].includes(rebalance) ? rebalance : 'comeback',
    };
    for (const p of room.players.values()) { p.charge = 0; p.charges = 1; p.armed = null; p.shield = false; p.isMJ = false; p.streak = 0; p.decayUses = 0; p.veteranUntil = null; p.veteranFloor = 0; p.nofault = false; p.selfBonus = 0; }
    room.mjDouble = false; room.mjPlus = false; room.mjId = null;
    if (room.settings.mj) {
      // le MJ est choisi explicitement (sinon 1er joueur connecté par défaut)
      const animator = (mjId && room.players.get(mjId)) || [...room.players.values()].find((p) => p.connected) || [...room.players.values()][0];
      if (animator) { animator.isMJ = true; room.mjId = animator.id; }
    }
    if (isQuiz) {
      room.playlist = pickQuiz(rounds || 8);
    } else {
      const diff = DIFFICULTY[room.settings.difficulty] || DIFFICULTY.normal;
      room.playlist = pickPlaylist(rounds || 8, diff.tier);
    }
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
    if (room.settings.mj) return cb?.({ ok: true, mj: true, points: 0 }); // en mode MJ, c'est l'animateur qui note
    // brouillage (jam) : tout le monde sauf l'auteur attend quelques secondes
    if (room.jam && p.id !== room.jam.by && Date.now() < (room.roundEndsAt - room.windowMs) + room.jam.ms) {
      return cb?.({ error: 'Brouillé — patiente…', jammed: true });
    }
    const g = gradeAnswer(text, room.current, !!p.nofault); // nofault : fautes tolérées
    const sm = p.armed?.type === 'freeze' ? 2.0 : speedMult(room.roundEndsAt - Date.now(), room.windowMs); // freeze : vitesse max
    let points = g.base ? Math.round(g.base * sm * room.mult) : 0;
    if (points > 0 && !room.firstScorerId) room.firstScorerId = p.id; // 1er à trouver cette manche
    if (points > 0 && p.armed) {
      if (p.armed.type === 'double' || p.armed.type === 'wager') points = Math.round(points * (p.armed.mult || 2));
      else if (p.armed.type === 'bonus') points += (p.armed.amount || 10000);
      else if (p.armed.type === 'firstblood') { points += (p.armed.base || 0); if (room.firstScorerId === p.id) points += (p.armed.first || 0); }
      if (p.armed.refuel) p.charges = Math.min(5, (p.charges || 0) + 1); // surrégime : charge remboursée si tu marques
      p.armed = null;
    }
    if (room.muted.has(p.id)) points = 0; // muselé cette manche (sabotage)
    if (points > 0 && p.selfBonus) points += p.selfBonus; // gain perso des pouvoirs utilitaires (hint/jam/freeze/nofault)
    const prev = room.answers.get(p.id);
    if (!prev || points > prev.points) room.answers.set(p.id, { points, titleHit: g.titleHit, artistHit: g.artistHit });
    cb?.({ ok: true, points, titleHit: g.titleHit, artistHit: g.artistHit });
    io.to(room.hostId).emit('player:answered', { id: p.id, name: p.name });
    // le son continue de tourner : on ne coupe plus la manche dès que tout le monde a répondu
  });

  // Mode quiz : QCM, une seule réponse par joueur, note = justesse × vitesse
  socket.on('quiz:answer', ({ choice } = {}, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || room.settings.mode !== 'quiz') return cb?.({ error: 'Pas de quiz en cours.' });
    const p = room.players.get(socket.data.playerId);
    if (!p) return cb?.({ error: 'Joueur inconnu.' });
    if (room.answers.has(p.id)) return cb?.({ error: 'Déjà répondu.' });
    const idx = Number(choice);
    const correct = idx === room.quiz.answer;
    const points = correct ? Math.round(10000 * speedMult(room.roundEndsAt - Date.now(), room.windowMs)) : 0;
    room.answers.set(p.id, { points, choice: idx, correct });
    io.to(room.hostId).emit('player:answered', { id: p.id, name: p.name });
    cb?.({ ok: true, correct, points, answer: room.quiz.answer });
    // tout le monde a répondu → on révèle sans attendre le chrono
    const active = [...room.players.values()].filter((x) => x.connected && !x.isMJ);
    if (active.length && active.every((x) => room.answers.has(x.id))) endRound(room);
  });

  // Mode buzzer : le premier qui buzze prend la main (lockout)
  socket.on('player:buzz', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || room.settings.mode !== 'buzzer' || room.settings.mj) return cb?.({ error: 'Pas de buzzer.' });
    const p = room.players.get(socket.data.playerId);
    if (!p) return cb?.({ error: 'Joueur inconnu.' });
    if (room.jam && p.id !== room.jam.by && Date.now() < (room.roundEndsAt - room.windowMs) + room.jam.ms) return cb?.({ error: 'Brouillé — patiente…', jammed: true });
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
    if (!room || room.phase !== 'playing' || room.settings.mode !== 'buzzer' || room.settings.mj) return;
    const p = room.players.get(socket.data.playerId);
    if (!p || room.buzz.winnerId !== p.id) return cb?.({ error: 'Ce n\'est pas ton tour.' });
    clearTimeout(room.buzzTimer);
    const g = gradeAnswer(text, room.current, !!p.nofault);
    if (g.base > 0) {
      let points = Math.round(g.base * room.mult) + 5000; // bonus buzzer
      if (!room.firstScorerId) room.firstScorerId = p.id; // le buzz gagnant = 1er à trouver
      if (p.armed) {
        if (p.armed.type === 'double' || p.armed.type === 'wager') points = Math.round(points * (p.armed.mult || 2));
        else if (p.armed.type === 'bonus') points += (p.armed.amount || 10000);
        else if (p.armed.type === 'firstblood') { points += (p.armed.base || 0); if (room.firstScorerId === p.id) points += (p.armed.first || 0); }
        if (p.armed.refuel) p.charges = Math.min(5, (p.charges || 0) + 1);
        p.armed = null;
      }
      if (room.muted.has(p.id)) points = 0;
      if (points > 0 && p.selfBonus) points += p.selfBonus;
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
    if (room.settings.mj) return cb?.({ error: 'Pas de pouvoirs en mode Maître du jeu.' });
    if (room.settings.mode === 'quiz') return cb?.({ error: 'Pas de pouvoirs en mode Quiz.' });
    // On active les pouvoirs AVANT la manche (fenêtre "prep"), pas en écoutant le son.
    if (room.phase !== 'prep') return cb?.({ error: 'On active les pouvoirs entre les manches.' });
    if ((p.charges || 0) < 1) return cb?.({ error: 'Aucune charge de pouvoir.' });
    const pw = POWERS[p.avatar];
    if (!pw) return cb?.({ error: 'Ce perso n\'a pas de pouvoir.' });
    // cohérence : un pouvoir qui ne peut RIEN faire ne consomme PAS la charge.
    // protégé = filet (safety) OU vétéran increvable → ni volable ni musclable
    const protectedNow = (x) => !!x.safety || (x.veteranUntil != null && room.roundIndex <= x.veteranUntil);
    const topOther = () => [...room.players.values()].filter((x) => x.id !== p.id && x.connected && !x.isMJ).sort((a, b) => b.score - a.score)[0];
    const topAttackable = () => [...room.players.values()].filter((x) => x.id !== p.id && x.connected && !x.isMJ && !protectedNow(x)).sort((a, b) => b.score - a.score)[0];
    let detail = null;
    if (pw.type === 'steal') {
      const leader = topAttackable();
      if (!leader || leader.score <= 0) return cb?.({ error: 'Personne à voler pour l\'instant.' });
      const amt = Math.min(pw.amount || 12000, leader.score);
      leader.score -= amt; p.score += amt;
      detail = { stoleFrom: leader.name, amount: amt };
    } else if (pw.type === 'sabotage') {
      const targets = [...room.players.values()].filter((x) => x.id !== p.id && x.connected && !x.isMJ && !protectedNow(x)).sort((a, b) => b.score - a.score).slice(0, pw.targets || 1);
      if (!targets.length) return cb?.({ error: 'Aucun leader à museler (les meneurs sont blindés).' });
      targets.forEach((t) => { room.muted.add(t.id); if (pw.grab) { const amt = Math.min(pw.grab, t.score); t.score -= amt; p.score += amt; } }); // muselle + rafle une part
      detail = { mutedName: targets.map((t) => t.name).join(' & ') };
    } else if (pw.type === 'comeback') {
      const leader = topOther();
      const deficit = leader ? leader.score - p.score : 0;
      if (deficit < 2000) return cb?.({ error: 'Tu n\'es pas assez à la traîne pour remonter.' });
      const gain = Math.min(pw.cap || 30000, Math.round(deficit * (pw.factor || 0.5)));
      p.score += gain;
      detail = { gain };
    } else if (pw.type === 'hint') {
      detail = { hint: { title: firstLetters(room.current.title), artist: firstLetters(room.current.artist) } };
    } else if (pw.type === 'safety') {
      p.safety = pw.floor || 7000; room.muted.delete(p.id); // le filet annule aussi un sabotage déjà posé sur toi
    } else if (pw.type === 'veteran') {
      p.veteranUntil = room.roundIndex + ((pw.rounds || 3) - 1); // increvable cette manche + les suivantes
      p.veteranFloor = pw.floor || 4000;
      detail = { rounds: pw.rounds || 3 };
    } else if (pw.type === 'momentum') {
      const amt = (pw.base || 5000) + (p.streak || 0) * (pw.per || 5000); // grossit avec la série
      p.armed = { type: 'bonus', amount: amt };
      detail = { amount: amt, streak: p.streak || 0 };
    } else if (pw.type === 'decay') {
      const uses = p.decayUses || 0;
      const amt = Math.round((pw.base || 15000) * Math.pow(pw.factor || 0.75, uses)); // fond à chaque usage
      p.decayUses = uses + 1;
      p.armed = { type: 'bonus', amount: amt };
      detail = { amount: amt };
    } else if (pw.type === 'firstblood') {
      p.armed = { type: 'firstblood', base: pw.base || 0, first: pw.first || 20000 };
    } else if (pw.type === 'freeze') {
      p.armed = { type: 'freeze' }; // le temps n'aura pas d'incidence cette manche
    } else if (pw.type === 'nofault') {
      p.nofault = true; // fautes tolérées cette manche
    } else if (pw.type === 'ace') {
      p.nofault = true; p.armed = { type: 'double', mult: pw.mult || 2 }; // sans-faute + ×2 (technicien élite)
    } else if (pw.type === 'refuel') {
      p.armed = { type: 'refuel' }; // surrégime : la charge est remboursée si tu marques
    } else if (pw.type === 'jam') {
      if (room.jam) return cb?.({ error: 'Le brouillage est déjà posé cette manche.' });
      room.jam = { by: p.id, ms: pw.ms || 4000 };
      detail = { ms: pw.ms || 4000 };
    } else if (pw.type === 'double' || pw.type === 'wager' || pw.type === 'bonus') {
      p.armed = { type: pw.type, mult: pw.mult, amount: pw.amount, penalty: pw.penalty, refuel: pw.refuel };
    } else {
      return cb?.({ error: 'Pouvoir inconnu.' });
    }
    if (pw.self) p.selfBonus = pw.self; // petit gain perso des pouvoirs utilitaires (hint/jam/freeze/nofault)
    p.charges -= 1;
    room.ready.add(p.id); // activer = prêt pour la fenêtre pouvoirs
    io.to(room.hostId).emit('power:used', { name: p.name, avatar: p.avatar, power: pw.name });
    io.to(room.code).emit('scores:update', { scores: publicPlayers(room) });
    const nbActive = [...room.players.values()].filter((x) => x.connected && !x.isMJ).length;
    io.to(room.hostId).emit('prep:ready', { count: room.ready.size, total: nbActive });
    cb?.({ ok: true, type: pw.type, power: pw.name, detail, charges: p.charges, charge: p.charge });
    checkPrepDone(room);
  });

  // Passer la fenêtre pouvoirs sans en activer
  socket.on('player:ready', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'prep') return cb?.({ error: 'Pas le moment.' });
    room.ready.add(socket.data.playerId);
    cb?.({ ok: true });
    const nbActive = [...room.players.values()].filter((x) => x.connected && !x.isMJ).length;
    io.to(room.hostId).emit('prep:ready', { count: room.ready.size, total: nbActive });
    checkPrepDone(room);
  });

  // ---- Maître du jeu (pupitre) ----
  const isMj = (room) => room && room.mjId && room.mjId === socket.data.playerId;
  socket.on('mj:next', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!isMj(room) || room.phase !== 'reveal') return cb?.({ error: 'Pas au bon moment.' });
    cb?.({ ok: true });
    nextRound(room);
  });
  // le MJ coupe le son et passe à la révélation quand il a fini d'arbitrer
  socket.on('mj:reveal', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!isMj(room) || room.phase !== 'playing') return cb?.({ error: 'Pas au bon moment.' });
    cb?.({ ok: true });
    endRound(room);
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
  socket.on('mj:award', ({ playerId, points } = {}, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!isMj(room)) return cb?.({ error: 'Non autorisé.' });
    const t = room.players.get(playerId);
    if (!t || t.isMJ) return cb?.({ error: 'Joueur inconnu.' });
    const amt = Math.max(100, Math.min(30000, Math.round(points || 10000)));
    t.score = Math.max(0, t.score + amt);
    // mémorise le gain de la manche pour l'afficher à la révélation
    if (room.mjRoundPoints) room.mjRoundPoints.set(t.id, (room.mjRoundPoints.get(t.id) || 0) + amt);
    io.to(room.code).emit('scores:update', { scores: publicPlayers(room) });
    io.to(room.hostId).emit('power:used', { name: 'Maître du jeu', power: `+${amt} à ${t.name}` });
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
// Test : renvoie le salon ouvert le plus récent (pour /?dev côté joueur)
app.get('/api/dev/room', (_req, res) => {
  const list = [...rooms.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const room = list.find((r) => r.phase === 'lobby') || list[0];
  res.json({ code: room?.code || null });
});
app.get('/api/pool', (_req, res) => res.json(POOL.map((t) => ({ artist: t.artist, title: t.title, rank: t.rank })).sort((a, b) => b.rank - a.rank)));

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

httpServer.listen(PORT, '0.0.0.0', () => { console.log(`[server] PUNCHLINE sur http://0.0.0.0:${PORT}`); loadPool(); });
