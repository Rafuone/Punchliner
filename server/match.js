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

// Qualité du match : 0 = raté, 1 = exact/fort, 0.8 = faute d'orthographe (compte un peu moins).
// lenient (pouvoir "nofault") : tolérance doublée et pas de pénalité de faute (0.8 → 1).
export function matchQuality(answer, target, lenient = false) {
  const a = normalize(answer);
  const t = normalize(target);
  if (!a || !t) return 0;
  if (a === t) return 1;
  // l'un contient l'autre (ex. "au dd pnl" contient "au dd")
  if (t.length >= 4 && a.includes(t)) return 1;
  if (a.length >= 4 && t.includes(a)) return 1;
  // chaque mot signifiant de la cible est présent
  const words = t.split(' ').filter((w) => w.length >= 3);
  if (words.length && words.every((w) => a.includes(w))) return 1;
  // tolérance aux fautes (~20 %, ou ~40 % en mode nofault)
  const tol = Math.max(1, Math.floor(t.length * (lenient ? 0.4 : 0.2)));
  if (levenshtein(a, t) <= tol) return lenient ? 1 : 0.8;
  return 0;
}

// Est-ce que "answer" matche la cible ? (rétro-compat)
export function isMatch(answer, target) {
  return matchQuality(answer, target) > 0;
}

// Extrait les artistes en featuring (dans le titre ou l'artiste) — ex. "Stuntmen (feat. Alpha Wann & Witt)".
export function extractFeats(track) {
  const raw = `${track?.title || ''} ${track?.artist || ''}`;
  const feats = [];
  const re = /(?:feat\.?|ft\.?|featuring|avec)\s+([^()\[\]]+)/gi;
  let m;
  while ((m = re.exec(raw))) {
    m[1].split(/,|&|\bet\b|\bx\b/i).forEach((n) => { const s = n.trim(); if (s.length >= 2) feats.push(s); });
  }
  return feats;
}

// Note brute d'une réponse : 100 pts titre + 100 pts artiste. Le feat compte comme artiste.
export function gradeAnswer(answer, track, lenient = false) {
  const titleQ = matchQuality(answer, track.title, lenient);
  let artistQ = matchQuality(answer, track.artist, lenient);
  if (artistQ < 1) {
    for (const f of extractFeats(track)) { const q = matchQuality(answer, f, lenient); if (q > artistQ) artistQ = q; }
  }
  const titleHit = titleQ > 0;
  const artistHit = artistQ > 0;
  // Auditeurs : 10 000 par volet (titre / artiste). Moins de fautes (qualité 1 vs 0,8) = plus d'auditeurs.
  let base = Math.round(titleQ * 10000 + artistQ * 10000);
  if (titleHit && artistHit) base += 5000; // prime de précision : titre ET artiste
  return { titleHit, artistHit, base };
}

// Multiplicateur de vitesse : de ×1.0 (dernière seconde) à ×2.0 (instantané) — creuse l'écart.
export function speedMult(timeLeftMs, windowMs) {
  return 1 + Math.max(0, Math.min(1, timeLeftMs / windowMs)) * 1.0;
}
