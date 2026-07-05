// Un pouvoir par rappeur, singulier + collé à la carrière. Unité = AUDITEURS.
// Valeurs CALIBRÉES par simulation (node sim-balance.mjs) : à skill égal, viser un delta serré
// (~16-24 % de victoire pour tous ; attendu 20 % à 5 joueurs). Aucun écrasant, aucun inutile.
// Les pouvoirs DÉFENSIFS (safety) ont un petit `self` offensif (moins fort que les autres) pour
// rester dans la course. Denial (sabotage) : petit `grab`. Utilitaires (hint/jam/freeze) : `self`.
//
// Mécaniques : double{mult}, bonus{amount,refuel}, wager{mult,penalty}, steal{amount},
//   sabotage{targets,grab}, hint{self}, safety{floor,self}, momentum{base,per}, decay{base,factor},
//   comeback{factor,cap}, firstblood{base,first}, veteran{rounds,floor}, freeze{self}, jam{ms,self},
//   nofault{self}, ace{mult}(nofault+double).
export const POWERS = {
  // ===== S — légendes / élite =====
  booba:      { name: 'DUC',                    type: 'steal',    amount: 16000 },
  iam:        { name: "L'École du Micro",       type: 'safety',   floor: 24000, self: 9000 },
  solaar:     { name: 'Le Prince des Mots',     type: 'nofault',  self: 17000 },
  ntm:        { name: 'Police',                 type: 'sabotage', targets: 2 },
  pnl:        { name: 'Onizuka',                type: 'double',   mult: 1.7 },
  damso:      { name: 'Le Vice',                type: 'firstblood', base: 15000, first: 35000 },
  nekfeu:     { name: 'Feu',                    type: 'double',   mult: 1.7 },
  jul:        { name: 'La Machine',             type: 'momentum', base: 13000, per: 6000 },
  ninho:      { name: 'Certifié Diamant',       type: 'decay',    base: 30000, factor: 0.9 },
  orelsan:    { name: 'Basique',                type: 'comeback', factor: 0.55, cap: 32000 },
  alphawann:  { name: "Une Main Lave l'Autre",  type: 'ace',      mult: 1.4 },
  // ===== A — très forts =====
  oxmo:       { name: 'Mines de Cristal',       type: 'hint',     self: 11000 },
  kery:       { name: 'Banlieusards',           type: 'comeback', factor: 0.55, cap: 33000 },
  youssoupha: { name: 'Éternel Recommencement', type: 'momentum', base: 15000, per: 6000 },
  sch:        { name: 'JVLIVS',                 type: 'wager',    mult: 1.8, penalty: 20000 },
  gims:       { name: 'Sapés comme jamais',     type: 'decay',    base: 33000, factor: 0.9 },
  rohff:      { name: "Le Code de l'Honneur",   type: 'sabotage', grab: 8000 },
  kaaris:     { name: 'Or Noir',               type: 'wager',    mult: 1.85, penalty: 30000 },
  gazo:       { name: 'Drill',                  type: 'steal',    amount: 15000 },
  laylow:     { name: 'Trinity',                type: 'freeze',   self: 11000 },
  vald:       { name: 'NQNT',                   type: 'jam',      ms: 4500, self: 16000 },
  plk:        { name: 'Polak',                  type: 'bonus',    amount: 14000, refuel: true },
  // ===== B — solides / montants =====
  fabe:       { name: 'Le Fond et la Forme',    type: 'veteran',  rounds: 3, floor: 16000 },
  medine:     { name: "Don't Panik",            type: 'safety',   floor: 20000, self: 10000 },
  lafouine:   { name: 'Capitale du Crime',      type: 'sabotage', grab: 8000 },
  jewelusain: { name: 'Bruce Lee',             type: 'firstblood', base: 16000, first: 32000 },
};

export const firstLetters = (s) =>
  String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + '·')
    .join(' ');
