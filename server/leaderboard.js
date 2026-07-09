// Leaderboard GLOBAL du mode Survivor (contre-la-montre) : commun à tous les salons,
// persistant entre sessions. Écriture atomique (tmp + rename) pour ne jamais corrompre le JSON.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, 'leaderboard.json');
const MAX_KEEP = 100; // on garde le top 100, on n'affiche que 10

let BOARD = []; // [{ name, avatar, score, tracks, difficulty, at }]
let writeTimer = null;

try {
  BOARD = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (!Array.isArray(BOARD)) BOARD = [];
} catch {
  BOARD = []; // fichier absent au 1er lancement = normal
}

function persist() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      const tmp = FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(BOARD));
      fs.renameSync(tmp, FILE); // rename = atomique sur le même volume
    } catch (e) {
      console.warn('[leaderboard] écriture KO :', e?.message);
    }
  }, 400);
}

// Le Survivor a une SEULE config qui compte : le CRÉNEAU DE DÉPART (startSec). La difficulté est PROGRESSIVE
// (commune à tous) et il n'y a plus de "pace" → un score n'est comparable qu'aux autres du même chrono de départ.
// Un classement (ladder) par créneau. (Les vieux champs difficulty/pace des entrées existantes sont ignorés.)
const sameCfg = (a, b) => (a.startSec || 60) === (b.startSec || 60);

// Enregistre un score et renvoie l'entrée normalisée + son rang DANS SON CRÉNEAU (comparable).
export function addScore(entry) {
  const e = {
    name: String(entry.name || '—').slice(0, 16),
    avatar: entry.avatar || null,
    score: Math.max(0, Math.round(entry.score || 0)),
    tracks: entry.tracks | 0,
    startSec: entry.startSec | 0 || 60, // SEULE config du Survivor : le chrono de départ
    at: Date.now(),
  };
  BOARD.push(e);
  BOARD.sort((a, b) => b.score - a.score);
  BOARD = BOARD.slice(0, MAX_KEEP);
  persist();
  const inCfg = BOARD.filter((x) => sameCfg(x, e));
  return { ...e, rank: inCfg.indexOf(e) + 1, configTotal: inCfg.length };
}

// getTop(n) = tout. getTop(n, {startSec}) = le classement d'UN créneau de départ.
export const getTop = (n = 10, filter = null) => {
  const list = filter ? BOARD.filter((e) => sameCfg(e, { startSec: filter.startSec })) : BOARD;
  return list.slice(0, n);
};
// Les créneaux de départ présents dans le classement (pour proposer les onglets de ladders).
export function getConfigs() {
  const seen = new Map();
  for (const e of BOARD) { const s = e.startSec || 60; if (!seen.has(s)) seen.set(s, { startSec: s, count: 0 }); seen.get(s).count++; }
  return [...seen.values()].sort((a, b) => a.startSec - b.startSec);
}
export const boardSize = () => BOARD.length;
