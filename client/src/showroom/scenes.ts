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
  { id: 'p1', name: 'Rafuo', avatar: 'disiz', score: 85200, connected: true, charge: 40, charges: 2, isMJ: false, total: 85200, gameWins: 1 },
  { id: 'p2', name: 'MoMo', avatar: 'sch', score: 77100, connected: true, charge: 70, charges: 1, isMJ: false, total: 153000, gameWins: 1 },
  { id: 'p3', name: 'Léo', avatar: 'ninho', score: 57600, connected: true, charge: 10, charges: 0, isMJ: false, total: 57600, gameWins: 0 },
  { id: 'p4', name: 'Sofiane', avatar: 'jul', score: 38400, connected: true, charge: 55, charges: 1, isMJ: false, total: 72000, gameWins: 0 },
  { id: 'p5', name: 'Manon', avatar: 'gazo', score: 18600, connected: true, charge: 20, charges: 0, isMJ: false, total: 18600, gameWins: 0 },
]);

const SETTINGS = (mode: string, difficulty = 'facile') => ({ difficulty, mode, mj: false, rounds: 16, rebalance: 'comeback' });

const revealResults = () => ([
  { id: 'p1', name: 'Rafuo', avatar: 'disiz', isMJ: false, points: 18000, titleHit: true, artistHit: true, answer: 'dkr booba', tried: true, power: null, hitBy: [{ by: 'MoMo', byAvatar: 'sch', type: 'steal', amount: 7200 }] },
  { id: 'p3', name: 'Léo', avatar: 'ninho', isMJ: false, points: 14400, titleHit: true, artistHit: true, answer: 'dkr', tried: true, power: null, hitBy: null },
  { id: 'p5', name: 'Manon', avatar: 'gazo', isMJ: false, points: 10800, titleHit: true, artistHit: true, answer: 'dkr booba', tried: true, power: null, hitBy: null },
  { id: 'p2', name: 'MoMo', avatar: 'sch', isMJ: false, points: 7200, titleHit: true, artistHit: false, answer: 'dkr', tried: true, power: { name: 'Vol', type: 'steal', note: '−7 200 à Rafuo' }, hitBy: null },
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
    { id: 'p2', name: 'MoMo', avatar: 'sch', total: 153000, gameWins: 1, totalRounds: 32 },
    { id: 'p1', name: 'Rafuo', avatar: 'disiz', total: 85200, gameWins: 1, totalRounds: 32 },
    { id: 'p4', name: 'Sofiane', avatar: 'jul', total: 72000, gameWins: 0, totalRounds: 32 },
    { id: 'p3', name: 'Léo', avatar: 'ninho', total: 57600, gameWins: 0, totalRounds: 32 },
    { id: 'p5', name: 'Manon', avatar: 'gazo', total: 18600, gameWins: 0, totalRounds: 16 },
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
    { id: 'p1', name: 'Rafuo', avatar: 'disiz', score: 85200, d: 0, pts: 18000, hit: true },
    { id: 'p3', name: 'Léo', avatar: 'ninho', score: 76800, d: 1, pts: 15600, hit: true },
    { id: 'p2', name: 'MoMo', avatar: 'sch', score: 72600, d: -1, pts: 7200, hit: true, power: { name: 'Vol', type: 'steal', note: '−7 200 à Rafuo' } },
    { id: 'p6', name: 'Yanis', avatar: 'booba', score: 58800, d: 3, pts: 14400, hit: true },
    { id: 'p4', name: 'Sofiane', avatar: 'jul', score: 45600, d: 0, pts: 4800, hit: false },
    { id: 'p7', name: 'Inès', avatar: 'damso', score: 36600, d: -2, pts: 0, hit: false },
    { id: 'p5', name: 'Manon', avatar: 'gazo', score: 26400, d: 0, pts: 7200, hit: true },
    { id: 'p8', name: 'Karim', avatar: 'orelsan', score: 12000, d: 0, pts: 0, hit: false },
  ];
  return {
    roundIndex: 5, total: 16,
    track: { title: 'DKR', artist: 'Booba', cover: 'https://cdn-images.dzcdn.net/images/cover/564dd3853a925bcd433b4e9846e78d09/250x250-000000-80-0-0.jpg' },
    quiz: null, hideBoard: false, lastRound: false,
    results: rows.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, isMJ: false, points: p.pts, titleHit: p.hit, artistHit: p.hit, answer: p.hit ? 'dkr booba' : '', tried: true, power: p.power || null, hitBy: null })),
    scores: rows.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, connected: true, charge: 0, charges: 0, isMJ: false, rankDelta: p.d, total: p.score, gameWins: 0 })),
  };
};

