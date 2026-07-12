// SCÈNES du showroom : chaque scène fournit un objet `state` conforme à snapshot() du serveur.
// Le mock répond au reclaim/join avec ce state → applyState() rend l'écran EXACT.
// `make()` recalcule les échéances (endsAt) à chaque affichage pour que les chronos soient frais.

export type Group = 'tv' | 'phone';
export interface Scene {
  id: string;
  label: string;
  group: Group;
  comp: 'host' | 'player';
  note?: string;
  make: () => any;
  session?: { code: string; playerId: string; name: string; avatar: string } | null; // phone : session à poser (null = non connecté → formulaire)
}

const now = () => Date.now();

// Joueurs (pseudo + rappeur) — avatars réels du roster.
const P = () => ([
  { id: 'p1', name: 'Rafuo', avatar: 'disiz', score: 142000, connected: true, charge: 40, charges: 2, isMJ: false, total: 142000, gameWins: 1 },
  { id: 'p2', name: 'MoMo', avatar: 'sch', score: 128500, connected: true, charge: 70, charges: 1, isMJ: false, total: 255000, gameWins: 1 },
  { id: 'p3', name: 'Léo', avatar: 'ninho', score: 96000, connected: true, charge: 10, charges: 0, isMJ: false, total: 96000, gameWins: 0 },
  { id: 'p4', name: 'Sofiane', avatar: 'jul', score: 64000, connected: true, charge: 55, charges: 1, isMJ: false, total: 120000, gameWins: 0 },
  { id: 'p5', name: 'Manon', avatar: 'gazo', score: 31000, connected: true, charge: 20, charges: 0, isMJ: false, total: 31000, gameWins: 0 },
]);

const SETTINGS = (mode: string, difficulty = 'facile') => ({ difficulty, mode, mj: false, rounds: 16, rebalance: 'comeback' });

const revealResults = () => ([
  { id: 'p1', name: 'Rafuo', avatar: 'disiz', isMJ: false, points: 30000, titleHit: true, artistHit: true, answer: 'dkr booba', tried: true, power: null, hitBy: [{ by: 'MoMo', byAvatar: 'sch', type: 'steal', amount: 12000 }] },
  { id: 'p3', name: 'Léo', avatar: 'ninho', isMJ: false, points: 24000, titleHit: true, artistHit: true, answer: 'dkr', tried: true, power: null, hitBy: null },
  { id: 'p5', name: 'Manon', avatar: 'gazo', isMJ: false, points: 18000, titleHit: true, artistHit: true, answer: 'dkr booba', tried: true, power: null, hitBy: null },
  { id: 'p2', name: 'MoMo', avatar: 'sch', isMJ: false, points: 12000, titleHit: true, artistHit: false, answer: 'dkr', tried: true, power: { name: 'Vol', type: 'steal', note: '−12 000 à Rafuo' }, hitBy: null },
  { id: 'p4', name: 'Sofiane', avatar: 'jul', isMJ: false, points: 0, titleHit: false, artistHit: false, answer: 'gato', tried: true, power: null, hitBy: null },
]);
const revealScores = () => {
  const d: Record<string, number> = { p1: 0, p2: -1, p3: 1, p4: 0, p5: 0 };
  return P().map((p) => ({ ...p, rankDelta: d[p.id] || 0 }));
};

const REVEAL = (hideBoard = false, lastRound = false) => ({
  roundIndex: 5, total: 16,
  track: { title: 'DKR', artist: 'Booba', cover: 'https://cdn-images.dzcdn.net/images/cover/564dd3853a925bcd433b4e9846e78d09/250x250-000000-80-0-0.jpg' },
  quiz: null, hideBoard, lastRound, results: revealResults(), scores: revealScores(),
});

const FINAL = () => ({
  scores: P(), rounds: 16, awards: [],
  settings: { difficulty: 'facile', mode: 'multi', mj: false, rounds: 16 },
  series: { gamesPlayed: 2, leaderId: 'p2', standings: [
    { id: 'p2', name: 'MoMo', avatar: 'sch', total: 255000, gameWins: 1, totalRounds: 32 },
    { id: 'p1', name: 'Rafuo', avatar: 'disiz', total: 142000, gameWins: 1, totalRounds: 32 },
    { id: 'p4', name: 'Sofiane', avatar: 'jul', total: 120000, gameWins: 0, totalRounds: 32 },
    { id: 'p3', name: 'Léo', avatar: 'ninho', total: 96000, gameWins: 0, totalRounds: 32 },
    { id: 'p5', name: 'Manon', avatar: 'gazo', total: 31000, gameWins: 0, totalRounds: 16 },
  ] },
});

const QUIZ = { id: 1, cat: 'Clashs', q: "Quel rappeur n'a jamais été clashé par Booba ?", choices: ['Rohff', 'Kaaris', 'La Fouine', 'Soprano'] };

