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
  booba:      { name: 'DUC',                    type: 'steal',    amount: 14000, shield: true }, // vole le meneur ET devient intouchable ce tour (utile même quand Booba mène → il peut enfin défendre)
  iam:        { name: "L'École du Micro",       type: 'safety',   floor: 24000, self: 9000 },
  solaar:     { name: 'Le Prince des Mots',     type: 'nofault',  self: 17000 },
  ntm:        { name: 'Police',                 type: 'sabotage', targets: 2 },
  pnl:        { name: 'Onizuka',                type: 'double',   mult: 1.7 },
  damso:      { name: 'Le Vice',                type: 'firstblood', base: 15000, first: 35000 },
  nekfeu:     { name: 'Feu',                    type: 'double',   mult: 1.7 },
  jul:        { name: 'La Machine',             type: 'momentum', base: 15000, per: 6000, cap: 30000 }, // force d'origine mais PLAFONNÉE : sans cap, s'emballait à 45 %+ en facile
  ninho:      { name: 'Certifié Diamant',       type: 'combo',    base: 1.3, per: 0.25, cap: 1.9 }, // enchaîne les certifs : ×mult qui grossit avec la série
  orelsan:    { name: 'Basique',                type: 'comeback', factor: 0.55, cap: 32000 },
  alphawann:  { name: "Une Main Lave l'Autre",  type: 'ace',      mult: 1.3 },
  // ===== A — très forts =====
  oxmo:       { name: 'Mines de Cristal',       type: 'hint',     self: 11000 },
  kery:       { name: 'Banlieusards',           type: 'comeback', factor: 0.55, cap: 33000 },
  youssoupha: { name: 'Éternel Recommencement', type: 'momentum', base: 15000, per: 6000, cap: 30000 },
  sch:        { name: 'JVLIVS',                 type: 'wager',    mult: 1.8, penalty: 20000 },
  gims:       { name: 'Sapés comme jamais',     type: 'decay',    base: 33000, factor: 0.9 },
  rohff:      { name: "Le Code de l'Honneur",   type: 'tax',      amount: 4500 }, // le padre prélève sa dîme sur TOUS
  kaaris:     { name: 'Or Noir',               type: 'wager',    mult: 1.85, penalty: 30000 },
  gazo:       { name: 'Drill',                  type: 'steal',    amount: 15000 },
  laylow:     { name: 'Trinity',                type: 'freeze',   self: 11000 },
  vald:       { name: 'NQNT',                   type: 'jam',      ms: 4500, self: 16000 },
  plk:        { name: 'Polak',                  type: 'bonus',    amount: 12500, refuel: true },
  // ===== B — solides / montants =====
  fabe:       { name: 'Le Fond et la Forme',    type: 'veteran',  rounds: 3, floor: 14000 },
  medine:     { name: "Don't Panik",            type: 'safety',   floor: 20000, self: 10000 },
  lafouine:   { name: 'Capitale du Crime',      type: 'sabotage', grab: 8000 },
  jewelusain: { name: 'Bruce Lee',             type: 'sustain',  amount: 11000, rounds: 2 }, // le conteur : ça résonne (auditeurs cette manche + la suivante) — boosté
  // ===== Génies incompris — rappeurs-mèmes ratés : VOLONTAIREMENT les plus faibles (gagnable mais dur).
  //   Bishok = exception "rigolote" (hint, correct). Les 3 autres = EV basse assumée. =====
  bishok:     { name: 'Complotisme',              type: 'hint',       self: 11000 },   // décrypte le "message caché"
  bilaldu92:  { name: 'Le Buzz 2006',             type: 'firstblood', base: 5000, first: 18000 }, // 1 seul buzz (2006) : maigre, gros QUE si 1er
  alexdu76:   { name: 'Je Voulais Juste Briller', type: 'decay',      base: 19000, factor: 0.6 },// voulait briller : correct puis s'effondre
  kortex:     { name: 'Le Clash',                 type: 'steal',      amount: 4000 },  // clashe le n°1 et lui grappille à peine 4 000 (faible mais GAGNABLE)
  // ===== Rookies — nouvelle scène FR (mécaniques calibrées, thème collé à l'artiste) =====
  bouss:      { name: 'Le Mirage',                type: 'draft',    frac: 0.38 }, // viral TikTok : surfe sur la vague — part du meilleur score adverse
  huntrill:   { name: 'Le Bruit de la Machine',   type: 'safety',   floor: 20000, self: 10000 }, // son album, trap machine
  jolagreen23:{ name: 'Barillet',                 type: 'allin',    per: 16000 }, // "vide le barillet" : claque TOUTES les charges d'un coup
  junglejack: { name: 'Flow Dévastateur',         type: 'firstblood', base: 16000, first: 32000 }, // flow rapide et dévastateur
  lafeve:     { name: 'Hors du Temps',            type: 'freeze',   self: 11000 }, // new wave expérimentale, hors du temps
  okis:       { name: 'La Crème',                 type: 'sustain',  amount: 8500, rounds: 4 }, // artisanal : petit revenu garanti sur la durée
  // ===== Déblocables (calibrer avec sim-balance.mjs comme le reste) =====
  freezecorleone: { name: 'Freeze Raël',      type: 'wager',    mult: 1.8, penalty: 20000 }, // propos problématiques : ×2 ou cancel
  lino:           { name: 'Requiem',          type: 'sabotage', targets: 1, grab: 6000 },     // muselle le n°1 ET lui rafle une part (le requiem)
  diams:          { name: 'Jeune Demoiselle', type: 'momentum', base: 15000, per: 6000, cap: 30000 }, // carton mainstream qui s'emballe (PLAFONNÉ)
  disiz:          { name: "J'pète les plombs",type: 'comeback', factor: 0.5, cap: 32000 },    // il pète les plombs et remonte
  caballerojeanjass:{ name: 'Double Hélice',  type: 'double',   mult: 1.6 },                  // duo : prochaine bonne réponse ×2
};

export const firstLetters = (s) =>
  String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + '·')
    .join(' ');
