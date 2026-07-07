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
export const CATEGORY_ORDER = ['Légende', 'Mainstream', 'Rap game', 'Plume', 'Conscient', 'Drill', 'Nouvelle scène', 'Rookies', 'Génies incompris'];

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
  { id: 'ntm', name: 'NTM', color: '#B12A2A', cat: 'Légende', img: true, power: { name: 'Police', effect: 'Muselle les 2 joueurs en tête : 0 auditeur pour eux cette manche.' }, stats: { flow: 4, punch: 5, tech: 4, aura: 5 } },
  // ---- Mainstream (grand public) ----
  { id: 'jul', name: 'Jul', color: '#2E9E8F', cat: 'Mainstream', img: true, power: { name: 'La Machine', effect: 'La machine s\'emballe : +6 000 auditeurs, +6 000 de plus par manche gagnée d\'affilée.' }, stats: { flow: 4, punch: 2, tech: 2, aura: 5 } },
  { id: 'gims', name: 'Gims', color: '#C6A24B', cat: 'Mainstream', img: true, power: { name: 'Sapés comme jamais', effect: 'Le tube qu\'on a trop porté : +22 000, puis -25 % à chaque réutilisation.' }, stats: { flow: 4, punch: 3, tech: 3, aura: 4 } },
  { id: 'rohff', name: 'Rohff', color: '#932F2F', cat: 'Mainstream', img: true, power: { name: "Le Code de l'Honneur", effect: 'Le padre prélève sa dîme : 2 500 auditeurs pris à CHAQUE adversaire.' }, stats: { flow: 4, punch: 5, tech: 3, aura: 4 } },
  { id: 'lafouine', name: 'La Fouine', color: '#3E6B8C', cat: 'Mainstream', img: true, crop: { z: 1.35 }, power: { name: 'Capitale du Crime', effect: 'Muselle le n°1 : 0 auditeur pour lui cette manche.' }, stats: { flow: 4, punch: 4, tech: 3, aura: 3 } },
  // ---- Rap game (contemporain établi) ----
  { id: 'pnl', name: 'PNL', color: '#4C6BE0', cat: 'Rap game', img: true, power: { name: 'Onizuka', effect: 'Ta prochaine bonne réponse compte DOUBLE (×2).' }, stats: { flow: 5, punch: 2, tech: 3, aura: 5 } },
  { id: 'vald', name: 'Vald', color: '#6FBF3A', cat: 'Rap game', img: true, power: { name: 'NQNT', effect: 'Brouillage : les autres ne peuvent répondre qu\'après 4,5 s. Toi, tu démarres direct.' }, stats: { flow: 4, punch: 4, tech: 5, aura: 4 } },
  { id: 'ninho', name: 'Ninho', color: '#B07E33', cat: 'Rap game', img: true, power: { name: 'Certifié Diamant', effect: 'Il enchaîne les certifs : ta réponse ×1.3 cette manche, et le multiplicateur grimpe (jusqu\'à ×2.3) à chaque manche marquée d\'affilée.' }, stats: { flow: 4, punch: 3, tech: 3, aura: 5 } },
  { id: 'sch', name: 'SCH', color: '#44405A', cat: 'Rap game', img: true, power: { name: 'JVLIVS', effect: 'Quitte ou double : ×2 si tu marques cette manche, sinon -20 000 auditeurs.' }, stats: { flow: 4, punch: 4, tech: 4, aura: 4 } },
  { id: 'plk', name: 'PLK', color: '#B4472E', cat: 'Rap game', img: true, power: { name: 'Polak', effect: 'Surrégime : si tu marques cette manche, tu récupères la charge dépensée.' }, stats: { flow: 4, punch: 4, tech: 3, aura: 4 } },
  { id: 'damso', name: 'Damso', color: '#8A1F1C', cat: 'Rap game', img: true, power: { name: 'Le Vice', effect: 'Le 1er à trouver cette manche rafle +30 000 auditeurs. Sinon, rien.' }, stats: { flow: 5, punch: 5, tech: 5, aura: 4 } },
  // ---- Plume (technique / écriture) — ordre voulu : Alpha Wann + Nekfeu en tête, Fabe + MC Solaar en fin ----
  { id: 'alphawann', name: 'Alpha Wann', color: '#3E5C6E', cat: 'Plume', img: true, power: { name: "Une Main Lave l'Autre", effect: 'Sans-faute chirurgical : ta réponse passe même mal orthographiée ET ton score grimpe (×1.5) cette manche.' }, stats: { flow: 5, punch: 4, tech: 5, aura: 4 } },
  { id: 'nekfeu', name: 'Nekfeu', color: '#E9703C', cat: 'Plume', img: true, power: { name: 'Feu', effect: 'Ça prend feu : ta prochaine bonne réponse ×2.' }, stats: { flow: 5, punch: 4, tech: 5, aura: 5 } },
  { id: 'oxmo', name: 'Oxmo Puccino', color: '#B5892E', cat: 'Plume', img: true, power: { name: 'Mines de Cristal', effect: 'Révèle les premières lettres (titre + artiste).' }, stats: { flow: 4, punch: 4, tech: 5, aura: 4 } },
  { id: 'orelsan', name: 'Orelsan', color: '#5E7052', cat: 'Plume', img: true, power: { name: 'Basique', effect: 'Plus t\'es à la traîne, plus ça paie : récupère 60 % de ton retard sur le n°1.' }, stats: { flow: 3, punch: 5, tech: 5, aura: 5 } },
  { id: 'fabe', name: 'Fabe', color: '#4A5568', cat: 'Plume', img: true, power: { name: 'Le Fond et la Forme', effect: 'Increvable : pendant 3 manches, tu ne peux rien perdre et tu grattes 4 000 auditeurs minimum à chaque fois.' }, stats: { flow: 4, punch: 3, tech: 5, aura: 3 } },
  { id: 'solaar', name: 'MC Solaar', color: '#D0A24E', cat: 'Plume', img: true, power: { name: 'Le Prince des Mots', effect: 'Le prince des mots n\'écrit jamais de faute : ta réponse passe même mal orthographiée cette manche.' }, stats: { flow: 5, punch: 3, tech: 5, aura: 5 } },
  // ---- Conscient ----
  { id: 'kery', name: 'Kery James', color: '#2A3D66', cat: 'Conscient', img: true, power: { name: 'Banlieusards', effect: 'Remonte : récupère la moitié de ton retard sur le n°1 (si tu es à la traîne).' }, stats: { flow: 4, punch: 5, tech: 4, aura: 4 } },
  { id: 'medine', name: 'Médine', color: '#2E7D5B', cat: 'Conscient', img: true, crop: { z: 1.4 }, power: { name: "Don't Panik", effect: 'Don\'t panik : 8 000 auditeurs minimum cette manche, immunisé au sabotage.' }, stats: { flow: 4, punch: 4, tech: 4, aura: 3 } },
  { id: 'youssoupha', name: 'Youssoupha', color: '#5B3E8C', cat: 'Conscient', img: true, power: { name: 'Prise de position', effect: 'Prise de position : +5 000 auditeurs, +5 000 par manche gagnée d\'affilée.' }, stats: { flow: 5, punch: 4, tech: 5, aura: 4 } },
  // ---- Drill / Trap ----
  { id: 'gazo', name: 'Gazo', color: '#2A7E48', cat: 'Drill', img: true, power: { name: 'Drill', effect: 'Vole 16 000 auditeurs au joueur en tête.' }, stats: { flow: 3, punch: 5, tech: 3, aura: 4 } },
  { id: 'kaaris', name: 'Kaaris', color: '#5A2333', cat: 'Drill', img: true, power: { name: 'Or Noir', effect: 'Tout ou rien : ×2 si tu marques cette manche, sinon -30 000 auditeurs.' }, stats: { flow: 3, punch: 5, tech: 3, aura: 4 } },
  // ---- Nouvelle scène (2020s) ----
  { id: 'laylow', name: 'Laylow', color: '#9E2B3A', cat: 'Nouvelle scène', img: true, power: { name: 'Trinity', effect: 'Hors du temps : tu marques le max de points même en répondant à la dernière seconde.' }, stats: { flow: 4, punch: 3, tech: 5, aura: 4 } },
  { id: 'jewelusain', name: 'Jewel Usain', color: '#2E7D6B', cat: 'Nouvelle scène', img: true, power: { name: 'Bruce Lee', effect: 'Le conteur, ça résonne : +11 000 auditeurs cette manche ET la manche suivante.' }, stats: { flow: 4, punch: 4, tech: 5, aura: 4 } },
  // ---- Génies incompris (rap raté, stats au fond du sac ; SAUF Bishok, l'exception : grosses stats… mais pas des stats de rappeur) ----
  { id: 'bishok', name: 'Bishok', color: '#6E1E28', cat: 'Génies incompris', img: true, crop: { y: 44 },
    power: { name: 'Complotisme', effect: 'Complotisme : Bishok a décrypté le message caché derrière le son — premières lettres du titre ET de l\'artiste révélées.' },
    stats: { flow: 5, punch: 5, tech: 4, aura: 5 }, statLabels: ['Complot', 'Maroc', 'Conscience', 'Révolte'] },
  { id: 'bilaldu92', name: 'Bilal du 92', color: '#2E4A6E', cat: 'Génies incompris', img: true, power: { name: 'Le Buzz 2006', effect: 'Son seul buzz, c\'était en 2006 : +16 000 auditeurs si tu es le 1er à trouver cette manche. Sinon, rien du tout.' }, stats: { flow: 1, punch: 2, tech: 1, aura: 2 } },
  { id: 'alexdu76', name: 'Alex du 76', color: '#5C3A1E', cat: 'Génies incompris', img: true, power: { name: 'Je Voulais Juste Briller', effect: 'Il voulait juste briller : +14 000 auditeurs, puis -40 % à chaque réutilisation (ça retombe vite).' }, stats: { flow: 2, punch: 1, tech: 1, aura: 2 } },
  { id: 'kortex', name: 'Cortex', color: '#3A3A3A', cat: 'Génies incompris', img: true, power: { name: 'Le Clash', effect: 'Il clashe le n°1 et lui grappille à peine 4 000 auditeurs (personne ne le calcule).' }, stats: { flow: 2, punch: 2, tech: 1, aura: 2 } },
  // ---- Rookies (la nouvelle scène FR qui monte) ----
  { id: 'bouss', name: 'Bouss', color: '#5C4A2E', cat: 'Rookies', img: true, power: { name: 'Le Mirage', effect: 'Comme un tube viral, tu surfes sur la vague : tu rafles la moitié du meilleur score de la manche.' }, stats: { flow: 4, punch: 3, tech: 3, aura: 5 } },
  { id: 'huntrill', name: 'Huntrill', color: '#2E3A5C', cat: 'Rookies', img: true, power: { name: 'Le Bruit de la Machine', effect: 'Le bruit de la machine ne s\'arrête pas : 20 000 auditeurs minimum cette manche, immunisé au sabotage.' }, stats: { flow: 3, punch: 4, tech: 5, aura: 3 } },
  { id: 'jolagreen23', name: 'Jolagreen23', color: '#1F5C3A', cat: 'Rookies', img: true, power: { name: 'Barillet', effect: 'Il vide le barillet : claque TOUTES tes charges d\'un coup → +12 000 auditeurs par charge dépensée.' }, stats: { flow: 4, punch: 4, tech: 3, aura: 4 } },
  { id: 'junglejack', name: 'Jungle Jack', color: '#2E3A1E', cat: 'Rookies', img: true, power: { name: 'Flow Dévastateur', effect: 'Flow dévastateur : le 1er à trouver cette manche rafle +32 000 auditeurs. Sinon, rien.' }, stats: { flow: 5, punch: 4, tech: 4, aura: 3 } },
  { id: 'lafeve', name: 'La Fève', color: '#5C1F1F', cat: 'Rookies', img: true, power: { name: 'Hors du Temps', effect: 'Hors du temps : tu marques le max de points même en répondant à la dernière seconde.' }, stats: { flow: 4, punch: 3, tech: 5, aura: 4 } },
  { id: 'okis', name: 'Okis', color: '#3A2E2E', cat: 'Rookies', img: true, power: { name: 'La Crème', effect: 'La crème du rap artisanal : +5 000 auditeurs garantis à chaque manche, pendant 4 manches.' }, stats: { flow: 3, punch: 3, tech: 4, aura: 3 } },
];