// Trophées de fin (catalogue serveur) — sert la séquence de remise ET le récap du podium.
const AWARDS = () => ([
  { id: 'comeback', icon: 'comeback', title: 'Comeback King', desc: 'Remonté de la dernière place au podium.', playerId: 'p1', playerName: 'Rafuo', avatar: 'disiz' },
  { id: 'mitraillette', icon: 'mitraillette', title: 'La Mitraillette', desc: '38 réponses envoyées dans la partie.', playerId: 'p4', playerName: 'Sofiane', avatar: 'jul' },
  { id: 'photofinish', icon: 'photofinish', title: 'Photo Finish', desc: 'Départagé de 400 auditeurs seulement.', playerId: 'p2', playerName: 'MoMo', avatar: 'sch' },
]);
const FINAL_AW = () => ({ ...FINAL(), awards: AWARDS() });

// Duellistes du clash (réutilisés par les 4 phases de la manche battle)
const DA = { id: 'p1', name: 'Rafuo', avatar: 'disiz', score: 85200 };
const DB = { id: 'p2', name: 'MoMo', avatar: 'sch', score: 77100 };
const CLASH_TRACK = { title: 'DKR', artist: 'Booba', cover: 'https://cdn-images.dzcdn.net/images/cover/564dd3853a925bcd433b4e9846e78d09/250x250-000000-80-0-0.jpg' };

// Journal d'un run Survivor → récap de fin (ce que le joueur a tapé + la vérité)
const RUSH_LOG = () => ([
  { no: 1, title: 'Bande organisée', artist: 'SCH', cover: '', answer: 'bande organisee sch', outcome: 'hit', points: 21600 },
  { no: 2, title: 'Onizuka', artist: 'PNL', cover: '', answer: 'onizuka', outcome: 'partial', points: 8400 },
  { no: 3, title: 'Fantôme', artist: 'Alpha Wann', cover: '', answer: 'alpha wann', outcome: 'partial', points: 7200 },
  { no: 4, title: 'Macarena', artist: 'Damso', cover: '', answer: 'nekfeu', outcome: 'timeout', points: 0 },
  { no: 5, title: "J'ai la moula", artist: 'Kaaris', cover: '', answer: '', outcome: 'pass', points: 0 },
]);
const RUSH_END = () => ({
  config: { startSec: 60 }, log: RUSH_LOG(),
  results: [{ id: 'p1', name: 'Rafuo', avatar: 'disiz', score: 37200, tracks: 3, rank: 4, configTotal: 26 }],
  top: [
    { name: 'MoMo', avatar: 'sch', score: 96000, tracks: 8 }, { name: 'Inès', avatar: 'damso', score: 74400, tracks: 6 },
    { name: 'Léo', avatar: 'ninho', score: 51600, tracks: 5 }, { name: 'Rafuo', avatar: 'disiz', score: 37200, tracks: 3 },
    { name: 'Manon', avatar: 'gazo', score: 18000, tracks: 2 },
  ],
});
const RUSH_ROUND = (spectator = false) => ({
  mode: 'rush', trackNo: 4, endsAt: now() + 40000, rushMax: 60000, passMs: 5000, bonusMs: 8000,
  difficulty: 'Mainstream', scores: P(), rushPlayerId: spectator ? 'p2' : 'me', rushPlayerName: spectator ? 'MoMo' : 'Rafuo',
});

