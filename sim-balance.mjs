// Simulateur d'équilibrage — "game tests" automatisés.
// Tous les joueurs ont EXACTEMENT le même skill ; seule leur POWER diffère.
// → le taux de victoire révèle si un pouvoir est trop fort / trop faible.
//
// IMPORTANT — on teste sur les 4 DIFFICULTÉS (facile→puriste). Un pouvoir n'a pas la même valeur selon
// la difficulté : ex. l'INDICE (hint) n'aide que si on NE trouve PAS tout seul (donc utile en digger/
// puriste, quasi inutile en facile où tout le monde trouve). À l'inverse, les pouvoirs de POINTS (bonus,
// double, momentum…) rapportent quelle que soit la difficulté. On regarde donc winrate PAR difficulté +
// une moyenne. Modèle fidèle à index.js/match.js ; valeurs = powers.js.
import { POWERS } from './server/powers.js';

const IDS = Object.keys(POWERS);
const rand = () => Math.random();

// profils de difficulté : proba de trouver (pFind), proba titre+artiste (pFull), multiplicateur (diff).
// Collés aux 4 crans du jeu (facile 1.0 · connaisseur 1.3 · digger 1.6 · puriste 2.0).
const DIFFS = [
  { key: 'facile',  pFind: 0.90, pFull: 0.80, diff: 1.0 },
  { key: 'normal',  pFind: 0.72, pFull: 0.66, diff: 1.3 },
  { key: 'digger',  pFind: 0.55, pFull: 0.54, diff: 1.6 },
  { key: 'puriste', pFind: 0.40, pFull: 0.44, diff: 2.0 },
];
const WINDOW = 26000; // fenêtre de réponse (ms) pour modéliser le jam

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

function playGame(avatars, rounds, prof) {
  const players = avatars.map((id) => ({ id, pw: POWERS[id], score: 0, charge: 0, charges: 1, streak: 0, decayUses: 0, vetUntil: -1, sustainUntil: -1, sustainAmount: 0 }));
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
      else if (t === 'sabotage') use = p.id !== leader.id && leader.score > 3000;
      else if (t === 'tax') use = players.some((x) => x.id !== p.id && x.score > 2000);
      else if (t === 'draft') use = p.id !== leader.id; // surfe sur un meilleur que toi
      else if (t === 'comeback') use = behind > 6000;
      else if (t === 'veteran') use = !vetActive; // (ré)active si pas déjà actif
      else if (t === 'safety') use = behind > 3000 || r < rounds - 1; // filet quand utile
      else use = true; // self-boost / allin / combo / sustain : dès qu'on a une charge
      if (!use) continue;
      p.charges -= 1; p.act = t;
      if (t === 'steal') { const amt = Math.min(p.pw.amount, leader.score); leader.score -= amt; p.score += amt; }
      else if (t === 'sabotage') {
        const targets = players.filter((x) => x.id !== p.id && !(r <= x.vetUntil) && x.act !== 'safety')
          .sort((a, b) => b.score - a.score).slice(0, p.pw.targets || 1);
        targets.forEach((x) => { muted.add(x.id); if (p.pw.grab) { const amt = Math.min(p.pw.grab, x.score); x.score -= amt; p.score += amt; } });
      }
      else if (t === 'tax') { players.filter((x) => x.id !== p.id && !(r <= x.vetUntil) && x.act !== 'safety').forEach((x) => { const amt = Math.min(p.pw.amount || 2500, x.score); x.score -= amt; p.score += amt; }); }
      else if (t === 'allin') { const spent = p.charges + 1; p.score += (p.pw.per || 12000) * spent; p.charges = 0; } // +1 : la charge déjà décrémentée
      else if (t === 'sustain') { p.sustainUntil = r + ((p.pw.rounds || 2) - 1); p.sustainAmount = p.pw.amount || 8000; }
      else if (t === 'comeback') { const gain = Math.min(p.pw.cap, Math.round(behind * p.pw.factor)); p.score += gain; }
      else if (t === 'veteran') { p.vetUntil = r + (p.pw.rounds - 1); }
      else if (t === 'jam') jammer = p.id;
      // combo & draft : pas d'effet instantané (résolus au scoring / en fin de manche)
    }
    // 2) skill de la manche (dépend de la difficulté)
    for (const p of players) {
      let pf = prof.pFind;
      if (p.act === 'hint') pf = Math.min(0.98, pf + (1 - pf) * 0.55); // l'indice comble une PART de ce qu'on rate → fort en difficile, ~inutile en facile
      p.found = rand() < pf;
      p.full = rand() < prof.pFull;
      if (p.act === 'nofault' || p.act === 'ace') p.full = true; // fautes tolérées → volet complet
      p.speed = p.act === 'freeze' ? 1 : rand();               // freeze : vitesse max
    }
    const fastest = players.filter((p) => p.found).sort((a, b) => b.speed - a.speed)[0];
    // 3) points de la manche
    for (const p of players) {
      let base = p.found ? (p.full ? 25000 : 10000) : 0;
      if (jammer && p.id !== jammer && p.found) base *= (1 - ((POWERS[jammer]?.ms) || 4000) / WINDOW); // brouillé : temps perdu
      let pts = Math.round(base * (1 + p.speed) * prof.diff);
      const t = p.act;
      if (pts > 0 && (t === 'double' || t === 'ace')) pts = Math.round(pts * (p.pw.mult || 2));
      else if (pts > 0 && t === 'combo') { const mult = Math.min(p.pw.cap || 2.2, (p.pw.base || 1.3) + p.streak * (p.pw.per || 0.3)); pts = Math.round(pts * mult); }
      else if (t === 'wager') pts = p.found ? Math.round(pts * p.pw.mult) : -p.pw.penalty;
      else if (pts > 0 && t === 'bonus') { pts += p.pw.amount; if (p.pw.refuel) p.charges = Math.min(5, p.charges + 1); }
      else if (pts > 0 && t === 'momentum') pts += p.pw.base + p.streak * p.pw.per;
      else if (pts > 0 && t === 'decay') { pts += Math.round(p.pw.base * Math.pow(p.pw.factor || 0.75, p.decayUses)); p.decayUses++; }
      else if (pts > 0 && t === 'firstblood') { pts += (p.pw.base || 0); if (fastest && fastest.id === p.id) pts += (p.pw.first || 0); }
      if (muted.has(p.id)) pts = 0;
      if (pts > 0 && t && p.pw.self) pts += p.pw.self; // gain perso des pouvoirs utilitaires
      const vetActive = r <= p.vetUntil;
      if (p.act === 'safety') pts = Math.max(pts, p.pw.floor);
      if (vetActive) pts = Math.max(pts, p.pw.floor || 4000);
      if (p.sustainUntil >= r && p.sustainAmount) pts += p.sustainAmount; // revenu garanti (sustain, survit au mute)
      p.roundPts = pts;
    }
    // draft : chaque "aspirateur" prend une part du MEILLEUR score adverse de la manche
    for (const p of players) { if (p.act === 'draft') { let om = 0; for (const x of players) if (x.id !== p.id && x.roundPts > om) om = x.roundPts; p.roundPts += Math.round((p.pw.frac || 0.5) * om); } }
    // 4) application + séries + charges
    for (const p of players) { p.score = Math.max(0, p.score + p.roundPts); p.streak = p.roundPts > 0 ? p.streak + 1 : 0; }
    fillCharges(players);
  }
  return players.slice().sort((a, b) => b.score - a.score);
}