export const avatarById = (id?: string | null): Avatar | undefined => AVATARS.find((a) => a.id === id);

// Persos VERROUILLÉS (démo) : silhouette, ni nom ni stats — on ne voit QUE l'objectif à accomplir.
// Le vrai déblocage (persistance + alerte « nouveau challenger » en fin de partie) viendra après.
export type LockedSlot = { id: string; objective: string };
export const LOCKED_SLOTS: LockedSlot[] = [
  { id: 'lock1', objective: 'Décroche le Disque de Diamant sur une seule manche, en difficulté Puriste.' },
  { id: 'lock2', objective: 'Termine une partie avec moins de 1 000 auditeurs. Le vrai fond du sac.' },
  { id: 'lock3', objective: 'Gagne 3 parties d’affilée dans la même série.' },
  { id: 'lock4', objective: 'Sois le premier à trouver sur 5 manches d’une même partie.' },
  { id: 'lock5', objective: 'Remporte une partie sans activer un seul pouvoir.' },
  { id: 'lock6', objective: 'Gagne une partie après avoir été bon dernier au classement (comeback).' },
];
export const isLockedSlot = (id: string) => LOCKED_SLOTS.some((s) => s.id === id);

// Petite fiche de présentation par rappeur (affichée dans le roster pour meubler + donner du contexte).
// tags = faits courts (ville, époque, certif…) ; note = une ligne d'ambiance (un peu chambreuse pour les persos ratés).
export type Bio = { tags?: string[]; note: string };
export const BIOS: Record<string, Bio> = {
  booba: { tags: ['Boulogne (92)', 'Depuis 1995', 'Multi-diamant'], note: 'Le Duc. A structuré le rap game FR à lui tout seul.' },
  iam: { tags: ['Marseille', 'Depuis 1989', 'Légende'], note: 'Les pharaons du 13. « L\'École du micro d\'argent », un monument.' },
  ntm: { tags: ['Seine-Saint-Denis', 'Depuis 1989', 'Légende'], note: 'L\'énergie punk du rap FR. « Qu\'est-ce qu\'on attend ».' },
  jul: { tags: ['Marseille', 'Depuis 2013', 'Disques de diamant'], note: 'La machine à tubes. Sort trois albums pendant que tu lis ça.' },
  gims: { tags: ['Paris', 'Sexion d\'Assaut', 'Mainstream'], note: 'Le tube incarné, lunettes noires vissées. « Sapés comme jamais ».' },
  rohff: { tags: ['Vitry (94)', 'Depuis 1996', 'Le padre'], note: 'Prolifique et bagarreur. Le code de l\'honneur avant tout.' },
  lafouine: { tags: ['Trappes (78)', 'Depuis 2000s'], note: 'Capitale du crime. Laouni, plume et clashs.' },
  pnl: { tags: ['Corbeil (91)', 'Depuis 2014', 'QLF'], note: 'Le rap cloud, à part. Onizuka, deux frères, aucun feat.' },
  vald: { tags: ['Aulnay (93)', 'NQNT'], note: 'L\'alien : technique redoutable, provoc assumée.' },
  ninho: { tags: ['Longjumeau (91)', 'Depuis 2015', 'Roi des certifs'], note: 'Certifié diamant les yeux fermés. La régularité faite rappeur.' },
  sch: { tags: ['Aix / Marseille', 'JVLIVS', 'Rap game'], note: 'Le S. Esthétique mafieuse, costard et cinéma.' },
  plk: { tags: ['Paris (18e)', 'Le Polak'], note: 'Surrégime permanent. Enfant de la ville.' },
  damso: { tags: ['Bruxelles', 'Depuis 2016', 'Dems'], note: 'Plume acérée, vice et virtuosité. Le vice belge.' },
  alphawann: { tags: ['Paris', 'Don Dada', 'Plume'], note: 'Le technicien. Orfèvre du mot, une main lave l\'autre.' },
  nekfeu: { tags: ['Paris', '1995 / S-Crew', 'Depuis 2011'], note: 'Le Feu. Du cypher à la première place des charts.' },
  oxmo: { tags: ['Paris', 'Depuis 1996', 'Le poète'], note: 'Le conteur, mines de cristal. Une voix, mille images.' },
  orelsan: { tags: ['Caen (14)', 'Depuis 2009', 'San'], note: 'L\'ironie et le vrai. « Basique », mais jamais simple.' },
  fabe: { tags: ['Paris', 'Depuis 1995', 'Underground'], note: 'Le sage des 90s. Le fond ET la forme, sans compromis.' },
  solaar: { tags: ['Val-de-Marne', 'Depuis 1990', 'Le prince'], note: 'Le prince des mots. Zéro faute, que des rimes.' },
  kery: { tags: ['Orly (94)', 'Ideal J', 'Conscient'], note: 'Le combattant. Banlieusards et lettre au Président.' },
  medine: { tags: ['Le Havre (76)', 'Conscient'], note: 'L\'insoumis. Don\'t Panik, keffieh et convictions.' },
  youssoupha: { tags: ['Paris', 'Congo', 'La plume'], note: 'Prise de position permanente. Le verbe engagé.' },
  gazo: { tags: ['Paris', 'Depuis 2020', 'Drill'], note: 'A imposé la drill FR au grand public. Die.' },
  kaaris: { tags: ['Sevran (93)', 'Depuis 2013', 'Riska'], note: 'La trap brutale. « Or Noir », la barbe et le 4matic.' },
  laylow: { tags: ['Toulouse (31)', 'Trinity', 'Nouvelle scène'], note: 'Le visionnaire. Rap et sci-fi, hors du temps.' },
  jewelusain: { tags: ['France', 'Nouvelle scène'], note: 'Le conteur. Ça résonne, ça reste.' },
  bouss: { tags: ['Rookie', 'Nouvelle scène FR'], note: 'La voix qui monte. Surfe sur la vague.' },
  huntrill: { tags: ['Rookie', 'Trap'], note: 'Le bruit de la machine ne s\'arrête jamais.' },
  jolagreen23: { tags: ['Rookie'], note: 'La green. Vide le barillet d\'un coup.' },
  junglejack: { tags: ['Rookie'], note: 'Flow dévastateur. Sort de la jungle.' },
  lafeve: { tags: ['Paris', 'Depuis 2018', 'New wave'], note: 'La new wave, planante et hors du temps.' },
  okis: { tags: ['Rookie', 'Artisanal'], note: 'La crème du rap fait maison. +5 000 garantis.' },
  bishok: { tags: ['Maroc', 'Pote d\'Alexandre', '0 disque'], note: 'Le révolté. Décrypte les complots. Grosses stats… mais pas de rappeur.' },
  bilaldu92: { tags: ['92', 'Un seul buzz : 2006'], note: 'Sa carrière tient dans un buzz de 2006. Depuis, silence radio.' },
  alexdu76: { tags: ['Le 76', 'Génie incompris'], note: 'La star du 76… dans sa tête. Voulait juste briller.' },
  kortex: { tags: ['Génie incompris', 'Le clasheur'], note: 'Il clashe tout le monde. Personne ne le calcule.' },
};
export const bioOf = (id?: string): Bio | undefined => (id ? BIOS[id] : undefined);

