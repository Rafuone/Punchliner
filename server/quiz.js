// Mode Quiz — QCM "Culture rap FR", 100 % offline, faits VÉRIFIÉS.
// La banque vit dans server/quiz-bank.json (des centaines de questions), chaque entrée :
//   { id, cat, diff: 'facile'|'normal'|'difficile'|'puriste', q, correct, distractors: [3 mauvaises réponses plausibles] }
// - diff FILTRE les questions par difficulté (facile = grand public → puriste = très dur).
// - Anti-répétition PAR SALON : une question tombée dans un salon ne retombe pas tant que la banque
//   (de cette difficulté) n'est pas épuisée (voir usedSet dans pickQuiz).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIFFS = ['facile', 'normal', 'difficile', 'puriste'];

let QUIZ = [];
try {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'quiz-bank.json'), 'utf8'));
  // garde-fou : QCM (q + correct + 3 distracteurs) OU Vrai/Faux (format:'vf', correct = 'Vrai'|'Faux')
  QUIZ = (Array.isArray(raw) ? raw : []).filter((q) =>
    q && q.q && q.correct && (q.format === 'vf' || (Array.isArray(q.distractors) && q.distractors.length >= 3))
  ).map((q, i) => ({
    id: q.id || `q${i}`,
    cat: q.cat || 'Culture',
    diff: DIFFS.includes(q.diff) ? q.diff : 'normal',
    q: q.q,
    format: q.format === 'vf' ? 'vf' : 'qcm',
    correct: q.correct,
    distractors: q.format === 'vf' ? [] : q.distractors.slice(0, 3),
  }));
  console.log(`[quiz] ${QUIZ.length} questions chargées (` +
    DIFFS.map((d) => `${d}:${QUIZ.filter((x) => x.diff === d).length}`).join(' · ') + ')');
} catch (e) {
  console.warn('[quiz] banque introuvable / illisible :', e?.message);
  QUIZ = [];
}

// Mélange (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Tire n questions de la DIFFICULTÉ demandée, en évitant celles déjà passées dans le salon (usedSet,
// persistant sur la durée de vie du salon). Quand le pool de cette difficulté est épuisé, on le recycle.
export function pickQuiz(n, difficulty = 'normal', usedSet = null, opts = {}) {
  const d = DIFFS.includes(difficulty) ? difficulty : 'normal';
  const noVf = !!opts.noVf; // option hôte : exclure les Vrai/Faux
  const full = QUIZ.filter((q) => !noVf || q.format !== 'vf'); // banque filtrée (repli SANS réintroduire les VF exclus)
  let pool = full.filter((q) => q.diff === d);
  if (pool.length < n) pool = full; // sécurité : difficulté trop maigre → toute la banque (toujours filtrée)
  const used = usedSet || new Set();
  let avail = pool.filter((q) => !used.has(q.id));
  if (avail.length < n) { for (const q of pool) used.delete(q.id); avail = [...pool]; } // épuisé → on recycle ce pool
  // RÉPARTITION : on évite qu'UNE catégorie (Culture/Année sont énormes) monopolise la partie → variété des types
  // de questions. Cap ~30 % de la partie par catégorie (min 2), puis complétion sans cap si trop peu de catégories.
  const cap = Math.max(2, Math.ceil(n * 0.30));
  const shuffled = shuffle(avail);
  const picks = [], catCount = {}, inPicks = new Set();
  for (const q of shuffled) {
    if (picks.length >= n) break;
    const c = q.cat || '?';
    if ((catCount[c] || 0) >= cap) continue; // catégorie déjà bien servie → on passe
    picks.push(q); inPicks.add(q.id); catCount[c] = (catCount[c] || 0) + 1;
  }
  if (picks.length < Math.min(n, avail.length)) for (const q of shuffled) { if (picks.length >= n) break; if (!inPicks.has(q.id)) { picks.push(q); inPicks.add(q.id); } } // peu de catégories dispo → on complète
  for (const q of picks) used.add(q.id);
  return picks;
}

// Prépare une manche : mélange les 4 choix et calcule l'index de la bonne réponse.
export function buildQuizRound(item) {
  // Vrai/Faux : deux choix fixes. QCM : la bonne réponse + jusqu'à 3 distracteurs, mélangés.
  const choices = item.format === 'vf'
    ? shuffle(['Vrai', 'Faux'])
    : shuffle([item.correct, ...item.distractors]).slice(0, 4);
  return { id: item.id, cat: item.cat, q: item.q, format: item.format, choices, answer: choices.indexOf(item.correct) };
}

export const quizCount = () => QUIZ.length;
