import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { Server } from 'socket.io';
import { SEED_TRACKS, SEED_ARTISTS, ARTIST_TAGS } from './tracks.js';
import { gradeAnswer, speedMult, normalize, extractFeats } from './match.js';
import { POWERS, firstLetters } from './powers.js';
import { pickQuiz, buildQuizRound } from './quiz.js';
import { computeAwards } from './awards.js';
import { addScore, getTop, getConfigs } from './leaderboard.js';

// format auditeurs (fr-FR) — utilisé pour les textes des trophées
const fmtAud = (n) => Math.round(n || 0).toLocaleString('fr-FR');
// Résumé COURT et lisible d'un pouvoir activé (nom + portée), affiché sur l'écran hôte (prep + reveal)
// pour qu'on comprenne CE QUE fait le pouvoir sans connaître tout le cast par cœur.
function powerNote(type, pw, detail) {
  const A = (n) => fmtAud(n);
  switch (type) {
    case 'steal':      return detail?.stoleFrom
      ? `vole ${A(detail.amount)} auditeurs à ${detail.stoleFrom}${detail.shield ? ' · intouchable ce tour' : ''}`
      : detail?.shield ? 'intouchable ce tour (aucun meneur à voler)' : 'vol raté';
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
const newStat = () => ({ att: 0, scored: 0, perfect: 0, firsts: 0, best: 0, zeros: 0, powers: 0, denial: false, gamble: false, solo: 0, firstHalf: 0, secondHalf: 0, worstRank: 1, lowRounds: 0, denialGain: 0, datedFinds: 0, oldFinds: 0, newFinds: 0 });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// SERVER_PORT (pas PORT) pour ne pas être capté par un outil qui injecte PORT (ex. preview)
const PORT = process.env.SERVER_PORT || 3001;
const FAST = !!process.env.PL_FAST; // TEST uniquement (test-games.mjs) : manches ultra-courtes. JAMAIS en prod.
const W = (ms) => (FAST ? 1500 : ms); // durée d'écoute par manche (raccourcie en mode test)
const BUZZ_ANSWER_MS = FAST ? 2500 : 15000; // fenêtre pour répondre après avoir buzzé (sinon lockout + réouverture) — 15 s : taper un titre + artiste long sous stress prend du temps
const BUZZ_ROUND_MAX_MS = FAST ? 4000 : 30000; // buzzer : PLAFOND ABSOLU par manche → révèle même si ça buzze/rate en boucle (plus de musique infinie)
const MIN_BUZZ_MS = FAST ? 200 : 800; // buzzer : grâce en début de manche (le son doit avoir démarré côté TV avant qu'on puisse buzzer)
// Manche BATTLE (clash 1v1 généré par le jeu, façon battle hip-hop) — événement BONUS, PAS un pouvoir.
// 2 joueurs s'affrontent ; les autres PARIENT sur le vainqueur. Le 1er des deux qui trouve gagne.
const BATTLE_WIN = 20000;              // auditeurs pour le vainqueur du clash
const BATTLE_DRAW = 6000;              // consolation aux 2 si personne ne trouve
const BATTLE_BET_BONUS = 4000;         // bonus pour un spectateur qui a parié sur le bon (pas de perte si raté)
const BATTLE_AUTO = true;              // clash auto : 1/partie, ~milieu, ≥3 joueurs. (Le crash live n'est PAS le clash : il survient en pleine LECTURE d'extrait, manche 3-4, avant le clash — cause native RAM/GPU, hors code JS.) Forçage dev host:forceBattle indépendant.
const BATTLE_INTRO_MS = FAST ? 700 : 4500;
const BATTLE_BET_MS = FAST ? 1200 : 10000;
const BATTLE_PLAY_MS = FAST ? 2500 : 22000;

const PREVIEW_MS = 30000; // durée d'un extrait Deezer
const QUIZ_MS = FAST ? 1500 : 22000; // durée d'une question de quiz (QCM)
const HOST_GRACE_MS = 120000; // délai avant de fermer un salon dont l'hôte a disparu

// Mode Survivor (contre-la-montre) — jauge de temps PARTAGÉE (bonne réponse = +temps, "passer" = -temps).
// PAS de choix de difficulté ni de "pace" : la difficulté est PROGRESSIVE (commune à tous), le seul réglage est le
// CHRONO DE DÉPART → un classement mondial par créneau de départ (scores comparables). Barème de temps FIXE.
const RUSH_START_MS = FAST ? 8000 : 60000; // budget de départ (repli)
const RUSH_BONUS_MS = FAST ? 4000 : 9000;  // +temps si RÉPONSE COMPLÈTE (titre ET artiste)
const RUSH_PARTIAL_MS = FAST ? 1500 : 3000; // +temps si PARTIEL (titre OU artiste seul)
const RUSH_PASS_MS  = FAST ? 3000 : 8000;  // -temps sur "passer" (fixe)
const RUSH_MAX_MS   = 90000;               // plafond de la jauge (anti-inflation)
const RUSH_REF_MS   = 10000;               // fenêtre de référence pour la prime de vitesse
const RUSH_TRACK_MAX_MS = FAST ? 3000 : 30000; // durée MAX d'un morceau : si ni trouvé ni passé, on enchaîne seul
// Difficulté PROGRESSIVE : p(n) ∈ [0,1] (0 = le plus reconnaissable → 1 = le plus obscur) pour le n-ième morceau.
// Courbe CONVEXE (exposant > 1) : démarre TRÈS facile, monte lentement puis accélère → jamais ultra-dur dès la 4e
// question, l'intérêt monte en crescendo maîtrisé. Le morceau n vient de cette tranche de recognizabilité.
const RUSH_RAMP_SCALE = 58; // vers le morceau ~59, on atteint le fond du bac (montée PLUS DOUCE : on reste grand public longtemps au début)
const RUSH_RAMP_EXP   = 1.9; // > 1 = facile longtemps puis ça grimpe (exposant relevé → début encore plus accessible)
function rushDifficulty(n) { return Math.min(1, Math.pow(Math.max(0, (n || 1) - 1) / RUSH_RAMP_SCALE, RUSH_RAMP_EXP)); }
function rushLabel(p) { return p < 0.30 ? 'Mainstream' : p < 0.55 ? 'Connaisseur' : p < 0.80 ? 'Digger' : 'Puriste'; } // libellé affiché, évolue avec p

// Difficulté = QUELS morceaux tombent (popularité via le rank Deezer), PAS la durée.
// Le son joue toujours généreusement ; offset = on démarre en plein milieu sur les niveaux durs.
const DIFFICULTY = {
  // 3 NIVEAUX (2026-07-11) : Grand public (facile, jouable avec des non-spécialistes) → Connaisseur (atteignable
  // mais pas donné) → RobMaïzi (vraiment dur, digger+underground fusionnés). `bands` = bandes de notoriété couvertes.
  facile:    { label: 'Mainstream',   tier: 'top',  bands: ['top'],         windowMs: W(30000), mult: 1.0, offset: false },
  normal:    { label: 'Connaisseur',  tier: 'high', bands: ['high'],        windowMs: W(26000), mult: 1.5, offset: false },
  puriste:   { label: 'Puriste',      tier: 'mid',  bands: ['mid', 'deep'], windowMs: W(21000), mult: 2.0, offset: true },
};
const MODES = ['multi', 'buzzer', 'quiz', 'rush'];

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

/* ------------------------------------------------------------------ */
/* Pool de morceaux (Deezer)                                           */
/* ------------------------------------------------------------------ */
let POOL = []; // pool élargi (canon variété 2026-07-11 injecté dans .pool-cache.json)
let poolIndex = new Map();       // id(string) -> track (lookup O(1) pour /api/preview)
const previewCache = new Map();  // id -> Buffer mp3 (rapatrié À LA VOLÉE quand le morceau tombe → URL stable)
const UA = { headers: { 'User-Agent': 'punchline-party-game' } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SKIT_RE = /\b(intro|outro|interlude|skit)\b/i; // on écarte les pistes non-jouables en blind-test
const DZ = 'https://api.deezer.com';
const POOL_CACHE = path.join(__dirname, '.pool-cache.json');
// Cache disque PERSISTANT des extraits mp3 (survit aux redémarrages → musique fiable même hors ligne une
// fois préchauffée) + liste des morceaux INJOUABLES (extrait Deezer mort) pour ne jamais les tirer.
const PREVIEW_DIR = path.join(__dirname, '.preview-cache');
const DEAD_FILE = path.join(__dirname, '.preview-dead.json');
try { fs.mkdirSync(PREVIEW_DIR, { recursive: true }); } catch { /* rien */ }
let DEAD = new Set();
try { const d = JSON.parse(fs.readFileSync(DEAD_FILE, 'utf8')); if (Array.isArray(d)) DEAD = new Set(d.map(String)); } catch { /* pas de liste */ }
const saveDead = () => { try { fs.writeFileSync(DEAD_FILE, JSON.stringify([...DEAD])); } catch { /* rien */ } };
const previewPath = (id) => path.join(PREVIEW_DIR, `${id}.mp3`);
const onDisk = (id) => { try { return fs.statSync(previewPath(id)).size > 2000; } catch { return false; } };
const isDead = (t) => DEAD.has(String(t.id));
const livePool = () => POOL.filter((t) => !isDead(t) && !isOffTopic(t)); // pool jouable (extraits morts + non-rap écartés)
let warm = { total: 0, done: 0, dead: 0, running: false }; // progression du préchauffage (exposée /api/health)
// tags par artiste, clés NORMALISÉES → lookup sur l'artiste Deezer (casse/accents variables)
const TAGMAP = new Map(Object.entries(ARTIST_TAGS).map(([k, v]) => [normalize(k), v]));
// v2 dans le hash : le cache stocke maintenant année + tags → on force une reconstruction quand ce format/les tags changent
const seedHash = () => crypto.createHash('md5').update('v2|' + JSON.stringify(SEED_ARTISTS) + '|' + JSON.stringify(SEED_TRACKS) + '|' + JSON.stringify(ARTIST_TAGS)).digest('hex');

// Un « hit » Deezer (search track / artist top) → notre forme de morceau. On garde l'URL Deezer d'origine
// dans .deezer et on expose .preview = notre route stable (l'extrait sera rapatrié à la volée, cf cacheTrack).
function trackFromDeezer(h, fallbackArtist = '') {
  const artist = h.artist?.name || fallbackArtist;
  const feats = extractFeats({ title: h.title, artist });
  return {
    id: h.id, title: h.title_short || h.title, artist,
    cover: h.album?.cover_medium || h.album?.cover || '', deezer: h.preview,
    preview: `/api/preview/${h.id}`, rank: h.rank || 0, feats,
    albumId: h.album?.id || null, year: 0,            // year rempli à l'enrichissement (release_date de l'album)
    tags: TAGMAP.get(normalize(artist)) || [],        // styles/ville/legend de l'artiste → filtre THÈME
  };
}
function buildPoolIndex() { poolIndex = new Map(POOL.map((t) => [String(t.id), t])); }
function refreshHosts() { for (const room of rooms.values()) { if (room.hostConnected) emitLobby(room); } }

// Cache disque du POOL (métadonnées uniquement, PAS les extraits audio) : boot instantané tant que la
// liste de graines ne change pas (< 3 j). Les extraits, eux, sont rapatriés à la volée quand ils tombent.
function readPoolCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(POOL_CACHE, 'utf8'));
    const fresh = Date.now() - (raw.builtAt || 0) < 3 * 24 * 3600 * 1000;
    if (raw.hash === seedHash() && fresh && Array.isArray(raw.tracks) && raw.tracks.length > 50) return raw.tracks;
  } catch { /* pas de cache / illisible → on reconstruit */ }
  return null;
}
function writePoolCache() {
  try { fs.writeFileSync(POOL_CACHE, JSON.stringify({ builtAt: Date.now(), hash: seedHash(), tracks: POOL })); } catch { /* disque RO → tant pis */ }
}

// Rapatrie l'extrait d'UN morceau (à la demande). Si l'URL Deezer a expiré, on redemande un extrait frais
// via /track/{id}. Renvoie true si l'extrait est en cache (donc jouable via /api/preview/:id).
// cache mémoire borné (les extraits vivent surtout sur DISQUE ; la mémoire ne garde que les récents)
function rememberBuf(id, buf) { previewCache.set(id, buf); if (previewCache.size > 500) previewCache.delete(previewCache.keys().next().value); }
async function cacheTrack(t) {
  if (!t) return false;
  const id = String(t.id);
  if (previewCache.has(id)) return true;
  if (onDisk(id)) return true;                       // déjà rapatrié sur disque (persistant) → jouable
  const dl = async (url) => {
    if (!url) return null;
    try { const r = await fetch(url, UA); if (!r.ok) return null; const b = Buffer.from(await r.arrayBuffer()); return b.length >= 2000 ? b : null; } catch { return null; }
  };
  let buf = await dl(t.deezer);
  if (!buf) { // URL périmée → on redemande un extrait frais à Deezer
    try { const jr = await fetch(`${DZ}/track/${id}`, UA); const fresh = (await jr.json())?.preview; if (fresh) { t.deezer = fresh; buf = await dl(fresh); } } catch { /* injouable */ }
  }
  if (buf) { try { fs.writeFileSync(previewPath(id), buf); } catch { /* disque RO */ } rememberBuf(id, buf); if (DEAD.delete(id)) saveDead(); return true; }
  return false;
}
// Rapatrie une liste (une playlist de partie) par petits paquets — best-effort, non bloquant pour le jeu
// (au pire /api/preview rapatriera le morceau au moment où il tombe).
async function cacheTracks(list) {
  for (let i = 0; i < list.length; i += 6) await Promise.allSettled(list.slice(i, i + 6).map(cacheTrack));
}
// PRÉCHAUFFAGE : au boot (en tâche de fond, non bloquant), on garantit TOUT le pool en cache disque et on
// écarte définitivement les extraits injouables → après le 1er préchauffage, la musique marche même hors ligne,
// survit aux redémarrages, et aucun morceau muet ne peut tomber. Relancé à chaque boot (rapide si déjà en cache).
async function prewarmPool() {
  if (FAST || warm.running || !POOL.length) return; // jamais en mode test
  const need = POOL.filter((t) => !onDisk(String(t.id)));
  warm = { total: POOL.length, done: POOL.length - need.length, dead: DEAD.size, running: true };
  if (!need.length) { warm.running = false; console.log(`[prewarm] cache disque déjà complet (${POOL.length} extraits).`); return; }
  console.log(`[prewarm] ${need.length} extraits à rapatrier (${warm.done} déjà en cache)…`);
  let deadNew = false;
  for (let i = 0; i < need.length; i += 5) {
    await Promise.allSettled(need.slice(i, i + 5).map(async (t) => {
      const id = String(t.id);
      const ok = await cacheTrack(t);
      if (!ok && !DEAD.has(id)) { DEAD.add(id); deadNew = true; }
      warm.done++;
    }));
    if (warm.done % 250 < 5) { console.log(`[prewarm] ${warm.done}/${warm.total} (${DEAD.size} injouables)`); if (deadNew) { saveDead(); deadNew = false; } }
    await sleep(180); // throttle (respecte Deezer)
  }
  if (deadNew) saveDead();
  warm.dead = DEAD.size; warm.running = false;
  console.log(`[prewarm] terminé : ${warm.total - DEAD.size} extraits en cache, ${DEAD.size} injouables écartés.`);
}

