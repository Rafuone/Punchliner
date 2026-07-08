import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { Server } from 'socket.io';
import { SEED_TRACKS } from './tracks.js';
import { gradeAnswer, speedMult, normalize, extractFeats } from './match.js';
import { POWERS, firstLetters } from './powers.js';
import { pickQuiz, buildQuizRound } from './quiz.js';
import { computeAwards } from './awards.js';
import { addScore, getTop } from './leaderboard.js';

// format auditeurs (fr-FR) — utilisé pour les textes des trophées
const fmtAud = (n) => Math.round(n || 0).toLocaleString('fr-FR');
// Résumé COURT et lisible d'un pouvoir activé (nom + portée), affiché sur l'écran hôte (prep + reveal)
// pour qu'on comprenne CE QUE fait le pouvoir sans connaître tout le cast par cœur.
function powerNote(type, pw, detail) {
  const A = (n) => fmtAud(n);
  switch (type) {
    case 'steal':      return detail?.stoleFrom ? `vole ${A(detail.amount)} auditeurs à ${detail.stoleFrom}` : 'vol raté';
    case 'sabotage':   return detail?.mutedName ? `muselle ${detail.mutedName} (0 auditeur pour lui)` : 'sabotage';
    case 'tax':        return detail?.amount ? `dîme : +${A(detail.amount)} auditeurs pris à ${detail.count} joueur${detail.count > 1 ? 's' : ''}` : 'dîme (personne à taxer)';
    case 'allin':      return detail ? `tapis : ${detail.spent} charge${detail.spent > 1 ? 's' : ''} → +${A(detail.gain)} auditeurs` : 'tapis';
    case 'comeback':   return detail ? `remontada : +${A(detail.gain)} auditeurs` : 'remontée';
    case 'combo':      return detail ? `enchaînement armé ×${detail.mult}` : 'combo armé';
    case 'sustain':    return detail ? `+${A(detail.amount)} auditeurs garantis (${detail.rounds} manches)` : 'revenu armé';
    case 'draft':      return 'aspire une part du meilleur score de la manche';
    case 'hint':       return 'a décrypté les indices (titre + artiste)';
    case 'safety':     return 'filet posé : plancher garanti cette manche';
    case 'veteran':    return detail ? `increvable pendant ${detail.rounds} manches` : 'increvable';
    case 'freeze':     return 'hors du temps : score au max même en dernier';
    case 'nofault':    return 'zéro faute : l’orthographe passe cette manche';
    case 'ace':        return 'sans-faute + prochaine réponse ×2';
    case 'jam':        return detail ? `brouille les autres pendant ${Math.round((detail.ms || 4000) / 1000)} s` : 'brouillage';
    case 'firstblood': return `prime au 1er qui trouve (+${A(pw.first || 0)})`;
    case 'momentum':   return detail ? `en feu : +${A(detail.amount)} armé` : 'momentum armé';
    case 'decay':      return detail ? `+${A(detail.amount)} auditeurs armés` : 'armé';
    case 'double':     return `prochaine bonne réponse ×${pw.mult || 2}`;
    case 'wager':      return `quitte ou double ×${pw.mult || 2} (ou -${A(pw.penalty || 20000)})`;
    case 'bonus':      return `+${A(pw.amount || 10000)} auditeurs sur ta réponse${pw.refuel ? ' (charge rendue)' : ''}`;
    default:           return pw?.name || 'pouvoir';
  }
}
// stats de partie d'un joueur (remises à zéro à chaque partie) → servent aux trophées de fin
const newStat = () => ({ att: 0, scored: 0, perfect: 0, firsts: 0, best: 0, zeros: 0, powers: 0, denial: false, gamble: false, solo: 0, firstHalf: 0, secondHalf: 0, worstRank: 1 });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// SERVER_PORT (pas PORT) pour ne pas être capté par un outil qui injecte PORT (ex. preview)
const PORT = process.env.SERVER_PORT || 3001;
const FAST = !!process.env.PL_FAST; // TEST uniquement (test-games.mjs) : manches ultra-courtes. JAMAIS en prod.
const W = (ms) => (FAST ? 1500 : ms); // durée d'écoute par manche (raccourcie en mode test)

const PREVIEW_MS = 30000; // durée d'un extrait Deezer
const QUIZ_MS = FAST ? 1500 : 22000; // durée d'une question de quiz (QCM)
const HOST_GRACE_MS = 120000; // délai avant de fermer un salon dont l'hôte a disparu

// Mode Cypher (contre-la-montre) — jauge de temps PARTAGÉE (bonne réponse = +temps, "passer" = -temps)
const RUSH_START_MS = FAST ? 8000 : 45000; // budget de départ
const RUSH_BONUS_MS = FAST ? 3000 : 6000;  // +temps par bonne réponse
const RUSH_PASS_MS  = FAST ? 3000 : 8000;  // -temps sur "passer"
const RUSH_MAX_MS   = 90000;               // plafond de la jauge (anti-inflation)
const RUSH_REF_MS   = 10000;               // fenêtre de référence pour la prime de vitesse

// Difficulté = QUELS morceaux tombent (popularité via le rank Deezer), PAS la durée.
// Le son joue toujours généreusement ; offset = on démarre en plein milieu sur les niveaux durs.
const DIFFICULTY = {
  facile:    { label: 'Grand public', tier: 'top',  windowMs: W(30000), mult: 1.0, offset: false },
  normal:    { label: 'Connaisseur',  tier: 'high', windowMs: W(26000), mult: 1.3, offset: false },
  difficile: { label: 'Digger',       tier: 'mid',  windowMs: W(22000), mult: 1.6, offset: true },
  puriste:   { label: 'Puriste',      tier: 'deep', windowMs: W(20000), mult: 2.0, offset: true },
};
const MODES = ['multi', 'buzzer', 'quiz', 'rush'];

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

