// Sélection de rappeurs = avatar + catégorie + pouvoir + stats (façon jeu de combat).
// La MÉCANIQUE des pouvoirs vit côté serveur (server/powers.js) ; ici c'est l'affichage.
// Force des pouvoirs = TIER de carrière (S > A > B). Voir server/powers.js pour le détail.
export type Avatar = {
  id: string; name: string; color: string; cat: string;
  power: { name: string; effect: string };
  stats: { flow: number; punch: number; tech: number; aura: number }; // 1..5
  statLabels?: [string, string, string, string]; // libellés de stats custom (déf. Flow/Punch/Tech/Aura) — cas Bishok
  img?: boolean; // un portrait existe dans client/public/avatars/<id>.png
  crop?: { z?: number; y?: number }; // recadrage : z = zoom vignette (déf. 1.6) · y = focale verticale du showcase (%, déf. 15)
};

// Ordre d'affichage des catégories dans le sélecteur (scroll horizontal par catégorie)
export const CATEGORY_ORDER = ['Légende', 'Mainstream', 'Rap game', 'Plume', 'Conscient', 'Drill', 'Nouvelle scène', 'Génies incompris', 'Rookies'];

// Une couleur flashy par genre (chip du showcase + libellés du roster).
// Légende = rendu IRIDESCENT via la classe .irid ; la valeur ci-dessous n'est que le repli (bordure /
// navigateurs sans background-clip:text).
export const CATEGORY_COLORS: Record<string, string> = {
  'Légende': '#ffd76b',        // doré (repli) — l'affichage réel est iridescent
  'Mainstream': '#ff4fa3',     // rose flash
  'Rap game': '#3ad4ff',       // cyan électrique
  'Plume': '#a6ff00',          // vert bombe
  'Conscient': '#ffcf3f',      // ambre
  'Drill': '#ff5a5a',          // rouge
  'Nouvelle scène': '#b57cff', // violet néon
  'Troll': '#ff8a3d',          // orange
  'Génies incompris': '#c4e8ff', // bleu-gris glacé
  'Rookies': '#ffa33d',        // orange-doré
};
export const isLegend = (cat: string) => cat === 'Légende';
export const isGenie = (cat: string) => cat === 'Génies incompris'; // cartes « sticker iridescent »

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
  { id: 'iam', name: 'IAM', color: '#C98A4A', cat: 'Légende', img: true, power: { name: 'Planète Mars', effect: 'Les sages ne tombent pas : 12 000 auditeurs minimum cette manche, immunisé au sabotage.' }, stats: { flow: 4, punch: 3, tech: 5, aura: 5 } },
  { id: 'solaar', name: 'MC Solaar', color: '#D0A24E', cat: 'Plume', img: true, power: { name: 'Le Prince des Mots', effect: 'Le prince des mots n\'écrit jamais de faute : ta réponse passe même mal orthographiée cette manche.' }, stats: { flow: 5, punch: 2, tech: 5, aura: 5 } },
  { id: 'oxmo', name: 'Oxmo Puccino', color: '#B5892E', cat: 'Plume', img: true, power: { name: 'Mines de Cristal', effect: 'Révèle les premières lettres (titre + artiste).' }, stats: { flow: 4, punch: 3, tech: 5, aura: 4 } },
  { id: 'ntm', name: 'NTM', color: '#B12A2A', cat: 'Légende', img: true, power: { name: 'Police', effect: 'Muselle les 2 joueurs en tête : 0 auditeur pour eux cette manche.' }, stats: { flow: 4, punch: 5, tech: 4, aura: 5 } },
  { id: 'fabe', name: 'Fabe', color: '#4A5568', cat: 'Plume', img: true, power: { name: 'Le Fond et la Forme', effect: 'Increvable : pendant 3 manches, tu ne peux rien perdre et tu grattes 4 000 auditeurs minimum à chaque fois.' }, stats: { flow: 4, punch: 3, tech: 5, aura: 3 } },
  // ---- Mainstream (grand public) ----
  { id: 'jul', name: 'Jul', color: '#2E9E8F', cat: 'Mainstream', img: true, power: { name: 'La Machine', effect: 'La machine s\'emballe : +6 000 auditeurs, +6 000 de plus par manche gagnée d\'affilée.' }, stats: { flow: 4, punch: 3, tech: 2, aura: 5 } },
  { id: 'gims', name: 'Gims', color: '#C6A24B', cat: 'Mainstream', img: true, power: { name: 'Sapés comme jamais', effect: 'Le tube qu\'on a trop porté : +22 000, puis -25 % à chaque réutilisation.' }, stats: { flow: 4, punch: 3, tech: 3, aura: 4 } },
  { id: 'rohff', name: 'Rohff', color: '#932F2F', cat: 'Mainstream', img: true, power: { name: "Le Code de l'Honneur", effect: 'Muselle le n°1 : 0 auditeur pour lui cette manche.' }, stats: { flow: 4, punch: 5, tech: 3, aura: 4 } },
  { id: 'lafouine', name: 'La Fouine', color: '#3E6B8C', cat: 'Mainstream', img: true, crop: { z: 1.35 }, power: { name: 'Capitale du Crime', effect: 'Muselle le n°1 : 0 auditeur pour lui cette manche.' }, stats: { flow: 4, punch: 4, tech: 3, aura: 3 } },
  // ---- Rap game (contemporain établi) ----
  { id: 'pnl', name: 'PNL', color: '#4C6BE0', cat: 'Rap game', img: true, power: { name: 'Onizuka', effect: 'Ta prochaine bonne réponse compte DOUBLE (×2).' }, stats: { flow: 5, punch: 2, tech: 4, aura: 5 } },
  { id: 'damso', name: 'Damso', color: '#8A1F1C', cat: 'Rap game', img: true, power: { name: 'Le Vice', effect: 'Le 1er à trouver cette manche rafle +30 000 auditeurs. Sinon, rien.' }, stats: { flow: 5, punch: 4, tech: 5, aura: 4 } },
  { id: 'ninho', name: 'Ninho', color: '#B07E33', cat: 'Rap game', img: true, power: { name: 'Certifié Diamant', effect: 'Gros bonus qui fond à chaque réutilisation : +26 000, puis -25 % à chaque fois.' }, stats: { flow: 4, punch: 3, tech: 3, aura: 5 } },
  { id: 'sch', name: 'SCH', color: '#44405A', cat: 'Rap game', img: true, power: { name: 'JVLIVS', effect: 'Quitte ou double : ×2 si tu marques cette manche, sinon -20 000 auditeurs.' }, stats: { flow: 4, punch: 4, tech: 4, aura: 4 } },
  { id: 'plk', name: 'PLK', color: '#B4472E', cat: 'Rap game', img: true, power: { name: 'Polak', effect: 'Surrégime : si tu marques cette manche, tu récupères la charge dépensée.' }, stats: { flow: 4, punch: 4, tech: 3, aura: 4 } },
  { id: 'vald', name: 'Vald', color: '#6FBF3A', cat: 'Rap game', img: true, power: { name: 'NQNT', effect: 'Brouillage : les autres ne peuvent répondre qu\'après 4,5 s. Toi, tu démarres direct.' }, stats: { flow: 4, punch: 4, tech: 4, aura: 4 } },
  // ---- Plume (technique / écriture) ----
  { id: 'nekfeu', name: 'Nekfeu', color: '#E9703C', cat: 'Plume', img: true, power: { name: 'Feu', effect: 'Ça prend feu : ta prochaine bonne réponse ×2.' }, stats: { flow: 5, punch: 3, tech: 5, aura: 4 } },
  { id: 'orelsan', name: 'Orelsan', color: '#5E7052', cat: 'Plume', img: true, power: { name: 'Basique', effect: 'Plus t\'es à la traîne, plus ça paie : récupère 60 % de ton retard sur le n°1.' }, stats: { flow: 3, punch: 4, tech: 5, aura: 5 } },
  { id: 'alphawann', name: 'Alpha Wann', color: '#3E5C6E', cat: 'Plume', img: true, power: { name: "Une Main Lave l'Autre", effect: 'Sans-faute chirurgical : ta réponse passe même mal orthographiée ET ton score grimpe (×1.5) cette manche.' }, stats: { flow: 5, punch: 4, tech: 5, aura: 4 } },
  // ---- Conscient ----
  { id: 'kery', name: 'Kery James', color: '#2A3D66', cat: 'Conscient', img: true, power: { name: 'Banlieusards', effect: 'Remonte : récupère la moitié de ton retard sur le n°1 (si tu es à la traîne).' }, stats: { flow: 4, punch: 5, tech: 4, aura: 4 } },
  { id: 'medine', name: 'Médine', color: '#2E7D5B', cat: 'Conscient', img: true, crop: { z: 1.4 }, power: { name: "Don't Panik", effect: 'Don\'t panik : 8 000 auditeurs minimum cette manche, immunisé au sabotage.' }, stats: { flow: 4, punch: 4, tech: 4, aura: 3 } },
  { id: 'youssoupha', name: 'Youssoupha', color: '#5B3E8C', cat: 'Conscient', img: true, power: { name: 'Prise de position', effect: 'Prise de position : +5 000 auditeurs, +5 000 par manche gagnée d\'affilée.' }, stats: { flow: 5, punch: 4, tech: 5, aura: 4 } },
  // ---- Drill / Trap ----
  { id: 'gazo', name: 'Gazo', color: '#2A7E48', cat: 'Drill', img: true, power: { name: 'Drill', effect: 'Vole 16 000 auditeurs au joueur en tête.' }, stats: { flow: 3, punch: 5, tech: 3, aura: 4 } },
  { id: 'kaaris', name: 'Kaaris', color: '#5A2333', cat: 'Drill', img: true, power: { name: 'Or Noir', effect: 'Tout ou rien : ×2 si tu marques cette manche, sinon -30 000 auditeurs.' }, stats: { flow: 3, punch: 5, tech: 3, aura: 4 } },
  // ---- Nouvelle scène (2020s) ----
  { id: 'laylow', name: 'Laylow', color: '#9E2B3A', cat: 'Nouvelle scène', img: true, power: { name: 'Trinity', effect: 'Hors du temps : tu marques le max de points même en répondant à la dernière seconde.' }, stats: { flow: 4, punch: 3, tech: 5, aura: 4 } },
  { id: 'jewelusain', name: 'Jewel Usain', color: '#2E7D6B', cat: 'Nouvelle scène', img: true, power: { name: 'Eleanor', effect: 'Le 1er à trouver cette manche rafle +20 000 auditeurs. Sinon, rien.' }, stats: { flow: 4, punch: 3, tech: 4, aura: 3 } },
  // ---- Génies incompris (rap raté, stats au fond du sac ; SAUF Bishok, l'exception : grosses stats… mais pas des stats de rappeur) ----
  { id: 'bishok', name: 'Bishok', color: '#6E1E28', cat: 'Génies incompris', img: true, crop: { y: 44 },
    power: { name: 'Complotisme', effect: 'Complotisme : Bishok a décrypté le message caché derrière le son — premières lettres du titre ET de l\'artiste révélées.' },
    stats: { flow: 5, punch: 5, tech: 4, aura: 5 }, statLabels: ['Complot', 'Maroc', 'Conscience', 'Révolte'] },
  { id: 'bilaldu92', name: 'Bilal du 9-2', color: '#2E4A6E', cat: 'Génies incompris', img: true, power: { name: 'Le Buzz 2006', effect: 'Le buzz de 2006 : le 1er à trouver cette manche rafle +32 000 auditeurs. Sinon, rien.' }, stats: { flow: 1, punch: 2, tech: 1, aura: 2 } },
  { id: 'alexdu76', name: 'Alex du 7-6', color: '#5C3A1E', cat: 'Génies incompris', img: true, power: { name: 'Je Voulais Juste Briller', effect: 'Je voulais juste briller : +30 000 auditeurs, puis -10 % à chaque réutilisation (la hype retombe vite).' }, stats: { flow: 2, punch: 1, tech: 1, aura: 2 } },
  { id: 'kortex', name: 'Kortex', color: '#3A3A3A', cat: 'Génies incompris', img: true, power: { name: 'Le Clash', effect: 'Le clash : part en clash contre le n°1 — muselé cette manche, et tu lui rafles 8 000 auditeurs.' }, stats: { flow: 2, punch: 2, tech: 1, aura: 2 } },
  // ---- Rookies (la nouvelle scène FR qui monte) ----
  { id: 'bouss', name: 'Bouss', color: '#5C4A2E', cat: 'Rookies', img: true, power: { name: 'Depuis le Temps', effect: 'Depuis le temps qu\'il bosse : increvable pendant 3 manches, jamais sous 16 000 auditeurs.' }, stats: { flow: 4, punch: 3, tech: 3, aura: 5 } },
  { id: 'huntrill', name: 'Huntrill', color: '#2E3A5C', cat: 'Rookies', img: true, power: { name: 'Le Bruit de la Machine', effect: 'Le bruit de la machine ne s\'arrête pas : 20 000 auditeurs minimum cette manche, immunisé au sabotage.' }, stats: { flow: 3, punch: 4, tech: 5, aura: 3 } },
  { id: 'jolagreen23', name: 'Jolagreen23', color: '#1F5C3A', cat: 'Rookies', img: true, power: { name: 'Barillet', effect: 'Il vide le barillet : +14 000 auditeurs, et la charge revient si tu marques cette manche.' }, stats: { flow: 4, punch: 4, tech: 3, aura: 4 } },
  { id: 'junglejack', name: 'Jungle Jack', color: '#2E3A1E', cat: 'Rookies', img: true, power: { name: 'Flow Dévastateur', effect: 'Flow dévastateur : le 1er à trouver cette manche rafle +32 000 auditeurs. Sinon, rien.' }, stats: { flow: 5, punch: 4, tech: 4, aura: 3 } },
  { id: 'lafeve', name: 'La Fève', color: '#5C1F1F', cat: 'Rookies', img: true, power: { name: 'Hors du Temps', effect: 'Hors du temps : tu marques le max de points même en répondant à la dernière seconde.' }, stats: { flow: 4, punch: 3, tech: 5, aura: 4 } },
  { id: 'okis', name: 'Okis', color: '#3A2E2E', cat: 'Rookies', img: true, power: { name: 'La Crème', effect: 'La crème du rap artisanal : +30 000 auditeurs, puis -10 % à chaque réutilisation (elle s\'écrème).' }, stats: { flow: 3, punch: 3, tech: 4, aura: 3 } },
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
  { title: 'Pensées amères', artist: 'Bishok', src: '/music/bishok-pensees-ameres.mp3' },
  { title: 'Stuntmen', artist: 'Laylow · Alpha Wann & Witt', src: '/music/laylow-stuntmen.mp3' },
  { title: 'Bruce Lee', artist: 'Jewel Usain', src: '/music/jewel-usain-bruce-lee.mp3' },
  { title: 'ZUSHILEAKS', artist: 'Caballero & JeanJass · Chilly Gonzales', src: '/music/zushileaks-cjj.mp3' },
  { title: 'Boulbi', artist: 'Booba', src: '/music/booba-boulbi.mp3' },
  { title: "Porte d'Orléans", artist: 'PLK', src: '/music/plk-porte-dorleans.mp3' },
];