// Tout le catalogue populaire d'un artiste (top ~50 Deezer) → nos morceaux, filtrés (extrait dispo, durée
// ≥ 60 s pour éviter skits/intros, pas de titre "intro/outro/interlude/skit").
async function loadArtistCatalog(name) {
  try {
    const sr = await fetch(`${DZ}/search/artist?q=${encodeURIComponent(name)}&limit=1`, UA);
    const artist = (await sr.json())?.data?.[0];
    if (!artist?.id) return [];
    const want = normalize(name), got = normalize(artist.name || '');
    if (!got || !(got.includes(want) || want.includes(got))) return []; // garde-fou : le bon artiste
    const tr = await fetch(`${DZ}/artist/${artist.id}/top?limit=50`, UA);
    const list = (await tr.json())?.data || [];
    return list
      .filter((h) => h.preview && (h.duration || 0) >= 60 && !SKIT_RE.test(h.title || ''))
      .map((h) => trackFromDeezer(h, name));
  } catch { return []; }
}
// Résout un SEED_TRACKS précis (classique qu'on veut garantir) → notre forme.
async function resolveTrack(seed) {
  const tryFetch = async (q) => { try { const r = await fetch(`${DZ}/search?q=${encodeURIComponent(q)}&limit=4`, UA); return r.ok ? (await r.json())?.data || [] : []; } catch { return []; } };
  const want = normalize(seed.artist);
  const pick = (list) => list.find((h) => h.preview && (() => { const a = normalize(h.artist?.name || ''); return a && (a.includes(want) || want.includes(a)); })());
  let hit = pick(await tryFetch(`artist:"${seed.artist}" track:"${seed.title}"`));
  if (!hit) hit = pick(await tryFetch(`artist:"${seed.artist}" ${seed.title}`));
  return hit ? trackFromDeezer(hit, seed.artist) : null;
}

// Enrichit chaque morceau avec son ANNÉE (release_date de l'album Deezer, DÉDUPLIQUÉ par album → bien moins de
// requêtes que par titre). Coût one-time (le pool est ensuite figé sur disque). Sans année → 0 (exclu des époques).
async function enrichYears() {
  const albumIds = [...new Set(POOL.map((t) => t.albumId).filter(Boolean))];
  const year = new Map();
  const one = async (id) => {
    try { const r = await fetch(`${DZ}/album/${id}`, UA); const rd = (await r.json())?.release_date; const y = rd ? parseInt(String(rd).slice(0, 4), 10) : 0; if (y >= 1980 && y <= 2035) year.set(id, y); } catch { /* pas d'année */ }
  };
  // Deezer throttle les bursts (~50 req/s) → concurrence basse + sleep. Une 2e passe rattrape les ratés du throttling.
  const run = async (ids) => { for (let i = 0; i < ids.length; i += 5) { await Promise.allSettled(ids.slice(i, i + 5).map(one)); await sleep(190); } };
  await run(albumIds);
  const missing = albumIds.filter((id) => !year.has(id));
  if (missing.length) await run(missing);
  for (const t of POOL) t.year = year.get(t.albumId) || 0;
  return { albums: albumIds.length, dated: year.size };
}