/* ------------------------------------------------------------------ */
/* Pool de morceaux (Deezer)                                           */
/* ------------------------------------------------------------------ */
let POOL = [];
const previewCache = new Map(); // id -> Buffer mp3 (extrait Deezer rapatrié chez NOUS → URL stable, jamais expirée)
// Rapatrie chaque extrait pendant que l'URL Deezer est valide, met en cache, et NE GARDE que les
// morceaux dont l'extrait est réellement téléchargeable (fini les URL mortes/expirées en pleine partie).
async function cachePreviews() {
  const original = [...POOL]; // repli si le cache échoue en masse (ex. Deezer bloque le fetch serveur)
  const keep = [];
  for (let i = 0; i < POOL.length; i += 6) {
    await Promise.allSettled(POOL.slice(i, i + 6).map(async (t) => {
      try {
        const r = await fetch(t.preview, { headers: { 'User-Agent': 'punchline-party-game' } });
        if (!r.ok) throw new Error('http ' + r.status);
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 2000) throw new Error('extrait vide');
        previewCache.set(String(t.id), buf); // clé en STRING (l'URL /api/preview/:id arrive en string)
        t.deezer = t.preview;                  // on garde l'URL d'origine (repli/debug)
        t.preview = `/api/preview/${t.id}`;    // le client jouera l'extrait SERVI PAR NOUS
        keep.push(t);
      } catch { /* extrait injouable → on retire ce morceau du pool */ }
    }));
    await new Promise((r) => setTimeout(r, 150));
  }
  // Sécurité : si (presque) rien n'a pu être mis en cache, on repart sur les URL Deezer d'origine
  // (comportement précédent) plutôt que de se retrouver avec un pool vide et un jeu injouable.
  POOL = keep.length >= Math.min(6, Math.ceil(original.length * 0.5)) ? keep : original;
  console.log(`[preview] ${previewCache.size} extraits en cache · ${POOL.length} morceaux jouables${POOL === keep ? ' (URL stables)' : ' (REPLI URL Deezer — cache indisponible)'}.`);
}
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
  // feats extraits du titre COMPLET (title_short l'enlève) → une réponse "Booba" en feat sera acceptée
  const feats = extractFeats({ title: hit.title, artist: hit.artist?.name });
  return { id: hit.id, title: hit.title_short || hit.title, artist: hit.artist?.name || seed.artist, cover: hit.album?.cover_medium || hit.album?.cover || '', preview: hit.preview, rank: hit.rank || 0, feats };
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
  console.log(`[deezer] ${POOL.length}/${SEED_TRACKS.length} morceaux résolus.`);
  await cachePreviews(); // rapatrie les extraits chez nous (URL stables) + retire les morts
  // pool prêt → on rafraîchit les hôtes déjà connectés (sinon leur bouton "Configurer" reste grisé)
  for (const room of rooms.values()) { if (room.hostConnected) emitLobby(room); }
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
// Fabrique un salon neuf (utilisé par create / new / reclaim) — une seule source de vérité.
function newRoom(code, hostId, hostToken) {
  return {
    code, hostId, hostToken, hostConnected: true, hostGrace: null,
    phase: 'lobby', players: new Map(), playlist: [], roundIndex: 0, totalRounds: 8,
    settings: { difficulty: 'normal', mode: 'multi', mj: false, rebalance: 'comeback' },
    current: null, answers: new Map(), timer: null, buzzTimer: null, lastReveal: null, createdAt: Date.now(),
    gamesPlayed: 0, lastFinal: null, usedQuiz: new Set(),
  };
}

// Joueurs ACTIFS (les « en attente » — arrivés en pleine partie — sont exclus des scores/écrans de jeu).
function publicPlayers(room) {
  return [...room.players.values()]
    .filter((p) => !p.waiting)
    .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, connected: p.connected, charge: p.charge, charges: p.charges || 0, isMJ: !!p.isMJ, total: p.total || 0, gameWins: p.gameWins || 0 }))
    .sort((a, b) => b.score - a.score);
}
const connectedCount = (room) => [...room.players.values()].filter((p) => p.connected).length;
const waitingCount = (room) => [...room.players.values()].filter((p) => p.waiting && p.connected).length;

function emitLobby(room) {
  io.to(room.code).emit('lobby', {
    code: room.code, phase: room.phase, players: publicPlayers(room),
    round: room.roundIndex + 1, totalRounds: room.totalRounds, settings: room.settings,
    waiting: waitingCount(room), gamesPlayed: room.gamesPlayed || 0, poolSize: POOL.length,
  });
}