export const SCENES: Scene[] = [
  // ─────────── TV (écran / hôte) ───────────
  { id: 'tv-lobby', label: 'Lobby (code + QR)', group: 'tv', comp: 'host', note: "Écran d'accueil : code du salon, QR, joueurs qui rejoignent.", make: () => base('multi', { phase: 'lobby' }) },
  { id: 'tv-prep', label: 'Fenêtre POUVOIRS (prep)', group: 'tv', comp: 'host', make: () => base('multi', { phase: 'prep', round: { index: 1, roundIndex: 1, total: 16, endsAt: now() + 9000, mode: 'multi', difficulty: 'Mainstream', prep: true } }) },
  { id: 'tv-playing', label: 'Manche · Blind Test', group: 'tv', comp: 'host', make: () => base('multi', { phase: 'playing', round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 22000, durationMs: 30000, mode: 'multi', difficulty: 'Mainstream', mj: false, preview: '', startAt: 0 } }) },
  { id: 'tv-reveal', label: 'Révélation + scores', group: 'tv', comp: 'host', make: () => base('multi', { phase: 'reveal', round: { index: 5, roundIndex: 5, total: 16, mode: 'multi', difficulty: 'Mainstream', mj: false }, reveal: REVEAL(false, false) }) },
  { id: 'tv-reveal8', label: 'Révélation · 8 joueurs', group: 'tv', comp: 'host', note: 'Tenue à 8 joueurs (sans scroll) + anim de rang + note du pouvoir sur le board.', make: () => { const r = REVEAL8(); return base('multi', { phase: 'reveal', players: r.scores, round: { index: 5, roundIndex: 5, total: 16, mode: 'multi', difficulty: 'Mainstream', mj: false }, reveal: r }); } },
  { id: 'tv-podium', label: 'Podium (fin de partie)', group: 'tv', comp: 'host', note: 'Récap de la partie + série (à séparer · Cycle 2).', make: () => base('multi', { phase: 'final', final: FINAL() }) },
  { id: 'tv-buzz-wait', label: 'Buzzer · en attente', group: 'tv', comp: 'host', make: () => base('buzzer', { phase: 'playing', round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 22000, durationMs: 30000, mode: 'buzzer', difficulty: 'Mainstream', mj: false, preview: '', startAt: 0 }, buzz: { winnerId: null, winnerName: null, winnerAvatar: null, open: true, lockedOut: [], endsAt: 0, answerMs: 15000 } }) },
  { id: 'tv-buzz-win', label: 'Buzzer · quelqu’un a buzzé', group: 'tv', comp: 'host', make: () => base('buzzer', { phase: 'playing', round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 22000, durationMs: 30000, mode: 'buzzer', difficulty: 'Mainstream', mj: false, preview: '', startAt: 0 }, buzz: { winnerId: 'p2', winnerName: 'MoMo', winnerAvatar: 'sch', open: false, lockedOut: [], endsAt: now() + 15000, answerMs: 15000 } }) },
  { id: 'tv-quiz', label: 'Quiz (QCM)', group: 'tv', comp: 'host', make: () => base('quiz', { phase: 'playing', roundIndex: 3, round: { index: 3, roundIndex: 3, total: 16, endsAt: now() + 18000, durationMs: 20000, mode: 'quiz', difficulty: 'Culture', mj: false, quiz: QUIZ } }) },
  { id: 'tv-survivor', label: 'Survivor (contre-la-montre)', group: 'tv', comp: 'host', make: () => base('rush', { phase: 'playing', round: { mode: 'rush', trackNo: 4, endsAt: now() + 40000, rushMax: 60000, passMs: 5000, bonusMs: 8000, difficulty: 'Mainstream', scores: P(), rushPlayerId: 'p1', rushPlayerName: 'Rafuo' } }) },
  { id: 'tv-clash-intro', label: 'Clash · intro (VS)', group: 'tv', comp: 'host', note: 'Manche battle 1v1 (1 par partie, au milieu, ≥3 joueurs). Le carton VS.', make: () => base('multi', { phase: 'battle-intro', battle: { a: { id: 'p1', name: 'Rafuo', avatar: 'disiz' }, b: { id: 'p2', name: 'MoMo', avatar: 'sch' }, flavor: 'sommet', betBonus: 2400, win: 12000, tallyA: [], tallyB: [] } }) },
  { id: 'tv-clash-reveal', label: 'Clash · résultat', group: 'tv', comp: 'host', note: 'Vainqueur + parieurs gagnants/perdants + le morceau révélé.', make: () => base('multi', { phase: 'battle-reveal', battle: { a: { id: 'p1', name: 'Rafuo', avatar: 'disiz' }, b: { id: 'p2', name: 'MoMo', avatar: 'sch' }, betBonus: 2400, reveal: { a: 'p1', b: 'p2', winnerId: 'p1', draw: false, points: 12000, betBonus: 2400, track: { title: 'DKR', artist: 'Booba', cover: 'https://cdn-images.dzcdn.net/images/cover/564dd3853a925bcd433b4e9846e78d09/250x250-000000-80-0-0.jpg' }, bets: [{ id: 'p3', won: true }, { id: 'p4', won: false }, { id: 'p5', won: true }], scores: P() } } }) },
  // Le NUL : personne ne trouve → les 2 duellistes touchent la consolation (BATTLE_DRAW 3 600) et les paris sont
  // ANNULÉS (cancelled, pas perdus). Scène ajoutée le 2026-07-15 : ce cas n'était pas visible et cachait 2 bugs
  // (le duelliste lisait « ±0 » alors qu'il gagnait 3 600 · le parieur lisait « Tu n'avais pas parié »).
  { id: 'tv-clash-draw', label: 'Clash · égalité (nul)', group: 'tv', comp: 'host', note: 'Personne ne trouve : +3 600 aux 2 duellistes, paris annulés (rien de perdu).', make: () => base('multi', { phase: 'battle-reveal', battle: { a: { id: 'p1', name: 'Rafuo', avatar: 'disiz' }, b: { id: 'p2', name: 'MoMo', avatar: 'sch' }, betBonus: 2400, reveal: { a: 'p1', b: 'p2', winnerId: null, draw: true, points: 3600, betBonus: 2400, track: { title: 'DKR', artist: 'Booba', cover: 'https://cdn-images.dzcdn.net/images/cover/564dd3853a925bcd433b4e9846e78d09/250x250-000000-80-0-0.jpg' }, bets: [{ id: 'p3', won: false, cancelled: true, pick: 'a' }, { id: 'p4', won: false, cancelled: true, pick: 'b' }], scores: P() } } }) },

  // --- Ecrans TV ajoutes le 2026-07-26 : ils dependaient d'un etat LOCAL (assistant, hub, etape de fin,
  //     arrivee du challenger) et etaient donc INATTEIGNABLES au banc d'essai -> on ne pouvait pas les relire.
  { id: 'tv-wizard', label: 'Assistant de configuration (5 actes)', group: 'tv', comp: 'host', note: 'Jeu / Playlist / Difficulté / Format / Réglages + dock musique. Naviguer avec Précédent/Suivant.', make: () => base('multi', { phase: 'lobby', __configuring: true }) },
  { id: 'tv-intro-powers', label: "Page d'intro POUVOIRS", group: 'tv', comp: 'host', note: "1re partie à pouvoirs du salon : explique les pouvoirs avant le coup d'envoi.", make: () => base('multi', { phase: 'lobby', __configuring: false, __intro: { mode: 'multi', rounds: 16, difficulty: 'facile', mj: false, rebalance: 'comeback' } }) },
  { id: 'tv-preload', label: 'Préchargement des extraits', group: 'tv', comp: 'host', note: 'La manche 1 attend que TOUTE la playlist soit en mémoire (fix latence audio).', make: () => base('multi', { phase: 'lobby', __preloading: { done: 11, total: 16 } }) },
  { id: 'tv-suspense', label: 'Révélation · scores MASQUÉS (suspense)', group: 'tv', comp: 'host', note: 'Fin de partie serrée : le classement est caché pour garder le suspense.', make: () => base('multi', { phase: 'reveal', round: { index: 15, roundIndex: 15, total: 16, mode: 'multi', difficulty: 'Mainstream', mj: false }, reveal: REVEAL(true, true) }) },
  { id: 'tv-clash-bets', label: 'Clash · paris', group: 'tv', comp: 'host', note: 'Les autres parient sur un duelliste ; leurs avatars arrivent par camp.', make: () => base('multi', { phase: 'battle-bet', battle: { a: DA, b: DB, flavor: 'sommet', betBonus: 2400, win: 12000, endsAt: now() + 10000, betMs: 10000, tallyA: [{ id: 'p3', name: 'Léo', avatar: 'ninho' }, { id: 'p5', name: 'Manon', avatar: 'gazo' }], tallyB: [{ id: 'p4', name: 'Sofiane', avatar: 'jul' }] } }) },
  { id: 'tv-clash-play', label: 'Clash · duel en cours', group: 'tv', comp: 'host', note: 'Consigne : titre ET artiste.', make: () => base('multi', { phase: 'battle-play', battle: { a: DA, b: DB, flavor: 'sommet', betBonus: 2400, win: 12000, endsAt: now() + 18000, durationMs: 22000, easeMs: 8000, eased: false } }) },
  { id: 'tv-clash-ease', label: 'Clash · palier « artiste seul »', group: 'tv', comp: 'host', note: "Les 8 dernières secondes : l'artiste seul suffit. La bascule doit se voir de loin.", make: () => base('multi', { phase: 'battle-play', battle: { a: DA, b: DB, flavor: 'rattrapage', betBonus: 2400, win: 12000, endsAt: now() + 7000, durationMs: 22000, easeMs: 8000, eased: true } }) },
  { id: 'tv-trophies', label: 'Remise des trophées (séquence)', group: 'tv', comp: 'host', note: "Un trophée à la fois, décompte auto + « Suivant ». Taille de l'image et du texte.", make: () => base('multi', { phase: 'final', final: FINAL_AW(), __finalStep: 'trophies', __troIdx: 0 }) },
  { id: 'tv-series', label: 'Classement général de la série', group: 'tv', comp: 'host', note: 'Le récap de TOUTE la soirée (échelle TV revue le 2026-07-26).', make: () => base('multi', { phase: 'final', final: FINAL_AW(), __finalStep: 'series' }) },
  { id: 'tv-challenger', label: "Arrivée d'un challenger", group: 'tv', comp: 'host', note: 'Séquence de déblocage (alarme → build → reveal). Le morceau est préchargé en fin de partie.', make: () => base('multi', { phase: 'final', final: FINAL_AW(), __finalStep: 'podium', __unlock: 'diams' }) },
  { id: 'tv-rushend', label: 'Survivor · fin de run + récap', group: 'tv', comp: 'host', note: 'Récap morceau par morceau (réponse du joueur + vérité) puis top mondial.', make: () => base('rush', { phase: 'rushend', rushEnd: RUSH_END() }) },
  { id: 'tv-hub-roster', label: 'Hub · le roster', group: 'tv', comp: 'host', note: 'Consultation du roster sur la TV (façon borne de jeu de combat).', make: () => base('multi', { phase: 'lobby', __hubView: 'roster' }) },
  { id: 'tv-hub-trophies', label: 'Hub · le palmarès', group: 'tv', comp: 'host', note: 'Galerie des trophées (débloqués / à découvrir).', make: () => base('multi', { phase: 'lobby', __hubView: 'trophies' }) },
  { id: 'tv-hub-radio', label: 'Hub · la radio (Spotify)', group: 'tv', comp: 'host', note: "Sans session Spotify : montre l'écran de connexion (et le raccourci 127.0.0.1).", make: () => base('multi', { phase: 'lobby', __hubView: 'radio' }) },
  { id: 'tv-mj', label: 'Maître du jeu · manche (TV)', group: 'tv', comp: 'host', note: "Un joueur anime : pas d'auto-notation, il distribue les points à la voix.", make: () => ({ ...base('multi', { phase: 'playing', round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 22000, durationMs: 30000, mode: 'multi', difficulty: 'Mainstream', mj: true, preview: '', startAt: 0 } }), settings: { ...SETTINGS('multi'), mj: true } }) },

  // ─────────── Téléphone (joueur) ───────────
  { id: 'ph-form', label: 'Formulaire → character-select', group: 'phone', comp: 'player', note: 'Tape un code + un blaze puis « Entre dans le cercle » pour ouvrir le character-select.', session: null, make: () => ({ phase: 'lobby', players: P() }) },
  { id: 'ph-prep', label: 'Fenêtre pouvoirs (Activer/Passer)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'prep', code: 'PUNCH', players: P(), settings: SETTINGS('multi'), round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 9000, mode: 'multi', difficulty: 'Mainstream', prep: true } }) },
  { id: 'ph-playing', label: 'Répondre (Blind Test)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'playing', code: 'PUNCH', players: P(), settings: SETTINGS('multi'), round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 22000, durationMs: 30000, mode: 'multi', difficulty: 'Mainstream', mj: false } }) },
  { id: 'ph-reveal', label: 'Révélation (joueur)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'reveal', code: 'PUNCH', players: P(), settings: SETTINGS('multi'), round: { index: 5, roundIndex: 5, total: 16, mode: 'multi', difficulty: 'Mainstream', mj: false }, reveal: REVEAL(false, false) }) },
  { id: 'ph-buzz', label: 'Buzzer (téléphone)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'playing', code: 'PUNCH', players: P(), settings: SETTINGS('buzzer'), round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 22000, durationMs: 30000, mode: 'buzzer', difficulty: 'Mainstream', mj: false } }) },
  { id: 'ph-quiz', label: 'Quiz (QCM téléphone)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'playing', code: 'PUNCH', players: P(), settings: SETTINGS('quiz'), round: { index: 3, roundIndex: 3, total: 16, endsAt: now() + 18000, durationMs: 20000, mode: 'quiz', difficulty: 'Culture', mj: false, quiz: { id: 1, cat: 'Clashs', q: QUIZ.q, choices: QUIZ.choices } } }) },
  { id: 'ph-final', label: 'Fin de partie (joueur)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'final', code: 'PUNCH', players: P(), settings: SETTINGS('multi'), final: FINAL() }) },
  { id: 'ph-waiting', label: 'Salle d’attente (rejoint en cours)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'playing', __waiting: true, code: 'PUNCH', players: P(), settings: SETTINGS('multi'), round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 22000, durationMs: 30000, mode: 'multi', difficulty: 'Mainstream', mj: false } }) },
  // --- Ecrans TELEPHONE ajoutes le 2026-07-26 (memes raisons : etat local -> inatteignables) ---
  { id: 'ph-charselect', label: 'Character select (choix du rappeur)', group: 'phone', comp: 'player', note: "Showcase + roster par catégorie. Vérifier l'affordance de SCROLL horizontal.", session: null, make: () => ({ phase: 'lobby', players: P(), __step: 'char' }) },
  { id: 'ph-lobby', label: 'Salon (joueur connecté)', group: 'phone', comp: 'player', note: 'Attente du lancement + « Changer de rappeur ».', session: SESSION, make: () => ({ phase: 'lobby', code: 'PUNCH', players: P(), settings: SETTINGS('multi'), __joined: true }) },
  { id: 'ph-changing', label: 'Changer de rappeur', group: 'phone', comp: 'player', note: 'Entre deux parties : rouvre le character select.', session: SESSION, make: () => ({ phase: 'lobby', code: 'PUNCH', players: P(), settings: SETTINGS('multi'), __joined: true, __changing: true }) },
  { id: 'ph-roster', label: 'Le roster (consultation)', group: 'phone', comp: 'player', note: 'Accueil → « Le roster » : fiches, pouvoirs, déblocables en « ??? ».', session: null, make: () => ({ phase: 'lobby', players: P(), __step: 'roster' }) },
  { id: 'ph-trophies', label: 'Le palmarès (galerie)', group: 'phone', comp: 'player', note: "Trophées débloqués / à découvrir. Ils ne s'affichent PLUS en fin de partie (anti-spoil).", session: null, make: () => ({ phase: 'lobby', players: P(), __step: 'trophies' }) },
  { id: 'ph-survivor', label: 'Survivor · joueur', group: 'phone', comp: 'player', note: "Chrono partagé, réponse, « Passer ». La bonne réponse s'annonce à l'enchaînement.", session: SESSION, make: () => ({ phase: 'playing', code: 'PUNCH', players: P(), settings: SETTINGS('rush'), round: RUSH_ROUND(false) }) },
  { id: 'ph-survivor-spec', label: 'Survivor · spectateur', group: 'phone', comp: 'player', note: 'Le Survivor est SOLO : les autres regardent.', session: SESSION, make: () => ({ phase: 'playing', code: 'PUNCH', players: P(), settings: SETTINGS('rush'), round: RUSH_ROUND(true) }) },
  { id: 'ph-rushend', label: 'Survivor · fin de run (joueur)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'rushend', code: 'PUNCH', players: P(), settings: SETTINGS('rush'), rushEnd: RUSH_END() }) },
  { id: 'ph-clash-intro', label: 'Clash · intro (téléphone)', group: 'phone', comp: 'player', session: SESSION, make: () => ({ phase: 'battle-intro', code: 'PUNCH', players: P(), settings: SETTINGS('multi'), battle: { a: DA, b: DB, flavor: 'sommet', betBonus: 2400, win: 12000 } }) },
  { id: 'ph-clash-bet', label: 'Clash · parier', group: 'phone', comp: 'player', note: "Le joueur n'est PAS duelliste : il mise sur un camp.", session: { code: 'PUNCH', playerId: 'p3', name: 'Léo', avatar: 'ninho' }, make: () => ({ phase: 'battle-bet', code: 'PUNCH', players: P(), settings: SETTINGS('multi'), battle: { a: DA, b: DB, flavor: 'sommet', betBonus: 2400, win: 12000, endsAt: now() + 10000, betMs: 10000 } }) },
  { id: 'ph-clash-duel', label: 'Clash · je suis duelliste', group: 'phone', comp: 'player', note: 'Consigne titre + artiste ; le palier bascule sur « artiste seul » en fin.', session: { code: 'PUNCH', playerId: 'p1', name: 'Rafuo', avatar: 'disiz' }, make: () => ({ phase: 'battle-play', code: 'PUNCH', players: P(), settings: SETTINGS('multi'), battle: { a: DA, b: DB, betBonus: 2400, win: 12000, endsAt: now() + 18000, durationMs: 22000, eased: false } }) },
  { id: 'ph-clash-reveal', label: 'Clash · résultat (téléphone)', group: 'phone', comp: 'player', session: { code: 'PUNCH', playerId: 'p3', name: 'Léo', avatar: 'ninho' }, make: () => ({ phase: 'battle-reveal', code: 'PUNCH', players: P(), settings: SETTINGS('multi'), battle: { a: DA, b: DB, betBonus: 2400, win: 12000, reveal: { a: 'p1', b: 'p2', winnerId: 'p1', winnerName: 'Rafuo', draw: false, points: 12000, betBonus: 2400, track: CLASH_TRACK, bets: [{ id: 'p3', won: true, pick: 'a' }, { id: 'p4', won: false, pick: 'b' }], scores: P() } } }) },
  { id: 'ph-mj', label: 'Pupitre Maître du jeu', group: 'phone', comp: 'player', note: 'Le MJ voit la réponse et distribue les points à la voix (+3 000 / +6 000).', session: { code: 'PUNCH', playerId: 'p1', name: 'Rafuo', avatar: 'disiz' }, make: () => ({ phase: 'playing', code: 'PUNCH', settings: { ...SETTINGS('multi'), mj: true }, players: P().map((p) => (p.id === 'p1' ? { ...p, isMJ: true } : p)), round: { index: 5, roundIndex: 5, total: 16, endsAt: now() + 22000, durationMs: 30000, mode: 'multi', difficulty: 'Mainstream', mj: true }, mjTrack: { title: 'DKR', artist: 'Booba', cover: CLASH_TRACK.cover } }) },
  { id: 'ph-suspense', label: 'Révélation · score masqué (joueur)', group: 'phone', comp: 'player', note: 'Fin serrée : le joueur voit son rang mais pas les scores.', session: SESSION, make: () => ({ phase: 'reveal', code: 'PUNCH', players: P(), settings: SETTINGS('multi'), round: { index: 15, roundIndex: 15, total: 16, mode: 'multi', difficulty: 'Mainstream', mj: false }, reveal: REVEAL(true, true) }) },
];
