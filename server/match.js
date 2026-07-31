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
  // ⚠️ Les featurings sont le PLUS SOUVENT dans le TITRE, pas dans le champ artiste (mesuré le 2026-07-26 :
  // 145 titres du pool en portent un, contre 0 dans le champ artiste côté Deezer). On y ajoute les marqueurs
  // anglais/alternatifs qu'on croisait sans les capter (« with », « w/ », « invité ») — sinon l'artiste
  // invité n'existe nulle part pour le matching et le joueur qui le trouve n'est pas crédité.
  const re = /(?:feat\.?|ft\.?|featuring|avec|with|w\/|invit[ée]s?|duo avec)\s+([^()\[\]]+)/gi;
  let m;
  while ((m = re.exec(raw))) {
    m[1].split(/,|&|\bet\b|\bx\b/i).forEach((n) => { const s = n.trim(); if (s.length >= 2) feats.push(s); });
  }
  return feats;
}

// Alias d'artistes : sigles/diminutifs courants ≠ graphie officielle Deezer (ex. tout le monde dit
// « NTM » pour « Suprême NTM »). Au sein d'un groupe, toutes les formes sont équivalentes (bidirectionnel).
// N'ajouter QUE les écarts sigle≠officiel : IAM / PNL / 113 sont DÉJÀ la graphie Deezer → inutile.
const ALIAS_GROUPS = [
  ['supreme ntm', 'ntm'],
  ['maitre gims', 'gims'],
  ["sexion d assaut", 'sexion'],
  ['psy 4 de la rime', 'psy 4'],
  ['ministere a m e r', 'amer'],
];
const ALIAS_INDEX = new Map();
for (const g of ALIAS_GROUPS) { const set = g.map(normalize); for (const k of set) ALIAS_INDEX.set(k, set); }
// Formes alternatives acceptées pour un artiste/feat donné (vide si aucun alias connu).
export function aliasForms(target) {
  const t = normalize(target);
  const set = ALIAS_INDEX.get(t);
  return set ? set.filter((x) => x !== t) : [];
}

// Tous les artistes CRÉDITÉS sur un morceau, séparément. `extractFeats` ne voit que ce qui est marqué
// « feat./ft./avec » ; or beaucoup de crédits sont juste séparés par une virgule, « & », « x », « vs »
// (« Bigflo & Oli », « SCH, Jul, Naps »). Mesuré le 2026-07-26 : **30 % de ces noms n'étaient PAS acceptés**
// alors que le joueur avait bel et bien trouvé — d'où « on a trouvé le feat et ça n'a pas compté ».
const ARTIST_SPLIT = /\s*(?:feat\.?|ft\.?|featuring|avec|,|&|\/|\+|\bx\b|\bvs\.?\b|\bet\b)\s+/i;
export function artistForms(track) {
  const feats = [...extractFeats(track), ...(track.feats || [])];
  const whole = [track?.artist || '', ...feats].filter(Boolean);
  const parts = [];
  for (const w of whole) for (const p of String(w).replace(/\(.*?\)|\[.*?\]/g, ' ').split(ARTIST_SPLIT)) {
    const s = p.trim();
    if (s.length >= 3) parts.push(s); // ≥3 : évite d'accepter du bruit (« x », « et », initiales)
  }
  const all = [...whole, ...parts];
  return [...new Set([...all, ...all.flatMap(aliasForms)])].filter(Boolean);
}

// Note brute d'une réponse : 6 000 auditeurs titre + 6 000 artiste. Le feat compte comme artiste.
export function gradeAnswer(answer, track, lenient = false) {
  const titleQ = matchQuality(answer, track.title, lenient);
  let artistQ = matchQuality(answer, track.artist, lenient);
  if (artistQ < 1) {
    // artiste principal, feats, CO-CRÉDITÉS (virgule/&/x/vs) et alias de sigle (NTM ↔ Suprême NTM…)
    for (const c of artistForms(track)) { const q = matchQuality(answer, c, lenient); if (q > artistQ) artistQ = q; }
  }
  const titleHit = titleQ > 0;
  const artistHit = artistQ > 0;
  // Auditeurs : 6 000 par volet (titre / artiste). Moins de fautes (qualité 1 vs 0,8) = plus d'auditeurs.
  // Ancrage SNEP : la certif est calée sur les VRAIS paliers français (Or 50 000 · Platine 100 000 ·
  // Double 200 000 · Triple 300 000 · Diamant 500 000) et se calcule sur le TOTAL de la partie
  // NORMALISÉ à 16 manches. Base double-hit = 18 000 (6 000 × 3) → le Diamant reste dur mais faisable.
  // Repère : en MAINSTREAM (mult 1.0) il faut titre+artiste en ~10 s à TOUTES les manches (0 ratée) ;
  // c'est plus accessible en Connaisseur (×1.5) et en Puriste (×2.0), où le mult compense la rareté.
  // ⚠️ Toute l'échelle en auditeurs suit ce facteur — voir CLAUDE.md § Score = AUDITEURS avant d'y toucher.
  let base = Math.round(titleQ * 6000 + artistQ * 6000);
  if (titleHit && artistHit) base += 6000; // prime de précision : titre ET artiste (vaut un 3e volet)
  return { titleHit, artistHit, base };
}

// Multiplicateur de vitesse : de ×1.0 (dernière seconde) à ×2.5 (instantané), courbe CONVEXE (frac^1.7)
// → le bonus CHUTE VITE quand on tarde (mi-temps ≈ ×1.46 au lieu de ×1.5 linéaire) : la rapidité paie bien plus.
export function speedMult(timeLeftMs, windowMs) {
  const frac = Math.max(0, Math.min(1, timeLeftMs / windowMs));
  return 1 + Math.pow(frac, 1.7) * 1.5;
}
