// Sélection de rappeurs = avatar + catégorie + pouvoir + stats (façon jeu de combat).
// La MÉCANIQUE des pouvoirs vit côté serveur (server/powers.js) ; ici c'est l'affichage.
export type Avatar = {
  id: string; name: string; color: string; cat: string;
  power: { name: string; effect: string };
  stats: { flow: number; punch: number; tech: number }; // 1..5
};

export const AVATARS: Avatar[] = [
  { id: 'jul', name: 'Jul', color: '#2E9E8F', cat: 'Marseille', power: { name: 'La Machine', effect: 'Ta prochaine bonne réponse compte double.' }, stats: { flow: 4, punch: 3, tech: 2 } },
  { id: 'pnl', name: 'PNL', color: '#4C6BE0', cat: 'Nouvelle vague', power: { name: 'Onizuka', effect: '+100 sur ta prochaine bonne réponse.' }, stats: { flow: 5, punch: 2, tech: 4 } },
  { id: 'booba', name: 'Booba', color: '#3A2F52', cat: 'Légende', power: { name: 'DUC', effect: 'Vole 100 pts au joueur en tête.' }, stats: { flow: 4, punch: 5, tech: 4 } },
  { id: 'damso', name: 'Damso', color: '#8A1F1C', cat: 'Nouvelle vague', power: { name: 'Macarena', effect: 'Ta prochaine bonne réponse compte double.' }, stats: { flow: 5, punch: 4, tech: 5 } },
  { id: 'sch', name: 'SCH', color: '#44405A', cat: 'Marseille', power: { name: 'Otto', effect: 'Révèle les premières lettres (titre + artiste).' }, stats: { flow: 4, punch: 4, tech: 4 } },
  { id: 'ninho', name: 'Ninho', color: '#B07E33', cat: 'Nouvelle vague', power: { name: 'Certifié Diamant', effect: '+100 sur ta prochaine bonne réponse.' }, stats: { flow: 4, punch: 3, tech: 3 } },
  { id: 'nekfeu', name: 'Nekfeu', color: '#E9703C', cat: 'Plume', power: { name: 'Feu', effect: 'Ta prochaine bonne réponse compte double.' }, stats: { flow: 4, punch: 3, tech: 5 } },
  { id: 'orelsan', name: 'Orelsan', color: '#5E7052', cat: 'Grand public', power: { name: 'Basique', effect: 'Révèle les premières lettres (titre + artiste).' }, stats: { flow: 3, punch: 3, tech: 5 } },
  { id: 'iam', name: 'IAM', color: '#C98A4A', cat: 'Légende', power: { name: "L'École du Micro", effect: 'Ta prochaine bonne réponse compte double.' }, stats: { flow: 4, punch: 3, tech: 5 } },
  { id: 'solaar', name: 'MC Solaar', color: '#D0A24E', cat: 'Légende', power: { name: 'Le Prince des Mots', effect: 'Révèle les premières lettres (titre + artiste).' }, stats: { flow: 5, punch: 2, tech: 5 } },
  { id: 'gazo', name: 'Gazo', color: '#2A7E48', cat: 'Drill', power: { name: 'Drill', effect: 'Vole 100 pts au joueur en tête.' }, stats: { flow: 3, punch: 5, tech: 3 } },
  { id: 'vald', name: 'Vald', color: '#6FBF3A', cat: 'Troll', power: { name: 'NQNT', effect: '+100 sur ta prochaine bonne réponse.' }, stats: { flow: 4, punch: 4, tech: 4 } },
];

export const avatarById = (id?: string | null): Avatar | undefined => AVATARS.find((a) => a.id === id);

export const DIFFICULTIES = [
  { key: 'facile', label: 'Grand public', desc: 'Les gros hits, tout le monde connaît' },
  { key: 'normal', label: 'Connaisseur', desc: 'Classiques + sons bien connus' },
  { key: 'difficile', label: 'Digger', desc: 'Deep cuts, sons moins streamés' },
  { key: 'puriste', label: 'Puriste', desc: 'Le fond du bac, pour les vrais' },
];

export const MODES = [
  { key: 'multi', label: 'Blind test', desc: 'Tout le monde répond' },
  { key: 'buzzer', label: 'Buzzer', desc: 'Le 1er qui buzze' },
];

// Remplissage de la jauge de pouvoir
export const REBALANCE = [
  { key: 'comeback', label: 'Comeback', desc: 'À la traîne = jauge + rapide (façon TowerFall)' },
  { key: 'snowball', label: 'Snowball', desc: 'Plus tu gagnes, plus ça monte' },
  { key: 'off', label: 'Neutre', desc: 'Pareil pour tout le monde' },
];

export const initials = (s: string) =>
  s.replace(/\(.*?\)/g, '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

// Musique du menu (fichiers dans client/public/music/, servis par Vite à /music/…)
// Lecture en entier + ordre aléatoire côté Host.
export type MenuTrack = { title: string; artist: string; src: string };
export const MENU_TRACKS: MenuTrack[] = [
  { title: 'Stuntmen', artist: 'Laylow · Alpha Wann & Witt', src: '/music/laylow-stuntmen.mp3' },
  { title: 'Bruce Lee', artist: 'Jewel Usain', src: '/music/jewel-usain-bruce-lee.mp3' },
  { title: 'ZUSHILEAKS', artist: 'Caballero & JeanJass · Chilly Gonzales', src: '/music/zushileaks-cjj.mp3' },
];