// Snapshot pour qu'un client (re)connecté reprenne au bon écran
function snapshot(room, isHost) {
  const s = { code: room.code, phase: room.phase, roundIndex: room.roundIndex, totalRounds: room.totalRounds, settings: room.settings, players: publicPlayers(room) };
  if (room.phase === 'playing' && room.settings.mode === 'rush') {
    s.round = { mode: 'rush', trackNo: room.rushIndex + 1, endsAt: room.rushEndsAt, rushMax: RUSH_MAX_MS, difficulty: room.diffLabel, scores: rushBoard(room) };
    if (isHost && room.current) Object.assign(s.round, { preview: room.current.preview, startAt: 0 });
  } else if (room.phase === 'playing' && room.current) {
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
    s.final = room.lastFinal || { scores: publicPlayers(room) };
  } else if (room.phase === 'rushend') {
    s.rushEnd = room.lastRushEnd;
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
  room.roundPowers = new Map(); // pouvoirs activés cette manche (pid → {name,type,note}) → affichés au reveal
  for (const pl of room.players.values()) { pl.armed = null; pl.safety = false; pl.nofault = false; pl.selfBonus = 0; } // veteranUntil / streak / decayUses persistent
  clearTimeout(room.cdTimer);
  const diffLabel = (DIFFICULTY[room.settings.difficulty] || DIFFICULTY.normal).label;
  // Fenêtre d'activation des pouvoirs AVANT la musique (sinon on active en connaissant déjà la réponse).
  // PAS à la manche 1 : sans classement établi, les pouvoirs anti-leader n'ont aucune cible → on n'ouvre
  // la fenêtre qu'à partir de la manche 2 (après au moins une question jouée).
  const powerPhase = (room.settings.mode === 'multi' || room.settings.mode === 'buzzer') && !room.settings.mj && room.roundIndex >= 1;
  if (powerPhase) {
    room.phase = 'prep';
    const seconds = FAST ? 2 : 10;
    room.prepEndsAt = Date.now() + seconds * 1000;
    const info = { index: room.roundIndex, total: room.totalRounds, endsAt: room.prepEndsAt, seconds, mode: room.settings.mode, difficulty: diffLabel };
    io.to(room.code).emit('round:prep', info);
    io.to(room.hostId).emit('round:prep', info);
    room.cdTimer = setTimeout(() => startRound(room), seconds * 1000);
  } else {
    // quiz / Maître du jeu : pas de pouvoirs → décompte direct
    room.phase = 'countdown';
    const seconds = FAST ? 1 : 5;
    io.to(room.hostId).emit('round:countdown', { seconds, index: room.roundIndex, total: room.totalRounds });
    io.to(room.code).emit('round:countdown', { seconds });
    room.cdTimer = setTimeout(() => startRound(room), seconds * 1000);
  }
}

// La fenêtre pouvoirs va TOUJOURS jusqu'au bout de ses 10 s, même si tout le monde est prêt : on a le
// temps de LIRE qui a lancé quel pouvoir (et son effet) sur la TV. (Avant : elle se fermait d'un coup.)
function checkPrepDone(_room) { /* no-op volontaire — le décompte complet est conservé */ }

function startRound(room) {
  if (room.phase !== 'countdown' && room.phase !== 'prep') return; // annulé pendant décompte / fenêtre pouvoirs
  room.phase = 'playing';
  room.suspense = suspenseActive(room); // manche de fin serrée → on masquera le score en direct + à la révélation
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
    const base = { index: room.roundIndex, total: room.totalRounds, endsAt: room.roundEndsAt, durationMs: QUIZ_MS, mode: 'quiz', difficulty: 'Culture', mj: false, suspense: room.suspense };
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

  const base = { index: room.roundIndex, total: room.totalRounds, endsAt: room.roundEndsAt, durationMs: diff.windowMs, mode: room.settings.mode, difficulty: diff.label, mj: room.settings.mj, suspense: room.suspense, jam: room.jam ? { by: room.jam.by, ms: room.jam.ms } : null };
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
  const sorted = [...room.players.values()].filter((p) => !p.isMJ && !p.waiting).sort((a, b) => b.score - a.score);
  const N = sorted.length;
  sorted.forEach((p, rank) => {
    // Accrual RALENTI (~1 charge toutes les ~3 manches) pour que les pouvoirs restent un temps fort,
    // pas un réflexe à chaque manche.
    let add = 18;
    if (N > 1 && rule !== 'off') {
      const fromBottom = (N - 1 - rank) / (N - 1); // dernier = 1, premier = 0
      const t = rule === 'comeback' ? fromBottom : 1 - fromBottom;
      // Écart RESSERRÉ + plus lent : ~14 (favorisé, ≈7 manches/charge) → ~28 (à la traîne, ≈3,5 manches).
      // Avant, le dernier rechargeait ~toutes les 2 manches → ça paraissait buggé/trop rapide.
      add = 14 + t * 14;
    }
    p.charge = (p.charge || 0) + Math.round(add);
    while (p.charge >= 100 && (p.charges || 0) < 5) { p.charges = (p.charges || 0) + 1; p.charge -= 100; }
    if (p.charge > 100) p.charge = 100;
  });
}

// SUSPENSE : sur la/les dernière(s) manche(s), on MASQUE le classement — MAIS uniquement si ça reste
// jouable (l'écart entre 1er et 2e est rattrapable). Si quelqu'un a une avance imprenable, on l'affiche
// (être plus fort doit payer — pas de frustration « carapace bleue »).
function suspenseActive(room) {
  if (room.settings.mj) return false;                 // le MJ voit tout de toute façon
  const hideRounds = room.totalRounds >= 12 ? 2 : 1;  // longues parties → 2 dernières masquées
  if (room.roundIndex < room.totalRounds - hideRounds) return false;
  const act = [...room.players.values()].filter((p) => !p.isMJ && !p.waiting).sort((a, b) => b.score - a.score);
  if (act.length < 2) return false;
  const gap = act[0].score - act[1].score;
  const roundsLeft = room.totalRounds - room.roundIndex; // manches restantes, celle-ci incluse
  return gap <= roundsLeft * 38000;                      // rattrapable → suspense ; sinon runaway → on montre
}

function endRound(room) {
  clearTimeout(room.timer);
  clearTimeout(room.buzzTimer);
  if (room.phase !== 'playing') return;
  room.phase = 'reveal';
  const results = [];
  const roundScorers = []; // pids (non-MJ) ayant marqué cette manche → détecte le « cavalier seul »
  const half = room.roundIndex < room.totalRounds / 2 ? 'firstHalf' : 'secondHalf'; // début vs fin de partie (feu de paille / diesel)
  for (const p of room.players.values()) {
    if (p.waiting) continue; // arrivé en pleine partie : il regarde, il n'entre pas dans les scores
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
      if (p.sustainUntil != null && room.roundIndex <= p.sustainUntil) points += (p.sustainAmount || 0); // revenu régulier (sustain)
      if (p.draftFrac) { let om = 0; for (const [pid, a] of room.answers) { if (pid !== p.id && a.points > om) om = a.points; } points += Math.round(p.draftFrac * om); } // draft : part du meilleur score adverse
      if (p.armed?.type === 'wager') points -= (p.armed.penalty || 15000); // quitte ou double raté
      p.score = Math.max(0, p.score + points);
      p.armed = null; p.safety = false; p.nofault = false; p.selfBonus = 0; p.draftFrac = 0; // les pouvoirs de manche expirent
      p.streak = points > 0 ? (p.streak || 0) + 1 : 0;             // série de bonnes manches (momentum)
    }
    // stats de partie (trophées de fin) — le MJ n'est pas noté
    if (!p.isMJ && p.stat) {
      if (points > 0) { p.stat.scored++; roundScorers.push(p.id); } else p.stat.zeros++;
      if (titleHit && artistHit) p.stat.perfect++;
      if (points > p.stat.best) p.stat.best = points;
      p.stat[half] += Math.max(0, points);
    }
    // ce que le joueur a RÉELLEMENT répondu (texte libre, ou l'intitulé du choix en quiz) + son pouvoir de la manche
    const ansEntry = room.answers.get(p.id);
    let answerText = null;
    if (!room.settings.mj) {
      if (room.settings.mode === 'quiz') answerText = (ansEntry && typeof ansEntry.choice === 'number' && room.quiz) ? room.quiz.choices[ansEntry.choice] : null;
      else answerText = ansEntry?.text || null;
    }
    const usedPower = room.roundPowers ? room.roundPowers.get(p.id) : null;
    results.push({ id: p.id, name: p.name, avatar: p.avatar, isMJ: !!p.isMJ, points, titleHit, artistHit, answer: answerText, power: usedPower || null });
  }
  if (roundScorers.length === 1) { const w = room.players.get(roundScorers[0]); if (w?.stat) w.stat.solo++; } // seul à trouver cette manche
  results.sort((a, b) => b.points - a.points);
  fillCharges(room);
  // delta de rang (monte/descend) vs la manche précédente + pire rang atteint (comeback)
  const ranked = [...room.players.values()].filter((p) => !p.isMJ && !p.waiting).sort((a, b) => b.score - a.score);
  const newRank = new Map(); ranked.forEach((p, i) => { newRank.set(p.id, i); if (p.stat) p.stat.worstRank = Math.max(p.stat.worstRank || 1, i + 1); });
  const scores = publicPlayers(room).map((sp) => {
    const prev = room.prevRanks ? room.prevRanks.get(sp.id) : null;
    const cur = newRank.get(sp.id);
    return { ...sp, rankDelta: (prev == null || cur == null) ? 0 : prev - cur };
  });
  room.prevRanks = newRank;
  const isQuiz = room.settings.mode === 'quiz';
  const isLastRound = room.roundIndex + 1 >= room.totalRounds; // dernière manche → on garde le classement pour le podium
  room.lastReveal = {
    roundIndex: room.roundIndex, total: room.totalRounds,
    track: isQuiz ? null : { title: room.current.title, artist: room.current.artist, cover: room.current.cover },
    quiz: isQuiz ? room.quiz : null,
    hideBoard: suspenseActive(room) || isLastRound, // manche de fin serrée OU dernière manche : on cache le classement (podium = la révélation)
    lastRound: isLastRound,
    results, scores,
  };
  io.to(room.code).emit('round:reveal', room.lastReveal);
}

