// Simulateur d'équilibrage — "game tests" automatisés.
// Tous les joueurs ont EXACTEMENT le même skill ; seule leur POWER diffère.
// → le taux de victoire révèle si un pouvoir est trop fort / trop faible.
// Modèle (fidèle aux formules de index.js/match.js, valeurs = source de vérité powers.js) :
//   auditeurs = base(10k/volet, +5k si titre+artiste) × vitesse(1..2) × diff(1.3)
//   charges : 1 au départ, se remplissent en fin de manche (règle comeback), cap 5.
import { POWERS } from './server/powers.js';

const IDS = Object.keys(POWERS);
const rand = () => Math.random();
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const DIFF = 1.3;          // multiplicateur de difficulté (normal)
const P_FIND = 0.7;        // proba de trouver (identique pour tous)
const P_FULL = 0.7;        // si trouvé, proba d'avoir titre + artiste (sinon titre seul)
const WINDOW = 26000;      // fenêtre de réponse (ms) pour modéliser le jam

function fillCharges(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const N = sorted.length;
  sorted.forEach((p, rank) => {
    const fromBottom = N > 1 ? (N - 1 - rank) / (N - 1) : 0;
    const add = 18 + fromBottom * 44; // comeback : les derniers rechargent plus vite
    p.charge += add;
    while (p.charge >= 100 && p.charges < 5) { p.charges += 1; p.charge -= 100; }
    if (p.charge > 100) p.charge = 100;
  });
}

function playGame(avatars, rounds) {
  const players = avatars.map((id) => ({ id, pw: POWERS[id], score: 0, charge: 0, charges: 1, streak: 0, decayUses: 0, vetUntil: -1 }));
  for (let r = 0; r < rounds; r++) {
    const leaderScore = Math.max(...players.map((p) => p.score));
    const leader = players.slice().sort((a, b) => b.score - a.score)[0];
    const muted = new Set();
    let jammer = null;
    // 1) décisions d'activation (si charge dispo) + effets instantanés
    for (const p of players) {
      p.act = null;
      const vetActive = r <= p.vetUntil;
      if (p.charges < 1) continue;
      const t = p.pw.type;
      const behind = leaderScore - p.score;
      let use = false;
      if (t === 'steal') use = p.id !== leader.id && leader.score > 3000;
      else if (t === 'sabotage') use = p.id !== leader.id;
      else if (t === 'comeback') use = behind > (p.pw.cap ? 6000 : 6000);
      else if (t === 'veteran') use = !vetActive; // (ré)active si pas déjà actif
      else if (t === 'safety') use = behind > 3000 || r < rounds - 1; // filet quand utile
      else use = true; // self-boost : on l'utilise dès qu'on a une charge
      if (!use) continue;
      p.charges -= 1; p.act = t;
      if (t === 'steal') { const amt = Math.min(p.pw.amount, leader.score); leader.score -= amt; p.score += amt; }
      else if (t === 'sabotage') {
        const targets = players.filter((x) => x.id !== p.id && !(r <= x.vetUntil) && x.act !== 'safety')
          .sort((a, b) => b.score - a.score).slice(0, p.pw.targets || 1);
        targets.forEach((x) => { muted.add(x.id); if (p.pw.grab) { const amt = Math.min(p.pw.grab, x.score); x.score -= amt; p.score += amt; } });
      }
      else if (t === 'comeback') { const gain = Math.min(p.pw.cap, Math.round(behind * p.pw.factor)); p.score += gain; }
      else if (t === 'veteran') { p.vetUntil = r + (p.pw.rounds - 1); }
      else if (t === 'jam') jammer = p.id;
    }
    // 2) skill de la manche
    for (const p of players) {
      let pf = P_FIND;
      if (p.act === 'hint') pf = Math.min(0.97, pf * 1.35); // l'indice aide à trouver
      p.found = rand() < pf;
      p.full = rand() < P_FULL;
      if (p.act === 'nofault' || p.act === 'ace') p.full = true; // fautes tolérées → volet complet
      p.speed = p.act === 'freeze' ? 1 : rand();               // freeze : vitesse max
    }
    const fastest = players.filter((p) => p.found).sort((a, b) => b.speed - a.speed)[0];
    // 3) points de la manche
    for (const p of players) {
      let base = p.found ? (p.full ? 25000 : 10000) : 0;
      if (jammer && p.id !== jammer && p.found) base *= (1 - ((POWERS[jammer]?.ms) || 4000) / WINDOW); // brouillé : temps perdu
      let pts = Math.round(base * (1 + p.speed) * DIFF);
      const t = p.act;
      if (pts > 0 && (t === 'double' || t === 'ace')) pts = Math.round(pts * (p.pw.mult || 2));
      else if (t === 'wager') pts = p.found ? Math.round(pts * p.pw.mult) : -p.pw.penalty;
      else if (pts > 0 && t === 'bonus') { pts += p.pw.amount; if (p.pw.refuel) p.charges = Math.min(5, p.charges + 1); } // PLK : surrégime
      else if (pts > 0 && t === 'momentum') pts += p.pw.base + p.streak * p.pw.per;
      else if (pts > 0 && t === 'decay') { pts += Math.round(p.pw.base * Math.pow(p.pw.factor || 0.75, p.decayUses)); p.decayUses++; }
      else if (pts > 0 && t === 'firstblood') { pts += (p.pw.base || 0); if (fastest && fastest.id === p.id) pts += (p.pw.first || 0); }
      if (muted.has(p.id)) pts = 0;
      if (pts > 0 && t && p.pw.self) pts += p.pw.self; // gain perso des pouvoirs utilitaires
      const vetActive = r <= p.vetUntil;
      if (p.act === 'safety') pts = Math.max(pts, p.pw.floor);
      if (vetActive) pts = Math.max(pts, p.pw.floor || 4000);
      p.roundPts = pts;
    }
    // 4) application + séries + charges
    for (const p of players) { p.score = Math.max(0, p.score + p.roundPts); p.streak = p.roundPts > 0 ? p.streak + 1 : 0; }
    fillCharges(players);
  }
  return players.slice().sort((a, b) => b.score - a.score); // classement final
}

