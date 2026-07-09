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

// Tous les scores ne se valent pas : ils dépendent de la CONFIG (difficulté + chrono de départ + pace).
// On stocke donc la config avec chaque score → classements comparables (« plusieurs ladders »).
const cfgOf = (e) => ({ difficulty: e.difficulty || 'normal', startSec: e.startSec || 60, pace: e.pace || 'normal' });
const sameCfg = (a, b) => a.difficulty === b.difficulty && (a.startSec || 60) === (b.startSec || 60) && (a.pace || 'normal') === (b.pace || 'normal');

// Enregistre un score et renvoie l'entrée normalisée + son rang DANS SA CONFIG (comparable).
export function addScore(entry) {
  const e = {
    name: String(entry.name || '—').slice(0, 16),
    avatar: entry.avatar || null,
    score: Math.max(0, Math.round(entry.score || 0)),
    tracks: entry.tracks | 0,
    difficulty: entry.difficulty || 'normal',
    startSec: entry.startSec | 0 || 60, // config Survivor (chrono de départ)
    pace: entry.pace || 'normal',       // config Survivor (pression du chrono)
    at: Date.now(),
  };
  BOARD.push(e);
  BOARD.sort((a, b) => b.score - a.score);
  BOARD = BOARD.slice(0, MAX_KEEP);
  persist();
  const inCfg = BOARD.filter((x) => sameCfg(x, e));
  return { ...e, rank: inCfg.indexOf(e) + 1, configTotal: inCfg.length };
}

// getTop(n) = classement global (toutes configs). getTop(n, {difficulty,startSec,pace}) = classement d'UNE config.
export const getTop = (n = 10, filter = null) => {
  const list = filter ? BOARD.filter((e) => sameCfg(e, { difficulty: filter.difficulty, startSec: filter.startSec, pace: filter.pace })) : BOARD;
  return list.slice(0, n);
};
// Les configs distinctes présentes dans le classement (pour proposer les différents ladders).
export function getConfigs() {
  const seen = new Map();
  for (const e of BOARD) { const c = cfgOf(e); const k = `${c.difficulty}|${c.startSec}|${c.pace}`; if (!seen.has(k)) seen.set(k, { ...c, count: 0 }); seen.get(k).count++; }
  return [...seen.values()].sort((a, b) => b.count - a.count);
}
export const boardSize = () => BOARD.length;