function nextRound(room) {
  if (room.roundIndex + 1 < room.totalRounds) { room.roundIndex += 1; beginRound(room); }
  else finishGame(room);
}

// Fin d'une partie : on fige le classement, on cumule dans la SÉRIE (total d'auditeurs + parties gagnées)
// et on décerne les trophées (façon TowerFall).
function finishGame(room) {
  room.phase = 'final';
  clearTimeout(room.timer); clearTimeout(room.buzzTimer); clearTimeout(room.cdTimer);
  const active = [...room.players.values()].filter((p) => !p.isMJ && !p.waiting);
  // cumul dans la série
  active.forEach((p) => { p.total = (p.total || 0) + p.score; p.totalRounds = (p.totalRounds || 0) + room.totalRounds; });
  const winner = [...active].sort((a, b) => b.score - a.score)[0];
  if (winner && winner.score > 0) winner.gameWins = (winner.gameWins || 0) + 1;
  room.gamesPlayed = (room.gamesPlayed || 0) + 1;
  // trophées de la partie qui vient de se finir
  const awards = computeAwards(active, { total: room.totalRounds, mode: room.settings.mode, fmt: fmtAud })
    .map((a) => { const pl = room.players.get(a.playerId); return { ...a, playerName: pl?.name || '', avatar: pl?.avatar || null }; });
  // classement général de la série (cumul de toutes les parties)
  const standings = active
    .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, total: p.total || 0, gameWins: p.gameWins || 0, totalRounds: p.totalRounds || 0 }))
    .sort((a, b) => b.total - a.total);
  const payload = { scores: publicPlayers(room), rounds: room.totalRounds, awards, settings: { difficulty: room.settings.difficulty, mode: room.settings.mode, mj: room.settings.mj, rounds: room.totalRounds }, series: { gamesPlayed: room.gamesPlayed, standings, leaderId: standings[0]?.id || null } };
  room.lastFinal = payload;
  io.to(room.code).emit('game:final', payload);
}

/* ------------------------------------------------------------------ */
/* Mode Cypher (contre-la-montre) — jauge de temps partagée            */
/* ------------------------------------------------------------------ */
function rushBoard(room) {
  return [...room.players.values()].filter((p) => !p.waiting)
    .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.rushScore || 0, tracks: p.rushTracks || 0 }))
    .sort((a, b) => b.score - a.score);
}
function rushEmitTrack(room, evt = {}) {
  const cur = room.rushPlaylist[room.rushIndex];
  room.current = cur; // pour /api/dev/answer + le grade
  room.rushTrackStartAt = Date.now();
  const common = { mode: 'rush', trackNo: room.rushIndex + 1, endsAt: room.rushEndsAt, rushMax: RUSH_MAX_MS, difficulty: room.diffLabel, scores: rushBoard(room), event: evt };
  io.to(room.hostId).emit('rush:host', { ...common, preview: cur.preview, startAt: 0 }); // l'hôte joue le son
  io.to(room.code).emit('rush:state', common); // les joueurs : chrono + score, pas d'audio
}
function rushAdvance(room, evt) {
  room.rushIndex += 1;
  if (room.rushIndex >= room.rushPlaylist.length) { // POOL épuisé → on recycle en re-mélangeant
    const last = room.rushPlaylist[room.rushPlaylist.length - 1];
    const tier = (DIFFICULTY[room.settings.difficulty] || DIFFICULTY.normal).tier;
    const next = pickPlaylist(POOL.length, tier);
    if (next[0] && last && next[0].id === last.id && next.length > 1) [next[0], next[1]] = [next[1], next[0]]; // pas de doublon immédiat
    room.rushPlaylist = next; room.rushIndex = 0;
  }
  room.rushResolving = false;
  rushEmitTrack(room, evt);
}
function rushApplyDelta(room, deltaMs) {
  room.rushEndsAt = Math.min(Date.now() + RUSH_MAX_MS, room.rushEndsAt + deltaMs);
  clearTimeout(room.rushTimer);
  const left = room.rushEndsAt - Date.now();
  if (left <= 0) return endRush(room);
  room.rushTimer = setTimeout(() => endRush(room), left);
}
function startRush(room) {
  const diff = DIFFICULTY[room.settings.difficulty] || DIFFICULTY.normal;
  room.phase = 'playing';
  room.mult = diff.mult; room.diffLabel = diff.label;
  room.rushPlaylist = pickPlaylist(POOL.length, diff.tier);
  room.rushIndex = 0;
  room.rushEndsAt = Date.now() + RUSH_START_MS;
  room.rushResolving = false;
  for (const p of room.players.values()) { p.rushScore = 0; p.rushTracks = 0; }
  clearTimeout(room.rushTimer);
  room.rushTimer = setTimeout(() => endRush(room), RUSH_START_MS);
  rushEmitTrack(room, { reason: 'start' });
}
function endRush(room) {
  clearTimeout(room.rushTimer);
  if (room.phase !== 'playing') return;
  room.phase = 'rushend';
  const players = [...room.players.values()].filter((p) => !p.waiting);
  const results = players.map((p) => {
    const placed = addScore({ name: p.name, avatar: p.avatar, score: p.rushScore || 0, tracks: p.rushTracks || 0, difficulty: room.settings.difficulty });
    return { id: p.id, name: p.name, avatar: p.avatar, score: p.rushScore || 0, tracks: p.rushTracks || 0, rank: placed.rank };
  }).sort((a, b) => b.score - a.score);
  const payload = { results, top: getTop(10), difficulty: room.settings.difficulty };
  room.lastRushEnd = payload;
  io.to(room.code).emit('rush:end', payload);
}

