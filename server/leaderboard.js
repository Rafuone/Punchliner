// Leaderboard GLOBAL du mode Cypher (contre-la-montre) : commun à tous les salons,
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

// Enregistre un score et renvoie l'entrée normalisée + son rang global.
export function addScore(entry) {
  const e = {
    name: String(entry.name || '—').slice(0, 16),
    avatar: entry.avatar || null,
    score: Math.max(0, Math.round(entry.score || 0)),
    tracks: entry.tracks | 0,
    difficulty: entry.difficulty || 'normal',
    at: Date.now(),
  };
  BOARD.push(e);
  BOARD.sort((a, b) => b.score - a.score);
  BOARD = BOARD.slice(0, MAX_KEEP);
  persist();
  return { ...e, rank: BOARD.indexOf(e) + 1 };
}

export const getTop = (n = 10) => BOARD.slice(0, n);
export const boardSize = () => BOARD.length;
