// Trophées de fin de partie — façon TowerFall Ascension.
// À la fin de CHAQUE partie on décerne jusqu'à 3 récompenses, piochées selon ce qui s'est RÉELLEMENT
// passé pendant la partie (pas forcément une par joueur). Chaque trophée = titre évocateur + petite
// explication. Source de vérité = ce fichier ; l'icône (SVG) vit côté client (data.ts → AWARD_ICONS).
//
// Chaque award : { id, title, icon, weight, pick(list, ctx) -> { playerId, desc } | null }.
//  - list = joueurs actifs (non-MJ) normalisés : { id, name, score, rank(1..N), ...stats }.
//  - ctx  = { N, total, mode, fmt } (fmt = format d'auditeurs fr-FR).
//  - weight = priorité (plus haut = plus « rare/rigolo » → préféré quand on doit choisir).
// Stats par joueur (server/index.js les remplit) : att, scored, perfect, firsts, best, zeros, powers,
// denial, gamble, solo, firstHalf, secondHalf, worstRank.

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// meilleur joueur selon val() ; null si sous le seuil min. Égalités départagées au hasard (variété).
function top(list, val, min) {
  let bv = -Infinity, ties = [];
  for (const p of list) {
    const v = val(p);
    if (v == null || Number.isNaN(v)) continue;
    if (v > bv) { bv = v; ties = [p]; }
    else if (v === bv) ties.push(p);
  }
  if (!ties.length || (min != null && bv < min)) return null;
  return { player: rand(ties), value: bv };
}