// Surnoms affichés sous le nom dans le showcase (character select + roster du hub)
export const EPITHETS: Record<string, string> = { jul: "L'OVNI", pnl: 'Les Frères', booba: 'Le Duc', damso: 'Dems', sch: 'Le S', ninho: 'Le Boss', nekfeu: 'Le Feu', orelsan: 'San', iam: 'Les Sages', solaar: 'Le Prince', gazo: 'La Drill', vald: "L'Alien", oxmo: 'Le Poète', fabe: 'Le Sage', kery: 'Le Combattant', medine: "L'Insoumis", youssoupha: 'La Plume', gims: 'Meugui', lafouine: 'Laouni', kaaris: 'Riska', rohff: 'Le Padre', alphawann: 'Le Technicien', laylow: 'Le Visionnaire', jewelusain: 'Le Conteur', plk: 'Le Polak', bishok: 'Le Révolté', bilaldu92: 'La Zermi du 92', alexdu76: 'La Star du 76', kortex: 'Le Clasheur', bouss: 'La Voix', huntrill: 'Nouvelle Trap', jolagreen23: 'La Green', junglejack: 'La Jungle', lafeve: 'La New Wave', okis: 'La Crème' };

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

// Trophées de fin de partie (façon TowerFall) : la mécanique + les textes vivent côté serveur
// (server/awards.js) ; ici on ne porte que l'icône (petit glyphe dessiné, zéro emoji), mappée par id.
const SVG = (inner: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
export const AWARD_ICONS: Record<string, string> = {
  crown: SVG('<path d="M4 8l3.5 4 4.5-6 4.5 6L20 8l-1.6 10.5H5.6z"/><path d="M6 18.5h12"/>'),
  up: SVG('<path d="M12 20V6"/><path d="M6 12l6-6 6 6"/>'),
  flag: SVG('<path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6"/>'),
  spray: SVG('<path d="M12 12V5M12 12h7M12 12H5M12 12v7M12 12l4.5-4.5M12 12l-4.5 4.5M12 12l4.5 4.5M12 12L7.5 7.5"/>'),
  target: SVG('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>'),
  gauge: SVG('<path d="M4 16a8 8 0 0 1 16 0"/><path d="M12 16l4.5-3.5"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/>'),
  bolt: SVG('<path d="M13 3L5 13h5.5L10 21l9-11h-6z"/>'),
  check: SVG('<path d="M4 12.5l5 5L20 6.5"/>'),
  diamond: SVG('<path d="M12 3l8 6-8 12L4 9z"/><path d="M4 9h16"/><path d="M9 3.5L12 21M15 3.5L12 21"/>'),
  mask: SVG('<rect x="3" y="9" width="7" height="5" rx="2.2"/><rect x="14" y="9" width="7" height="5" rx="2.2"/><path d="M10 11.5h4"/>'),
  dice: SVG('<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/>'),
  feather: SVG('<path d="M20 4C11 4 6 9.5 5 18l-1 2"/><path d="M20 4c.5 7-4 12.5-11 13.5"/><path d="M8.5 15H15"/>'),
  fire: SVG('<path d="M12 3c1.2 4-3 5.5-3 9.5a3 3 0 0 0 6 0c0-1.6-.8-2.6-.8-2.6 2 1 3.3 3 3.3 5.3a5.5 5.5 0 0 1-11 0C6.5 9.5 12 8.5 12 3z"/>'),
  snail: SVG('<path d="M2 17h4"/><path d="M14 17a6 6 0 1 0-6-6 4 4 0 0 0 8 0"/><path d="M20 8l2.5-2M20 10l3-1"/>'),
  ghost: SVG('<path d="M5 20V11a7 7 0 0 1 14 0v9l-2.5-2-2.5 2-2-2-2 2z"/><circle cx="9.5" cy="10.5" r="1" fill="currentColor"/><circle cx="14.5" cy="10.5" r="1" fill="currentColor"/>'),
  skull: SVG('<path d="M5 10.5a7 7 0 0 1 14 0V13l-1 2h-1.5v3H7.5v-3H6l-1-2z"/><circle cx="9" cy="11" r="1.4" fill="currentColor"/><circle cx="15" cy="11" r="1.4" fill="currentColor"/>'),
  medal: SVG('<circle cx="12" cy="14" r="6"/><path d="M9 3.5l3 5 3-5"/><circle cx="12" cy="14" r="2"/>'),
};
export const awardIcon = (id?: string) => AWARD_ICONS[id || ''] || AWARD_ICONS.medal;

// Catalogue d'AFFICHAGE des trophées (page Palmarès) — la mécanique de déclenchement vit dans
// server/awards.js. `blurb` = comment on le décroche (texte de référence, pas le texte dynamique).
export type AwardInfo = { id: string; title: string; icon: string; blurb: string; salty?: boolean };
export const AWARDS_INFO: AwardInfo[] = [
  { id: 'comeback', title: 'Comeback King', icon: 'up', blurb: 'Bon dernier à un moment… et gagne la partie sur la fin.' },
  { id: 'ecrasant', title: 'Rouleau Compresseur', icon: 'crown', blurb: 'Gagne avec une avance écrasante, personne au niveau.' },
  { id: 'photofinish', title: 'Photo Finish', icon: 'flag', blurb: 'Gagne sur le fil, à quelques auditeurs près.' },
  { id: 'sniper', title: 'Le Sniper', icon: 'target', blurb: 'Presque toutes ses tentatives font mouche.' },
  { id: 'machine', title: 'La Machine', icon: 'gauge', blurb: 'Marque sur la grande majorité des manches.' },
  { id: 'reflexe', title: 'Réflexe Éclair', icon: 'bolt', blurb: 'Premier à trouver, encore et encore.' },
  { id: 'sansfaute', title: 'Sans-Faute', icon: 'check', blurb: 'Enchaîne les manches titre ET artiste.' },
  { id: 'puriste', title: 'Le Puriste', icon: 'diamond', blurb: 'Ne trouve jamais à moitié : toujours titre ET artiste.' },
  { id: 'diamant', title: 'Le Gros Move', icon: 'diamond', blurb: 'Claque le plus gros score sur une seule manche.' },
  { id: 'solo', title: 'Cavalier Seul', icon: 'flag', blurb: 'Seul à reconnaître le son, plusieurs fois.' },
  { id: 'metronome', title: 'Le Métronome', icon: 'gauge', blurb: 'Marque à CHAQUE manche, aucune ratée.' },
  { id: 'diesel', title: 'Le Diesel', icon: 'snail', blurb: 'Démarrage poussif, gros finish.' },
  { id: 'sage', title: 'Le Sage', icon: 'feather', blurb: 'Finit dans le haut du panier SANS aucun pouvoir.' },
  { id: 'perdantmagnifique', title: 'Le Perdant Magnifique', icon: 'up', blurb: 'Fait une énorme partie… et finit 2ᵉ. Rageant.' },
  { id: 'champion', title: 'La Ceinture', icon: 'crown', blurb: 'Champion de la partie.' },
  // ---- les salés (on est là pour se chambrer) ----
  { id: 'mitraillette', title: 'La Mitraillette', icon: 'spray', blurb: 'Balance un max de réponses au petit bonheur.', salty: true },
  { id: 'feudepaille', title: 'Feu de Paille', icon: 'fire', blurb: 'Démarre en fusée… s\'éteint sur la fin.', salty: true },
  { id: 'braqueur', title: 'Le Braqueur', icon: 'mask', blurb: 'Dépouille les autres avec un pouvoir de vol.', salty: true },
  { id: 'kamikaze', title: 'Le Kamikaze', icon: 'dice', blurb: 'Mise tout sur un coup de poker.', salty: true },
  { id: 'sanspitie', title: 'Le Sans-Pitié', icon: 'mask', blurb: 'Gagne ET dépouille tout le monde au passage.', salty: true },
  { id: 'escroc', title: "L'Escroc", icon: 'dice', blurb: 'Gagne en n\'ayant trouvé presque aucune manche.', salty: true },
  { id: 'boulet', title: 'Le Rendement', icon: 'skull', blurb: 'Beaucoup de tentatives, presque rien à la clé.', salty: true },
  { id: 'fantome', title: 'Le Fantôme', icon: 'ghost', blurb: 'Enchaîne les manches à zéro pointé.', salty: true },
  { id: 'muet', title: 'Le Muet', icon: 'ghost', blurb: 'Pas une seule réponse tentée de toute la partie.', salty: true },
  { id: 'lanterne', title: 'La Lanterne Rouge', icon: 'skull', blurb: 'Termine bon dernier.', salty: true },
  { id: 'touriste', title: 'Le Touriste', icon: 'ghost', blurb: 'Finit la partie à zéro auditeur.', salty: true },
  { id: 'frimeur', title: 'Le Frimeur', icon: 'mask', blurb: 'Claque plein de pouvoirs et finit dernier.', salty: true },
  { id: 'radin', title: 'Le Radin', icon: 'skull', blurb: 'Finit dernier sans avoir utilisé un seul pouvoir.', salty: true },
];

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
