// Matching flou des réponses (mode automatique) : normalisation + distance de Levenshtein.

export function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')      // accents
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')     // parenthèses (feat…), crochets
    .replace(/\b(feat|ft|featuring|prod|avec|remix|version|radio edit)\b.*$/g, ' ')
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9]+/g, ' ')          // ponctuation → espace
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Est-ce que "answer" matche la cible "target" (titre ou artiste) ?
export function isMatch(answer, target) {
  const a = normalize(answer);
  const t = normalize(target);
  if (!a || !t) return false;
  if (a === t) return true;
  // l'un contient l'autre (ex. "au dd pnl" contient "au dd")
  if (t.length >= 4 && a.includes(t)) return true;
  if (a.length >= 4 && t.includes(a)) return true;
  // tolérance aux fautes ~20 % de la longueur de la cible
  const tol = Math.max(1, Math.floor(t.length * 0.2));
  if (levenshtein(a, t) <= tol) return true;
  // match au niveau des mots (ex. réponse contient chaque mot signifiant du titre)
  const words = t.split(' ').filter((w) => w.length >= 3);
  if (words.length && words.every((w) => a.includes(w))) return true;
  return false;
}

// Note brute d'une réponse : 100 pts titre + 100 pts artiste (avant vitesse/difficulté).
export function gradeAnswer(answer, track) {
  const titleHit = isMatch(answer, track.title);
  const artistHit = isMatch(answer, track.artist);
  const base = (titleHit ? 100 : 0) + (artistHit ? 100 : 0);
  return { titleHit, artistHit, base };
}

// Multiplicateur de vitesse : de x1.0 (dernière seconde) à x1.5 (instantané).
export function speedMult(timeLeftMs, windowMs) {
  return 1 + Math.max(0, Math.min(1, timeLeftMs / windowMs)) * 0.5;
}
