// Un pouvoir par rappeur, singulier + collé à la carrière. Unité = AUDITEURS.
// Valeurs CALIBRÉES par simulation (node sim-balance.mjs) : à skill égal, viser un delta serré
// (~16-24 % de victoire pour tous ; attendu 20 % à 5 joueurs). Aucun écrasant, aucun inutile.
// Les pouvoirs DÉFENSIFS (safety) ont un petit `self` offensif (moins fort que les autres) pour
// rester dans la course. Denial (sabotage) : petit `grab`. Utilitaires (hint/jam/freeze) : `self`.
//
// Mécaniques : double{mult}, bonus{amount,refuel}, wager{mult,penalty}, steal{amount},
//   sabotage{targets,grab}, hint{self}, safety{floor,self}, momentum{base,per}, decay{base,factor},
//   comeback{factor,cap}, firstblood{base,first}, veteran{rounds,floor}, freeze{self}, jam{ms,self},
//   nofault{self}, ace{mult}(nofault+double),
//   tax{amount}(prélève à TOUS), allin{per}(vide toutes les charges → per×charges), draft{frac}(part du
//   meilleur score adverse de la manche), combo{base,per,cap}(×mult qui grossit avec la série),
//   sustain{amount,rounds}(revenu garanti pendant N manches — echo/slowburn).
export const POWERS = {
  // ===== S — légendes / élite =====
  booba:      { name: 'DUC',                    type: 'steal',    amount: 8400, shield: true }, // vole le meneur ET devient intouchable ce tour (utile même quand Booba mène → il peut enfin défendre)
  iam:        { name: "L'École du Micro",       type: 'safety',   floor: 14400, self: 9400 },
  solaar:     { name: 'Le Prince des Mots',     type: 'nofault',  self: 10200 },
  ntm:        { name: 'Police',                 type: 'sabotage', targets: 2 },
  pnl:        { name: 'Onizuka',                type: 'double',   mult: 1.7 },
  damso:      { name: 'Le Vice',                type: 'firstblood', base: 9000, first: 21000 },
  nekfeu:     { name: 'Feu',                    type: 'double',   mult: 1.7 },
  jul:        { name: 'La Machine',             type: 'momentum', base: 10400, per: 3600, cap: 18000 }, // force d'origine mais PLAFONNÉE : sans cap, s'emballait à 45 %+ en facile
  ninho:      { name: 'Certifié Diamant',       type: 'combo',    base: 1.3, per: 0.25, cap: 1.9 }, // enchaîne les certifs : ×mult qui grossit avec la série
  orelsan:    { name: 'Basique',                type: 'comeback', factor: 0.55, cap: 19200 },
  alphawann:  { name: "Une Main Lave l'Autre",  type: 'ace',      mult: 1.3 },
  // ===== A — très forts =====
  oxmo:       { name: 'Mines de Cristal',       type: 'hint',     self: 6600 },
  kery:       { name: 'Banlieusards',           type: 'comeback', factor: 0.55, cap: 19800 },
  youssoupha: { name: 'Éternel Recommencement', type: 'momentum', base: 10400, per: 3600, cap: 18000 },
  sch:        { name: 'JVLIVS',                 type: 'wager',    mult: 1.8, penalty: 12000 },
  gims:       { name: 'Sapés comme jamais',     type: 'decay',    base: 19800, factor: 0.9 },
  rohff:      { name: "Le Code de l'Honneur",   type: 'tax',      amount: 2520 }, // le padre prélève sa dîme sur TOUS (calibré à 4200 sur l'ancienne échelle — bord haut ~27,7% → ~24% ; le tax est très sensible — puis ×0.6 lors du passage à l'échelle SNEP)
  kaaris:     { name: 'Or Noir',               type: 'wager',    mult: 1.85, penalty: 18000 },
  gazo:       { name: 'Drill',                  type: 'steal',    amount: 9000 },
  laylow:     { name: 'Trinity',                type: 'freeze',   self: 8200 },
  vald:       { name: 'NQNT',                   type: 'jam',      ms: 4500, self: 11000 },
  plk:        { name: 'Polak',                  type: 'bonus',    amount: 4300, refuel: true }, // refuel = charge rendue si tu marques → en Mainstream (on marque ~90%) le bonus tourne à CHAQUE manche : il est payé ~14× par partie, donc le montant doit rester PETIT (à 7500 : 50% de winrate en facile, spread 32 ; à 4600 : ~21%, spread ~2)
  // ===== B — solides / montants =====
  fabe:       { name: 'Le Fond et la Forme',    type: 'veteran',  rounds: 3, floor: 10200 },
  medine:     { name: "Don't Panik",            type: 'safety',   floor: 12000, self: 9800 },
  lafouine:   { name: 'Capitale du Crime',      type: 'sabotage', grab: 4800 },
  jewelusain: { name: 'Bruce Lee',             type: 'sustain',  amount: 6000, rounds: 2 }, // ça résonne (auditeurs cette manche + la suivante) — calibré à 10000 sur l'ancienne échelle (bord haut ~27,8% → ~23%), puis ×0.6 lors du passage à l'échelle SNEP
  // ===== Génies incompris — rappeurs-mèmes ratés : VOLONTAIREMENT les plus faibles (gagnable mais dur).
  //   Bishok = exception "rigolote" (hint, correct). Les 3 autres = EV basse assumée. =====
  bishok:     { name: 'Complotisme',              type: 'hint',       self: 8400 },   // décrypte le "message caché"
  bilaldu92:  { name: 'Le Buzz 2006',             type: 'firstblood', base: 3000, first: 10800 }, // 1 seul buzz (2006) : maigre, gros QUE si 1er
  alexdu76:   { name: 'Je Voulais Juste Briller', type: 'decay',      base: 11400, factor: 0.6 },// voulait briller : correct puis s'effondre
  kortex:     { name: 'Le Clash',                 type: 'steal',      amount: 2400 },  // clashe le n°1 et lui grappille à peine 2 400 (faible mais GAGNABLE)
  // ===== Rookies — nouvelle scène FR (mécaniques calibrées, thème collé à l'artiste) =====
  bouss:      { name: 'Le Mirage',                type: 'draft',    frac: 0.38 }, // viral TikTok : surfe sur la vague — part du meilleur score adverse
  huntrill:   { name: 'Le Bruit de la Machine',   type: 'safety',   floor: 12000, self: 10400 }, // son album, trap machine
  jolagreen23:{ name: 'Barillet',                 type: 'allin',    per: 12000 }, // "vide le barillet" : claque TOUTES les charges d'un coup (cap 3 charges → rarement plus de 2 d'un coup, d'où le per élevé)
  junglejack: { name: 'Flow Dévastateur',         type: 'firstblood', base: 9600, first: 19200 }, // flow rapide et dévastateur
  lafeve:     { name: 'Hors du Temps',            type: 'freeze',   self: 7400 }, // new wave expérimentale, hors du temps
  okis:       { name: 'La Crème',                 type: 'sustain',  amount: 3800, rounds: 4 }, // artisanal : petit revenu garanti sur la durée (4 manches × montant, payé SANS condition → très rentable, d'où le montant bas ; 5100 → 30% de winrate)
  // ===== Alternative — les libraires-diggers complétistes de Tsukimi (Robin & Kevin) =====
  robinkevin: { name: "L'Intégrale",              type: 'combo',    base: 1.3, per: 0.2, cap: 2.05 }, // complétistes : une fois lancés ils vont AU BOUT → ×mult qui grossit avec la série (récompense les longues séries)
  // ===== Déblocables (calibrer avec sim-balance.mjs comme le reste) =====
  freezecorleone: { name: 'Freeze Raël',      type: 'wager',    mult: 1.8, penalty: 12000 }, // propos problématiques : ×2 ou cancel
  lino:           { name: 'Requiem',          type: 'sabotage', targets: 1, grab: 3600 },     // muselle le n°1 ET lui rafle une part (le requiem)
  diams:          { name: 'Jeune Demoiselle', type: 'momentum', base: 10400, per: 3600, cap: 18000 }, // carton mainstream qui s'emballe (PLAFONNÉ)
  disiz:          { name: "J'pète les plombs",type: 'comeback', factor: 0.5, cap: 19200 },    // il pète les plombs et remonte
  caballerojeanjass:{ name: 'Double Hélice',  type: 'double',   mult: 1.6 },                  // duo : prochaine bonne réponse ×2
};

export const firstLetters = (s) =>
  String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + '·')
    .join(' ');
