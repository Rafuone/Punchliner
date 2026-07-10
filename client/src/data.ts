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
  locked?: boolean; // déblocable : verrouillé tant que l'objectif (voir UNLOCKS) n'est pas atteint
};

// Ordre d'affichage des catégories dans le sélecteur (scroll horizontal par catégorie)
export const CATEGORY_ORDER = ['Légende', 'Mainstream', 'Rap game', 'Plume', 'Conscient', 'Drill', 'Alternative', 'Rookies', 'Génies incompris'];

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
  'Alternative': '#b57cff', // violet néon
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
  // Paliers DURCIS (2e passe) : gagner une partie ne doit PAS donner du 3× Platine par défaut. Diamant =
  // quasi sans-faute en difficulté élevée. Le Platine reste atteignable sur une belle partie.
  if (per >= 50000) return { label: 'Disque de Diamant', short: 'Diamant' };
  if (per >= 35000) return { label: 'Triple Platine', short: '3× Platine' };
  if (per >= 25000) return { label: 'Double Platine', short: '2× Platine' };
  if (per >= 16000) return { label: 'Disque de Platine', short: 'Platine' };
  if (per >= 8500) return { label: "Disque d'Or", short: 'Or' };
  return { label: 'Espoir du rap', short: 'Espoir' };
}

// Niveau de certif → matière du "CD" affiché sur le podium (dégradé + halo). Ordre du plus bas au plus haut.
export const CERTIF_TIER: Record<string, number> = { 'Espoir': 0, 'Or': 1, 'Platine': 2, '2× Platine': 3, '3× Platine': 4, 'Diamant': 5 };