// ---- run : chaque difficulté séparément, puis moyenne ----
const GAMES = 4000, N = 5, ROUNDS = 16;
const perDiff = {}; // perDiff[diffKey][id] = winRate
for (const prof of DIFFS) {
  const stat = {}; IDS.forEach((id) => (stat[id] = { games: 0, wins: 0 }));
  for (let g = 0; g < GAMES; g++) {
    const roster = [...IDS].sort(() => rand() - 0.5).slice(0, N);
    const final = playGame(roster, ROUNDS, prof);
    final.forEach((p, i) => { const s = stat[p.id]; s.games++; if (i === 0) s.wins++; });
  }
  perDiff[prof.key] = {}; IDS.forEach((id) => (perDiff[prof.key][id] = stat[id].wins / stat[id].games));
}

const rows = IDS.map((id) => {
  const byDiff = DIFFS.map((d) => perDiff[d.key][id]);
  const avg = byDiff.reduce((a, b) => a + b, 0) / byDiff.length;
  return { id, type: POWERS[id].type, avg, byDiff, spread: Math.max(...byDiff) - Math.min(...byDiff) };
}).sort((a, b) => b.avg - a.avg);

const tier = (idx) => idx >= 1.35 ? 'S' : idx >= 1.12 ? 'A' : idx >= 0.9 ? 'B' : idx >= 0.7 ? 'C' : 'D';
console.log(`\n=== ${GAMES} parties/difficulté · ${N} joueurs · ${ROUNDS} manches · skill égal (attendu = 20%) ===`);
console.log(`(spread = écart facile↔puriste : gros spread = pouvoir très sensible à la difficulté)\n`);
console.log('TIER  MOY%  ' + 'FACILE NORMAL DIGGER PURIST  SPRD  ' + 'RAPPEUR'.padEnd(13) + 'POUVOIR');
for (const r of rows) {
  const idx = r.avg / (1 / N);
  const cols = r.byDiff.map((w) => (w * 100).toFixed(1).padStart(6)).join(' ');
  console.log(
    `${tier(idx).padEnd(4)} ${(r.avg * 100).toFixed(1).padStart(4)}  ${cols}  ${(r.spread * 100).toFixed(1).padStart(4)}  ` +
    `${r.id.padEnd(13)}${r.type}`
  );
}