const base = (mode: string, extra: any = {}, difficulty = 'facile') => ({
  code: 'PUNCH', poolSize: 264, roundIndex: 5, totalRounds: 16, settings: SETTINGS(mode, difficulty), players: P(), ...extra,
});

const SESSION = { code: 'PUNCH', playerId: 'me', name: 'Rafuo', avatar: 'disiz' };

// Reveal à 8 joueurs (vérifier : tout tient sans scroll + anim de rang + note du pouvoir sur le board)
const REVEAL8 = () => {
  const rows: any[] = [
    { id: 'p1', name: 'Rafuo', avatar: 'disiz', score: 142000, d: 0, pts: 30000, hit: true },
    { id: 'p3', name: 'Léo', avatar: 'ninho', score: 128000, d: 1, pts: 26000, hit: true },
    { id: 'p2', name: 'MoMo', avatar: 'sch', score: 121000, d: -1, pts: 12000, hit: true, power: { name: 'Vol', type: 'steal', note: '−12 000 à Rafuo' } },
    { id: 'p6', name: 'Yanis', avatar: 'booba', score: 98000, d: 3, pts: 24000, hit: true },
    { id: 'p4', name: 'Sofiane', avatar: 'jul', score: 76000, d: 0, pts: 8000, hit: false },
    { id: 'p7', name: 'Inès', avatar: 'damso', score: 61000, d: -2, pts: 0, hit: false },
    { id: 'p5', name: 'Manon', avatar: 'gazo', score: 44000, d: 0, pts: 12000, hit: true },
    { id: 'p8', name: 'Karim', avatar: 'orelsan', score: 20000, d: 0, pts: 0, hit: false },
  ];
  return {
    roundIndex: 5, total: 16,
    track: { title: 'DKR', artist: 'Booba', cover: 'https://cdn-images.dzcdn.net/images/cover/564dd3853a925bcd433b4e9846e78d09/250x250-000000-80-0-0.jpg' },
    quiz: null, hideBoard: false, lastRound: false,
    results: rows.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, isMJ: false, points: p.pts, titleHit: p.hit, artistHit: p.hit, answer: p.hit ? 'dkr booba' : '', tried: true, power: p.power || null, hitBy: null })),
    scores: rows.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, connected: true, charge: 0, charges: 0, isMJ: false, rankDelta: p.d, total: p.score, gameWins: 0 })),
  };
};

