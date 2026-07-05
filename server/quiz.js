// Banque de questions "Culture rap FR" (mode Quiz) — QCM, faite main, 100 % offline.
// Pas de paroles sous copyright : on reste sur des FAITS (blazes, années, groupes,
// villes, albums, feats, signatures). Facile à étoffer : ajoute des entrées ci-dessous.
//   { id, cat, q, correct, distractors: [3 mauvaises réponses plausibles, même type] }

export const QUIZ = [
  // ---- Vrais blazes ----
  { id: 'name-booba',   cat: 'Blaze',  q: 'Quel est le vrai nom de Booba ?',        correct: 'Élie Yaffa',        distractors: ['Karim Zenoud', 'William Kalubi', 'Didier Morville'] },
  { id: 'name-solaar',  cat: 'Blaze',  q: 'Quel est le vrai nom de MC Solaar ?',    correct: "Claude M'Barali",   distractors: ['Abdoulaye Diarra', 'Philippe Fragione', 'Ken Samaras'] },
  { id: 'name-akh',     cat: 'Blaze',  q: "Quel est le vrai nom d'Akhenaton (IAM) ?", correct: 'Philippe Fragione', distractors: ["Claude M'Barali", 'Geoffroy Mussard', 'Élie Yaffa'] },
  { id: 'name-oxmo',    cat: 'Blaze',  q: 'Quel est le vrai nom d\'Oxmo Puccino ?', correct: 'Abdoulaye Diarra',   distractors: ['Gandhi Djuna', 'Ken Samaras', 'Aurélien Cotentin'] },
  { id: 'name-gims',    cat: 'Blaze',  q: 'Quel est le vrai nom de Gims ?',         correct: 'Gandhi Djuna',      distractors: ['William Kalubi', 'Élie Yaffa', 'Abdoulaye Diarra'] },
  { id: 'name-orel',    cat: 'Blaze',  q: 'Quel est le vrai nom d\'Orelsan ?',      correct: 'Aurélien Cotentin', distractors: ['Ken Samaras', 'Valentin Le Du', 'Julien Schwarzer'] },
  { id: 'name-nekfeu',  cat: 'Blaze',  q: 'Quel est le vrai nom de Nekfeu ?',       correct: 'Ken Samaras',       distractors: ['Aurélien Cotentin', 'Karim Fall', 'Nabil Andrieu'] },
  { id: 'name-damso',   cat: 'Blaze',  q: 'Quel est le vrai nom de Damso ?',        correct: 'William Kalubi',    distractors: ['Gandhi Djuna', 'Élie Yaffa', 'Stanislas Dinga'] },
  { id: 'name-vald',    cat: 'Blaze',  q: 'Quel est le vrai nom de Vald ?',         correct: 'Valentin Le Du',    distractors: ['Aurélien Cotentin', 'Ken Samaras', 'Julien Mari'] },
  { id: 'name-jul',     cat: 'Blaze',  q: 'Quel est le vrai nom de Jul ?',          correct: 'Julien Mari',       distractors: ['Julien Schwarzer', 'Valentin Le Du', 'Karim Zenoud'] },
  { id: 'name-sch',     cat: 'Blaze',  q: 'Quel est le vrai nom de SCH ?',          correct: 'Julien Schwarzer',  distractors: ['Julien Mari', 'Valentin Le Du', 'Aurélien Cotentin'] },

  // ---- Groupes / collectifs ----
  { id: 'grp-nekfeu',   cat: 'Groupe', q: 'De quel groupe vient Nekfeu ?',                      correct: '1995',              distractors: ['Sexion d\'Assaut', 'IAM', 'PNL'] },
  { id: 'grp-gims',     cat: 'Groupe', q: 'De quel groupe vient Gims ?',                        correct: "Sexion d'Assaut",   distractors: ['1995', 'NTM', '113'] },
  { id: 'grp-booba',    cat: 'Groupe', q: 'Avec Ali, Booba formait quel duo à ses débuts ?',   correct: 'Lunatic',           distractors: ['Time Bomb', '113', 'Ärsenik'] },
  { id: 'grp-alpha',    cat: 'Groupe', q: 'De quel groupe vient Alpha Wann ?',                  correct: '1995',              distractors: ['S-Crew', 'L\'Entourage', 'MZ'] },
  { id: 'grp-cf',       cat: 'Groupe', q: 'Casseurs Flowters, c\'est Orelsan et… ?',           correct: 'Gringe',            distractors: ['Nekfeu', 'Dinos', 'Vald'] },
  { id: 'grp-ntm',      cat: 'Groupe', q: 'JoeyStarr et Kool Shen forment quel groupe ?',      correct: 'Suprême NTM',       distractors: ['IAM', 'Lunatic', 'Ministère A.M.E.R.'] },
  { id: 'grp-arsenik',  cat: 'Groupe', q: 'Lino et Calbo, c\'est quel groupe ?',               correct: 'Ärsenik',           distractors: ['Lunatic', '113', 'Sniper'] },

  // ---- Villes ----
  { id: 'city-iam',     cat: 'Ville',  q: 'De quelle ville vient IAM ?',            correct: 'Marseille',         distractors: ['Paris', 'Lyon', 'Lille'] },
  { id: 'city-pnl',     cat: 'Ville',  q: 'De quelle ville viennent les frères de PNL ?', correct: 'Corbeil-Essonnes', distractors: ['Marseille', 'Sevran', 'Boulogne-Billancourt'] },
  { id: 'city-kaaris',  cat: 'Ville',  q: 'De quelle ville vient Kaaris ?',         correct: 'Sevran',            distractors: ['Corbeil-Essonnes', 'Marseille', 'Aulnay-sous-Bois'] },
  { id: 'city-jul',     cat: 'Ville',  q: 'De quelle ville vient Jul ?',            correct: 'Marseille',         distractors: ['Paris', 'Toulouse', 'Nice'] },
  { id: 'city-orel',    cat: 'Ville',  q: 'À quelle ville est associé Orelsan ?',   correct: 'Caen',              distractors: ['Rouen', 'Le Havre', 'Rennes'] },
  { id: 'city-laylow',  cat: 'Ville',  q: 'De quelle ville vient Laylow ?',         correct: 'Toulouse',          distractors: ['Marseille', 'Bordeaux', 'Montpellier'] },
  { id: 'city-sch',     cat: 'Ville',  q: 'À quelle ville est associé SCH ?',       correct: 'Marseille',         distractors: ['Aix-en-Provence', 'Lyon', 'Toulon'] },

  // ---- Années d'albums ----
  { id: 'yr-ornoir',    cat: 'Année',  q: 'En quelle année sort « Or Noir » de Kaaris ?',                correct: '2013', distractors: ['2011', '2015', '2017'] },
  { id: 'yr-ipseite',   cat: 'Année',  q: 'En quelle année sort « Ipséité » de Damso ?',                 correct: '2017', distractors: ['2015', '2019', '2020'] },
  { id: 'yr-feu',       cat: 'Année',  q: 'En quelle année sort « Feu » de Nekfeu ?',                    correct: '2015', distractors: ['2013', '2016', '2017'] },
  { id: 'yr-emda',      cat: 'Année',  q: "En quelle année sort « L'École du micro d'argent » d'IAM ?", correct: '1997', distractors: ['1995', '1999', '2001'] },
  { id: 'yr-legende',   cat: 'Année',  q: 'En quelle année sort « Dans la légende » de PNL ?',          correct: '2016', distractors: ['2014', '2017', '2019'] },
  { id: 'yr-xeu',       cat: 'Année',  q: 'En quelle année sort « Xeu » de Vald ?',                      correct: '2018', distractors: ['2016', '2017', '2019'] },
  { id: 'yr-jvlius',    cat: 'Année',  q: 'En quelle année sort « JVLIVS » de SCH ?',                    correct: '2018', distractors: ['2016', '2019', '2021'] },
  { id: 'yr-fete',      cat: 'Année',  q: 'En quelle année sort « La fête est finie » d\'Orelsan ?',    correct: '2017', distractors: ['2015', '2018', '2021'] },
  { id: 'yr-trinity',   cat: 'Année',  q: 'En quelle année sort « Trinity » de Laylow ?',               correct: '2020', distractors: ['2018', '2019', '2021'] },
  { id: 'yr-civ',       cat: 'Année',  q: 'En quelle année sort « Civilisation » d\'Orelsan ?',         correct: '2021', distractors: ['2019', '2020', '2022'] },

  // ---- Surnoms / signatures ----
  { id: 'sig-duc',      cat: 'Surnom', q: 'Qui se surnomme « le Duc de Boulogne » ?',   correct: 'Booba',   distractors: ['Rohff', 'Kaaris', 'Gims'] },
  { id: 'sig-jvlius',   cat: 'Univers', q: 'Quelle saga d\'albums a bâti SCH autour d\'un univers mafieux ?', correct: 'JVLIVS', distractors: ['QALF', 'Agartha', 'Trinity'] },
  { id: 'sig-qalf',     cat: 'Univers', q: 'Quelle série d\'albums est signée Damso ?', correct: 'QALF', distractors: ['JVLIVS', 'Xeu', 'Or Noir'] },
];

// Mélange (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Tire n questions distinctes, ordre aléatoire.
export function pickQuiz(n) {
  return shuffle(QUIZ).slice(0, Math.min(n, QUIZ.length));
}

// Prépare une manche : mélange les 4 choix et calcule l'index de la bonne réponse.
export function buildQuizRound(item) {
  const choices = shuffle([item.correct, ...item.distractors]).slice(0, 4);
  return { id: item.id, cat: item.cat, q: item.q, choices, answer: choices.indexOf(item.correct) };
}