export const AVATARS: Avatar[] = [
  // ---- Légende (pionniers) — tier S ----
  { id: 'booba', name: 'Booba', color: '#3A2F52', cat: 'Légende', img: true, power: { name: 'DUC', effect: 'Rafle 14 000 auditeurs au meneur ET devient intouchable ce tour (vol, sabotage et dîme sans effet).' }, stats: { flow: 4, punch: 5, tech: 4, aura: 5 } },
  { id: 'iam', name: 'IAM', color: '#C98A4A', cat: 'Légende', img: true, power: { name: 'Planète Mars', effect: 'Les sages ne tombent pas : 24 000 auditeurs minimum cette manche (+9 000 si tu marques), immunisé au vol et au sabotage.' }, stats: { flow: 4, punch: 3, tech: 5, aura: 5 } },
  { id: 'ntm', name: 'NTM', color: '#B12A2A', cat: 'Légende', img: true, power: { name: 'Police', effect: 'Muselle les 2 joueurs en tête : 0 auditeur pour eux cette manche.' }, stats: { flow: 4, punch: 5, tech: 4, aura: 5 } },
  // ---- Mainstream (grand public) ----
  { id: 'jul', name: 'Jul', color: '#2E9E8F', cat: 'Mainstream', img: true, power: { name: 'La Machine', effect: 'La machine s\'emballe : +15 000 auditeurs, +6 000 de plus par manche gagnée d\'affilée (max +30 000).' }, stats: { flow: 4, punch: 2, tech: 2, aura: 5 } },
  { id: 'gims', name: 'Gims', color: '#C6A24B', cat: 'Mainstream', img: true, power: { name: 'Sapés comme jamais', effect: 'Le tube qu\'on a trop porté : +33 000 auditeurs, puis -10 % à chaque réutilisation.' }, stats: { flow: 4, punch: 3, tech: 3, aura: 4 } },
  { id: 'rohff', name: 'Rohff', color: '#932F2F', cat: 'Mainstream', img: true, power: { name: "Le Code de l'Honneur", effect: 'Le padre prélève sa dîme : 4 500 auditeurs pris à CHAQUE adversaire.' }, stats: { flow: 4, punch: 5, tech: 3, aura: 4 } },
  { id: 'lafouine', name: 'La Fouine', color: '#3E6B8C', cat: 'Mainstream', img: true, crop: { z: 1.35 }, power: { name: 'Capitale du Crime', effect: 'Muselle le n°1 : 0 auditeur pour lui cette manche, et tu lui rafles 8 000 auditeurs au passage.' }, stats: { flow: 4, punch: 4, tech: 3, aura: 3 } },
  // ---- Rap game (contemporain établi) ----
  { id: 'pnl', name: 'PNL', color: '#4C6BE0', cat: 'Rap game', img: true, power: { name: 'Onizuka', effect: 'Ta prochaine bonne réponse compte presque double (×1.7).' }, stats: { flow: 5, punch: 2, tech: 3, aura: 5 } },
  { id: 'vald', name: 'Vald', color: '#6FBF3A', cat: 'Rap game', img: true, power: { name: 'NQNT', effect: 'Brouillage : les autres ne répondent qu\'après 4,5 s ; toi tu démarres direct (+16 000 si tu marques).' }, stats: { flow: 4, punch: 4, tech: 5, aura: 4 } },
  { id: 'ninho', name: 'Ninho', color: '#B07E33', cat: 'Rap game', img: true, power: { name: 'Certifié Diamant', effect: 'Enchaîne les certifs : ta réponse ×mult qui grossit avec la série (jusqu\'à ×1.9).' }, stats: { flow: 4, punch: 3, tech: 3, aura: 5 } },
  { id: 'sch', name: 'SCH', color: '#44405A', cat: 'Rap game', img: true, power: { name: 'JVLIVS', effect: 'Quitte ou double : ×1.8 si tu marques cette manche, sinon -20 000 auditeurs.' }, stats: { flow: 4, punch: 4, tech: 4, aura: 4 } },
  { id: 'plk', name: 'PLK', color: '#B4472E', cat: 'Rap game', img: true, power: { name: 'Polak', effect: 'Surrégime : +12 500 auditeurs, et si tu marques tu récupères la charge dépensée.' }, stats: { flow: 4, punch: 4, tech: 3, aura: 4 } },
  { id: 'damso', name: 'Damso', color: '#8A1F1C', cat: 'Rap game', img: true, power: { name: 'Le Vice', effect: 'Le 1er à trouver cette manche rafle +50 000 auditeurs. Les autres qui trouvent : +15 000.' }, stats: { flow: 5, punch: 5, tech: 5, aura: 4 } },
  // ---- Plume (technique / écriture) — ordre voulu : Alpha Wann + Nekfeu en tête, Fabe + MC Solaar en fin ----
  { id: 'alphawann', name: 'Alpha Wann', color: '#3E5C6E', cat: 'Plume', img: true, power: { name: "Une Main Lave l'Autre", effect: 'Sans-faute chirurgical : ta réponse passe même mal orthographiée ET ton score grimpe (×1.3) cette manche.' }, stats: { flow: 5, punch: 4, tech: 5, aura: 4 } },
  { id: 'nekfeu', name: 'Nekfeu', color: '#E9703C', cat: 'Plume', img: true, power: { name: 'Feu', effect: 'Ça prend feu : ta prochaine bonne réponse ×1.7.' }, stats: { flow: 5, punch: 4, tech: 5, aura: 5 } },
  { id: 'oxmo', name: 'Oxmo Puccino', color: '#B5892E', cat: 'Plume', img: true, power: { name: 'Mines de Cristal', effect: 'Révèle les premières lettres (titre + artiste). +11 000 auditeurs si tu marques.' }, stats: { flow: 4, punch: 4, tech: 5, aura: 4 } },
  { id: 'orelsan', name: 'Orelsan', color: '#5E7052', cat: 'Plume', img: true, power: { name: 'Basique', effect: 'Plus t\'es à la traîne, plus ça paie : récupère 55 % de ton retard sur le n°1 (jusqu\'à 32 000).' }, stats: { flow: 3, punch: 5, tech: 5, aura: 5 } },
  { id: 'fabe', name: 'Fabe', color: '#4A5568', cat: 'Plume', img: true, power: { name: 'Le Fond et la Forme', effect: 'Increvable : pendant 3 manches, tu ne peux rien perdre et tu grattes 14 000 auditeurs minimum à chaque fois.' }, stats: { flow: 4, punch: 3, tech: 5, aura: 3 } },
  { id: 'solaar', name: 'MC Solaar', color: '#D0A24E', cat: 'Plume', img: true, power: { name: 'Le Prince des Mots', effect: 'Le prince des mots n\'écrit jamais de faute : ta réponse passe même mal orthographiée, et +17 000 auditeurs si tu marques.' }, stats: { flow: 5, punch: 3, tech: 5, aura: 5 } },
  // ---- Conscient ----
  { id: 'kery', name: 'Kery James', color: '#2A3D66', cat: 'Conscient', img: true, power: { name: 'Banlieusards', effect: 'Remonte : récupère 55 % de ton retard sur le n°1 (jusqu\'à 33 000).' }, stats: { flow: 4, punch: 5, tech: 4, aura: 4 } },
  { id: 'medine', name: 'Médine', color: '#2E7D5B', cat: 'Conscient', img: true, crop: { z: 1.4 }, power: { name: "Don't Panik", effect: 'Don\'t panik : 20 000 auditeurs minimum cette manche (+10 000 si tu marques), immunisé au sabotage.' }, stats: { flow: 4, punch: 4, tech: 4, aura: 3 } },
  { id: 'youssoupha', name: 'Youssoupha', color: '#5B3E8C', cat: 'Conscient', img: true, power: { name: 'Prise de position', effect: 'Prise de position : +15 000 auditeurs, +6 000 de plus par manche gagnée d\'affilée (max +30 000).' }, stats: { flow: 5, punch: 4, tech: 5, aura: 4 } },
  // ---- Drill / Trap ----
  { id: 'gazo', name: 'Gazo', color: '#2A7E48', cat: 'Drill', img: true, power: { name: 'Drill', effect: 'Vole 15 000 auditeurs au joueur en tête.' }, stats: { flow: 3, punch: 5, tech: 3, aura: 4 } },
  { id: 'kaaris', name: 'Kaaris', color: '#5A2333', cat: 'Drill', img: true, power: { name: 'Or Noir', effect: 'Tout ou rien : ×1.85 si tu marques cette manche, sinon -30 000 auditeurs.' }, stats: { flow: 3, punch: 5, tech: 3, aura: 4 } },
  // ---- Alternative (rap moderne installé, hors-format : Laylow, Jewel Usain…) ----
  { id: 'laylow', name: 'Laylow', color: '#9E2B3A', cat: 'Alternative', img: true, power: { name: 'Trinity', effect: 'Hors du temps : score au max même à la dernière seconde. +11 000 auditeurs si tu marques.' }, stats: { flow: 4, punch: 3, tech: 5, aura: 4 } },
  { id: 'jewelusain', name: 'Jewel Usain', color: '#2E7D6B', cat: 'Alternative', img: true, power: { name: 'Bruce Lee', effect: 'Le conteur, ça résonne : +11 000 auditeurs cette manche ET la manche suivante.' }, stats: { flow: 4, punch: 4, tech: 5, aura: 4 } },
  // ---- Génies incompris (rap raté, stats au fond du sac ; SAUF Bishok, l'exception : grosses stats… mais pas des stats de rappeur) ----
  { id: 'bishok', name: 'Bishok', color: '#6E1E28', cat: 'Génies incompris', img: true, crop: { y: 44 },
    power: { name: 'Complotisme', effect: 'Complotisme : Bishok a décrypté le message caché — premières lettres du titre ET de l\'artiste révélées. +11 000 auditeurs si tu marques.' },
    stats: { flow: 5, punch: 5, tech: 4, aura: 5 }, statLabels: ['Complot', 'Maroc', 'Conscience', 'Révolte'] },
  { id: 'bilaldu92', name: 'Bilal du 92', color: '#2E4A6E', cat: 'Génies incompris', img: true, power: { name: 'Le Buzz 2006', effect: 'Son seul buzz, c\'était en 2006 : +23 000 auditeurs si tu es le 1er à trouver. Les autres qui trouvent : +5 000.' }, stats: { flow: 1, punch: 2, tech: 1, aura: 2 } },
  { id: 'alexdu76', name: 'Alex du 76', color: '#5C3A1E', cat: 'Génies incompris', img: true, power: { name: 'Je Voulais Juste Briller', effect: 'Il voulait juste briller : +19 000 auditeurs, puis -40 % à chaque réutilisation (ça retombe vite).' }, stats: { flow: 2, punch: 1, tech: 1, aura: 2 } },
  { id: 'kortex', name: 'Cortex', color: '#3A3A3A', cat: 'Génies incompris', img: true, power: { name: 'Le Clash', effect: 'Il clashe le n°1 et lui grappille à peine 4 000 auditeurs (personne ne le calcule).' }, stats: { flow: 2, punch: 2, tech: 1, aura: 2 } },
  // ---- Rookies (la nouvelle scène FR qui monte) ----
  { id: 'bouss', name: 'Bouss', color: '#5C4A2E', cat: 'Rookies', img: true, power: { name: 'Le Mirage', effect: 'Comme un tube viral, tu surfes sur la vague : tu rafles 38 % du meilleur score adverse de la manche.' }, stats: { flow: 4, punch: 3, tech: 3, aura: 5 } },
  { id: 'huntrill', name: 'Huntrill', color: '#2E3A5C', cat: 'Rookies', img: true, power: { name: 'Le Bruit de la Machine', effect: 'Le bruit de la machine : 20 000 auditeurs minimum cette manche (+10 000 si tu marques), immunisé au sabotage.' }, stats: { flow: 3, punch: 4, tech: 5, aura: 3 } },
  { id: 'jolagreen23', name: 'Jolagreen23', color: '#1F5C3A', cat: 'Rookies', img: true, power: { name: 'Barillet', effect: 'Il vide le barillet : claque TOUTES tes charges d\'un coup → +16 000 auditeurs par charge dépensée.' }, stats: { flow: 4, punch: 4, tech: 3, aura: 4 } },
  { id: 'junglejack', name: 'Jungle Jack', color: '#2E3A1E', cat: 'Rookies', img: true, power: { name: 'Flow Dévastateur', effect: 'Flow dévastateur : le 1er à trouver rafle +48 000 auditeurs. Les autres qui trouvent : +16 000.' }, stats: { flow: 5, punch: 4, tech: 4, aura: 3 } },
  { id: 'lafeve', name: 'La Fève', color: '#5C1F1F', cat: 'Rookies', img: true, power: { name: 'Hors du Temps', effect: 'Planant, hors du temps : score au max même à la dernière seconde. +11 000 auditeurs si tu marques.' }, stats: { flow: 4, punch: 3, tech: 5, aura: 4 } },
  { id: 'okis', name: 'Okis', color: '#3A2E2E', cat: 'Rookies', img: true, power: { name: 'La Crème', effect: 'La crème du rap artisanal : +8 500 auditeurs garantis à chaque manche, pendant 4 manches.' }, stats: { flow: 3, punch: 3, tech: 4, aura: 3 } },
  // ---- Ex-déblocables : DÉVERROUILLÉS (le gating a été retiré le 2026-07-10) → sélectionnables comme tous les autres, rangés dans leur catégorie ----
  { id: 'freezecorleone', name: 'Freeze Corleone', color: '#241F38', cat: 'Drill', img: true, power: { name: 'Freeze Raël', effect: 'Propos problématiques : ta réponse ×1.8 si tu marques cette manche… sinon il se fait cancel (-20 000 auditeurs).' }, stats: { flow: 5, punch: 5, tech: 5, aura: 4 } },
  { id: 'lino', name: 'Lino', color: '#38414F', cat: 'Plume', img: true, power: { name: 'Requiem', effect: 'Il écrit le requiem du n°1 : 0 auditeur pour lui cette manche, et lui rafle 6 000 auditeurs au passage.' }, stats: { flow: 4, punch: 5, tech: 5, aura: 4 } },
  { id: 'diams', name: "Diam's", color: '#B23A6B', cat: 'Mainstream', img: true, power: { name: 'Jeune Demoiselle', effect: "Carton mainstream qui s'emballe : +15 000 auditeurs, +6 000 de plus par manche gagnée d'affilée (max +30 000)." }, stats: { flow: 4, punch: 4, tech: 3, aura: 5 } },
  { id: 'disiz', name: 'Disiz', color: '#45607C', cat: 'Conscient', img: true, power: { name: "J'pète les plombs", effect: 'Il pète les plombs et remonte : récupère la moitié de ton retard sur le n°1 (si tu es à la traîne).' }, stats: { flow: 4, punch: 4, tech: 4, aura: 4 } },
  { id: 'caballerojeanjass', name: 'Caballero & JeanJass', color: '#3E8E5E', cat: 'Alternative', img: true, power: { name: 'Double Hélice', effect: 'À deux sur le mic : ta prochaine bonne réponse ×1.6.' }, stats: { flow: 4, punch: 5, tech: 4, aura: 4 } },
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

// Déblocage des rappeurs verrouillés : objectif affiché + condition testée en fin de partie
// (côté joueur, façon trophées → persisté dans localStorage `pl_unlocked`). Conditions PROVISOIRES,
// à affiner. `check` reçoit le résultat perso de la partie qui vient de se terminer.
// Conditions RÉPARTIES sur des réglages DIFFÉRENTS (difficulté / mode / format) → impossible de tout
// débloquer en une seule partie : il faut varier les configs. (Affichage des déblocages désactivé pour
// l'instant — voir Player.tsx : on ne montre pas encore les challengers.)
export type UnlockCtx = { won: boolean; rank: number; certifShort: string; awardIds: string[]; difficulty: string; mode: string; rounds: number };
// Conditions ATTEIGNABLES et VARIÉES (une par CONFIG) → en variant mode/difficulté sur 3-4 parties, on
// débloque un challenger par partie (un SEUL à la fois : computeUnlock renvoie le 1er non encore débloqué).
export const UNLOCKS: { id: string; objective: string; check: (c: UnlockCtx) => boolean }[] = [
  { id: 'diams', objective: 'Termine une partie de Blind Test.', check: (c) => c.mode === 'multi' },
  { id: 'caballerojeanjass', objective: 'Termine une partie de Quiz.', check: (c) => c.mode === 'quiz' },
  { id: 'lino', objective: 'Termine une partie en mode Buzzer.', check: (c) => c.mode === 'buzzer' },
  { id: 'freezecorleone', objective: 'Termine une partie en difficulté Puriste.', check: (c) => c.difficulty === 'puriste' },
  { id: 'disiz', objective: 'Termine une partie en Grand public (facile).', check: (c) => c.difficulty === 'facile' },
];
export const unlockObjective = (id: string) => UNLOCKS.find((u) => u.id === id)?.objective || 'À débloquer.';

// Fiche de présentation par rappeur (affichée dans le roster) : origine / année / ventes (certifs) + une
// ligne d'ambiance. Les données réelles (from/since/sales) viennent d'une recherche web (certifs SNEP en
// priorité, plus fiables que des chiffres bruts) ; les persos fictifs ont des données bidon (chambrage).
export type Bio = { from?: string; since?: string; sales?: string; note: string };
export const BIOS: Record<string, Bio> = {
  booba: { from: 'Boulogne (92)', since: '1996', sales: 'Albums diamant en pagaille (0.9, Futur, D.U.C.)', note: 'Le Duc. A structuré le rap game FR à lui tout seul.' },
  iam: { from: 'Marseille', since: '1989', sales: '« L\'École du micro d\'argent » diamant', note: 'Les pharaons du 13. Un monument du rap français.' },
  ntm: { from: 'Seine-Saint-Denis (93)', since: '1989', sales: 'Multi-platine', note: 'L\'énergie punk du rap FR. « Qu\'est-ce qu\'on attend ».' },
  jul: { from: 'Marseille', since: '2013', sales: 'Diamant en série · 1er rappeur FR à +10 M d\'albums', note: 'La machine à tubes. Sort trois albums pendant que tu lis ça.' },
  gims: { from: 'Paris (né à Kinshasa)', since: '2013', sales: '« Ceinture Noire » triple diamant', note: 'Le tube incarné, lunettes noires vissées.' },
  rohff: { from: 'Vitry (94)', since: '1999', sales: 'Multi-platine (~1,7 M d\'albums)', note: 'Le padre. Prolifique et bagarreur.' },
  lafouine: { from: 'Trappes (78)', since: '2004', sales: 'Plusieurs albums platine (>1 M)', note: 'Capitale du crime. Laouni, plume et clashs.' },
  pnl: { from: 'Corbeil-Essonnes', since: '2014', sales: '« Deux frères » double diamant', note: 'Le rap cloud, à part. QLF, aucun feat.' },
  vald: { from: 'Aulnay (93)', since: '2012', sales: '« XEU » triple platine', note: 'L\'alien : technique redoutable, provoc assumée.' },
  ninho: { from: 'Nemours (77)', since: '2014', sales: '1er rappeur FR à 5 projets diamant', note: 'Certifié diamant les yeux fermés. La régularité faite rappeur.' },
  sch: { from: 'Aix / Marseille (13)', since: '2015', sales: '« A7 » diamant · saga JVLIVS multi-platine', note: 'Le S. Esthétique mafieuse, costard et cinéma.' },
  plk: { from: 'Paris (14e)', since: '2015', sales: '« ENNA » diamant', note: 'Surrégime permanent. Enfant de la ville.' },
  damso: { from: 'Bruxelles', since: '2006', sales: '« Ipséité » diamant · « Macarena » diamant', note: 'Dems. Plume acérée, vice et virtuosité.' },
  alphawann: { from: 'Paris (14e)', since: '2007', sales: '« Une Main Lave l\'Autre » platine', note: 'Le technicien. Orfèvre du mot.' },
  nekfeu: { from: 'Paris (15e)', since: '2007', sales: '« Feu », « Cyborg » diamant · « Étoiles vagabondes » double diamant', note: 'Le Feu. Du cypher à la première place.' },
  oxmo: { from: 'Paris (19e), né à Ségou (Mali)', since: '1995', sales: 'Victoire de la musique 2010', note: 'Le « Black Jacques Brel ». Une voix, mille images.' },
  orelsan: { from: 'Caen (14)', since: '2007', sales: '« La fête est finie » & « Civilisation » diamant', note: 'L\'ironie et le vrai. « Basique », mais jamais simple.' },
  fabe: { from: 'Paris (18e, Barbès)', since: '1991', sales: 'Underground culte (Scred Connexion)', note: 'Le sage des 90s. Le fond ET la forme.' },
  solaar: { from: 'Val-de-Marne, né à Dakar', since: '1990', sales: '~5 M d\'albums · « Cinquième As » double platine', note: 'Le prince des mots. Zéro faute, que des rimes.' },
  kery: { from: 'Orly (94)', since: '1991', sales: 'Or/platine (d\'Idéal J au solo)', note: 'Le combattant. Banlieusards, lettre au Président.' },
  medine: { from: 'Le Havre (76)', since: '2004', sales: 'Culte plus que certifié', note: 'L\'insoumis. Don\'t Panik, keffieh et convictions.' },
  youssoupha: { from: 'Kinshasa → Sartrouville', since: '2007', sales: '« Noir Désir » platine', note: 'Prise de position permanente. Le verbe engagé.' },
  gazo: { from: 'Châteauroux / Saint-Denis (93)', since: '2019', sales: 'Singles diamant (Haine&Sex, KMT)', note: 'A imposé la drill FR au grand public.' },
  kaaris: { from: 'Sevran (93), né à Abidjan', since: '2013', sales: '« Tchoin » diamant · « Or Noir » double platine', note: 'Riska. La trap brutale, la barbe et le 4matic.' },
  laylow: { from: 'Toulouse (31)', since: '2013', sales: '« Trinity » double platine', note: 'Le visionnaire. Rap et sci-fi, hors du temps.' },
  jewelusain: { from: 'Argenteuil (95)', since: '2015', sales: 'Émergent, plume de niche', note: 'Le conteur. Ça résonne, ça reste.' },
  bouss: { from: 'Gentilly (94)', since: '2020', sales: '« Depuis le temps » platine', note: 'La voix qui monte. Surfe sur la vague.' },
  huntrill: { from: 'Essonne (91)', since: '2017', sales: 'Émergent (révélé en 2024)', note: 'Le bruit de la machine ne s\'arrête jamais.' },
  jolagreen23: { from: 'Bois-Colombes (92)', since: '2021', sales: 'Émergent (rookie majeur)', note: 'La green. Vide le barillet d\'un coup.' },
  junglejack: { from: 'Paris (20e)', since: '2014', sales: 'Émergent, underground', note: 'Flow dévastateur. Sort de la jungle.' },
  lafeve: { from: 'Paris (20e) / Fontenay (94)', since: '2018', sales: '« ERRR » platine', note: 'La new wave, planante et hors du temps.' },
  okis: { from: 'Lyon (Croix-Rousse)', since: '2022', sales: 'Émergent (rap indé)', note: 'La crème du rap fait maison.' },
  // ---- déblocables ----
  freezecorleone: { from: 'Rungis (94)', since: '2015', sales: '« LMF » disque de platine', note: 'La menace fantôme. 667, flow glacial, références en pagaille — et polémiques.' },
  lino: { from: 'Villiers-le-Bel (95)', since: '1994', sales: "Ärsenik disque d'or, culte", note: 'La lame. Technicien brutal, punchlines chirurgicales.' },
  diams: { from: 'Paris (née à Nicosie)', since: '1999', sales: '« Dans ma bulle » diamant (best-seller 2006)', note: 'La reine du rap 2000s. A tout raflé, puis a tout quitté.' },
  disiz: { from: 'Évry (91), origines sénégalaises', since: '2000', sales: '« L\'Amour » (2022) encensé', note: 'La Peste. De « J\'pète les plombs » à « L\'Amour », il se réinvente sans fin.' },
  caballerojeanjass: { from: 'Bruxelles (Belgique)', since: '2015', sales: 'Saga « Double Hélice » · culte web', note: 'Le duo chill de Bruxelles. Punchlines, weed et second degré.' },
  // ---- persos fictifs : données bidon (chambrage) ----
  bishok: { from: 'Maroc', since: '???', sales: '0 disque, 100 % conviction', note: 'Le révolté. Décrypte les complots. Grosses stats… mais pas de rappeur.' },
  bilaldu92: { from: 'Le 92', since: '2006', sales: '3 CD vendus (à sa famille)', note: 'Sa carrière tient dans un buzz de 2006. Depuis, silence radio.' },
  alexdu76: { from: 'Le 76', since: '2008 (dans sa tête)', sales: 'Disque de plomb', note: 'La star du 76… dans sa tête. Voulait juste briller.' },
  kortex: { from: 'Quelque part', since: '???', sales: 'Personne ne l\'a acheté', note: 'Il clashe tout le monde. Personne ne le calcule.' },
};
export const bioOf = (id?: string): Bio | undefined => (id ? BIOS[id] : undefined);

// Surnoms affichés sous le nom dans le showcase (character select + roster du hub)
export const EPITHETS: Record<string, string> = { jul: "L'OVNI", pnl: 'Les Frères', booba: 'Le Duc', damso: 'Dems', sch: 'Le S', ninho: 'Le Boss', nekfeu: 'Le Feu', orelsan: 'San', iam: 'Les Sages', solaar: 'Le Prince', gazo: 'La Drill', vald: "L'Alien", oxmo: 'Le Poète', fabe: 'Le Sage', kery: 'Le Combattant', medine: "L'Insoumis", youssoupha: 'La Plume', gims: 'Meugui', lafouine: 'Laouni', kaaris: 'Riska', rohff: 'Le Padre', alphawann: 'Le Technicien', laylow: 'Le Visionnaire', jewelusain: 'Le Conteur', plk: 'Le Polak', bishok: 'Le Révolté', bilaldu92: 'La Zermi du 92', alexdu76: 'La Star du 76', kortex: 'Le Clasheur', bouss: 'La Voix', huntrill: 'Nouvelle Trap', jolagreen23: 'La Green', junglejack: 'La Jungle', lafeve: 'La New Wave', okis: 'La Crème', freezecorleone: 'Le Complotiste', lino: 'La Lame', diams: 'La Demoiselle', disiz: 'La Peste', caballerojeanjass: 'Le Duo' };

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

// Réactions/taunts : boutons (pas de texte libre) que le joueur balance pendant le reveal → remontent
// sur l'écran hôte façon réactions Meet. Phrasé « street » du projet. Index = id envoyé au serveur.
export const REACTIONS = [
  { e: '🔥', t: 'Chaud' },
  { e: '😮‍💨', t: 'Trop facile' },
  { e: '🥊', t: 'Grosse frappe' },
  { e: '😤', t: 'Dans ta face' },
  { e: '👑', t: 'On est là' },
  { e: '💀', t: 'La honte' },
  { e: '🤡', t: 'Petit joueur' },
  { e: '🐐', t: 'GOAT' },
];

// Réactions de FIN DE PARTIE (podium/trophées) — un ton différent des taunts de manche : on félicite,
// on rage, on relance. Envoyées avec le flag `end` → l'hôte les mappe sur ce set (pas REACTIONS).
export const END_REACTIONS = [
  { e: '🏆', t: 'La ceinture' },
  { e: '🤝', t: 'GG' },
  { e: '🐐', t: 'GOAT' },
  { e: '😭', t: 'Rageant' },
  { e: '🔁', t: 'On remet ça' },
  { e: '🫡', t: 'Respect' },
  { e: '😮‍💨', t: 'Dégoûté' },
  { e: '🎤', t: 'Trop fort' },
];

// Punchlines de chambrage affichées quand le joueur n'a AUCUNE charge de pouvoir (jauge à sec).
// On en pioche une différente à chaque fois → ça pique un peu, ça motive à marquer pour recharger.
export const TRASH_TALK = [
  'Jauge à sec. Le talent, pas les pouvoirs.',
  'Zéro charge — va falloir mériter la prochaine.',
  'Rien dans le chargeur. Trouve, ça remplira.',
  'À poil, aucune charge. On rappe à l’ancienne.',
  'Pouvoir en PLS. Marque des points pour recharger.',
  '0 charge : prouve que t’as le niveau sans triche.',
  'Le barillet est vide. Reconnais des sons, pas des excuses.',
  'Pas de pouvoir. Juste toi, tes oreilles et ta fierté.',
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
  { id: 'braqueur', title: 'Les Impôts', icon: 'mask', blurb: 'Prélève sa part sur le dos des autres (vol / dîme / sabotage).', salty: true },
  { id: 'kamikaze', title: 'Le Poker', icon: 'dice', blurb: 'Mise tout sur un coup de poker.', salty: true },
  { id: 'sanspitie', title: 'Le Sans-Pitié', icon: 'mask', blurb: 'Gagne ET dépouille tout le monde au passage.', salty: true },
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