export const AWARDS = [
  { id: 'comeback', title: 'Comeback King', icon: 'up', weight: 10, pick(list, c) {
    if (c.N < 3) return null;
    // vrai comeback = a fini 1er ET a VRAIMENT traîné au fond (plusieurs manches), pas juste un creux d'une manche
    const cands = list.filter((p) => p.rank === 1 && p.worstRank >= Math.ceil(c.N * 0.7) && p.lowRounds >= Math.max(2, Math.ceil((c.total || 0) * 0.3)));
    if (!cands.length) return null;
    const p = rand(cands);
    return { playerId: p.id, desc: `Longtemps scotché au fond du classement, ${p.name} rafle tout sur la fin.` };
  } },
  { id: 'ecrasant', title: 'Rouleau Compresseur', icon: 'crown', weight: 8, pick(list, c) {
    if (c.N < 2) return null;
    const s = [...list].sort((a, b) => b.score - a.score);
    if (s[0].score < 30000 || s[0].score < s[1].score * 1.8) return null;
    return { playerId: s[0].id, desc: `Victoire écrasante — personne n'a jamais été au niveau.` };
  } },
  { id: 'photofinish', title: 'Photo Finish', icon: 'flag', weight: 9, pick(list, c) {
    if (c.N < 2) return null;
    const s = [...list].sort((a, b) => b.score - a.score);
    if (s[0].score <= 0 || (s[0].score - s[1].score) > s[0].score * 0.05) return null;
    return { playerId: s[0].id, desc: `Gagné sur le fil face à ${s[1].name} — ${c.fmt(s[0].score - s[1].score)} auditeurs d'écart.` };
  } },
  { id: 'mitraillette', title: 'La Mitraillette', icon: 'spray', weight: 7, pick(list, c) {
    // seulement les vrais ARROSEURS (beaucoup de tentatives, PEU de trouvailles) — jamais le vainqueur qui tape juste
    const sprayers = list.filter((p) => p.scored <= Math.ceil((c.total || 0) * 0.4));
    const r = top(sprayers, (p) => p.att, Math.max(8, c.total + 3));
    if (!r) return null;
    return { playerId: r.player.id, desc: `${r.value} réponses balancées dans le tas. Au moins il aura essayé.` };
  } },
  { id: 'sniper', title: 'Le Sniper', icon: 'target', weight: 9, pick(list) {
    const r = top(list.filter((p) => p.att >= 3 && p.scored >= 3), (p) => p.scored / p.att, 0.85);
    if (!r) return null;
    const p = r.player;
    return { playerId: p.id, desc: `${p.scored} trouvailles pour ${p.att} tentatives — précision chirurgicale.` };
  } },
  { id: 'machine', title: 'La Machine', icon: 'gauge', weight: 6, pick(list, c) {
    const r = top(list, (p) => p.scored, Math.ceil(c.total * 0.6));
    if (!r || c.total < 5) return null;
    return { playerId: r.player.id, desc: `A marqué sur ${r.value} manches sur ${c.total}. Increvable.` };
  } },
  { id: 'reflexe', title: 'Réflexe Éclair', icon: 'bolt', weight: 8, pick(list) {
    const r = top(list, (p) => p.firsts, 2);
    if (!r) return null;
    return { playerId: r.player.id, desc: `Premier à dégainer ${r.value} fois. Le doigt sur la gâchette.` };
  } },
  { id: 'sansfaute', title: 'Sans-Faute', icon: 'check', weight: 8, pick(list) {
    const r = top(list, (p) => p.perfect, 2);
    if (!r) return null;
    return { playerId: r.player.id, desc: `${r.value} manches titre ET artiste. Le boulot bien fait.` };
  } },
  // (« Le Puriste » retiré : faisait doublon avec « Sans-Faute » — les deux se basent sur les manches perfect titre+artiste)
  { id: 'diamant', title: 'Le Gros Move', icon: 'diamond', weight: 7, pick(list, c) {
    const r = top(list, (p) => p.best, 40000);
    if (!r) return null;
    return { playerId: r.player.id, desc: `+${c.fmt(r.value)} auditeurs d'un seul coup. La manche parfaite.` };
  } },
  { id: 'solo', title: 'Cavalier Seul', icon: 'flag', weight: 8, pick(list) {
    const r = top(list, (p) => p.solo, 2);
    if (!r) return null;
    return { playerId: r.player.id, desc: `${r.value} manches où lui seul a reconnu le son.` };
  } },
  { id: 'metronome', title: 'Le Métronome', icon: 'gauge', weight: 8, pick(list, c) {
    if (c.total < 6) return null;
    const cands = list.filter((p) => p.zeros === 0 && p.scored === c.total);
    if (!cands.length) return null;
    const p = rand(cands);
    return { playerId: p.id, desc: `Pas une seule manche à zéro. Régulier comme un métronome.` };
  } },
  { id: 'feudepaille', title: 'Feu de Paille', icon: 'fire', weight: 7, pick(list, c) {
    if (c.total < 6) return null;
    const cands = list.filter((p) => p.firstHalf > 15000 && p.secondHalf < p.firstHalf * 0.25);
    if (!cands.length) return null;
    const p = rand(cands);
    return { playerId: p.id, desc: `Parti comme une fusée, fini à l'arrêt. Le classique.` };
  } },
  { id: 'diesel', title: 'Le Diesel', icon: 'snail', weight: 7, pick(list, c) {
    if (c.total < 6) return null;
    const cands = list.filter((p) => p.secondHalf > 15000 && p.firstHalf < p.secondHalf * 0.25);
    if (!cands.length) return null;
    const p = rand(cands);
    return { playerId: p.id, desc: `Démarrage poussif, finish canon. Il lui fallait juste chauffer.` };
  } },
  { id: 'braqueur', title: 'Les Impôts', icon: 'mask', weight: 7, pick(list) { // (id 'braqueur' conservé pour ne pas casser les déblocages déjà enregistrés)
    const cands = list.filter((p) => p.denialGain > 0); // a RÉELLEMENT dépouillé (vol/dîme/musellement effectif), pas juste activé un pouvoir sans cible
    if (!cands.length) return null;
    const p = rand(cands);
    return { playerId: p.id, desc: `A prélevé sa part sur le dos des autres. Personne n'échappe au fisc.` };
  } },
  { id: 'kamikaze', title: 'Le Poker', icon: 'dice', weight: 7, pick(list) { // (id 'kamikaze' conservé pour les déblocages déjà enregistrés)
    const cands = list.filter((p) => p.gamble);
    if (!cands.length) return null;
    const p = rand(cands);
    return { playerId: p.id, desc: `A tout misé sur un coup de poker. Faut avoir les nerfs.` };
  } },
  { id: 'sage', title: 'Le Sage', icon: 'feather', weight: 8, pick(list, c) {
    if (c.mode === 'quiz' || c.mj) return null; // en Quiz/MJ les pouvoirs sont désactivés pour TOUS → « zéro pouvoir » n'a aucun sens
    const cands = list.filter((p) => p.powers === 0 && p.rank <= Math.ceil(c.N / 2) && p.score > 0);
    if (!cands.length || c.N < 2) return null;
    const p = rand(cands);
    return { playerId: p.id, desc: `Zéro pouvoir activé. Que du talent brut. Respect.` };
  } },
  { id: 'muet', title: 'Le Muet', icon: 'ghost', weight: 6, pick(list) {
    const cands = list.filter((p) => p.att === 0);
    if (!cands.length) return null;
    const p = rand(cands);
    return { playerId: p.id, desc: `Pas une seule réponse tentée de toute la partie. Présent, déjà.` };
  } },
  { id: 'fantome', title: 'Le Fantôme', icon: 'ghost', weight: 5, pick(list, c) {
    if (c.total < 5) return null;
    const r = top(list, (p) => p.zeros, Math.ceil(c.total * 0.6));
    if (!r) return null;
    return { playerId: r.player.id, desc: `${r.value} manches à zéro pointé. On l'a à peine entendu.` };
  } },
  { id: 'lanterne', title: 'La Lanterne Rouge', icon: 'skull', weight: 5, pick(list, c) {
    if (c.N < 3) return null;
    const s = [...list].sort((a, b) => b.score - a.score);
    const last = s[s.length - 1];
    if (last.score >= s[0].score) return null;
    return { playerId: last.id, desc: `Dernier du classement. Quelqu'un doit bien fermer la marche.` };
  } },
  { id: 'touriste', title: 'Le Touriste', icon: 'ghost', weight: 5, pick(list, c) {
    if (c.N < 2) return null;
    const cands = list.filter((p) => p.score <= 0);
    if (!cands.length) return null;
    const p = rand(cands);
    return { playerId: p.id, desc: `Zéro auditeur au compteur. T'es venu visiter ou jouer, ${p.name} ?` };
  } },
  { id: 'frimeur', title: 'Le Frimeur', icon: 'mask', weight: 6, pick(list, c) {
    if (c.N < 3) return null;
    const cands = list.filter((p) => p.rank === c.N && p.powers >= 2);
    if (!cands.length) return null;
    const p = rand(cands);
    return { playerId: p.id, desc: `${p.powers} pouvoirs claqués… pour finir bon dernier. La grosse lose.` };
  } },
  { id: 'radin', title: 'Le Radin', icon: 'skull', weight: 6, pick(list, c) {
    if (c.N < 3 || c.mode === 'quiz' || c.mj) return null; // Quiz/MJ : pouvoirs désactivés pour tous → pas de « radin »
    const cands = list.filter((p) => p.rank === c.N && p.powers === 0);
    if (!cands.length) return null;
    const p = rand(cands);
    return { playerId: p.id, desc: `Dernier sans avoir lâché UN seul pouvoir. Fallait s'en servir, tocard.` };
  } },
  { id: 'perdantmagnifique', title: 'Le Perdant Magnifique', icon: 'up', weight: 7, pick(list, c) {
    if (c.N < 3) return null;
    const s = [...list].sort((a, b) => b.score - a.score);
    if (s.length < 2 || s[1].score <= 0 || s[1].score < s[0].score * 0.85) return null;
    return { playerId: s[1].id, desc: `Une partie énorme… et 2ᵉ quand même. Rageant.` };
  } },
  { id: 'sanspitie', title: 'Le Sans-Pitié', icon: 'mask', weight: 7, pick(list, c) {
    if (c.N < 3) return null;
    const s = [...list].sort((a, b) => b.score - a.score);
    if (s[0].rank !== 1 || !(s[0].denialGain > 0)) return null; // a gagné ET dépouillé pour de vrai
    return { playerId: s[0].id, desc: `Pas assez de gagner : il a fallu en plus dépouiller tout le monde.` };
  } },
  { id: 'champion', title: 'La Ceinture', icon: 'crown', weight: 2, pick(list) {
    const s = [...list].sort((a, b) => b.score - a.score);
    if (!s.length || s[0].score <= 0) return null;
    return { playerId: s[0].id, desc: `Champion de la partie. La ceinture est à lui.` };
  } },
  { id: 'alancienne', title: 'À l\'Ancienne', icon: 'vinyl', weight: 9, pick(list, c) {
    // n'a reconnu QUE des sons d'avant 2010 — et il y avait bien du récent à trouver aussi (sinon c'est gratuit)
    if (c.mode === 'quiz' || !c.hadModern) return null;
    const cands = list.filter((p) => p.datedFinds >= 4 && p.oldFinds === p.datedFinds);
    if (!cands.length) return null;
    const p = rand(cands);
    return { playerId: p.id, desc: `Que des classiques d'avant 2010 — ${p.name} s'est arrêté à l'époque du CD. Le vrai goût.` };
  } },
  { id: 'releve', title: 'La Relève', icon: 'sprout', weight: 8, pick(list, c) {
    // le pendant moderne : n'a reconnu QUE du 2020+ — et il y avait bien du vieux à trouver aussi
    if (c.mode === 'quiz' || !c.hadOld) return null;
    const cands = list.filter((p) => p.datedFinds >= 4 && p.newFinds === p.datedFinds);
    if (!cands.length) return null;
    const p = rand(cands);
    return { playerId: p.id, desc: `Que du 2020 et après — ${p.name} est né dans l'auto-tune. Les anciens ? Connaît pas.` };
  } },
];

