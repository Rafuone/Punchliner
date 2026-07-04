// Pouvoirs des rappeurs (mécanique). Le libellé/effet affiché est dans le client (data.ts).
// type = effet implémenté par le moteur :
//   double  : ta prochaine bonne réponse compte double
//   bonus   : +100 sur ta prochaine bonne réponse
//   steal   : vole 100 pts au joueur en tête
//   shield  : immunité au prochain coup fourré (armé)
//   hint    : révèle les premières lettres (titre + artiste) pour toi cette manche
export const POWERS = {
  jul:     { name: 'La Machine',      type: 'double' },
  pnl:     { name: 'Onizuka',         type: 'bonus' },
  booba:   { name: 'DUC',             type: 'steal' },
  damso:   { name: 'Macarena',        type: 'double' },
  sch:     { name: 'Otto',            type: 'hint' },
  ninho:   { name: 'Certifié Diamant', type: 'bonus' },
  nekfeu:  { name: 'Feu',             type: 'double' },
  orelsan: { name: 'Basique',         type: 'hint' },
  iam:     { name: "L'École du Micro", type: 'double' },
  solaar:  { name: 'Le Prince des Mots', type: 'hint' },
  gazo:    { name: 'Drill',           type: 'steal' },
  vald:    { name: 'NQNT',            type: 'bonus' },
};

export const firstLetters = (s) =>
  String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + '·')
    .join(' ');