async function loadPool() {
  // 1) Cache disque → boot instantané tant que la liste de graines ne bouge pas
  const cached = readPoolCache();
  if (cached) { POOL = cached; buildPoolIndex(); console.log(`[pool] ${POOL.length} morceaux (cache disque, extraits à la volée).`); refreshHosts(); prewarmPool(); return; }
  // 2) Construction : catalogues d'artistes (le gros du pool) + quelques classiques garantis
  console.log(`[deezer] construction du pool : ${SEED_ARTISTS.length} artistes + ${SEED_TRACKS.length} classiques…`);
  const byId = new Map();
  for (let i = 0; i < SEED_ARTISTS.length; i += 4) {
    const res = await Promise.allSettled(SEED_ARTISTS.slice(i, i + 4).map(loadArtistCatalog));
    for (const r of res) if (r.status === 'fulfilled') for (const t of r.value) if (!byId.has(t.id)) byId.set(t.id, t);
    await sleep(250);
  }
  const gotArtists = byId.size;
  for (let i = 0; i < SEED_TRACKS.length; i += 6) {
    const res = await Promise.allSettled(SEED_TRACKS.slice(i, i + 6).map(resolveTrack));
    for (const r of res) if (r.status === 'fulfilled' && r.value && !byId.has(r.value.id)) byId.set(r.value.id, r.value);
    await sleep(300);
  }
  POOL = [...byId.values()];
  buildPoolIndex();
  console.log(`[pool] ${POOL.length} morceaux (${gotArtists} via artistes + ${POOL.length - gotArtists} classiques). Datation des albums…`);
  const yr = await enrichYears(); // année par morceau (pour le filtre ÉPOQUE)
  if (POOL.length > 50) writePoolCache(); // on ne fige pas un pool anémique (réseau KO)
  console.log(`[pool] prêt · ${yr.dated}/${yr.albums} albums datés · extraits rapatriés à la volée.`);
  refreshHosts();
  prewarmPool();
}
// ÉPOQUE : sur l'ANNÉE RÉELLE du morceau (release_date), jamais l'artiste (qui traverse les décennies).
function inEra(year, era) {
  if (era === '90') return year >= 1990 && year <= 1999;
  if (era === '00') return year >= 2000 && year <= 2009;
  if (era === '10') return year >= 2010 && year <= 2019;
  if (era === '20') return year >= 2020;
  return true;
}
// THÈME : "old school" = année ≤ 2005 ; "gros feats" = morceau AVEC feat ; sinon = tag de l'artiste (style/ville/legend).
const THEME_ALIAS = { legendes: 'legend' }; // id CLIENT « legendes » → tag SERVEUR « legend » (sinon « Légendes » ne matche RIEN)
function matchTheme(t, theme) {
  theme = THEME_ALIAS[theme] || theme;
  if (theme === 'oldschool') return !!t.year && t.year <= 2005;
  if (theme === 'feats') return (t.feats || []).length > 0;
  return (t.tags || []).includes(theme);
}
// MULTI-THÈME : normalise en liste (accepte array OU string legacy ; 'all'/vide = pas de filtre).
function themeList(themes) {
  if (Array.isArray(themes)) return themes.filter((x) => x && x !== 'all');
  return (themes && themes !== 'all') ? [themes] : [];
}
// UNION (OR) : « boombap + club » = boombap OU club (agrandit le pool, ce qu'attend l'utilisateur qui coche plusieurs styles).
function matchThemes(t, themes) {
  const list = themeList(themes);
  if (!list.length) return true;
  return list.some((th) => matchTheme(t, th));
}
// MULTI-DÉCENNIE : normalise en liste (accepte array OU string legacy ; 'all'/vide = pas de filtre).
function eraList(era) {
  if (Array.isArray(era)) return era.filter((x) => x && x !== 'all');
  return (era && era !== 'all') ? [era] : [];
}
function selectPool(era, themes) {
  let s = livePool(); // exclut les extraits injouables (repérés au préchauffage) → jamais de manche muette
  const eras = eraList(era);
  if (eras.length) s = s.filter((t) => t.year && eras.some((e) => inEra(t.year, e))); // UNION des décennies cochées
  const list = themeList(themes);
  if (list.length) s = s.filter((t) => matchThemes(t, list));
  return s;
}
// « Recognizabilité » = à quel point un LAMBDA reconnaît le TITRE (pas juste l'artiste). Deux corrections au
// rank Deezer brut (= streaming ACTUEL, imparfait comme mesure de difficulté) :
//  1) ÉPOQUE : le streaming sous-cote les classiques (médianes réelles du pool : 2000s ~425k vs 2020s ~693k)
//     → IAM/NTM/Diam's « Ma France » coulaient en PURISTE alors que tout le monde les connaît. On compense par décennie.
//  2) PROFONDEUR DANS LE CATALOGUE DE L'ARTISTE : même chez un archi-connu, tout n'est pas au même niveau — on
//     trouve l'artiste mais pas forcément le titre (ex. un deep cut du 1er album d'NTM). Un titre au rank faible
//     RELATIVEMENT au plus gros titre de son artiste devient plus dur → il MONTE en difficulté (« plus c'est dip,
//     plus ça monte »). Sans ça, les artistes mainstream modernes (Booba/Ninho/Jul) tombaient TOUS en facile.
// Multiplicatif → l'ordre intra-artiste est préservé (les hits d'un artiste restent + faciles que ses cuts) et un
// mainstream reste globalement + facile qu'un inconnu (rank absolu élevé) = équitable. Validé sur .pool-cache.json :
// classiques → facile, catalogues des légendes ÉTALÉS (NTM/IAM cuts → difficile/puriste), vrais deep cuts → puriste.
let _amaxCache = null, _amaxLen = -1;
function artistPeaks() { // plus gros rank par artiste (sur TOUT le pool) → mesure la profondeur intra-catalogue
  if (_amaxCache && _amaxLen === POOL.length) return _amaxCache;
  const m = new Map();
  for (const t of POOL) if ((t.rank || 0) > (m.get(t.artist) || 0)) m.set(t.artist, t.rank || 0);
  _amaxCache = m; _amaxLen = POOL.length; return m;
}
function recoScore(t, peaks) {
  const y = t.year || 0;
  const eraMult = !y ? 1.0 : y <= 1999 ? 1.15 : y <= 2009 ? 1.12 : y <= 2019 ? 1.03 : 1.0; // prime patrimoine DOUCE (sampleBalancedByEra rééquilibre déjà les décennies) — sinon un DEEP CUT ancien remonte en facile
  const peak = (peaks && peaks.get(t.artist)) || (t.rank || 1);
  const rel = (t.rank || 0) / (peak || 1);   // 1 = le plus gros titre de l'artiste · petit = deep cut
  const depth = 0.15 + 0.85 * rel * rel;     // courbe CONVEXE : un deep cut (rel bas) plonge vraiment vers les tiers durs ; un hit (rel~1) reste en haut
  return (t.rank || 0) * eraMult * depth;
}
// ── DIFFICULTÉ PAR NOTORIÉTÉ « GRAND PUBLIC » (bandes curées + vérifiées) — remplace le rank brut, trop faux pour le facile ──
// server/difficulty-labels.json : { "artiste|titre" normalisé → 'top'|'high'|'mid'|'deep' } (facile/normal/difficile/puriste).
// Construit par jugement humain sur les VRAIS titres (radio/tubes, PAS le streaming) : facile = top ~350 par notoriété
// (streams AJUSTÉS À L'ÉPOQUE) + plafond par artiste (variété). difficulty-exclude.json : titres NON-RAP à écarter du jeu.
let DIFF_LABELS = {}, DIFF_EXCLUDE = new Set();
try { DIFF_LABELS = JSON.parse(fs.readFileSync(path.join(__dirname, 'difficulty-labels.json'), 'utf8')); } catch { DIFF_LABELS = {}; }
try { DIFF_EXCLUDE = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, 'difficulty-exclude.json'), 'utf8'))); } catch { DIFF_EXCLUDE = new Set(); }
function dnorm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)|\[.*?\]/g, '').replace(/\b(feat|ft|featuring|avec)\b\.?/g, '').replace(/,.*$/, '').replace(/[^a-z0-9]+/g, ''); }
function dkey(t) { return dnorm(t.artist) + '|' + dnorm(t.title); }
// Artistes bannis EN ENTIER (RnB / variété / parodie qui a fui via les canons) : exclusion PAR ARTISTE, robuste
// aux titres qu'on n'a pas listés (le pool vient de Deezer → impossible de tous les énumérer à la main).
const EXCLUDE_ARTISTS = new Set(['dadju', 'fatalbazooka']);
function isOffTopic(t) { return EXCLUDE_ARTISTS.has(dnorm(t.artist)) || DIFF_EXCLUDE.has(dkey(t)); } // artiste banni OU titre non-rap → jamais en jeu
function trackBand(t) { return DIFF_LABELS[dkey(t)] || 'mid'; } // hors liste (titre ajouté après) → difficile par défaut, JAMAIS facile
let _bandCache = null, _bandLen = -1;
function computeBands() { // memoïsé sur POOL.length (comme artistPeaks) — bande PRÉ-CALCULÉE + éraNorm pour l'ORDRE
  if (_bandCache && _bandLen === POOL.length) return _bandCache;
  const dec = (y) => !y ? 'x' : y < 2000 ? '90' : y < 2010 ? '00' : y < 2020 ? '10' : '20';
  const groups = {};
  for (const t of POOL) (groups[dec(t.year)] || (groups[dec(t.year)] = [])).push(t.rank || 0);
  for (const k in groups) groups[k].sort((a, b) => a - b);
  const eraPct = (y, r) => { const a = groups[dec(y)]; if (!a || !a.length) return 0.5; let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < r) lo = m + 1; else hi = m; } return lo / a.length; };
  const band = new Map(), eraNorm = new Map();
  for (const t of POOL) { eraNorm.set(t, eraPct(t.year || 0, t.rank || 0)); band.set(t, trackBand(t)); }
  _bandCache = { band, eraNorm }; _bandLen = POOL.length; return _bandCache;
}
// Sous-ensemble par DIFFICULTÉ : la bande de notoriété demandée, triée par notoriété ajustée à l'époque.
// Backfill depuis les niveaux adjacents (plus proche d'abord) si un filtre (thème rare) rend la bande trop maigre.
function tierSlice(arr, tier) {
  const { band, eraNorm } = computeBands();
  const byEra = (a, b) => (eraNorm.get(b) || 0) - (eraNorm.get(a) || 0);
  const seen = new Set(); // le pool a des ré-éditions (même titre, id différent) → une partie ne doit JAMAIS rejouer le même son
  const dedup = (list) => list.filter((t) => { const k = dnorm(t.artist) + '|' + dnorm(t.title); if (seen.has(k)) return false; seen.add(k); return true; });
  const bands = Array.isArray(tier) ? tier : [tier]; // une difficulté peut couvrir plusieurs bandes (RobMaïzi = mid+deep)
  let sel = dedup(arr.filter((t) => bands.includes(band.get(t))).sort(byEra));
  const MIN = 30; // assez pour une partie 24 manches sans que pickPlaylist ne retombe sur TOUTES les difficultés
  if (sel.length < MIN) {
    const order = ['top', 'high', 'mid', 'deep'];
    const idxs = bands.map((b) => order.indexOf(b));
    const dist = (b) => Math.min(...idxs.map((i) => Math.abs(order.indexOf(b) - i))); // distance à la bande la plus proche déjà incluse
    const near = order.filter((b) => !bands.includes(b)).sort((a, b) => dist(a) - dist(b));
    for (const nb of near) {
      sel = sel.concat(dedup(arr.filter((t) => band.get(t) === nb).sort(byEra)));
      if (sel.length >= MIN) break;
    }
  }
  return sel;
}
function poolForTier(tier) { return tierSlice(livePool(), tier); } // compat (Survivor recycle)
// ÉQUILIBRAGE DES ÉPOQUES (époque = « toutes ») : le pool est très orienté récent (mesuré : 90s 3% · 00s 15% ·
// 10s 33% · 20s 40%). On échantillonne par DÉCENNIE selon une cible « à peu près autant partout, léger surpoids
// 2010/2020 » au lieu de la répartition brute → un blind-test balaie les époques au lieu de matraquer du récent.
// Pondération DÉPENDANTE DE LA DIFFICULTÉ (bande curée). Grand public (top) veut les hits d'AUJOURD'HUI → penche
// NET récent ; Puriste/Digger assument le patrimoine (deep cuts anciens) → vrai balayage d'époques. 'x' = année inconnue.
const ERA_WEIGHT_BY_TIER = {
  top:  { '90': 0.05, '00': 0.10, '10': 0.32, '20': 0.45, 'x': 0.08 }, // Grand public : penche NET récent
  high: { '90': 0.10, '00': 0.16, '10': 0.30, '20': 0.36, 'x': 0.08 }, // Connaisseur : léger surpoids récent
  mid:  { '90': 0.16, '00': 0.22, '10': 0.28, '20': 0.26, 'x': 0.08 }, // Digger : équilibré
  deep: { '90': 0.19, '00': 0.22, '10': 0.26, '20': 0.25, 'x': 0.08 }, // Puriste : balaye tout
};
const ERA_WEIGHT = ERA_WEIGHT_BY_TIER.mid; // défaut (appels sans tier / legacy)
// Pondération d'époque quand une difficulté couvre PLUSIEURS bandes (RobMaïzi = mid+deep) → on moyenne les cibles.
function eraWeightFor(tier) {
  const bands = Array.isArray(tier) ? tier : [tier];
  if (bands.length === 1) return ERA_WEIGHT_BY_TIER[bands[0]] || ERA_WEIGHT;
  const acc = { '90': 0, '00': 0, '10': 0, '20': 0, 'x': 0 };
  for (const b of bands) { const w = ERA_WEIGHT_BY_TIER[b] || ERA_WEIGHT; for (const k in acc) acc[k] += (w[k] || 0); }
  for (const k in acc) acc[k] /= bands.length;
  return acc;
}
function eraBucket(t) { const y = t.year || 0; return !y ? 'x' : y <= 1999 ? '90' : y <= 2009 ? '00' : y <= 2019 ? '10' : '20'; }
function shuffleArr(a) { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
// Interleaving par « déficit » : à chaque tirage on prend la décennie la plus EN RETARD sur sa cible. Avantage
// clé : TOUT PRÉFIXE de la sortie respecte déjà la cible → marche pour une partie de N manches (blind test /
// buzzer) ET pour un FLUX potentiellement infini (Survivor, qui enchaîne et peut s'arrêter à tout moment).
// Plafonné par la dispo : quand une décennie rare (90s) s'épuise, les autres complètent proprement.
function sampleBalancedByEra(src, n, tier) {
  const W = eraWeightFor(tier);                                       // pondération d'époques selon la difficulté (gère les bandes multiples)
  const g = { '90': [], '00': [], '10': [], '20': [], 'x': [] };
  for (const t of src) g[eraBucket(t)].push(t);
  for (const k in g) g[k] = shuffleArr(g[k]);
  const keys = Object.keys(W);
  const totW = keys.reduce((s, k) => s + W[k], 0);
  const ptr = {}, cnt = {}; for (const k of keys) { ptr[k] = 0; cnt[k] = 0; }
  const take = Math.min(n, src.length), out = [];
  while (out.length < take) {
    let best = null, bestDef = -Infinity;
    for (const k of keys) {
      if (ptr[k] >= g[k].length) continue;                            // décennie épuisée
      const def = (out.length + 1) * (W[k] / totW) - cnt[k];          // le plus sous sa cible l'emporte
      if (def > bestDef) { bestDef = def; best = k; }
    }
    if (!best) break;
    out.push(g[best][ptr[best]++]); cnt[best]++;
  }
  return out;
}
// Tire n morceaux : ÉPOQUE + THÈME → DIFFICULTÉ → aléatoire. Repli PROGRESSIF si le combo est trop restrictif
// (on lâche d'abord la difficulté, puis époque/thème) → le jeu reste TOUJOURS jouable, jamais 0 morceau.
function pickPlaylist(n, tier, era = 'all', themes = 'all', played = null) {
  const base = selectPool(era, themes);
  const tiered = tierSlice(base, tier);
  let src;
  if (tiered.length >= n) src = tiered;              // idéal : époque + thème + difficulté
  else if (base.length >= n) src = base;             // assez en époque+thème mais pas au bon tier → on garde le filtre
  else src = tierSlice(livePool(), tier);            // filtre trop restrictif → on le lâche, on garde la difficulté
  if (src.length < Math.min(n, 3)) src = livePool(); // ultime filet (morts exclus)
  if (src.length < Math.min(n, 3)) src = POOL;       // réseau/préchauffage KO → au pire tout le pool
  // ANTI-RÉPÉTITION SALON : on écarte les titres DÉJÀ JOUÉS dans la série. Si le pool NON-JOUÉ de CETTE difficulté
  // ne suffit plus pour remplir une partie, on RECYCLE ce pool (on efface SA mémoire, pas celle des autres
  // difficultés/époques) → un son peut alors repasser une 2e fois. (Même logique que pickQuiz.)
  if (played && played.size) {
    let avail = src.filter((t) => !played.has(dkey(t)));
    if (avail.length < Math.min(n, src.length)) { for (const t of src) played.delete(dkey(t)); avail = src; }
    src = avail;
  }
  const take = Math.min(n, src.length);
  // 0 ou ≥2 décennies → rééquilibrage PONDÉRÉ PAR DIFFICULTÉ (balaye les époques sélectionnées) ; 1 seule décennie → simple shuffle
  return eraList(era).length === 1 ? shuffleArr(src).slice(0, take) : sampleBalancedByEra(src, take, tier);
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
    gamesPlayed: 0, lastFinal: null, usedQuiz: new Set(), playedTracks: new Set(),
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
    s.round = { mode: 'rush', trackNo: room.rushIndex + 1, endsAt: room.rushEndsAt, rushMax: room.rushMaxMs || RUSH_MAX_MS, passMs: room.rushPassMs, bonusMs: room.rushBonusMs, difficulty: room.diffLabel, scores: rushBoard(room), rushPlayerId: room.rushPlayerId, rushPlayerName: room.rushPlayerId ? (room.players.get(room.rushPlayerId)?.name || '') : '' };
    if (isHost && room.current) Object.assign(s.round, { preview: room.current.preview, startAt: 0 });
  } else if (room.phase === 'playing' && room.current) {
    s.round = { index: room.roundIndex, roundIndex: room.roundIndex, total: room.totalRounds, endsAt: room.roundEndsAt, durationMs: room.windowMs, mode: room.settings.mode, difficulty: room.diffLabel, mj: room.settings.mj };
    if (room.settings.mode === 'quiz' && room.quiz) {
      s.round.quiz = isHost ? room.quiz : { id: room.quiz.id, cat: room.quiz.cat, q: room.quiz.q, choices: room.quiz.choices };
    } else {
      if (isHost) Object.assign(s.round, { preview: room.current.preview, startAt: room.startAt });
      if (room.settings.mode === 'buzzer') s.buzz = { winnerId: room.buzz.winnerId, winnerName: room.buzz.winnerName, winnerAvatar: room.buzz.winnerId ? (room.players.get(room.buzz.winnerId)?.avatar || null) : null, open: room.buzz.open, lockedOut: [...room.buzz.lockedOut], endsAt: room.buzz.endsAt || 0, answerMs: BUZZ_ANSWER_MS };
    }
  } else if (room.phase === 'prep') {
    s.round = { index: room.roundIndex, roundIndex: room.roundIndex, total: room.totalRounds, endsAt: room.prepEndsAt, mode: room.settings.mode, difficulty: (DIFFICULTY[room.settings.difficulty] || DIFFICULTY.normal).label, prep: true };
  } else if (room.phase === 'reveal') {
    s.reveal = room.lastReveal;
  } else if (room.phase === 'final') {
    s.final = room.lastFinal || { scores: publicPlayers(room) };
  } else if (room.phase === 'rushend') {
    s.rushEnd = room.lastRushEnd;
  } else if (typeof room.phase === 'string' && room.phase.startsWith('battle') && room.battle) {
    // reconnexion en pleine manche CLASH : on renvoie de quoi restaurer l'écran (a/b viennent seulement d'ici)
    const P = (id) => { const p = room.players.get(id); return p ? { id: p.id, name: p.name, avatar: p.avatar, score: p.score } : null; };
    s.battle = { a: P(room.battle.a), b: P(room.battle.b), flavor: room.battle.flavor, endsAt: room.battle.endsAt, betBonus: BATTLE_BET_BONUS, win: BATTLE_WIN };
    if (room.phase === 'battle-reveal') s.battle.reveal = room.lastBattleReveal || null;
    if (isHost && room.phase === 'battle-play' && room.battle.track) Object.assign(s.battle, { preview: room.battle.track.preview, startAt: 0, durationMs: BATTLE_PLAY_MS, sp: { title: room.battle.track.title, artist: room.battle.track.artist } });
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* Boucle de jeu                                                       */
/* ------------------------------------------------------------------ */
// Un pouvoir PEUT-IL agir maintenant ? (miroir des gardes d'activation) → sert à GRISER le bouton côté joueur.
function canPowerAct(room, p, pw) {
  if (!pw) return false;
  const prot = (x) => !!x.safety || !!x.shield || (x.veteranUntil != null && room.roundIndex <= x.veteranUntil);
  const others = () => [...room.players.values()].filter((x) => x.id !== p.id && x.connected && !x.isMJ && !x.waiting);
  const attackable = () => others().filter((x) => !prot(x));
  switch (pw.type) {
    case 'steal': { if (pw.shield) return true; const t = attackable().sort((a, b) => b.score - a.score)[0]; return !!(t && t.score > p.score && t.score > 0); }
    case 'sabotage': return attackable().length > 0;
    case 'tax': return attackable().some((x) => x.score > 0);
    case 'comeback': { const lead = others().sort((a, b) => b.score - a.score)[0]; return !!(lead && lead.score - p.score >= 2000); }
    case 'draft': return others().length > 0;
    case 'jam': return !room.jam;
    default: return true; // double/bonus/hint/safety/veteran/momentum/decay/firstblood/freeze/nofault/ace/wager/allin/combo/sustain : pas de cible requise
  }
}
function powerIneligibleReason(pw) {
  switch (pw && pw.type) {
    case 'steal': return 'Personne à voler pour l\'instant';
    case 'sabotage': return 'Aucune cible (meneurs blindés)';
    case 'tax': return 'Personne à taxer';
    case 'comeback': return 'Tu n\'es pas assez à la traîne';
    case 'draft': return 'Aucun adversaire';
    case 'jam': return 'Déjà brouillé ce tour';
    default: return 'Sans effet ce tour';
  }
}
function beginRound(room) {
  // le morceau est choisi MAINTENANT (avant la fenêtre pouvoirs → le hint peut révéler ses lettres)
  room.current = room.playlist[room.roundIndex];
  if (room.settings.mode !== 'quiz') { cacheTrack(room.current); cacheTrack(room.playlist[room.roundIndex + 1]); } // extrait de la manche + la suivante, prêts avant la lecture
  if (room.settings.mode !== 'quiz' && room.current) (room.playedTracks || (room.playedTracks = new Set())).add(dkey(room.current)); // mémorise le son JOUÉ → anti-répétition entre parties du salon
  room.muted = new Set(); room.mutedBy = new Map(); room.mutedDenied = new Map(); // qui a muselé qui + points RÉELLEMENT refusés (trophée braqueur)
  room.ready = new Set();
  room.firstScorerId = null; // 1er à trouver cette manche (pour firstblood)
  room.jam = null;           // brouillage (pouvoir jam) posé pour cette manche
  room.roundPowers = new Map(); // pouvoirs activés cette manche (pid → {name,type,note}) → affichés au reveal
  room.powerHits = new Map();   // victimes de vol/sabotage/tax cette manche (pid → [{by,byAvatar,type,amount}]) → anim au reveal
  for (const pl of room.players.values()) { pl.armed = null; pl.safety = false; pl.nofault = false; pl.selfBonus = 0; } // veteranUntil / streak / decayUses persistent
  clearTimeout(room.cdTimer);
  const diffLabel = (DIFFICULTY[room.settings.difficulty] || DIFFICULTY.normal).label;
  // Fenêtre d'activation des pouvoirs AVANT la musique (sinon on active en connaissant déjà la réponse).
  // PAS à la manche 1 : sans classement établi, les pouvoirs anti-leader n'ont aucune cible → on n'ouvre
  // la fenêtre qu'à partir de la manche 2 (après au moins une question jouée).
  const powerPhase = room.settings.mode === 'multi' && !room.settings.mj && room.roundIndex >= 1; // pouvoirs UNIQUEMENT en Blind Test auto (jamais Buzzer/Quiz/MJ/Survivor/Clash)
  if (powerPhase) {
    room.phase = 'prep';
    const seconds = FAST ? 2 : 10;
    room.prepEndsAt = Date.now() + seconds * 1000;
    const info = { index: room.roundIndex, total: room.totalRounds, endsAt: room.prepEndsAt, seconds, serverNow: Date.now(), mode: room.settings.mode, difficulty: diffLabel };
    io.to(room.code).emit('round:prep', info);
    io.to(room.hostId).emit('round:prep', info);
    // éligibilité PAR JOUEUR (grisage du bouton) : un pouvoir sans cible ne doit pas se gaspiller
    for (const pl of room.players.values()) {
      if (pl.socketId && !pl.isMJ && !pl.waiting) {
        const pw = POWERS[pl.avatar]; const ok = canPowerAct(room, pl, pw);
        io.to(pl.socketId).emit('power:eligible', { eligible: ok, reason: ok ? '' : powerIneligibleReason(pw) });
      }
    }
    // fin de la fenêtre pouvoirs → DÉCOMPTE ~3 s avant la musique : l'hôte PRÉCHARGE l'extrait et le scratch
    // du dernier pouvoir a le temps de finir (plus de débordement sur le début de la manche ni de son en retard)
    room.cdTimer = setTimeout(() => startCountdown(room), seconds * 1000);
  } else {
    // quiz / Maître du jeu / Buzzer / manche 1 : pas de fenêtre pouvoirs → décompte direct.
    // On PRÉCHARGE quand même l'extrait (sauf quiz = sans musique) → le son ne démarre plus en retard
    // au 1er tour d'un Blind Test, en Maître du jeu ou en Buzzer (retour showroom tv-playing 15:05).
    room.phase = 'countdown';
    const seconds = FAST ? 1 : 5;
    const preload = room.settings.mode !== 'quiz' ? (room.current?.preview || '') : '';
    io.to(room.hostId).emit('round:countdown', { seconds, index: room.roundIndex, total: room.totalRounds, preload });
    io.to(room.code).emit('round:countdown', { seconds });
    room.cdTimer = setTimeout(() => startRound(room), seconds * 1000);
  }
}

// La fenêtre pouvoirs va TOUJOURS jusqu'au bout de ses 10 s, même si tout le monde est prêt : on a le
// temps de LIRE qui a lancé quel pouvoir (et son effet) sur la TV. (Avant : elle se fermait d'un coup.)
function checkPrepDone(_room) { /* no-op volontaire — le décompte complet est conservé */ }

// DÉCOMPTE ~3 s AVANT la musique (Blind Test multi, APRÈS la fenêtre pouvoirs). Deux buts : (1) laisser l'hôte
// PRÉCHARGER l'extrait (URL envoyée dans 'preload' → mis en cache navigateur avant lecture, plus de son qui met
// ~5 s à démarrer) ; (2) donner au scratch du dernier pouvoir le temps de finir avant que la musique parte
// (plus de scratch qui déborde sur le début de la manche). Buzzer/Quiz/MJ gardent leur décompte direct via beginRound.
function startCountdown(room) {
  if (room.phase !== 'prep' && room.phase !== 'countdown') return; // annulé (salon fermé / restart pendant la fenêtre)
  room.phase = 'countdown';
  clearTimeout(room.cdTimer);
  const seconds = FAST ? 1 : 3;
  io.to(room.hostId).emit('round:countdown', { seconds, index: room.roundIndex, total: room.totalRounds, preload: room.current?.preview || '' });
  io.to(room.code).emit('round:countdown', { seconds });
  room.cdTimer = setTimeout(() => startRound(room), seconds * 1000);
}

function startRound(room) {
  if (room.phase !== 'countdown' && room.phase !== 'prep') return; // annulé pendant décompte / fenêtre pouvoirs
  room.phase = 'playing';
  room.suspense = suspenseActive(room); // manche de fin serrée → on masquera le score en direct + à la révélation
  room.current = room.playlist[room.roundIndex];
  room.answers = new Map();
  room.buzz = { winnerId: null, winnerName: null, open: true, lockedOut: new Set(), endsAt: 0 };
  room.roundRemainingMs = null; room.hardRemainingMs = null; // invariant : pas de temps restant/plafond périmé au démarrage d'une manche (buzzer)
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
  room.roundStartAt = Date.now(); // vrai début de manche (fixe) : sert la fenêtre de brouillage, indépendant du décalage buzzer
  room.roundEndsAt = Date.now() + diff.windowMs;

  const base = { index: room.roundIndex, total: room.totalRounds, endsAt: room.roundEndsAt, durationMs: diff.windowMs, serverNow: Date.now(), mode: room.settings.mode, difficulty: diff.label, mj: room.settings.mj, suspense: room.suspense, jam: room.jam ? { by: room.jam.by, ms: room.jam.ms } : null };
  // sp = titre/artiste envoyés À L'HÔTE SEUL (jamais aux joueurs) pour résoudre le morceau sur Spotify.
  // L'hôte joue déjà le son (= la réponse) → aucune fuite ; les joueurs ne reçoivent que round:go.
  io.to(room.hostId).emit('round:host', { ...base, preview: room.current.preview, startAt: room.startAt, sp: { title: room.current.title, artist: room.current.artist } });
  io.to(room.code).emit('round:go', base);
  // le Maître du jeu voit la réponse (lui seul) pour arbitrer à la voix
  if (room.mjId) { const a = room.players.get(room.mjId); if (a?.socketId) io.to(a.socketId).emit('mj:track', { title: room.current.title, artist: room.current.artist, cover: room.current.cover }); }
  clearTimeout(room.timer);
  room.timer = setTimeout(() => endRound(room), diff.windowMs);
  if (room.settings.mode === 'buzzer') { clearTimeout(room.hardTimer); room.hardEndsAt = Date.now() + BUZZ_ROUND_MAX_MS; room.hardTimer = setTimeout(() => { if (room.phase === 'playing') endRound(room); }, BUZZ_ROUND_MAX_MS); } // plafond absolu du TEMPS D'ÉCOUTE (mis en pause pendant qu'un joueur répond, comme la musique) → borne les boucles buzz/rate sans tronquer la fenêtre de réponse
}

// Remplit la jauge de pouvoir de chaque joueur en fin de manche selon la règle choisie
function fillCharges(room) {
  if (room.settings.mode !== 'multi' || room.settings.mj) return; // jauge de charges seulement en Blind Test auto (pas Buzzer/Quiz/MJ)
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
    while (p.charge >= 100 && (p.charges || 0) < 3) { p.charges = (p.charges || 0) + 1; p.charge -= 100; }
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
  clearTimeout(room.hardTimer);
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
      p.armed = null; p.safety = false; p.shield = false; p.nofault = false; p.selfBonus = 0; p.draftFrac = 0; // les pouvoirs de manche expirent
      p.streak = points > 0 ? (p.streak || 0) + 1 : 0;             // série de bonnes manches (momentum)
    }
    // stats de partie (trophées de fin) — le MJ n'est pas noté
    if (!p.isMJ && p.stat) {
      if (points > 0) {
        p.stat.scored++; roundScorers.push(p.id);
        const yr = room.settings.mode !== 'quiz' ? (room.current?.year || 0) : 0; // année du son reconnu → trophées « À l'ancienne » / « La Relève »
        if (yr > 0) { p.stat.datedFinds++; if (yr < 2010) p.stat.oldFinds++; else if (yr >= 2020) p.stat.newFinds++; }
      } else p.stat.zeros++;
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
    results.push({ id: p.id, name: p.name, avatar: p.avatar, isMJ: !!p.isMJ, points, titleHit, artistHit, answer: answerText, tried: !!ansEntry, power: usedPower || null, hitBy: (room.powerHits && room.powerHits.get(p.id)) || null });
  }
  if (roundScorers.length === 1) { const w = room.players.get(roundScorers[0]); if (w?.stat) w.stat.solo++; } // seul à trouver cette manche
  // braqueur : crédite le musellement (sabotage) qui a RÉELLEMENT refusé des points à un adversaire cette manche
  for (const [tid, denied] of (room.mutedDenied || new Map())) { const mid = room.mutedBy?.get(tid); const mp = mid && room.players.get(mid); if (mp?.stat && denied > 0) mp.stat.denialGain += denied; }
  results.sort((a, b) => b.points - a.points);
  fillCharges(room);
  // delta de rang (monte/descend) vs la manche précédente + pire rang atteint (comeback)
  const ranked = [...room.players.values()].filter((p) => !p.isMJ && !p.waiting).sort((a, b) => b.score - a.score);
  const newRank = new Map(); const bottomCut = Math.ceil(ranked.length * 0.7); ranked.forEach((p, i) => { newRank.set(p.id, i); if (p.stat) { p.stat.worstRank = Math.max(p.stat.worstRank || 1, i + 1); if (i + 1 >= bottomCut) p.stat.lowRounds = (p.stat.lowRounds || 0) + 1; } }); // lowRounds = manches PASSÉES au fond (comeback = remontée DURABLE, pas un simple creux d'une manche)
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

function advanceRound(room) { // avance RÉELLEMENT à la manche suivante (ou fin)
  if (room.roundIndex + 1 < room.totalRounds) { room.roundIndex += 1; beginRound(room); }
  else finishGame(room);
}
function nextRound(room) {
  const duel = pickBattleDuelists(room);          // parfois : un CLASH bonus s'intercale (pas de manche consommée)
  if (duel) { startBattle(room, duel.a, duel.b, duel.flavor); return; }
  advanceRound(room);
}

/* ------------------------------------------------------------------ */
/* Manche BATTLE — clash 1v1 généré par le jeu, avec paris des autres  */
/* ------------------------------------------------------------------ */
// Choisit 2 duellistes à un BON moment (récompense imprévisible) — ou null si pas de clash cette fois.
// force=true (dev/test) : ignore le hasard/timing, prend le top 2.
function pickBattleDuelists(room, force = false) {
  if (room.settings.mode !== 'multi' && room.settings.mode !== 'buzzer') return null; // modes audio only
  if (room.settings.mj) return null;                                                  // pas d'événement auto en MJ
  const act = [...room.players.values()].filter((p) => p.connected && !p.isMJ && !p.waiting).sort((a, b) => b.score - a.score);
  if (act.length < 3) return null;                                                     // JAMAIS de clash à < 3 actifs (2 duellistes + ≥1 parieur)
  if (force) return { a: act[0].id, b: act[1].id, flavor: 'sommet' };                  // dev/test : top 2, ignore le timing
  if (!BATTLE_AUTO) return null;                                                       // interrupteur global
  if ((room.battlesThisGame || 0) >= 1) return null;                                   // EXACTEMENT UN clash par partie
  const total = room.totalRounds || 16;
  if (total < 4) return null;                                                          // partie trop courte pour intercaler un clash
  const triggerAt = Math.min(total - 2, Math.floor(total / 2));                        // ~milieu de partie, en gardant ≥1 manche après
  if (room.roundIndex < triggerAt) return null;                                        // pas encore le moment
  if (room.roundIndex >= total - 1) return null;                                       // jamais à la dernière manche
  // 1re occasion atteinte AVEC ≥3 joueurs → on lance (sinon ça glisse jusqu'à total-2).
  const gapTop = act[0].score - act[1].score;
  if (gapTop <= 45000) return { a: act[0].id, b: act[1].id, flavor: 'sommet' };        // haut du tableau serré = duel au sommet
  return { a: act[act.length - 2].id, b: act[act.length - 1].id, flavor: 'rattrapage' }; // sinon : les 2 derniers (chance de remontée)
}

function startBattle(room, aId, bId, flavor) {
  clearTimeout(room.timer); clearTimeout(room.buzzTimer); clearTimeout(room.cdTimer);
  const A = room.players.get(aId), B = room.players.get(bId);
  if (!A || !B) { advanceRound(room); return; }
  room.battlesThisGame = (room.battlesThisGame || 0) + 1;
  room.lastBattleRound = room.roundIndex;
  room.battle = { a: aId, b: bId, flavor, bets: new Map(), winnerId: null, points: 0, track: null, endsAt: 0 };
  room.phase = 'battle-intro';
  const pinfo = (p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score });
  io.to(room.code).emit('battle:intro', { a: pinfo(A), b: pinfo(B), flavor, betBonus: BATTLE_BET_BONUS, win: BATTLE_WIN });
  room.cdTimer = setTimeout(() => startBattleBets(room), BATTLE_INTRO_MS);
}

function startBattleBets(room) {
  if (room.phase !== 'battle-intro' || !room.battle) return;
  room.phase = 'battle-bet';
  room.battle.endsAt = Date.now() + BATTLE_BET_MS;
  io.to(room.code).emit('battle:bets', { a: room.battle.a, b: room.battle.b, endsAt: room.battle.endsAt, betMs: BATTLE_BET_MS });
  room.cdTimer = setTimeout(() => startBattlePlay(room), BATTLE_BET_MS);
}

function startBattlePlay(room) {
  if (room.phase !== 'battle-bet' || !room.battle) return;
  const diff = DIFFICULTY[room.settings.difficulty] || DIFFICULTY.normal;
  const t = (pickPlaylist(1, diff.bands, room.settings.era, room.settings.themes) || [])[0];
  if (!t) { endBattle(room, null); return; }
  cacheTrack(t);
  room.battle.track = t;
  room.mult = diff.mult;
  room.phase = 'battle-play';
  const maxOffset = Math.max(0, PREVIEW_MS - BATTLE_PLAY_MS - 1000);
  const startAt = diff.offset ? Math.floor(Math.random() * Math.min(14000, maxOffset)) : 0;
  room.battle.endsAt = Date.now() + BATTLE_PLAY_MS;
  const base = { a: room.battle.a, b: room.battle.b, endsAt: room.battle.endsAt, durationMs: BATTLE_PLAY_MS };
  io.to(room.hostId).emit('battle:go', { ...base, preview: t.preview, startAt, sp: { title: t.title, artist: t.artist } });
  io.to(room.code).emit('battle:go', base);
  clearTimeout(room.timer);
  room.timer = setTimeout(() => endBattle(room, null), BATTLE_PLAY_MS);
}

function endBattle(room, winnerId) {
  if (!room.battle || !room.phase?.startsWith('battle')) return;
  clearTimeout(room.timer); clearTimeout(room.cdTimer);
  const b = room.battle;
  b.winnerId = winnerId; b.points = winnerId ? BATTLE_WIN : 0;
  const betResults = [];
  if (winnerId) {
    const w = room.players.get(winnerId);
    if (w) w.score = Math.max(0, w.score + BATTLE_WIN);
    const winSide = winnerId === b.a ? 'a' : 'b';
    for (const [sid, pick] of b.bets) {
      const sp = room.players.get(sid); const won = pick === winSide;
      if (sp && won) sp.score += BATTLE_BET_BONUS;
      betResults.push({ id: sid, won });
    }
  } else {
    for (const id of [b.a, b.b]) { const p = room.players.get(id); if (p) p.score += BATTLE_DRAW; } // nul → consolation, paris annulés
  }
  room.phase = 'battle-reveal';
  const nm = (id) => room.players.get(id)?.name || '';
  const payload = {
    winnerId, winnerName: winnerId ? nm(winnerId) : null, points: b.points, draw: !winnerId,
    a: b.a, b: b.b, betBonus: BATTLE_BET_BONUS, bets: betResults,
    track: b.track ? { title: b.track.title, artist: b.track.artist, cover: b.track.cover } : null,
    scores: publicPlayers(room),
  };
  room.lastBattleReveal = payload; // mémorisé pour la reconnexion pendant la révélation du clash
  io.to(room.code).emit('battle:reveal', payload);
}

// Fin d'une partie : on fige le classement, on cumule dans la SÉRIE (total d'auditeurs + parties gagnées)
// et on décerne les trophées (façon TowerFall).
function finishGame(room) {
  room.phase = 'final';
  clearTimeout(room.timer); clearTimeout(room.buzzTimer); clearTimeout(room.cdTimer);
  room.replayVotes = new Map(); // vote de rejeu (fin de partie) : ardoise vierge à chaque fin
  const active = [...room.players.values()].filter((p) => !p.isMJ && !p.waiting);
  // cumul dans la série
  active.forEach((p) => { p.total = (p.total || 0) + p.score; p.totalRounds = (p.totalRounds || 0) + room.totalRounds; });
  const winner = [...active].sort((a, b) => b.score - a.score)[0];
  if (winner && winner.score > 0) winner.gameWins = (winner.gameWins || 0) + 1;
  room.gamesPlayed = (room.gamesPlayed || 0) + 1;
  // trophées de la partie qui vient de se finir
  const plYears = (room.playlist || []).map((t) => t?.year || 0).filter(Boolean);
  room.awardCounts = room.awardCounts || {};
  room.awardLog = room.awardLog || []; // ids des dernières parties (la + récente en tête) → rotation par récence
  const rawAwards = computeAwards(active, {
    total: room.totalRounds, mode: room.settings.mode, mj: room.settings.mj, fmt: fmtAud,
    recentGames: room.awardLog, counts: room.awardCounts,                              // rotation (récence) + couverture (jamais-vu)
    hadModern: plYears.some((y) => y >= 2010), hadOld: plYears.some((y) => y < 2010),   // « À l'ancienne » / « La Relève » : n'a de sens que si l'autre époque était jouable
  });
  for (const a of rawAwards) room.awardCounts[a.id] = (room.awardCounts[a.id] || 0) + 1; // tally cumulé sur la série (couverture)
  room.awardLog = [rawAwards.map((a) => a.id), ...room.awardLog].slice(0, 6); // fenêtre glissante des 6 dernières parties
  const awards = rawAwards.map((a) => { const pl = room.players.get(a.playerId); return { ...a, playerName: pl?.name || '', avatar: pl?.avatar || null }; });
  // classement général de la série (cumul de toutes les parties)
  const standings = active
    .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, total: p.total || 0, gameWins: p.gameWins || 0, totalRounds: p.totalRounds || 0 }))
    .sort((a, b) => b.total - a.total);
  const payload = { scores: publicPlayers(room), rounds: room.totalRounds, awards, settings: { difficulty: room.settings.difficulty, mode: room.settings.mode, mj: room.settings.mj, rounds: room.totalRounds }, series: { gamesPlayed: room.gamesPlayed, standings, leaderId: standings[0]?.id || null } };
  room.lastFinal = payload;
  io.to(room.code).emit('game:final', payload);
}