export const SCENES: Scene[] = [
  // ─────────── TV (écran / hôte) ───────────
  { id: 'tv-lobby', label: 'Lobby (code + QR)', group: 'tv', comp: 'host', note: "Écran d'accueil : code du salon, QR, joueurs qui rejoignent.", make: () => base('multi', { phase: 'lobby' }) },
  { id: 'tv-prep', label: 'Fenêtre POUVOIRS (prep)', group: 'tv', comp: 'host', make: () => base('multi', { phase: 'prep', round: { index: 1, roundIndex: 1, total: 16, endsAt: now() + 9000, mode: 'multi', difficulty: 'Grand public', prep: true } }) },
  { id: 'tv-playing', label: 'Manche — Blind Test', group: 'tv', comp: 'host', make: () => base('multi', { phase: 'playing', round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 22000, durationMs: 30000, mode: 'multi', difficulty: 'Grand public', mj: false, preview: '', startAt: 0 } }) },
  { id: 'tv-reveal', label: 'Révélation + scores', group: 'tv', comp: 'host', make: () => base('multi', { phase: 'reveal', round: { index: 5, roundIndex: 5, total: 16, mode: 'multi', difficulty: 'Grand public', mj: false }, reveal: REVEAL(false, false) }) },
  { id: 'tv-reveal8', label: 'Révélation — 8 joueurs', group: 'tv', comp: 'host', note: 'Tenue à 8 joueurs (sans scroll) + anim de rang + note du pouvoir sur le board.', make: () => { const r = REVEAL8(); return base('multi', { phase: 'reveal', players: r.scores, round: { index: 5, roundIndex: 5, total: 16, mode: 'multi', difficulty: 'Grand public', mj: false }, reveal: r }); } },
  { id: 'tv-podium', label: 'Podium (fin de partie)', group: 'tv', comp: 'host', note: 'Récap de la partie + série (à séparer — Cycle 2).', make: () => base('multi', { phase: 'final', final: FINAL() }) },
  { id: 'tv-buzz-wait', label: 'Buzzer — en attente', group: 'tv', comp: 'host', make: () => base('buzzer', { phase: 'playing', round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 22000, durationMs: 30000, mode: 'buzzer', difficulty: 'Grand public', mj: false, preview: '', startAt: 0 }, buzz: { winnerId: null, winnerName: null, winnerAvatar: null, open: true, lockedOut: [], endsAt: 0, answerMs: 15000 } }) },
  { id: 'tv-buzz-win', label: 'Buzzer — quelqu’un a buzzé', group: 'tv', comp: 'host', make: () => base('buzzer', { phase: 'playing', round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 22000, durationMs: 30000, mode: 'buzzer', difficulty: 'Grand public', mj: false, preview: '', startAt: 0 }, buzz: { winnerId: 'p2', winnerName: 'MoMo', winnerAvatar: 'sch', open: false, lockedOut: [], endsAt: now() + 15000, answerMs: 15000 } }) },
  { id: 'tv-quiz', label: 'Quiz (QCM)', group: 'tv', comp: 'host', make: () => base('quiz', { phase: 'playing', roundIndex: 3, round: { index: 3, roundIndex: 3, total: 16, endsAt: now() + 18000, durationMs: 20000, mode: 'quiz', difficulty: 'Culture', mj: false, quiz: QUIZ } }) },
  { id: 'tv-survivor', label: 'Survivor (contre-la-montre)', group: 'tv', comp: 'host', make: () => base('rush', { phase: 'playing', round: { mode: 'rush', trackNo: 4, endsAt: now() + 40000, rushMax: 60000, passMs: 5000, bonusMs: 8000, difficulty: 'Grand public', scores: P(), rushPlayerId: 'p1', rushPlayerName: 'Rafuo' } }) },
  { id: 'tv-clash-intro', label: 'Clash — intro (VS)', group: 'tv', comp: 'host', note: 'Manche battle 1v1 (1 par partie, au milieu, ≥3 joueurs). Le carton VS.', make: () => base('multi', { phase: 'battle-intro', battle: { a: { id: 'p1', name: 'Rafuo', avatar: 'disiz' }, b: { id: 'p2', name: 'MoMo', avatar: 'sch' }, flavor: 'sommet', betBonus: 4000, win: 20000, tallyA: [], tallyB: [] } }) },
  { id: 'tv-clash-reveal', label: 'Clash — résultat', group: 'tv', comp: 'host', note: 'Vainqueur + parieurs gagnants/perdants + le morceau révélé.', make: () => base('multi', { phase: 'battle-reveal', battle: { a: { id: 'p1', name: 'Rafuo', avatar: 'disiz' }, b: { id: 'p2', name: 'MoMo', avatar: 'sch' }, betBonus: 4000, reveal: { a: 'p1', b: 'p2', winnerId: 'p1', draw: false, points: 20000, betBonus: 4000, track: { title: 'DKR', artist: 'Booba', cover: 'https://cdn-images.dzcdn.net/images/cover/564dd3853a925bcd433b4e9846e78d09/250x250-000000-80-0-0.jpg' }, bets: [{ id: 'p3', won: true }, { id: 'p4', won: false }, { id: 'p5', won: true }], scores: P() } } }) },

  // ─────────── Téléphone (joueur) ───────────
  { id: 'ph-form', label: 'Formulaire → character-select', group: 'phone', comp: 'player', note: 'Tape un code + un blaze puis « Entre dans le cercle » pour ouvrir le character-select.', session: null, make: () => ({ phase: 'lobby', players: P() }) },
  { id: 'ph-prep', label: 'Fenêtre pouvoirs (Activer/Passer)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'prep', code: 'PUNCH', players: P(), settings: SETTINGS('multi'), round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 9000, mode: 'multi', difficulty: 'Grand public', prep: true } }) },
  { id: 'ph-playing', label: 'Répondre (Blind Test)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'playing', code: 'PUNCH', players: P(), settings: SETTINGS('multi'), round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 22000, durationMs: 30000, mode: 'multi', difficulty: 'Grand public', mj: false } }) },
  { id: 'ph-reveal', label: 'Révélation (joueur)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'reveal', code: 'PUNCH', players: P(), settings: SETTINGS('multi'), round: { index: 5, roundIndex: 5, total: 16, mode: 'multi', difficulty: 'Grand public', mj: false }, reveal: REVEAL(false, false) }) },
  { id: 'ph-buzz', label: 'Buzzer (téléphone)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'playing', code: 'PUNCH', players: P(), settings: SETTINGS('buzzer'), round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 22000, durationMs: 30000, mode: 'buzzer', difficulty: 'Grand public', mj: false } }) },
  { id: 'ph-quiz', label: 'Quiz (QCM téléphone)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'playing', code: 'PUNCH', players: P(), settings: SETTINGS('quiz'), round: { index: 3, roundIndex: 3, total: 16, endsAt: now() + 18000, durationMs: 20000, mode: 'quiz', difficulty: 'Culture', mj: false, quiz: { id: 1, cat: 'Clashs', q: QUIZ.q, choices: QUIZ.choices } } }) },
  { id: 'ph-final', label: 'Fin de partie (joueur)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'final', code: 'PUNCH', players: P(), settings: SETTINGS('multi'), final: FINAL() }) },
  { id: 'ph-waiting', label: 'Salle d’attente (rejoint en cours)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'playing', __waiting: true, code: 'PUNCH', players: P(), settings: SETTINGS('multi'), round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 22000, durationMs: 30000, mode: 'multi', difficulty: 'Grand public', mj: false } }) },
];