// ---- run ----
const GAMES = 6000, N = 5, ROUNDS = 16;
const stat = {}; IDS.forEach((id) => (stat[id] = { games: 0, wins: 0, rankSum: 0, scoreSum: 0 }));
for (let g = 0; g < GAMES; g++) {
  const roster = [...IDS].sort(() => rand() - 0.5).slice(0, N);
  const final = playGame(roster, ROUNDS);
  final.forEach((p, i) => { const s = stat[p.id]; s.games++; s.rankSum += i + 1; if (i === 0) s.wins++; s.scoreSum += p.score; });
}
const rows = IDS.map((id) => {
  const s = stat[id];
  const winRate = s.wins / s.games;
  return { id, name: POWERS[id].name, type: POWERS[id].type, winRate, idx: winRate / (1 / N), avgRank: s.rankSum / s.games, avgScore: Math.round(s.scoreSum / s.games) };
}).sort((a, b) => b.winRate - a.winRate);

const tier = (idx) => idx >= 1.35 ? 'S' : idx >= 1.12 ? 'A' : idx >= 0.9 ? 'B' : idx >= 0.7 ? 'C' : 'D';
console.log(`\n=== ${GAMES} parties · ${N} joueurs · ${ROUNDS} manches · skill égal (attendu = 20% victoire) ===\n`);
console.log('TIER  IDX   WIN%   RANK  ' + 'RAPPEUR'.padEnd(14) + 'POUVOIR');
for (const r of rows) {
  console.log(
    `${tier(r.idx).padEnd(4)} ${r.idx.toFixed(2)}  ${(r.winRate * 100).toFixed(1).padStart(4)}%  ${r.avgRank.toFixed(2)}  ` +
    `${r.id.padEnd(14)}${r.type}`
  );
}