// Décerne jusqu'à `max` trophées. On évalue tous les détecteurs, on trie par poids (+ un peu d'aléa
// pour la variété : « pas tout le temps les mêmes »), puis on pioche en essayant de varier les joueurs.
export function computeAwards(active, ctx, max = 3) {
  if (!active.length) return [];
  const s = [...active].sort((a, b) => b.score - a.score);
  const list = s.map((p, i) => ({
    id: p.id, name: p.name, score: p.score, rank: i + 1,
    att: p.stat?.att || 0, scored: p.stat?.scored || 0, perfect: p.stat?.perfect || 0,
    firsts: p.stat?.firsts || 0, best: p.stat?.best || 0, zeros: p.stat?.zeros || 0,
    powers: p.stat?.powers || 0, denial: !!p.stat?.denial, gamble: !!p.stat?.gamble,
    solo: p.stat?.solo || 0, firstHalf: p.stat?.firstHalf || 0, secondHalf: p.stat?.secondHalf || 0,
    worstRank: p.stat?.worstRank || (i + 1), lowRounds: p.stat?.lowRounds || 0, denialGain: p.stat?.denialGain || 0,
    datedFinds: p.stat?.datedFinds || 0, oldFinds: p.stat?.oldFinds || 0, newFinds: p.stat?.newFinds || 0,
  }));
  const c = { N: list.length, total: ctx.total || 0, mode: ctx.mode, mj: !!ctx.mj, hadModern: !!ctx.hadModern, hadOld: !!ctx.hadOld, fmt: ctx.fmt || ((n) => String(Math.round(n || 0))) };
  const hits = [];
  for (const a of AWARDS) {
    let res = null;
    try { res = a.pick(list, c); } catch { res = null; }
    if (res && res.playerId) hits.push({ id: a.id, title: a.title, icon: a.icon, weight: a.weight, ...res });
  }
  // Sélection à VRAIE VARIÉTÉ : tirage aléatoire PONDÉRÉ par le poids (Efraimidis-Spirakis : clé = rand^(1/poids)).
  // Un poids fort reste favorisé mais ne gagne plus systématiquement — un w=2 bat un w=10 ~17 % du temps.
  // De plus, on DÉCOTE (×0.35) les trophées décernés à la partie PRÉCÉDENTE (ctx.recentIds) : l'assortiment
  // tourne d'une partie à l'autre → on ne retombe pas toujours sur les mêmes, on sent qu'on peut en débloquer d'autres.
  // VARIÉTÉ SUR LA SÉRIE. ctx.recentGames = ids des dernières parties (la + récente en tête). Deux règles :
  //  (1) ROTATION DURE : on ne re-décerne PAS un trophée vu dans les RECENT_WIN dernières parties tant qu'il reste
  //      d'autres trophées « frais » déclenchés pour remplir → l'assortiment tourne vraiment (fini « toujours les mêmes »).
  //  (2) COUVERTURE : un trophée JAMAIS décerné de la série est boosté (×2.6) → on finit par voir les rares.
  //  Fallback : s'il n'y a pas assez de frais, on complète avec les récents (mieux vaut 3 trophées qu'un seul).
  const log = ctx.recentGames || [];
  const counts = ctx.counts || {};
  const RECENT_WIN = 3;
  const agoOf = (id) => { for (let i = 0; i < log.length; i++) if (log[i] && log[i].includes(id)) return i + 1; return Infinity; };
  const fresh = (h) => agoOf(h.id) > RECENT_WIN;
  // tirage pondéré (Efraimidis-Spirakis) : poids de base × boost de couverture pour le jamais-vu
  for (const h of hits) { const boost = (counts[h.id] || 0) === 0 ? 2.6 : 1; h.k = Math.pow(Math.random(), 1 / Math.max(0.4, h.weight * boost)); }
  hits.sort((x, y) => y.k - x.k);
  const out = [], usedAwards = new Set(), usedPlayers = new Set();
  // passes successives : FRAIS d'abord (1 trophée/joueur, puis 2e/joueur), puis fallback sur les récents pour remplir
  const passes = [
    (h) => fresh(h) && !usedPlayers.has(h.playerId),
    (h) => fresh(h),
    (h) => !usedPlayers.has(h.playerId),
    () => true,
  ];
  for (const ok of passes) {
    for (const h of hits) {
      if (out.length >= max) break;
      if (usedAwards.has(h.id) || !ok(h)) continue;
      out.push(h); usedAwards.add(h.id); usedPlayers.add(h.playerId);
    }
    if (out.length >= max) break;
  }
  return out.map(({ id, title, icon, playerId, desc }) => ({ id, title, icon, playerId, desc }));
}