/* ------------------------------------------------------------------ */
/* Mode Survivor (contre-la-montre) — jauge de temps partagée            */
/* ------------------------------------------------------------------ */
function rushBoard(room) {
  return [...room.players.values()].filter((p) => !p.waiting)
    .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.rushScore || 0, tracks: p.rushTracks || 0 }))
    .sort((a, b) => b.score - a.score);
}
function rushRankedPool(room) { // pool trié GRAND PUBLIC → puriste (mêmes BANDES curées que les autres modes), filtré époque/thème
  const { band, eraNorm } = computeBands();
  const ord = { top: 0, high: 1, mid: 2, deep: 3 };
  const rank = (arr) => arr.slice().sort((a, b) => ((ord[band.get(a)] ?? 2) - (ord[band.get(b)] ?? 2)) || ((eraNorm.get(b) || 0) - (eraNorm.get(a) || 0)));
  let s = rank(selectPool(room.settings.era, room.settings.themes));
  if (s.length < 20) s = rank(livePool()); // filtre trop restrictif → tout le pool jouable
  return s;
}
function rushPickTrack(room, n) { // un morceau de la tranche de difficulté du moment (fenêtre glissante sur le pool trié)
  const ranked = room.rushRanked, M = ranked.length; if (!M) return { track: null, p: 0 };
  const p = rushDifficulty(n);
  const center = Math.round(p * (M - 1));
  // Fenêtre qui S'ÉLARGIT avec la difficulté : minuscule au démarrage (collée au sommet du bac trié),
  // large seulement quand p monte → un son dur ne peut PAS tomber dans les toutes premières manches.
  const half = Math.max(3, Math.round(M * (0.015 + 0.09 * p)));
  let lo = Math.max(0, center - half), hi = Math.min(M, center + half + 1);
  // GARANTIE grand public : les ~5 premiers morceaux restent dans la bande 'top', les 6-8 en 'top'+'high'
  // (bornes pré-calculées dans startRush), quel que soit le hasard. Rampe douce reprise ensuite.
  const cap = n <= 5 ? Math.max(8, room.rushTopEnd || 0)
            : n <= 8 ? Math.max(room.rushTopEnd || 0, room.rushHighEnd || 0)
            : M;
  if (cap && hi > cap) { hi = Math.min(hi, cap); lo = Math.min(lo, Math.max(0, hi - 1)); }
  const fresh = []; for (let i = lo; i < hi; i++) if (!room.rushUsed.has(ranked[i].id)) fresh.push(ranked[i]);
  const cand = fresh.length ? fresh : ranked.slice(lo, hi); // fenêtre épuisée (run très long) → on ré-autorise
  const track = cand[Math.floor(Math.random() * cand.length)] || ranked[center];
  if (track) room.rushUsed.add(track.id);
  return { track, p };
}
function rushSetTrack(room, evt = {}) {
  room.rushTrackNo = (room.rushTrackNo || 0) + 1;
  const { track, p } = rushPickTrack(room, room.rushTrackNo);
  if (!track) return endRush(room);
  room.current = track;              // pour /api/dev/answer + le grade
  room.mult = 1 + p;                 // 1.0 (facile) → 2.0 (le + dur) : les morceaux durs rapportent plus (récompense la survie)
  room.rushTrackStartAt = Date.now();
  cacheTrack(track);                 // rapatrie l'extrait du morceau courant
  clearTimeout(room.rushTrackTimer); // auto-enchaînement si ni trouvé ni passé (jamais bloqué sur un son)
  const noAtSet = room.rushTrackNo;
  room.rushTrackTimer = setTimeout(() => { if (room.phase === 'playing' && room.settings.mode === 'rush' && room.rushTrackNo === noAtSet) rushAdvance(room, { reason: 'timeout' }); }, RUSH_TRACK_MAX_MS);
  const common = { mode: 'rush', trackNo: room.rushTrackNo, endsAt: room.rushEndsAt, rushMax: room.rushMaxMs || RUSH_MAX_MS, passMs: room.rushPassMs, bonusMs: room.rushBonusMs, difficulty: rushLabel(p), diffP: Math.round(p * 100) / 100, scores: rushBoard(room), rushPlayerId: room.rushPlayerId, rushPlayerName: room.rushPlayerId ? (room.players.get(room.rushPlayerId)?.name || '') : '', event: evt };
  io.to(room.hostId).emit('rush:host', { ...common, preview: track.preview, startAt: 0, sp: { title: track.title, artist: track.artist } }); // l'hôte joue le son
  io.to(room.code).emit('rush:state', common); // les joueurs : chrono + score + difficulté du moment, pas d'audio
}
function rushAdvance(room, evt) { room.rushResolving = false; rushSetTrack(room, evt); }
function rushApplyDelta(room, deltaMs) {
  room.rushEndsAt = Math.min(Date.now() + (room.rushMaxMs || RUSH_MAX_MS), room.rushEndsAt + deltaMs);
  clearTimeout(room.rushTimer);
  const left = room.rushEndsAt - Date.now();
  if (left <= 0) return endRush(room);
  room.rushTimer = setTimeout(() => endRush(room), left);
}
function startRush(room) {
  room.phase = 'playing';
  room.rushBonusMs = RUSH_BONUS_MS; room.rushPartialMs = RUSH_PARTIAL_MS; room.rushPassMs = RUSH_PASS_MS; // barème FIXE (plus de pace)
  // Survivor = SOLO : un seul joueur joue. Celui désigné par l'hôte, sinon le 1er connecté.
  room.rushPlayerId = room.settings.rushPlayerId || ([...room.players.values()].find((p) => p.connected && !p.waiting) || [...room.players.values()][0])?.id || null;
  const startMs = FAST ? RUSH_START_MS : (room.settings.rushStartSec || 60) * 1000; // chrono de départ choisi
  room.rushMaxMs = FAST ? RUSH_MAX_MS : Math.max(RUSH_MAX_MS, startMs + 30000);
  room.rushRanked = rushRankedPool(room); room.rushUsed = new Set(); room.rushTrackNo = 0; // difficulté PROGRESSIVE
  { const { band } = computeBands(); const R = room.rushRanked; // bornes de bandes → garantie grand public au démarrage
    let te = 0; while (te < R.length && band.get(R[te]) === 'top') te++;
    let he = te; while (he < R.length && band.get(R[he]) === 'high') he++;
    room.rushTopEnd = te; room.rushHighEnd = he; }
  room.rushEndsAt = Date.now() + startMs;
  room.rushResolving = false;
  for (const p of room.players.values()) { p.rushScore = 0; p.rushTracks = 0; }
  clearTimeout(room.rushTimer);
  room.rushTimer = setTimeout(() => endRush(room), startMs);
  rushSetTrack(room, { reason: 'start' });
}
function endRush(room) {
  clearTimeout(room.rushTimer);
  clearTimeout(room.rushTrackTimer);
  if (room.phase !== 'playing') return;
  room.phase = 'rushend';
  const cfg = { startSec: room.settings.rushStartSec || 60 }; // SEULE config : le créneau de départ
  const players = [...room.players.values()].filter((p) => !p.waiting);
  const scorers = room.rushPlayerId ? players.filter((p) => p.id === room.rushPlayerId) : players; // 1 seul joueur désigné joue (sinon tous, compat)
  const results = scorers.map((p) => {
    const placed = addScore({ name: p.name, avatar: p.avatar, score: p.rushScore || 0, tracks: p.rushTracks || 0, ...cfg });
    return { id: p.id, name: p.name, avatar: p.avatar, score: p.rushScore || 0, tracks: p.rushTracks || 0, rank: placed.rank, configTotal: placed.configTotal };
  }).sort((a, b) => b.score - a.score);
  const payload = { results, top: getTop(10, cfg), config: cfg }; // top du MÊME créneau → comparable
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

  // Un joueur quitte le salon de lui-même → on le retire (libère son rappeur) et on rafraîchit le lobby.
  socket.on('player:leave', (_p, cb) => {
    const room = rooms.get(socket.data?.roomCode);
    const pid = socket.data?.playerId;
    if (room && pid) {
      room.players.delete(pid);
      socket.leave(room.code);
      emitLobby(room);
    }
    socket.data = { roomCode: null, role: null, playerId: null };
    cb?.({ ok: true });
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

  socket.on('host:start', (args = {}, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return cb?.({ error: 'Non autorisé.' });
    startGame(room, args, cb);
  });
  // Démarre/relance une partie. Utilisé par host:start ET par le vote de rejeu unanime (player:replayVote).
  // Les réglages sont mémorisés dans room.lastStartArgs → une relance rejoue exactement la même config.
  function startGame(room, { rounds, difficulty, mode, mj, mjId, rebalance, era, theme, themes, rushStartSec, rushPace, quizNoVf, rushPlayerId } = {}, cb) {
    room.lastStartArgs = { rounds, difficulty, mode, mj, mjId, rebalance, era, theme, themes, rushStartSec, rushPace, quizNoVf, rushPlayerId };
    const wantMode = MODES.includes(mode) ? mode : 'multi';
    const isQuiz = wantMode === 'quiz';
    // MJ = uniquement le Blind Test (multi). Quiz/Survivor = objectifs ; Buzzer = 100% auto (buzz puis saisie notée seule).
  const useMj = !!mj && wantMode === 'multi';
    if (!isQuiz && !POOL.length) return cb?.({ error: 'Aucun morceau disponible (réseau ?).' });
    if (room.players.size < 1) return cb?.({ error: 'Il faut au moins un joueur.' });
    if (useMj && room.players.size < 2) return cb?.({ error: 'Le mode Maître du jeu demande au moins 2 joueurs (1 anime, 1 joue).' });
    room.settings = {
      difficulty: DIFFICULTY[difficulty] ? difficulty : 'normal',
      mode: wantMode,
      mj: useMj,
      rebalance: ['comeback', 'snowball', 'off'].includes(rebalance) ? rebalance : 'comeback',
      era: eraList(era).length ? eraList(era) : 'all',     // ÉPOQUE(S) — multi-décennie (array) ou 'all' ; filtre le pool musical
      themes: themeList(themes !== undefined ? themes : theme), // THÈMES/STYLES (multi, union) — array ; rétro-compat string `theme`
      rushStartSec: Math.min(180, Math.max(30, (rushStartSec | 0) || 60)), // Survivor : SEUL réglage = chrono de départ (difficulté progressive)
      quizNoVf: !!quizNoVf, // Quiz : exclure les Vrai/Faux
      rushPlayerId: (rushPlayerId && room.players.has(rushPlayerId)) ? rushPlayerId : null, // Survivor : le SEUL joueur qui joue
    };
    for (const p of room.players.values()) { p.score = 0; p.waiting = false; p.stat = newStat(); p.charge = 0; p.charges = 1; p.armed = null; p.shield = false; p.isMJ = false; p.streak = 0; p.decayUses = 0; p.veteranUntil = null; p.veteranFloor = 0; p.nofault = false; p.selfBonus = 0; p.sustainUntil = null; p.sustainAmount = 0; p.draftFrac = 0; p.rushScore = 0; p.rushTracks = 0; }
    room.mjDouble = false; room.mjPlus = false; room.mjId = null;
    clearTimeout(room.rushTimer);
    // Mode Survivor : boucle dédiée (jauge de temps), pas de manches ni de pouvoirs → on lance et on sort
    if (wantMode === 'rush') { room.totalRounds = 0; room.roundIndex = 0; room.prevRanks = null; cb?.({ ok: true }); return startRush(room); }
    if (room.settings.mj) {
      // le MJ est choisi explicitement (sinon 1er joueur connecté par défaut)
      const animator = (mjId && room.players.get(mjId)) || [...room.players.values()].find((p) => p.connected) || [...room.players.values()][0];
      if (animator) { animator.isMJ = true; room.mjId = animator.id; }
    }
    if (isQuiz) {
      if (!room.usedQuiz) room.usedQuiz = new Set(); // salons créés avant l'ajout du champ
      room.playlist = pickQuiz(rounds || 8, room.settings.difficulty, room.usedQuiz, { noVf: room.settings.quizNoVf }); // filtre difficulté + anti-répétition salon (+ option sans Vrai/Faux)
    } else {
      const diff = DIFFICULTY[room.settings.difficulty] || DIFFICULTY.normal;
      if (!room.playedTracks) room.playedTracks = new Set(); // salons créés avant l'ajout du champ
      room.playlist = pickPlaylist(rounds || 8, diff.bands, room.settings.era, room.settings.themes, room.playedTracks); // + anti-répétition salon (série)
      cacheTracks(room.playlist); // rapatrie les extraits de la partie en fond (le décompte couvre la manche 1)
    }
    room.totalRounds = room.playlist.length;
    if (!room.totalRounds) return cb?.({ error: isQuiz ? 'Banque de quiz indisponible.' : 'Aucun morceau disponible.' });
    room.roundIndex = 0;
    room.prevRanks = null;
    room.battle = null; room.battlesThisGame = 0; room.lastBattleRound = -99; // clash : reset par partie
    cb?.({ ok: true });
    beginRound(room);
  }

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
    if (room.jam && p.id !== room.jam.by && Date.now() < (room.roundStartAt || (room.roundEndsAt - room.windowMs)) + room.jam.ms) {
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
      if (p.armed.refuel) p.charges = Math.min(3, (p.charges || 0) + 1); // surrégime : charge remboursée si tu marques
      p.armed = null;
    }
    if (room.muted.has(p.id)) { if (points > (room.mutedDenied.get(p.id) || 0)) room.mutedDenied.set(p.id, points); points = 0; } // muselé (sabotage) : on retient ce qui lui a été refusé
    if (points > 0 && p.selfBonus) points += p.selfBonus; // gain perso des pouvoirs utilitaires (hint/jam/freeze/nofault)
    const prev = room.answers.get(p.id);
    if (!prev || points > prev.points) room.answers.set(p.id, { points, titleHit: g.titleHit, artistHit: g.artistHit, text: String(text || '').slice(0, 60) });
    cb?.({ ok: true, points, titleHit: g.titleHit, artistHit: g.artistHit });
    io.to(room.hostId).emit('player:answered', { id: p.id, name: p.name });
    // le son continue de tourner : on ne coupe plus la manche dès que tout le monde a répondu
  });

  // Mode Survivor (contre-la-montre) : on répond en boucle, la 1re bonne réponse fait avancer TOUT LE MONDE
  socket.on('rush:answer', ({ text } = {}, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || room.settings.mode !== 'rush') return cb?.({ error: 'Pas de run.' });
    if (room.rushPlayerId && socket.data.playerId !== room.rushPlayerId) return cb?.({ ok: true, correct: false, spectator: true }); // seul le joueur désigné joue
    if (room.rushResolving) return cb?.({ ok: true, correct: false }); // course : qqn a déjà trouvé ce morceau
    const p = room.players.get(socket.data.playerId);
    if (!p || p.waiting) return cb?.({ error: 'Joueur inconnu.' });
    const g = gradeAnswer(text, room.current);
    if (!(g.titleHit || g.artistHit)) return cb?.({ ok: true, correct: false }); // titre OU artiste suffit pour avancer
    room.rushResolving = true; // verrou anti double-résolution
    const full = g.titleHit && g.artistHit; // les DEUX = plus de temps + plus de points (g.base porte déjà la prime de précision)
    const addMs = full ? room.rushBonusMs : room.rushPartialMs; // partiel = petit gain de temps, complet = gros gain
    const elapsed = Date.now() - (room.rushTrackStartAt || Date.now());
    const sm = speedMult(Math.max(0, RUSH_REF_MS - elapsed), RUSH_REF_MS);
    const pts = Math.round((g.base || 0) * sm * (room.mult || 1));
    p.rushScore = (p.rushScore || 0) + pts; p.rushTracks = (p.rushTracks || 0) + 1;
    cb?.({ ok: true, correct: true, points: pts, addedMs: addMs, full });
    rushApplyDelta(room, addMs); // +temps (partiel ou complet)
    if (room.phase === 'playing') rushAdvance(room, { reason: 'hit', by: p.id, name: p.name, points: pts, addedMs: addMs, full });
  });
  socket.on('rush:pass', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || room.settings.mode !== 'rush' || room.rushResolving) return cb?.({ error: 'Non.' });
    if (room.rushPlayerId && socket.data.playerId !== room.rushPlayerId) return cb?.({ ok: true, spectator: true }); // seul le joueur désigné joue
    const p = room.players.get(socket.data.playerId);
    if (!p || p.waiting) return;
    room.rushResolving = true;
    cb?.({ ok: true, removedMs: room.rushPassMs });
    rushApplyDelta(room, -room.rushPassMs); // -temps (peut finir le run)
    if (room.phase === 'playing') rushAdvance(room, { reason: 'pass', by: p.id, name: p.name, removedMs: room.rushPassMs });
  });
  socket.on('leaderboard:get', ({ n, filter } = {}, cb) => cb?.({ ok: true, top: getTop(Math.min(50, Math.max(1, n || 10)), filter || null), configs: getConfigs() }));

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
    if (Date.now() < (room.roundStartAt || 0) + MIN_BUZZ_MS) return cb?.({ error: 'Le son démarre…' }); // ANTI-BUZZ PRÉCOCE : refusé tant que le son n'a pas vraiment démarré côté TV
    if (room.jam && p.id !== room.jam.by && Date.now() < (room.roundStartAt || (room.roundEndsAt - room.windowMs)) + room.jam.ms) return cb?.({ error: 'Brouillé — patiente…', jammed: true });
    if (!room.buzz.open || room.buzz.winnerId || room.buzz.lockedOut.has(p.id)) return cb?.({ error: 'Buzzer indisponible.' });
    room.buzz.winnerId = p.id; room.buzz.winnerName = p.name; room.buzz.open = false;
    room.buzz.endsAt = Date.now() + BUZZ_ANSWER_MS; // échéance de réponse (décompte affiché TV + tel)
    cb?.({ ok: true, winner: true, endsAt: room.buzz.endsAt, answerMs: BUZZ_ANSWER_MS });
    io.to(room.code).emit('buzz:winner', { id: p.id, name: p.name, avatar: p.avatar, endsAt: room.buzz.endsAt, answerMs: BUZZ_ANSWER_MS, serverNow: Date.now() });
    // on MET LA MANCHE EN PAUSE pendant qu'il répond (le son est coupé côté hôte) — sinon la manche
    // pourrait se terminer en plein milieu de sa réponse. On mémorise le temps restant.
    room.roundRemainingMs = Math.max(0, room.roundEndsAt - Date.now());
    clearTimeout(room.timer);
    // on met AUSSI en pause le plafond d'écoute pendant qu'il répond → la fenêtre de réponse (15 s) n'est jamais tronquée par le cap
    room.hardRemainingMs = Math.max(0, (room.hardEndsAt || Date.now()) - Date.now());
    clearTimeout(room.hardTimer);
    // le gagnant a BUZZ_ANSWER_MS (15 s) pour répondre, sinon il est verrouillé et le buzzer rouvre
    clearTimeout(room.buzzTimer);
    room.buzzTimer = setTimeout(() => buzzerFail(room, p.id), BUZZ_ANSWER_MS);
  });

  socket.on('buzzer:answer', ({ text }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || room.settings.mode !== 'buzzer' || room.settings.mj) return;
    const p = room.players.get(socket.data.playerId);
    if (!p || room.buzz.winnerId !== p.id) return cb?.({ error: 'Ce n\'est pas ton tour.' });
    if (!String(text || '').trim()) return cb?.({ error: 'Réponse vide.' }); // garde-fou serveur : une soumission vide ne consomme pas le tour (le téléphone bloque déjà, pas un client tiers)
    clearTimeout(room.buzzTimer);
    if (p.stat) p.stat.att++;
    const g = gradeAnswer(text, room.current, !!p.nofault);
    if (g.titleHit && g.artistHit) { // BUZZER : titre ET artiste obligatoires (sinon injuste vs qqn qui met les deux)
      let points = Math.round(g.base * room.mult) + 5000; // bonus buzzer
      if (!room.firstScorerId) { room.firstScorerId = p.id; if (p.stat) p.stat.firsts++; } // le buzz gagnant = 1er à trouver
      if (p.armed) {
        if (p.armed.type === 'double' || p.armed.type === 'wager') points = Math.round(points * (p.armed.mult || 2));
        else if (p.armed.type === 'bonus') points += (p.armed.amount || 10000);
        else if (p.armed.type === 'firstblood') { points += (p.armed.base || 0); if (room.firstScorerId === p.id) points += (p.armed.first || 0); }
        if (p.armed.refuel) p.charges = Math.min(3, (p.charges || 0) + 1);
        p.armed = null;
      }
      if (room.muted.has(p.id)) { if (points > (room.mutedDenied.get(p.id) || 0)) room.mutedDenied.set(p.id, points); points = 0; }
      if (points > 0 && p.selfBonus) points += p.selfBonus;
      room.answers.set(p.id, { points, titleHit: g.titleHit, artistHit: g.artistHit, text: String(text || '').slice(0, 60) });
      cb?.({ ok: true, correct: true, points });
      endRound(room);
    } else {
      room.answers.set(p.id, { points: 0, titleHit: g.titleHit, artistHit: g.artistHit, text: String(text || '').slice(0, 60), tried: true }); // trace la tentative RATÉE (pour l'affichage reveal)
      cb?.({ ok: true, correct: false });
      buzzerFail(room, p.id);
    }
  });

  function buzzerFail(room, pid) {
    if (room.phase !== 'playing' || room.buzz.winnerId !== pid) return;
    clearTimeout(room.buzzTimer);
    room.buzz.lockedOut.add(pid);
    room.buzz.winnerId = null; room.buzz.winnerName = null; room.buzz.endsAt = 0;
    // RÈGLE : tant que tout le monde n'a pas tenté (ou trouvé), le buzzeur qui a raté est verrouillé.
    // Si TOUT LE MONDE (connecté, hors MJ/attente) a tenté et loupé → on efface les lockouts : chacun peut re-buzzer.
    const eligible = [...room.players.values()].filter((p) => p.connected && !p.isMJ && !p.waiting);
    const allTried = eligible.length > 0 && eligible.every((p) => room.buzz.lockedOut.has(p.id));
    if (allTried) room.buzz.lockedOut.clear();
    room.buzz.open = true;
    io.to(room.code).emit('buzz:open', { lockedOut: [...room.buzz.lockedOut] });
    // le buzzeur a raté → la manche REPREND (le son redémarre côté hôte via buzz:open) avec le temps restant
    resumeBuzzRound(room);
  }
  // reprend le chrono de la manche là où il s'était arrêté au buzz (le son était coupé pendant la réponse)
  function resumeBuzzRound(room) {
    const remaining = room.roundRemainingMs != null ? room.roundRemainingMs : Math.max(0, room.roundEndsAt - Date.now());
    room.roundRemainingMs = null;
    room.roundEndsAt = Date.now() + remaining;
    clearTimeout(room.timer);
    room.timer = setTimeout(() => endRound(room), remaining);
    // on relance aussi le plafond d'écoute là où il s'était arrêté au buzz (symétrique de la pause dans player:buzz)
    if (room.hardRemainingMs != null) { const hr = room.hardRemainingMs; room.hardRemainingMs = null; room.hardEndsAt = Date.now() + hr; clearTimeout(room.hardTimer); room.hardTimer = setTimeout(() => { if (room.phase === 'playing') endRound(room); }, hr); }
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
    if (room.settings.mode !== 'multi') return cb?.({ error: 'Pas de pouvoirs dans ce mode.' }); // défense : Blind Test auto uniquement (ni Buzzer/Survivor/Clash)
    // On active les pouvoirs AVANT la manche (fenêtre "prep"), pas en écoutant le son.
    if (room.phase !== 'prep') return cb?.({ error: 'On active les pouvoirs entre les manches.' });
    // UN SEUL pouvoir (ou passe) par fenêtre : bloque le double-clic / la ré-activation après reconnexion.
    if (room.ready.has(p.id)) return cb?.({ error: 'Tu as déjà joué cette fenêtre de pouvoirs.' });
    if ((p.charges || 0) < 1) return cb?.({ error: 'Aucune charge de pouvoir.' });
    const pw = POWERS[p.avatar];
    if (!pw) return cb?.({ error: 'Ce perso n\'a pas de pouvoir.' });
    // cohérence : un pouvoir qui ne peut RIEN faire ne consomme PAS la charge.
    // protégé = filet (safety) OU vétéran increvable → ni volable ni musclable
    const protectedNow = (x) => !!x.safety || !!x.shield || (x.veteranUntil != null && room.roundIndex <= x.veteranUntil);
    const topOther = () => [...room.players.values()].filter((x) => x.id !== p.id && x.connected && !x.isMJ && !x.waiting).sort((a, b) => b.score - a.score)[0];
    const topAttackable = () => [...room.players.values()].filter((x) => x.id !== p.id && x.connected && !x.isMJ && !x.waiting && !protectedNow(x)).sort((a, b) => b.score - a.score)[0];
    // enregistre + notifie une VICTIME d'un vol/sabotage/dîme (anim temps réel + rejeu au reveal)
    const recordHit = (victim, amount) => {
      if (!victim || !(amount > 0)) return;
      if (!room.powerHits) room.powerHits = new Map();
      const arr = room.powerHits.get(victim.id) || []; arr.push({ by: p.name, byAvatar: p.avatar, type: pw.type, amount }); room.powerHits.set(victim.id, arr);
      if (victim.socketId) io.to(victim.socketId).emit('power:hit', { by: p.name, byAvatar: p.avatar, type: pw.type, amount });
    };
    let detail = null;
    if (pw.type === 'steal') {
      const top = topAttackable();
      // on ne vole QUE quelqu'un DEVANT soi (le meneur) — pas de snowball en volant le n°2 quand on est n°1.
      const leader = top && top.score > p.score ? top : null;
      // sans bouclier, un vol sans cible ne sert à rien → on n'entame pas la charge. Avec bouclier (DUC),
      // le pouvoir reste utile même sans cible (défense quand on mène) → on continue.
      if ((!leader || leader.score <= 0) && !pw.shield) return cb?.({ error: 'Personne à voler pour l\'instant.' });
      let amt = 0;
      if (leader && leader.score > 0) { amt = Math.min(pw.amount || 12000, leader.score); leader.score -= amt; p.score += amt; if (p.stat) p.stat.denialGain += amt; recordHit(leader, amt); }
      if (pw.shield) { p.shield = true; room.muted.delete(p.id); } // devient intouchable ce tour (immunisé vol/sabotage/dîme, annule un sabotage déjà posé) → peut DÉFENDRE son rang
      detail = { stoleFrom: amt ? leader.name : null, amount: amt, shield: !!pw.shield };
    } else if (pw.type === 'sabotage') {
      const targets = [...room.players.values()].filter((x) => x.id !== p.id && x.connected && !x.isMJ && !x.waiting && !protectedNow(x)).sort((a, b) => b.score - a.score).slice(0, pw.targets || 1);
      if (!targets.length) return cb?.({ error: 'Aucun leader à museler (les meneurs sont blindés).' });
      targets.forEach((t) => { room.muted.add(t.id); room.mutedBy.set(t.id, p.id); if (pw.grab) { const amt = Math.min(pw.grab, t.score); t.score -= amt; p.score += amt; if (amt > 0 && p.stat) p.stat.denialGain += amt; recordHit(t, amt); } }); // muselle + rafle une part
      detail = { mutedName: targets.map((t) => t.name).join(' & ') };
    } else if (pw.type === 'tax') {
      // prélève une petite dîme sur CHAQUE adversaire attaquable
      const others = [...room.players.values()].filter((x) => x.id !== p.id && x.connected && !x.isMJ && !x.waiting && !protectedNow(x));
      let grabbed = 0;
      others.forEach((t) => { const amt = Math.min(pw.amount || 2500, t.score); t.score -= amt; p.score += amt; grabbed += amt; recordHit(t, amt); });
      if (grabbed > 0 && p.stat) p.stat.denialGain += grabbed;
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
      const amt = Math.min(pw.cap || 1e9, (pw.base || 5000) + (p.streak || 0) * (pw.per || 5000)); // grossit avec la série, PLAFONNÉ (cap)
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
    if (!room || room.hostId !== socket.id) return cb?.({ error: 'Non autorisé.' });
    if (room.phase === 'reveal') { cb?.({ ok: true }); nextRound(room); }        // manche normale → suivante (ou clash)
    else if (room.phase === 'battle-reveal') { cb?.({ ok: true }); room.battle = null; advanceRound(room); } // fin de clash → vraie manche suivante
    else return cb?.({ error: 'Pas au bon moment.' });
  });

  // Clash : un spectateur PARIE sur un des deux duellistes
  socket.on('battle:bet', ({ pick } = {}, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'battle-bet' || !room.battle) return cb?.({ error: 'Pas de pari en cours.' });
    const p = room.players.get(socket.data.playerId);
    if (!p || p.id === room.battle.a || p.id === room.battle.b || p.isMJ || p.waiting) return cb?.({ error: 'Tu ne peux pas parier.' });
    if (pick !== 'a' && pick !== 'b') return cb?.({ error: 'Choix invalide.' });
    room.battle.bets.set(p.id, pick);
    cb?.({ ok: true, pick });
    // diffuse à l'HÔTE la liste des parieurs par camp (pour afficher les avatars qui arrivent sur Paris TV)
    const tally = (side) => [...room.battle.bets.entries()].filter(([, v]) => v === side)
      .map(([id]) => { const q = room.players.get(id); return { id, name: q?.name || '', avatar: q?.avatar || null }; });
    io.to(room.hostId).emit('battle:tally', { a: tally('a'), b: tally('b') });
  });

  // Clash : un duelliste répond — le 1er correct des deux GAGNE
  socket.on('battle:answer', ({ text } = {}, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'battle-play' || !room.battle) return cb?.({ error: 'Pas de clash.' });
    const p = room.players.get(socket.data.playerId);
    if (!p || (p.id !== room.battle.a && p.id !== room.battle.b)) return cb?.({ error: 'Tu n\'es pas dans le clash.' });
    const g = gradeAnswer(text, room.battle.track, false);
    if (g.base > 0) { cb?.({ ok: true, correct: true }); endBattle(room, p.id); }
    else cb?.({ ok: true, correct: false });
  });

  // Dev/test : forcer un clash depuis une révélation (le lien « + clash test » côté hôte, et test-games)
  socket.on('host:forceBattle', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id || room.phase !== 'reveal') return cb?.({ error: 'Pas au bon moment.' });
    const d = pickBattleDuelists(room, true);
    if (!d) return cb?.({ error: 'Pas assez de joueurs (≥3).' });
    cb?.({ ok: true });
    startBattle(room, d.a, d.b, d.flavor);
  });

  // Retour au salon (bouton « ← Salon » en jeu, ou « Rejouer / Relancer » depuis le podium).
  // On repart pour une nouvelle partie EN GARDANT le cumul de série (total d'auditeurs + parties gagnées).
  socket.on('host:restart', (_p, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return cb?.({ error: 'Non autorisé.' });
    clearTimeout(room.timer); clearTimeout(room.buzzTimer); clearTimeout(room.cdTimer); clearTimeout(room.rushTimer); clearTimeout(room.hardTimer);
    room.phase = 'lobby'; room.roundIndex = 0; room.prevRanks = null; room.current = null; room.lastReveal = null;
    room.battle = null; room.battlesThisGame = 0; room.lastBattleRound = -99;
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
    room.gamesPlayed = 0; room.lastFinal = null; room.playedTracks = new Set(); // série remise à zéro → les sons peuvent repasser
    room.awardCounts = {}; room.awardLog = []; // rotation des trophées remise à zéro avec la série
    for (const p of room.players.values()) { p.total = 0; p.gameWins = 0; p.totalRounds = 0; }
    cb?.({ ok: true });
    emitLobby(room);
  });

  // Vote de fin de partie : chaque joueur (actif, connecté) dit s'il veut rejouer. Unanimité de OUI →
  // le serveur relance DIRECTEMENT avec les mêmes réglages (room.lastStartArgs), sans action de l'hôte.
  socket.on('player:replayVote', ({ replay } = {}, cb) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'final') return cb?.({ error: 'Pas en fin de partie.' });
    const p = room.players.get(socket.data.playerId);
    if (!p || p.isMJ || p.waiting) return cb?.({ error: 'Vote indisponible.' });
    if (!room.replayVotes) room.replayVotes = new Map();
    room.replayVotes.set(p.id, replay !== false);
    const voters = [...room.players.values()].filter((x) => x.connected && !x.isMJ && !x.waiting);
    const yes = voters.filter((x) => room.replayVotes.get(x.id) === true).length;
    const voted = voters.filter((x) => room.replayVotes.has(x.id)).length;
    cb?.({ ok: true, vote: replay !== false });
    io.to(room.code).emit('replay:tally', { yes, voted, total: voters.length });
    // tous les joueurs actifs ont voté OUI → relance immédiate, mêmes réglages
    if (voters.length >= 1 && voters.every((x) => room.replayVotes.get(x.id) === true)) {
      room.replayVotes = new Map();
      startGame(room, room.lastStartArgs || {});
    }
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
    if (p && p.socketId === socket.id) {
      p.connected = false; p.socketId = null;
      // si le joueur qui TIENT le buzzer se déconnecte, on libère le buzzer tout de suite (sinon la manche gèle, son coupé côté TV, jusqu'à la fin du décompte de réponse)
      if (room.phase === 'playing' && room.settings.mode === 'buzzer' && !room.settings.mj && room.buzz && room.buzz.winnerId === p.id) buzzerFail(room, p.id);
      emitLobby(room);
    }
  });
});

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */
// CORS pour /api (dev local) : permet de POSTER depuis une page externe (ex. open.spotify.com → import direct de playlist publique).
app.use('/api', (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.get('/api/health', (_req, res) => res.json({ ok: true, pool: POOL.length, playable: POOL.length - DEAD.size, rooms: rooms.size, previews: previewCache.size, warmup: { ...warm, pct: warm.total ? Math.round((warm.done / warm.total) * 100) : 100 } }));
// Extraits servis PAR NOUS (mp3 en cache) → URL stables, jamais expirées. Range-request pour le seek.
app.get('/api/preview/:id', async (req, res) => {
  const id = String(req.params.id);
  let buf = previewCache.get(id);
  if (!buf && onDisk(id)) { try { buf = fs.readFileSync(previewPath(id)); rememberBuf(id, buf); } catch { /* lecture KO */ } } // cache disque persistant
  if (!buf) { const t = poolIndex.get(id); if (t) { await cacheTrack(t); buf = previewCache.get(id) || (onDisk(id) ? fs.readFileSync(previewPath(id)) : null); } } // pas encore rapatrié → maintenant
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
// ── Liste de curation ACTIVE (base-musicale) : servie depuis canon-active.json (la LISTE à affiner), jointe au
// pool résolu (audio/pochette/année) là où c'est dispo. Les titres pas encore résolus s'affichent SANS extrait
// (l'audio se remplit au fur et à mesure de la résolution Deezer). La bande = label serveur (source de vérité) sinon
// la bande de la liste. `k` = clé serveur (dnorm) → base-musicale la renvoie telle quelle à /apply, match garanti.
let _canonActive = null;
function canonActive() { if (_canonActive) return _canonActive; try { _canonActive = JSON.parse(fs.readFileSync(path.join(__dirname, 'canon-active.json'), 'utf8')); } catch { _canonActive = []; } return _canonActive; }
let _poolByKey = null, _pbkLen = -1;
function poolByKey() { if (_poolByKey && _pbkLen === POOL.length) return _poolByKey; const m = new Map(); for (const t of POOL) { const k = dkey(t); if (!m.has(k)) m.set(k, t); } _poolByKey = m; _pbkLen = POOL.length; return m; }
app.get('/api/curation', (_req, res) => {
  res.set('Cache-Control', 'no-store');   // décompte toujours frais (jamais servi depuis le cache navigateur après un drop)
  const list = canonActive(), pk = poolByKey();
  const seen = new Set(), rows = [];
  for (const c of list) {
    if (seen.has(c.k)) continue; seen.add(c.k);
    const t = pk.get(c.k);
    const b = DIFF_EXCLUDE.has(c.k) ? 'exc' : (DIFF_LABELS[c.k] || c.band || 'mid');
    rows.push({ id: t ? t.id : null, k: c.k, a: c.a, t: c.t, b, labeled: !!DIFF_LABELS[c.k], c: (t && t.cover) || c.cov || '', y: (t && t.year) || c.yr || 0, dec: c.dec || 'x', g: t ? (t.tags || []) : [], f: t ? (t.feats2 || []) : [], sp: c.sp || '', spRank: c.spRank || 0, rank: t ? (t.rank || 0) : 0, preview: t ? '/api/preview/' + t.id : '' });
  }
  const counts = { top: 0, high: 0, mid: 0, deep: 0, exc: 0, noaudio: 0 };
  for (const r of rows) { counts[r.b] = (counts[r.b] || 0) + 1; if (!r.preview && !r.sp) counts.noaudio++; }
  res.json({ counts: { ...counts, playable: rows.length, excluded: counts.exc }, rows, excluded: [] });
});
// Top morceaux d'un artiste, classés par POPULARITÉ (≈ streams) via l'embed artiste — sans token. On récupère l'id de
// l'artiste depuis l'embed d'un de ses titres (entity.artists = [{name, uri:spotify:artist:ID}]).
app.get('/api/curation/artist-top', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const name = String((req.query && req.query.name) || '');
    const trackId = String((req.query && req.query.track) || '');
    if (!/^[a-zA-Z0-9]{22}$/.test(trackId)) return res.status(400).json({ error: 'track invalide' });
    const NEXT = (h) => { const m = h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/); if (!m) return null; try { return JSON.parse(m[1])?.props?.pageProps?.state?.data?.entity; } catch { return null; } };
    const UA = { headers: { 'User-Agent': 'Mozilla/5.0' } };
    // 1) id de l'artiste cliqué depuis l'embed du titre
    const tEnt = NEXT(await (await fetch('https://open.spotify.com/embed/track/' + trackId, UA)).text());
    const arts = (tEnt && tEnt.artists) || [];
    const want = dnorm(name);
    const a = arts.find((x) => dnorm(x.name) === want) || arts[0];
    const aid = (((a && a.uri) || '').match(/spotify:artist:([a-zA-Z0-9]{22})/) || [])[1];
    if (!aid) return res.json({ ok: false, error: 'artiste introuvable' });
    // 2) top tracks depuis l'embed artiste (déjà classé par popularité)
    const aEnt = NEXT(await (await fetch('https://open.spotify.com/embed/artist/' + aid, UA)).text()) || {};
    const top = ((aEnt.trackList) || []).map((t) => {
      const spId = ((t.uri || '').match(/spotify:track:([a-zA-Z0-9]{22})/) || [])[1] || '';
      const parts = (t.subtitle || '').split(',').map((s) => s.trim()).filter(Boolean);
      const artist = parts.length > 1 ? parts[0] + ' feat. ' + parts.slice(1).join(', ') : (t.subtitle || '');
      return { title: t.title, artist, subtitle: t.subtitle || '', spId, k: dkey({ artist, title: t.title }) };
    });
    res.json({ ok: true, artist: aEnt.name || name, top });
  } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
});
// Applique un classement de popularité Spotify par titre (rang 1..N dans le top de l'artiste). { ranks: { clé: rang } }.
// Source de vérité complète : tout spRank absent de la map est effacé (refresh total). Backup .bak + hot-reload.
app.post('/api/curation/set-ranks', express.json({ limit: '4mb' }), (req, res) => {
  try {
    const ranks = (req.body && req.body.ranks) || {};
    const list = canonActive();
    let n = 0;
    for (const c of list) { const r = ranks[c.k]; if (r) { c.spRank = r; n++; } else if (c.spRank) { delete c.spRank; } }
    const lp = path.join(__dirname, 'canon-active.json');
    try { fs.copyFileSync(lp, lp + '.bak'); } catch { /* best-effort */ }
    fs.writeFileSync(lp, JSON.stringify(list));
    _canonActive = list;
    res.json({ ok: true, ranked: n, total: list.length });
  } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
});
// Pose une pochette (et l'année si dispo) par titre, récupérée depuis l'embed Spotify. { covers: { clé: { cov, yr } } }.
app.post('/api/curation/set-covers', express.json({ limit: '12mb' }), (req, res) => {
  try {
    const covers = (req.body && req.body.covers) || {};
    const list = canonActive();
    let n = 0;
    for (const c of list) { const v = covers[c.k]; if (v) { if (v.cov) { c.cov = v.cov; n++; } if (v.yr) c.yr = v.yr; } }
    const lp = path.join(__dirname, 'canon-active.json');
    try { fs.copyFileSync(lp, lp + '.bak'); } catch { /* best-effort */ }
    fs.writeFileSync(lp, JSON.stringify(list));
    _canonActive = list;
    res.json({ ok: true, covered: n, total: list.length });
  } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
});
// Token app Spotify (Client Credentials, mémorisé ~50 min) — lit server/.spotify-secret (gitignored). Accès catalogue PUBLIC (pop, albums).
let _spTok = { v: '', exp: 0 };
async function spAppToken() {
  if (_spTok.v && Date.now() < _spTok.exp) return _spTok.v;
  let secret = ''; try { secret = fs.readFileSync(path.join(__dirname, '.spotify-secret'), 'utf8').trim(); } catch { /* absent */ }
  if (!secret || secret.startsWith('COLLE')) return '';
  try {
    const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: '4b5842ddb3ef4a1f9f14b789a0a35706', client_secret: secret }) });
    const j = await r.json(); if (!j.access_token) return '';
    _spTok = { v: j.access_token, exp: Date.now() + ((j.expires_in || 3600) - 120) * 1000 };
    return _spTok.v;
  } catch { return ''; }
}
// Explorer un artiste : ses titres avec POPULARITÉ Spotify (0-100 ≈ proxy des streams), avec album + cover + type (album/single).
app.get('/api/curation/artist-explore', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const q = String((req.query && req.query.q) || '').trim();
    if (!q) return res.status(400).json({ error: 'nom manquant' });
    const tok = await spAppToken();
    if (!tok) return res.json({ ok: false, error: 'secret Spotify absent (server/.spotify-secret)' });
    const r = await fetch('https://api.spotify.com/v1/search?type=track&market=FR&limit=50&q=' + encodeURIComponent('artist:"' + q + '"'), { headers: { Authorization: 'Bearer ' + tok } });
    if (r.status === 429) return res.json({ ok: false, error: 'quota Spotify (429) — réessaie plus tard' });
    if (!r.ok) return res.json({ ok: false, error: 'Spotify ' + r.status + " — ce nom pose souci (ex. purement numérique). Réessaie ou vérifie l'orthographe." });
    const items = (await r.json()).tracks?.items || [];
    const want = dnorm(q);
    const tracks = items.filter((t) => (t.artists || []).some((a) => { const x = dnorm(a.name); return x && (x.includes(want) || want.includes(x)); })).map((t) => {
      const artist = (t.artists?.[0]?.name || '') + (t.artists?.length > 1 ? ' feat. ' + t.artists.slice(1).map((x) => x.name).join(', ') : '');
      return { title: t.name, spId: t.id, pop: t.popularity || 0, album: t.album?.name || '', cover: t.album?.images?.slice(-1)[0]?.url || '', type: t.album?.album_type || 'album', year: +((t.album?.release_date || '').slice(0, 4)) || 0, artist, k: dkey({ artist, title: t.name }) };
    });
    res.json({ ok: true, artist: q, tracks });
  } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
});
// ── Applique les reclassements du tool DIRECTEMENT sur disque + hot-reload (plus besoin de redémarrer le serveur).
// body: { labels:{clé→'top'|'high'|'mid'|'deep'}, exclude:[clés], unexclude:[clés] }. Backup .bak avant écriture.
app.post('/api/curation/apply', express.json({ limit: '4mb' }), (req, res) => {
  try {
    const { labels = {}, exclude = [], unexclude = [] } = req.body || {};
    const lp = path.join(__dirname, 'difficulty-labels.json'), ep = path.join(__dirname, 'difficulty-exclude.json');
    try { if (fs.existsSync(lp)) fs.copyFileSync(lp, lp + '.bak'); if (fs.existsSync(ep)) fs.copyFileSync(ep, ep + '.bak'); } catch { /* backup best-effort */ }
    const VALID = new Set(['top', 'high', 'mid', 'deep']);
    let nL = 0; for (const k in labels) if (VALID.has(labels[k])) { DIFF_LABELS[k] = labels[k]; nL++; }
    for (const k of exclude) DIFF_EXCLUDE.add(k);
    for (const k of unexclude) DIFF_EXCLUDE.delete(k);
    fs.writeFileSync(lp, JSON.stringify(DIFF_LABELS));
    fs.writeFileSync(ep, JSON.stringify([...DIFF_EXCLUDE]));
    _bandCache = null; _bandLen = -1; // invalide le cache de bandes → le jeu reflète les changements SANS redémarrage
    res.json({ ok: true, labels: nL, excluded: exclude.length, unexcluded: unexclude.length, totalLabels: Object.keys(DIFF_LABELS).length, totalExcluded: DIFF_EXCLUDE.size });
  } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
});
// ── Import de playlists Spotify (depuis base-musicale, qui lit le token de la session hôte) : ajoute/reclasse les
// titres dans la liste active + les labels, par catégorie. { tracks:[{artist,title,band('top'|'high'|'mid'),year?}] }
// Fusionne des titres dans la liste active + les labels (partagé par /import et /drop-spotify). Backup .bak + hot-reload.
function mergeCanonTracks(tracks) {
  const VALID = new Set(['top', 'high', 'mid']);
  const list = canonActive();
  const byKey = new Map(list.map((c) => [c.k, c]));
  const decY = (y) => !y ? 'x' : y < 2000 ? '90' : y < 2010 ? '00' : y < 2020 ? '10' : '20';
  let added = 0, updated = 0, spAdded = 0;
  for (const t of tracks) {
    if (!t || !t.artist || !t.title || !VALID.has(t.band)) continue;
    const k = dkey({ artist: t.artist, title: t.title });
    if (!k || k === '|') continue;
    if (byKey.has(k)) { const c = byKey.get(k); if (DIFF_LABELS[k] !== t.band) updated++; if (t.spId && !c.sp) spAdded++; c.band = t.band; if (t.year) { c.dec = decY(t.year); c.yr = t.year; } if (t.spId) c.sp = t.spId; if (t.cover) c.cov = t.cover; }
    else { const c = { k, a: t.artist, t: t.title, dec: decY(t.year || 0), band: t.band }; if (t.spId) c.sp = t.spId; if (t.cover) c.cov = t.cover; if (t.year) c.yr = t.year; list.push(c); byKey.set(k, c); added++; }
    DIFF_LABELS[k] = t.band;
  }
  const lp = path.join(__dirname, 'canon-active.json'), dp = path.join(__dirname, 'difficulty-labels.json');
  try { fs.copyFileSync(lp, lp + '.bak'); fs.copyFileSync(dp, dp + '.bak'); } catch { /* best-effort */ }
  fs.writeFileSync(lp, JSON.stringify(list));
  fs.writeFileSync(dp, JSON.stringify(DIFF_LABELS));
  _canonActive = list; _bandCache = null; _bandLen = -1;
  return { added, updated, spAdded, total: list.length };
}
app.post('/api/curation/import', express.json({ limit: '4mb' }), (req, res) => {
  try { res.json({ ok: true, ...mergeCanonTracks((req.body && req.body.tracks) || []) }); }
  catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
});
// Glisser-déposer d'un morceau depuis Spotify : on ne connaît que l'id → on résout titre+artiste via la PAGE EMBED
// publique (open.spotify.com/embed/track/{id} → champs "name"/"subtitle"), SANS token → plus de 403.
app.post('/api/curation/drop-spotify', express.json({ limit: '32kb' }), async (req, res) => {
  try {
    const ids = ((req.body && req.body.ids) || []).slice(0, 30);
    const band = req.body && req.body.band;
    if (!['top', 'high', 'mid'].includes(band)) return res.status(400).json({ error: 'catégorie invalide' });
    const unesc = (s) => { try { return JSON.parse('"' + s + '"'); } catch { return s; } };
    const tracks = [];
    for (const id of ids) {
      if (!/^[a-zA-Z0-9]{22}$/.test(id)) continue;
      try {
        const r = await fetch('https://open.spotify.com/embed/track/' + id, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) continue;
        const html = await r.text();
        const nm = html.match(/"name":"((?:[^"\\]|\\.)*)"/);
        const title = nm ? unesc(nm[1]) : '';
        const artArr = html.match(/"artists":\[(.*?)\]/);   // artiste(s) réel(s) — pas "subtitle" (= une classe CSS)
        const arts = [];
        if (artArr) { const re = /"name":"((?:[^"\\]|\\.)*)"/g; let m; while ((m = re.exec(artArr[1]))) arts.push(unesc(m[1])); }
        const artist = arts.length ? (arts[0] + (arts.length > 1 ? ' feat. ' + arts.slice(1).join(', ') : '')) : '';
        const cm = html.match(/https:\/\/[a-z0-9-]*\.?(?:scdn\.co|spotifycdn\.com)\/image\/[a-zA-Z0-9]+/i);   // pochette depuis l'embed → posée direct au drop
        const ym = html.match(/"releaseDate":\{"isoString":"(\d{4})/);
        if (title && artist) tracks.push({ artist, title, band, spId: id, cover: cm ? cm[0] : '', year: ym ? +ym[1] : 0 });
      } catch { /* skip */ }
    }
    if (!tracks.length) return res.json({ ok: false, error: 'titre Spotify illisible' });
    res.json({ ok: true, resolved: tracks.map((t) => t.artist + ' - ' + t.title), ...mergeCanonTracks(tracks) });
  } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
});
// Résout une playlist via sa PAGE EMBED (jusqu'à 100 titres, sans token) → {artist,title,band,spId}. subtitle = artiste(s), uri = id.
async function playlistEmbedTracks(id, band) {
  const r = await fetch('https://open.spotify.com/embed/playlist/' + id, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) return [];
  const html = await r.text();
  const nd = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/);
  if (!nd) return [];
  let items = [];
  try { items = JSON.parse(nd[1])?.props?.pageProps?.state?.data?.entity?.trackList || []; } catch { return []; }
  const out = [];
  for (const it of items) {
    const title = (it && it.title) || '', subtitle = (it && it.subtitle) || '';
    if (!title || !subtitle) continue;
    const m = ((it && it.uri) || '').match(/spotify:track:([a-zA-Z0-9]{22})/);
    const parts = subtitle.split(',').map((s) => s.trim()).filter(Boolean);
    const artist = parts.length > 1 ? parts[0] + ' feat. ' + parts.slice(1).join(', ') : subtitle;
    out.push({ artist, title, band, spId: m ? m[1] : '' });
  }
  return out;
}
// Synchronise les playlists de server/spotify-playlists.json via leur embed (≤100 titres chacune, frais, sans token).
app.post('/api/curation/sync-playlists', express.json({ limit: '8kb' }), async (_req, res) => {
  try {
    let pls = [];
    try { pls = JSON.parse(fs.readFileSync(path.join(__dirname, 'spotify-playlists.json'), 'utf8')); } catch { return res.status(400).json({ error: 'spotify-playlists.json introuvable' }); }
    const report = []; let all = [];
    for (const p of pls) {
      if (!['top', 'high', 'mid'].includes(p.band) || !p.id) continue;
      const tr = await playlistEmbedTracks(p.id, p.band);
      report.push({ name: p.name, band: p.band, lus: tr.length });
      all = all.concat(tr);
    }
    res.json({ ok: true, report, ...mergeCanonTracks(all) });
  } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
});
// ── Boîte à PROMPT de base-musicale (comme le retour du showroom) : append un retour global dans un fichier lisible
// (server/base-musicale-notes.md) → je le relis pour itérer sur la liste.
app.post('/api/curation/note', express.json({ limit: '64kb' }), (req, res) => {
  const note = String((req.body && req.body.note) || '').trim();
  if (!note) return res.json({ ok: false, error: 'vide' });
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  try { fs.appendFileSync(path.join(__dirname, 'base-musicale-notes.md'), `\n## Retour ${stamp}\n${note}\n`); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
});
// Morceau de DÉBLOCAGE d'un challenger : résolu à la volée via Deezer (title+artist) → extrait 30 s proxifié.
// L'arrivée épique (ChallengerReveal) lit /api/unlock-preview?... et joue l'URL → plus besoin de mp3 locaux.
const unlockCache = new Map(); // "title|artist" -> preview url (ou '' si injouable)
app.get('/api/unlock-preview', async (req, res) => {
  const title = String(req.query.title || '').slice(0, 80), artist = String(req.query.artist || '').slice(0, 80);
  if (!title || !artist) return res.json({ preview: '' });
  const key = title + '|' + artist;
  if (unlockCache.has(key)) return res.json({ preview: unlockCache.get(key) });
  try {
    const t = await resolveTrack({ title, artist });
    if (t) { await cacheTrack(t); unlockCache.set(key, t.preview); return res.json({ preview: t.preview }); }
  } catch { /* injouable */ }
  unlockCache.set(key, '');
  res.json({ preview: '' });
});
// Test uniquement : révèle la réponse de la manche en cours (pour scripter des réponses correctes dans test-games.mjs).
app.get('/api/dev/answer', (req, res) => {
  const room = rooms.get(String(req.query.code || '').toUpperCase().trim());
  if (room && room.phase === 'battle-play' && room.battle?.track) return res.json({ title: room.battle.track.title, artist: room.battle.track.artist }); // réponse du clash
  if (!room || !room.current) return res.json({ title: null, artist: null });
  res.json({ title: room.current.title, artist: room.current.artist, quizAnswer: room.quiz ? room.quiz.answer : null });
});

// Showroom (/showroom) : reçoit les retours de design PAR PAGE → append dans RETOURS-SHOWROOM.md (racine).
// Ensuite « corrige les retours du showroom » et je pioche dedans (comme CORRECTIFS.md).
app.post('/api/feedback', express.json({ limit: '256kb' }), (req, res) => {
  try {
    const page = String(req.body?.page || 'inconnu').slice(0, 60);
    const label = String(req.body?.label || page).slice(0, 120);
    const text = String(req.body?.text || '').trim().slice(0, 8000);
    if (!text) return res.status(400).json({ ok: false, error: 'vide' });
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const file = path.join(__dirname, '..', 'RETOURS-SHOWROOM.md');
    if (!fs.existsSync(file)) fs.writeFileSync(file, '# Retours showroom (par page)\n\n> Déposés depuis /showroom. Dis « corrige les retours du showroom » pour que je les applique.\n');
    fs.appendFileSync(file, `\n### ${label}  \`[${page}]\` — ${stamp}\n${text}\n`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false }); }
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

httpServer.listen(PORT, '0.0.0.0', () => { console.log(`[server] PUNCHLINE sur http://0.0.0.0:${PORT}`); loadPool(); });
