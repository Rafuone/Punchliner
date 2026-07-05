// Sélection de rappeurs = avatar + catégorie + pouvoir + stats (façon jeu de combat).
// La MÉCANIQUE des pouvoirs vit côté serveur (server/powers.js) ; ici c'est l'affichage.
// Force des pouvoirs = TIER de carrière (S > A > B). Voir server/powers.js pour le détail.
export type Avatar = {
  id: string; name: string; color: string; cat: string;
  power: { name: string; effect: string };
  stats: { flow: number; punch: number; tech: number; aura: number }; // 1..5
  img?: boolean; // un portrait existe dans client/public/avatars/<id>.png
  crop?: { z?: number; y?: number }; // recadrage vignette : zoom (déf. 1.6) + focale verticale
};

// Ordre d'affichage des catégories dans le sélecteur (scroll horizontal par catégorie)
export const CATEGORY_ORDER = ['Légende', 'Mainstream', 'Rap game', 'Plume', 'Conscient', 'Drill', 'Nouvelle scène', 'Troll'];

// Le score se compte en AUDITEURS. Formatage FR + certification de fin de partie.
export const fmtAud = (n: number) => Math.round(n || 0).toLocaleString('fr-FR');
export function certif(score: number, rounds: number) {
  const per = (score || 0) / Math.max(1, rounds || 1); // auditeurs / manche → indépendant de la longueur de partie
  if (per >= 28000) return { label: 'Disque de Diamant', short: 'Diamant' };
  if (per >= 20000) return { label: 'Triple Platine', short: '3× Platine' };
  if (per >= 14000) return { label: 'Double Platine', short: '2× Platine' };
  if (per >= 9000) return { label: 'Disque de Platine', short: 'Platine' };
  if (per >= 4500) return { label: "Disque d'Or", short: 'Or' };
  return { label: 'Espoir du rap', short: 'Espoir' };
}