/* ------------------------------------------------------------------ */
/* Socket.IO                                                           */
/* ------------------------------------------------------------------ */
io.on('connection', (socket) => {
  socket.data = { roomCode: null, role: null, playerId: null };

  socket.on('host:create', (_p, cb) => {
    const code = makeCode();
    const hostToken = genId();
    rooms.set(code, newRoom(code, socket.id, hostToken));
    socket.join(code);
    socket.data = { roomCode: code, role: 'host', playerId: null };
    cb?.({ ok: true, code, hostToken, poolSize: POOL.length, difficulties: Object.fromEntries(Object.entries(DIFFICULTY).map(([k, v]) => [k, v.label])), maxRounds: POOL.length });
    emitLobby(rooms.get(code));
  });

  socket.on('host:reclaim', ({ code, hostToken }, cb) => {
    code = String(code || '').toUpperCase().trim();
    let room = rooms.get(code);
    if (room && room.hostToken !== hostToken) return cb?.({ error: 'Salon introuvable.' });
    if (!room) {
      // Serveur redémarré (dev) : on RECRÉE le salon avec le MÊME code → le code ne change JAMAIS sous
      // les joueurs. Les joueurs se reconnectent avec ce même code (leur session est conservée).
      if (!code || !hostToken) return cb?.({ error: 'Salon introuvable.' });
      room = newRoom(code, socket.id, hostToken);
      rooms.set(code, room);
    } else {
      clearTimeout(room.hostGrace); room.hostGrace = null;
      room.hostId = socket.id; room.hostConnected = true;
    }
    socket.join(code);
    socket.data = { roomCode: code, role: 'host', playerId: null };
    cb?.({ ok: true, code, poolSize: POOL.length, state: snapshot(room, true) });
    emitLobby(room);
  });

  // Nouveau salon : ferme celui de l'hôte (le libère, prévient les joueurs) puis en ouvre un neuf
  socket.on('host:new', (_p, cb) => {
    const old = rooms.get(socket.data?.roomCode);
    if (old && old.hostId === socket.id) {
      io.to(old.code).emit('room:closed', { reason: "Nouveau salon ouvert par l'hôte." });
      clearTimeout(old.timer); clearTimeout(old.buzzTimer);
      socket.leave(old.code);
      rooms.delete(old.code);
    }
    const code = makeCode();
    const hostToken = genId();
    rooms.set(code, newRoom(code, socket.id, hostToken));
    socket.join(code);
    socket.data = { roomCode: code, role: 'host', playerId: null };
    cb?.({ ok: true, code, hostToken, poolSize: POOL.length });
    emitLobby(rooms.get(code));
  });

  // L'hôte retire un joueur du salon (erreur, doublon, test…) — le joueur est prévenu et éjecté
  socket.on('host:kick', ({ playerId }) => {
    const room = rooms.get(socket.data?.roomCode);
    if (!room || room.hostId !== socket.id) return;
    const p = room.players.get(playerId);
    if (!p) return;
    if (p.socketId) io.to(p.socketId).emit('room:closed', { reason: "Tu as été retiré du salon par l'hôte." });
    room.players.delete(playerId);
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
      cb?.({ ok: true, playerId, reconnected: true, waiting: !!p.waiting, state: snapshot(room, false) });
      emitLobby(room);
      // le MJ qui revient en cours de manche doit récupérer la réponse
      if (p.isMJ && room.phase === 'playing' && room.current) io.to(socket.id).emit('mj:track', { title: room.current.title, artist: room.current.artist, cover: room.current.cover });
      return;
    }
    // Perso unique : impossible de prendre un rappeur déjà choisi par un autre joueur connecté (actif OU en attente)
    if (avatar && [...room.players.values()].some((x) => x.connected && x.avatar === avatar)) return cb?.({ error: 'Ce rappeur est déjà pris — choisis-en un autre.' });
    const pid = playerId || genId();
    const clean = String(name || '').trim().slice(0, 16) || 'Anonyme';
    // Hors lobby → salle d'attente : le joueur est là, il regarde, et il rejoint pour de vrai à la prochaine partie.
    const waiting = room.phase !== 'lobby';
    room.players.set(pid, { id: pid, name: clean, avatar: avatar || null, score: 0, connected: true, socketId: socket.id, charge: 0, charges: 1, armed: null, shield: false, waiting, total: 0, gameWins: 0, totalRounds: 0, stat: newStat() });
    socket.join(code);
    socket.data = { roomCode: code, role: 'player', playerId: pid };
    cb?.({ ok: true, playerId: pid, waiting, state: snapshot(room, false) });
    emitLobby(room);
  });

  // Changer de rappeur ENTRE DEUX PARTIES (uniquement dans le lobby, perso encore libre).
  socket.on('player:changeChar', ({ avatar } = {}, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ error: 'Pas de salon.' });
    if (room.phase !== 'lobby') return cb?.({ error: 'On change de rappeur entre deux parties, pas en pleine partie.' });
    const p = room.players.get(socket.data.playerId);
    if (!p) return cb?.({ error: 'Joueur inconnu.' });
    if (!avatar) return cb?.({ error: 'Aucun rappeur choisi.' });
    if ([...room.players.values()].some((x) => x.connected && x.id !== p.id && x.avatar === avatar)) return cb?.({ error: 'Ce rappeur est déjà pris — choisis-en un autre.' });
    p.avatar = avatar;
    cb?.({ ok: true, avatar });
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
    const useMj = !!mj && !isQuiz && wantMode !== 'rush'; // quiz / Cypher : objectifs, pas de Maître du jeu
    if (!isQuiz && !POOL.length) return cb?.({ error: 'Aucun morceau disponible (réseau ?).' });
    if (room.players.size < 1) return cb?.({ error: 'Il faut au moins un joueur.' });
    if (useMj && room.players.size < 2) return cb?.({ error: 'Le mode Maître du jeu demande au moins 2 joueurs (1 anime, 1 joue).' });
    room.settings = {
      difficulty: DIFFICULTY[difficulty] ? difficulty : 'normal',
      mode: wantMode,
      mj: useMj,
      rebalance: ['comeback', 'snowball', 'off'].includes(rebalance) ? rebalance : 'comeback',
    };
    for (const p of room.players.values()) { p.score = 0; p.waiting = false; p.stat = newStat(); p.charge = 0; p.charges = 1; p.armed = null; p.shield = false; p.isMJ = false; p.streak = 0; p.decayUses = 0; p.veteranUntil = null; p.veteranFloor = 0; p.nofault = false; p.selfBonus = 0; p.sustainUntil = null; p.sustainAmount = 0; p.draftFrac = 0; p.rushScore = 0; p.rushTracks = 0; }
    room.mjDouble = false; room.mjPlus = false; room.mjId = null;
    clearTimeout(room.rushTimer);
    // Mode Cypher : boucle dédiée (jauge de temps), pas de manches ni de pouvoirs → on lance et on sort
    if (wantMode === 'rush') { room.totalRounds = 0; room.roundIndex = 0; room.prevRanks = null; cb?.({ ok: true }); return startRush(room); }
    if (room.settings.mj) {
      // le MJ est choisi explicitement (sinon 1er joueur connecté par défaut)
      const animator = (mjId && room.players.get(mjId)) || [...room.players.values()].find((p) => p.connected) || [...room.players.values()][0];
      if (animator) { animator.isMJ = true; room.mjId = animator.id; }
    }
    if (isQuiz) {
      if (!room.usedQuiz) room.usedQuiz = new Set(); // salons créés avant l'ajout du champ
      room.playlist = pickQuiz(rounds || 8, room.settings.difficulty, room.usedQuiz); // filtre par difficulté + anti-répétition salon
    } else {
      const diff = DIFFICULTY[room.settings.difficulty] || DIFFICULTY.normal;
      room.playlist = pickPlaylist(rounds || 8, diff.tier);
    }
    room.totalRounds = room.playlist.length;
    if (!room.totalRounds) return cb?.({ error: isQuiz ? 'Banque de quiz indisponible.' : 'Aucun morceau disponible.' });
    room.roundIndex = 0;
    room.prevRanks = null;
    cb?.({ ok: true });
    beginRound(room);
  });

  // Réactions/taunts : le joueur balance une réaction préréglée → relayée à l'écran hôte (façon Meet).
  // `end` = jeu de réactions de fin de partie (podium) ; l'hôte mappe le texte sur le bon set.
  socket.on('player:reaction', ({ id, end } = {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const p = room.players.get(socket.data.playerId);
    if (!p || p.isMJ) return;
    const t = Date.now();
    if (p._lastReact && t - p._lastReact < 700) return; // anti-spam léger
    p._lastReact = t;
    io.to(room.hostId).emit('reaction', { id: Number(id) || 0, name: p.name, avatar: p.avatar, end: !!end });
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
    if (p.stat) p.stat.att++; // une vraie tentative (trophée « mitraillette »)
    const g = gradeAnswer(text, room.current, !!p.nofault); // nofault : fautes tolérées
    const sm = p.armed?.type === 'freeze' ? 2.0 : speedMult(room.roundEndsAt - Date.now(), room.windowMs); // freeze : vitesse max
    let points = g.base ? Math.round(g.base * sm * room.mult) : 0;
    if (points > 0 && !room.firstScorerId) { room.firstScorerId = p.id; if (p.stat) p.stat.firsts++; } // 1er à trouver cette manche
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
    if (!prev || points > prev.points) room.answers.set(p.id, { points, titleHit: g.titleHit, artistHit: g.artistHit, text: String(text || '').slice(0, 60) });
    cb?.({ ok: true, points, titleHit: g.titleHit, artistHit: g.artistHit });
    io.to(room.hostId).emit('player:answered', { id: p.id, name: p.name });
    // le son continue de tourner : on ne coupe plus la manche dès que tout le monde a répondu
  });

  // Mode Cypher (contre-la-montre) : on répond en boucle, la 1re bonne réponse fait avancer TOUT LE MONDE
  socket.on('rush:answer', ({ text } = {}, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || room.settings.mode !== 'rush') return cb?.({ error: 'Pas de run.' });
    if (room.rushResolving) return cb?.({ ok: true, correct: false }); // course : qqn a déjà trouvé ce morceau
    const p = room.players.get(socket.data.playerId);
    if (!p || p.waiting) return cb?.({ error: 'Joueur inconnu.' });
    const g = gradeAnswer(text, room.current);
    if (!(g.titleHit && g.artistHit)) return cb?.({ ok: true, correct: false }); // titre ET artiste requis pour avancer
    room.rushResolving = true; // verrou anti double-résolution
    const elapsed = Date.now() - (room.rushTrackStartAt || Date.now());
    const sm = speedMult(Math.max(0, RUSH_REF_MS - elapsed), RUSH_REF_MS);
    const pts = Math.round((g.base || 0) * sm * (room.mult || 1));
    p.rushScore = (p.rushScore || 0) + pts; p.rushTracks = (p.rushTracks || 0) + 1;
    cb?.({ ok: true, correct: true, points: pts, addedMs: RUSH_BONUS_MS });
    rushApplyDelta(room, RUSH_BONUS_MS); // +temps
    if (room.phase === 'playing') rushAdvance(room, { reason: 'hit', by: p.id, name: p.name, points: pts, addedMs: RUSH_BONUS_MS });
  });
  socket.on('rush:pass', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || room.settings.mode !== 'rush' || room.rushResolving) return cb?.({ error: 'Non.' });
    const p = room.players.get(socket.data.playerId);
    if (!p || p.waiting) return;
    room.rushResolving = true;
    cb?.({ ok: true, removedMs: RUSH_PASS_MS });
    rushApplyDelta(room, -RUSH_PASS_MS); // -temps (peut finir le run)
    if (room.phase === 'playing') rushAdvance(room, { reason: 'pass', by: p.id, name: p.name, removedMs: RUSH_PASS_MS });
  });
  socket.on('leaderboard:get', (_p, cb) => cb?.({ ok: true, top: getTop(10) }));

  // Mode quiz : QCM, une seule réponse par joueur, note = justesse × vitesse
  socket.on('quiz:answer', ({ choice } = {}, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || room.settings.mode !== 'quiz') return cb?.({ error: 'Pas de quiz en cours.' });
    const p = room.players.get(socket.data.playerId);
    if (!p) return cb?.({ error: 'Joueur inconnu.' });
    if (room.answers.has(p.id)) return cb?.({ error: 'Déjà répondu.' });
    if (p.stat) p.stat.att++;
    const idx = Number(choice);
    const correct = idx === room.quiz.answer;
    const points = correct ? Math.round(10000 * speedMult(room.roundEndsAt - Date.now(), room.windowMs)) : 0;
    room.answers.set(p.id, { points, choice: idx, correct });
    io.to(room.hostId).emit('player:answered', { id: p.id, name: p.name });
    cb?.({ ok: true, correct, points, answer: room.quiz.answer });
    // tout le monde a répondu → on révèle sans attendre le chrono (les "en attente" ne comptent pas)
    const active = [...room.players.values()].filter((x) => x.connected && !x.isMJ && !x.waiting);
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
    room.buzzTimer = setTimeout(() => buzzerFail(room, p.id), FAST ? 2500 : 8000);
  });

  socket.on('buzzer:answer', ({ text }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || room.settings.mode !== 'buzzer' || room.settings.mj) return;
    const p = room.players.get(socket.data.playerId);
    if (!p || room.buzz.winnerId !== p.id) return cb?.({ error: 'Ce n\'est pas ton tour.' });
    clearTimeout(room.buzzTimer);
    if (p.stat) p.stat.att++;
    const g = gradeAnswer(text, room.current, !!p.nofault);
    if (g.base > 0) {
      let points = Math.round(g.base * room.mult) + 5000; // bonus buzzer
      if (!room.firstScorerId) { room.firstScorerId = p.id; if (p.stat) p.stat.firsts++; } // le buzz gagnant = 1er à trouver
      if (p.armed) {
        if (p.armed.type === 'double' || p.armed.type === 'wager') points = Math.round(points * (p.armed.mult || 2));
        else if (p.armed.type === 'bonus') points += (p.armed.amount || 10000);
        else if (p.armed.type === 'firstblood') { points += (p.armed.base || 0); if (room.firstScorerId === p.id) points += (p.armed.first || 0); }
        if (p.armed.refuel) p.charges = Math.min(5, (p.charges || 0) + 1);
        p.armed = null;
      }
      if (room.muted.has(p.id)) points = 0;
      if (points > 0 && p.selfBonus) points += p.selfBonus;
      room.answers.set(p.id, { points, titleHit: g.titleHit, artistHit: g.artistHit, text: String(text || '').slice(0, 60) });
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
    // tout le monde a raté → fin de manche (hors MJ / en attente)
    const active = [...room.players.values()].filter((p) => p.connected && !p.isMJ && !p.waiting && !room.buzz.lockedOut.has(p.id));
    if (active.length === 0) endRound(room);
  }

  // Activation d'un pouvoir de rappeur (1x/partie)
  socket.on('player:power', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return cb?.({ error: 'Pas de partie.' });
    const p = room.players.get(socket.data.playerId);
    if (!p) return cb?.({ error: 'Joueur inconnu.' });
    if (p.waiting) return cb?.({ error: 'Tu rejoins une partie en cours : tu joueras au prochain salon.' });
    if (room.settings.mj) return cb?.({ error: 'Pas de pouvoirs en mode Maître du jeu.' });
    if (room.settings.mode === 'quiz') return cb?.({ error: 'Pas de pouvoirs en mode Quiz.' });
    // On active les pouvoirs AVANT la manche (fenêtre "prep"), pas en écoutant le son.
    if (room.phase !== 'prep') return cb?.({ error: 'On active les pouvoirs entre les manches.' });
    // UN SEUL pouvoir (ou passe) par fenêtre : bloque le double-clic / la ré-activation après reconnexion.
    if (room.ready.has(p.id)) return cb?.({ error: 'Tu as déjà joué cette fenêtre de pouvoirs.' });
    if ((p.charges || 0) < 1) return cb?.({ error: 'Aucune charge de pouvoir.' });
    const pw = POWERS[p.avatar];
    if (!pw) return cb?.({ error: 'Ce perso n\'a pas de pouvoir.' });
    // cohérence : un pouvoir qui ne peut RIEN faire ne consomme PAS la charge.
    // protégé = filet (safety) OU vétéran increvable → ni volable ni musclable
    const protectedNow = (x) => !!x.safety || (x.veteranUntil != null && room.roundIndex <= x.veteranUntil);
    const topOther = () => [...room.players.values()].filter((x) => x.id !== p.id && x.connected && !x.isMJ && !x.waiting).sort((a, b) => b.score - a.score)[0];
    const topAttackable = () => [...room.players.values()].filter((x) => x.id !== p.id && x.connected && !x.isMJ && !x.waiting && !protectedNow(x)).sort((a, b) => b.score - a.score)[0];
    let detail = null;
    if (pw.type === 'steal') {
      const leader = topAttackable();
      if (!leader || leader.score <= 0) return cb?.({ error: 'Personne à voler pour l\'instant.' });
      const amt = Math.min(pw.amount || 12000, leader.score);
      leader.score -= amt; p.score += amt;
      detail = { stoleFrom: leader.name, amount: amt };
    } else if (pw.type === 'sabotage') {
      const targets = [...room.players.values()].filter((x) => x.id !== p.id && x.connected && !x.isMJ && !x.waiting && !protectedNow(x)).sort((a, b) => b.score - a.score).slice(0, pw.targets || 1);
      if (!targets.length) return cb?.({ error: 'Aucun leader à museler (les meneurs sont blindés).' });
      targets.forEach((t) => { room.muted.add(t.id); if (pw.grab) { const amt = Math.min(pw.grab, t.score); t.score -= amt; p.score += amt; } }); // muselle + rafle une part
      detail = { mutedName: targets.map((t) => t.name).join(' & ') };
    } else if (pw.type === 'tax') {
      // prélève une petite dîme sur CHAQUE adversaire attaquable
      const others = [...room.players.values()].filter((x) => x.id !== p.id && x.connected && !x.isMJ && !x.waiting && !protectedNow(x));
      let grabbed = 0;
      others.forEach((t) => { const amt = Math.min(pw.amount || 2500, t.score); t.score -= amt; p.score += amt; grabbed += amt; });
      detail = { amount: grabbed, count: others.length };
    } else if (pw.type === 'allin') {
      // vide TOUTES les charges d'un coup pour un burst immédiat
      const spent = p.charges; // ≥ 1 (garanti plus haut)
      const gain = (pw.per || 12000) * spent;
      p.score += gain; p.charges = 1; // le "p.charges -= 1" plus bas ramène à 0
      detail = { gain, spent };
    } else if (pw.type === 'combo') {
      // multiplicateur qui GROSSIT avec la série de bonnes manches (enchaînement)
      const mult = Math.min(pw.cap || 2.2, (pw.base || 1.3) + (p.streak || 0) * (pw.per || 0.3));
      p.armed = { type: 'double', mult };
      detail = { mult: +mult.toFixed(2), streak: p.streak || 0 };
    } else if (pw.type === 'sustain') {
      // revenu garanti pendant plusieurs manches (echo / slowburn)
      p.sustainUntil = room.roundIndex + ((pw.rounds || 2) - 1);
      p.sustainAmount = pw.amount || 8000;
      detail = { amount: pw.amount || 8000, rounds: pw.rounds || 2 };
    } else if (pw.type === 'draft') {
      // aspiration : tu gagnes une part du MEILLEUR score adverse de la manche (calculé au endRound)
      p.draftFrac = pw.frac || 0.5;
      detail = { frac: pw.frac || 0.5 };
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
    if (p.stat) { p.stat.powers++; if (['steal', 'sabotage', 'tax'].includes(pw.type)) p.stat.denial = true; if (['wager', 'allin'].includes(pw.type)) p.stat.gamble = true; } // trophées (braqueur / kamikaze / sage)
    p.charges -= 1;
    room.ready.add(p.id); // activer = prêt pour la fenêtre pouvoirs
    const note = powerNote(pw.type, pw, detail);
    if (!room.roundPowers) room.roundPowers = new Map();
    room.roundPowers.set(p.id, { name: pw.name, type: pw.type, note }); // rappelé au reveal (qui a fait quoi)
    io.to(room.hostId).emit('power:used', { name: p.name, avatar: p.avatar, power: pw.name, effect: note });
    io.to(room.code).emit('scores:update', { scores: publicPlayers(room) });
    const nbActive = [...room.players.values()].filter((x) => x.connected && !x.isMJ && !x.waiting).length;
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
    const nbActive = [...room.players.values()].filter((x) => x.connected && !x.isMJ && !x.waiting).length;
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

  // Retour au salon (bouton « ← Salon » en jeu, ou « Rejouer / Relancer » depuis le podium).
  // On repart pour une nouvelle partie EN GARDANT le cumul de série (total d'auditeurs + parties gagnées).
  socket.on('host:restart', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return cb?.({ error: 'Non autorisé.' });
    clearTimeout(room.timer); clearTimeout(room.buzzTimer); clearTimeout(room.cdTimer); clearTimeout(room.rushTimer);
    room.phase = 'lobby'; room.roundIndex = 0; room.prevRanks = null; room.current = null; room.lastReveal = null;
    for (const p of room.players.values()) {
      p.score = 0; p.waiting = false; p.stat = newStat(); // les « en attente » rejoignent la prochaine partie
      p.charge = 0; p.charges = 1; p.armed = null; p.shield = false; p.isMJ = false;
      p.sustainUntil = null; p.sustainAmount = 0; p.draftFrac = 0; p.streak = 0; p.decayUses = 0;
      p.veteranUntil = null; p.veteranFloor = 0; p.nofault = false; p.selfBonus = 0;
      // NB : p.total / p.gameWins / p.totalRounds NE sont PAS remis à zéro → c'est le cumul de la série.
    }
    room.mjId = null; room.mjDouble = false; room.mjPlus = false;
    cb?.({ ok: true });
    emitLobby(room);
  });

  // Repartir de zéro pour la série (efface le cumul de toutes les parties).
  socket.on('host:resetSeries', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return cb?.({ error: 'Non autorisé.' });
    room.gamesPlayed = 0; room.lastFinal = null;
    for (const p of room.players.values()) { p.total = 0; p.gameWins = 0; p.totalRounds = 0; }
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
app.get('/api/health', (_req, res) => res.json({ ok: true, pool: POOL.length, rooms: rooms.size, previews: previewCache.size }));
// Extraits servis PAR NOUS (mp3 en cache) → URL stables, jamais expirées. Range-request pour le seek.
app.get('/api/preview/:id', (req, res) => {
  const buf = previewCache.get(req.params.id);
  if (!buf) return res.status(404).end();
  res.set('Content-Type', 'audio/mpeg');
  res.set('Accept-Ranges', 'bytes');
  res.set('Cache-Control', 'public, max-age=86400');
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = m ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? Math.min(parseInt(m[2], 10), buf.length - 1) : buf.length - 1;
    if (start >= buf.length) return res.status(416).set('Content-Range', `bytes */${buf.length}`).end();
    if (end < start) return res.set('Content-Length', String(buf.length)).end(buf); // plage inversée → on ignore la range, morceau complet
    res.status(206).set('Content-Range', `bytes ${start}-${end}/${buf.length}`).set('Content-Length', String(end - start + 1));
    return res.end(buf.subarray(start, end + 1));
  }
  res.set('Content-Length', String(buf.length)).end(buf);
});
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
app.get('/api/pool', (_req, res) => res.json(POOL.map((t) => ({ id: t.id, artist: t.artist, title: t.title, rank: t.rank })).sort((a, b) => b.rank - a.rank)));
// Test uniquement : révèle la réponse de la manche en cours (pour scripter des réponses correctes dans test-games.mjs).
app.get('/api/dev/answer', (req, res) => {
  const room = rooms.get(String(req.query.code || '').toUpperCase().trim());
  if (!room || !room.current) return res.json({ title: null, artist: null });
  res.json({ title: room.current.title, artist: room.current.artist, quizAnswer: room.quiz ? room.quiz.answer : null });
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

httpServer.listen(PORT, '0.0.0.0', () => { console.log(`[server] PUNCHLINE sur http://0.0.0.0:${PORT}`); loadPool(); });