export const AVATARS: Avatar[] = [
  // ---- Légende (pionniers) — tier S ----
  { id: 'booba', name: 'Booba', color: '#3A2F52', cat: 'Légende', img: true, power: { name: 'DUC', effect: 'Le Duc rafle 22 000 auditeurs au n°1.' }, stats: { flow: 4, punch: 5, tech: 4, aura: 5 } },
  { id: 'iam', name: 'IAM', color: '#C98A4A', cat: 'Légende', power: { name: "L'École du Micro", effect: 'Les sages ne tombent pas : 12 000 auditeurs minimum cette manche, immunisé au sabotage.' }, stats: { flow: 4, punch: 3, tech: 5, aura: 5 } },
  { id: 'solaar', name: 'MC Solaar', color: '#D0A24E', cat: 'Légende', img: true, power: { name: 'Le Prince des Mots', effect: 'Le prince des mots n\'écrit jamais de faute : ta réponse passe même mal orthographiée cette manche.' }, stats: { flow: 5, punch: 2, tech: 5, aura: 5 } },
  { id: 'oxmo', name: 'Oxmo Puccino', color: '#B5892E', cat: 'Légende', img: true, power: { name: 'Mines de Cristal', effect: 'Révèle les premières lettres (titre + artiste).' }, stats: { flow: 4, punch: 3, tech: 5, aura: 4 } },
  { id: 'ntm', name: 'NTM', color: '#B12A2A', cat: 'Légende', power: { name: 'Police', effect: 'Muselle les 2 joueurs en tête : 0 auditeur pour eux cette manche.' }, stats: { flow: 4, punch: 5, tech: 4, aura: 5 } },
  { id: 'fabe', name: 'Fabe', color: '#4A5568', cat: 'Plume', img: true, power: { name: 'Le Fond et la Forme', effect: 'Increvable : pendant 3 manches, tu ne peux rien perdre et tu grattes 4 000 auditeurs minimum à chaque fois.' }, stats: { flow: 4, punch: 3, tech: 5, aura: 3 } },
  // ---- Mainstream (grand public) ----
  { id: 'jul', name: 'Jul', color: '#2E9E8F', cat: 'Mainstream', power: { name: 'La Machine', effect: 'La machine s\'emballe : +6 000 auditeurs, +6 000 de plus par manche gagnée d\'affilée.' }, stats: { flow: 4, punch: 3, tech: 2, aura: 5 } },
  { id: 'gims', name: 'Gims', color: '#C6A24B', cat: 'Mainstream', img: true, power: { name: 'Sapés comme jamais', effect: 'Le tube qu\'on a trop porté : +22 000, puis -25 % à chaque réutilisation.' }, stats: { flow: 4, punch: 3, tech: 3, aura: 4 } },
  { id: 'rohff', name: 'Rohff', color: '#932F2F', cat: 'Mainstream', img: true, power: { name: "Le Code de l'Honneur", effect: 'Muselle le n°1 : 0 auditeur pour lui cette manche.' }, stats: { flow: 4, punch: 5, tech: 3, aura: 4 } },
  { id: 'lafouine', name: 'La Fouine', color: '#3E6B8C', cat: 'Mainstream', img: true, power: { name: 'Capitale du Crime', effect: 'Muselle le n°1 : 0 auditeur pour lui cette manche.' }, stats: { flow: 4, punch: 4, tech: 3, aura: 3 } },
  // ---- Rap game (contemporain établi) ----
  { id: 'pnl', name: 'PNL', color: '#4C6BE0', cat: 'Rap game', power: { name: 'Onizuka', effect: 'Ta prochaine bonne réponse compte TRIPLE (×3).' }, stats: { flow: 5, punch: 2, tech: 4, aura: 5 } },
  { id: 'damso', name: 'Damso', color: '#8A1F1C', cat: 'Rap game', img: true, power: { name: 'Le Vice', effect: 'Le 1er à trouver cette manche rafle +30 000 auditeurs. Sinon, rien.' }, stats: { flow: 5, punch: 4, tech: 5, aura: 4 } },
  { id: 'ninho', name: 'Ninho', color: '#B07E33', cat: 'Rap game', img: true, power: { name: 'Certifié Diamant', effect: 'Gros bonus qui fond à chaque réutilisation : +26 000, puis -25 % à chaque fois.' }, stats: { flow: 4, punch: 3, tech: 3, aura: 5 } },
  { id: 'sch', name: 'SCH', color: '#44405A', cat: 'Rap game', img: true, power: { name: 'JVLIVS', effect: 'Quitte ou double : ×3 si tu marques cette manche, sinon -13 000 auditeurs.' }, stats: { flow: 4, punch: 4, tech: 4, aura: 4 } },
  { id: 'plk', name: 'PLK', color: '#B4472E', cat: 'Rap game', img: true, power: { name: 'Polak', effect: 'Surrégime : si tu marques cette manche, tu récupères la charge dépensée.' }, stats: { flow: 4, punch: 4, tech: 3, aura: 4 } },
  // ---- Plume (technique / écriture) ----
  { id: 'nekfeu', name: 'Nekfeu', color: '#E9703C', cat: 'Plume', img: true, power: { name: 'Feu', effect: 'Ça prend feu : ta prochaine bonne réponse ×3.' }, stats: { flow: 5, punch: 3, tech: 5, aura: 4 } },
  { id: 'orelsan', name: 'Orelsan', color: '#5E7052', cat: 'Plume', img: true, power: { name: 'Basique', effect: 'Plus t\'es à la traîne, plus ça paie : récupère 60 % de ton retard sur le n°1.' }, stats: { flow: 3, punch: 4, tech: 5, aura: 5 } },
  { id: 'alphawann', name: 'Alpha Wann', color: '#3E5C6E', cat: 'Plume', img: true, power: { name: "Une Main Lave l'Autre", effect: 'Sans-faute chirurgical : ta réponse passe même mal orthographiée ET compte double cette manche.' }, stats: { flow: 5, punch: 4, tech: 5, aura: 4 } },
  // ---- Conscient ----
  { id: 'kery', name: 'Kery James', color: '#2A3D66', cat: 'Conscient', img: true, power: { name: 'Banlieusards', effect: 'Remonte : récupère la moitié de ton retard sur le n°1 (si tu es à la traîne).' }, stats: { flow: 4, punch: 5, tech: 4, aura: 4 } },
  { id: 'medine', name: 'Médine', color: '#2E7D5B', cat: 'Conscient', img: true, crop: { z: 1.85 }, power: { name: "Don't Panik", effect: 'Don\'t panik : 8 000 auditeurs minimum cette manche, immunisé au sabotage.' }, stats: { flow: 4, punch: 4, tech: 4, aura: 3 } },
  { id: 'youssoupha', name: 'Youssoupha', color: '#5B3E8C', cat: 'Conscient', img: true, power: { name: 'Éternel Recommencement', effect: 'Éternel recommencement : +5 000 auditeurs, +5 000 par manche gagnée d\'affilée.' }, stats: { flow: 5, punch: 4, tech: 5, aura: 4 } },
  // ---- Drill / Trap ----
  { id: 'gazo', name: 'Gazo', color: '#2A7E48', cat: 'Drill', img: true, power: { name: 'Drill', effect: 'Vole 16 000 auditeurs au joueur en tête.' }, stats: { flow: 3, punch: 5, tech: 3, aura: 4 } },
  { id: 'kaaris', name: 'Kaaris', color: '#5A2333', cat: 'Drill', img: true, power: { name: 'Or Noir', effect: 'Tout ou rien : ×4 si tu marques cette manche, sinon -18 000 auditeurs.' }, stats: { flow: 3, punch: 5, tech: 3, aura: 4 } },
  // ---- Nouvelle scène (2020s) ----
  { id: 'laylow', name: 'Laylow', color: '#9E2B3A', cat: 'Nouvelle scène', img: true, power: { name: 'Trinity', effect: 'Hors du temps : tu marques le max de points même en répondant à la dernière seconde.' }, stats: { flow: 4, punch: 3, tech: 5, aura: 4 } },
  { id: 'jewelusain', name: 'Jewel Usain', color: '#2E7D6B', cat: 'Nouvelle scène', img: true, power: { name: 'Bruce Lee', effect: 'Rapide comme Bruce Lee : le 1er à trouver cette manche rafle +20 000 auditeurs. Sinon, rien.' }, stats: { flow: 4, punch: 3, tech: 4, aura: 3 } },
  // ---- Troll ----
  { id: 'vald', name: 'Vald', color: '#6FBF3A', cat: 'Troll', img: true, power: { name: 'NQNT', effect: 'Brouillage : les autres ne peuvent répondre qu\'après 4,5 s. Toi, tu démarres direct.' }, stats: { flow: 4, punch: 4, tech: 4, aura: 4 } },
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
