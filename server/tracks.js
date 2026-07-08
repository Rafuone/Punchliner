// ════════════════════════════════════════════════════════════════════════
//  SOURCE DE VÉRITÉ DU POOL MUSICAL
// ════════════════════════════════════════════════════════════════════════
// Deux graines complémentaires :
//  1) SEED_ARTISTS → le serveur récupère TOUT le catalogue populaire de chaque
//     rappeur (top ~50 titres via Deezer) → un pool de 1500-2000+ morceaux qui
//     change à chaque partie. C'est la source principale ("toujours du nouveau").
//  2) SEED_TRACKS → une poignée de classiques précis qu'on veut GARANTIR dans le
//     pool même s'ils ne sont pas dans le top d'un artiste. Un filet, pas la base.
// La difficulté se base sur la popularité (rank Deezer), pas sur la durée.
// NB : cette même liste d'artistes servira à Spotify (même moteur, autre source).

export const SEED_ARTISTS = [
  // — Légendes / patrimoine 90s-2000s —
  'IAM', 'Suprême NTM', 'MC Solaar', 'Booba', 'Rohff', 'Kery James', 'Oxmo Puccino',
  'Ärsenik', 'Fonky Family', 'Sniper', '113', 'Sinik', 'La Fouine', 'Diam\'s', 'Sefyu',
  'Médine', 'Disiz', 'Kaaris', 'Mac Tyer', 'Nessbeal', 'Rim\'K',
  // — Piliers 2010s / mainstream —
  'Sexion d\'Assaut', 'Maître Gims', 'Soprano', 'Psy 4 de la Rime', 'Youssoupha', 'Lacrim',
  'Alonzo', 'Sofiane', 'Gradur', 'MHD', 'Niska', 'Nekfeu', 'Orelsan', 'Bigflo & Oli',
  'Lomepal', 'Alpha Wann', 'Dinos', 'Dosseh', 'Lorenzo', 'Vald',
  // — Poids lourds actuels —
  'PNL', 'Damso', 'SCH', 'Ninho', 'Jul', 'Gazo', 'Naps', 'Tiakola', 'PLK', 'Koba LaD',
  'Maes', 'Hamza', 'Laylow', 'Josman', 'Soso Maness', 'Heuss L\'Enfoiré', 'Soolking',
  'Kalash', 'Bosh', 'Ziak', 'Zola', 'Leto', 'Freeze Corleone', 'Lefa', 'Da Uzi',
  'Werenoi', 'Franglish', 'Jolagreen23',
];

// ════════════════════════════════════════════════════════════════════════
//  TAGS PAR ARTISTE (vérifiés) → pilotent le filtre THÈME/STYLE du blind test.
// ════════════════════════════════════════════════════════════════════════
// Vocabulaire (aligné sur les thèmes du ConfigWizard) :
//   styles  : boombap · drill · trap · nouvelle · conscient · club · egotrip · street · love
//   ville   : marseille · paris        (pour les thèmes "Marseille" / "Paris")
//   statut  : legend                    (patrimoine, pour le thème "Légendes")
// L'ÉPOQUE n'est PAS ici : elle vient de l'ANNÉE RÉELLE du morceau (release_date), car un artiste
// traverse plusieurs décennies. Le thème "Old school" = année ≤ 2005 ; "Gros feats" = morceau AVEC feat.
// Le style est au niveau ARTISTE (Deezer ne donne pas de genre fiable par titre) : dominant, pas exhaustif.
export const ARTIST_TAGS = {
  // — Légendes / patrimoine —
  'IAM': ['boombap', 'conscient', 'marseille', 'legend'],
  'Suprême NTM': ['boombap', 'egotrip', 'paris', 'legend'],
  'MC Solaar': ['boombap', 'conscient', 'paris', 'legend'],
  'Booba': ['trap', 'egotrip', 'street', 'paris', 'legend'],
  'Rohff': ['trap', 'street', 'egotrip', 'paris', 'legend'],
  'Kery James': ['conscient', 'boombap', 'paris', 'legend'],
  'Oxmo Puccino': ['boombap', 'conscient', 'paris', 'legend'],
  'Ärsenik': ['boombap', 'street', 'paris'],
  'Fonky Family': ['boombap', 'street', 'marseille'],
  'Sniper': ['boombap', 'conscient', 'street', 'paris'],
  '113': ['boombap', 'street', 'paris'],
  'Sinik': ['boombap', 'egotrip', 'paris'],
  'La Fouine': ['trap', 'street', 'paris'],
  "Diam's": ['boombap', 'conscient', 'paris', 'legend'],
  'Sefyu': ['street', 'boombap', 'paris'],
  'Médine': ['conscient', 'boombap'],
  'Disiz': ['boombap', 'conscient', 'paris'],
  'Kaaris': ['trap', 'street', 'paris'],
  'Mac Tyer': ['street', 'paris'],
  'Nessbeal': ['boombap', 'street', 'paris'],
  "Rim'K": ['street', 'boombap', 'paris'],
  // — Piliers 2010s / mainstream —
  "Sexion d'Assaut": ['club', 'paris'],
  'Maître Gims': ['club', 'love', 'paris'],
  'Soprano': ['club', 'marseille'],
  'Psy 4 de la Rime': ['boombap', 'marseille'],
  'Youssoupha': ['conscient', 'boombap', 'paris'],
  'Lacrim': ['trap', 'street', 'paris'],
  'Alonzo': ['street', 'trap', 'marseille'],
  'Sofiane': ['street', 'club', 'paris'],
  'Gradur': ['club', 'trap'],
  'MHD': ['club', 'nouvelle', 'paris'],
  'Niska': ['club', 'trap', 'paris'],
  'Nekfeu': ['boombap', 'nouvelle', 'paris'],
  'Orelsan': ['boombap', 'conscient'],
  'Bigflo & Oli': ['boombap', 'conscient'],
  'Lomepal': ['nouvelle', 'boombap', 'paris'],
  'Alpha Wann': ['boombap', 'egotrip', 'paris'],
  'Dinos': ['boombap', 'conscient', 'paris'],
  'Dosseh': ['trap', 'street', 'paris'],
  'Lorenzo': ['club', 'egotrip'],
  'Vald': ['trap', 'egotrip', 'paris'],
  // — Poids lourds actuels —
  'PNL': ['nouvelle', 'trap', 'paris'],
  'Damso': ['trap', 'nouvelle', 'egotrip'],
  'SCH': ['trap', 'street', 'marseille'],
  'Ninho': ['trap', 'street', 'paris'],
  'Jul': ['club', 'nouvelle', 'marseille'],
  'Gazo': ['drill', 'paris'],
  'Naps': ['club', 'street', 'marseille'],
  'Tiakola': ['nouvelle', 'club', 'paris'],
  'PLK': ['trap', 'street', 'paris'],
  'Koba LaD': ['trap', 'drill', 'street', 'paris'],
  'Maes': ['trap', 'street', 'paris'],
  'Hamza': ['nouvelle', 'love', 'trap'],
  'Laylow': ['nouvelle', 'trap'],
  'Josman': ['nouvelle', 'boombap'],
  'Soso Maness': ['street', 'marseille'],
  "Heuss L'Enfoiré": ['club', 'street', 'paris'],
  'Soolking': ['club', 'nouvelle'],
  'Kalash': ['club', 'nouvelle'],
  'Bosh': ['club', 'trap'],
  'Ziak': ['drill', 'street', 'paris'],
  'Zola': ['trap', 'drill', 'street', 'paris'],
  'Leto': ['trap', 'drill', 'street', 'paris'],
  'Freeze Corleone': ['drill', 'egotrip', 'street', 'paris'],
  'Lefa': ['boombap', 'trap', 'paris'],
  'Da Uzi': ['drill', 'street', 'paris'],
  'Werenoi': ['trap', 'drill', 'street', 'paris'],
  'Franglish': ['nouvelle', 'love', 'club', 'paris'],
  'Jolagreen23': ['nouvelle', 'drill'],
};

export const SEED_TRACKS = [
  // — grand public / hits —
  { artist: 'Jul', title: 'Tchikita' },
  { artist: 'PNL', title: 'Au DD' },
  { artist: 'Maître Gims', title: 'Sapés comme jamais' },
  { artist: 'Niska', title: 'Réseaux' },
  { artist: 'Gazo', title: 'Drill FR 4' },
  { artist: 'Ninho', title: 'Jefe' },
  { artist: 'Damso', title: 'Macarena' },
  { artist: 'SCH', title: 'Otto' },
  { artist: 'Orelsan', title: 'Basique' },
  { artist: 'Nekfeu', title: 'On verra' },
  { artist: 'Booba', title: 'DKR' },
  { artist: 'Maes', title: 'Blanche' },
  { artist: 'Naps', title: 'La kiffance' },
  { artist: 'Tiakola', title: 'Meuda' },
  { artist: 'Bigflo & Oli', title: 'Dommage' },
  { artist: 'Sexion d\'Assaut', title: 'Désolé' },
  { artist: 'PLK', title: 'Au sommet' },
  { artist: 'Koba LaD', title: 'RR 9.1' },
  { artist: 'Vald', title: 'Bonjour' },
  { artist: 'Kaaris', title: 'Zoo' },
  // — connaisseurs / classiques —
  { artist: 'Sofiane', title: 'Mon p\'tit loup' },
  { artist: 'Lacrim', title: 'Corleone' },
  { artist: 'Soso Maness', title: 'Petrouchka' },
  { artist: 'Alonzo', title: 'La Seleção' },
  { artist: 'Josman', title: 'Différent' },
  { artist: 'Dinos', title: 'Hélicoptère' },
  { artist: 'Rohff', title: 'Qui est l\'exemple' },
  { artist: 'La Fouine', title: 'Karma' },
  { artist: 'Sinik', title: 'Une époque formidable' },
  { artist: 'Sniper', title: 'Gravé dans la roche' },
  // — diggers / plus pointu —
  { artist: 'IAM', title: 'Petit frère' },
  { artist: 'Suprême NTM', title: 'Laisse pas traîner ton fils' },
  { artist: 'MC Solaar', title: 'Bouge de là' },
  { artist: 'Médine', title: 'Grand Paris' },
  { artist: 'Alpha Wann', title: 'Stupide' },
  { artist: 'Laylow', title: 'Megatron' },
  { artist: 'Hamza', title: 'HS' },
  { artist: 'Rim\'K', title: 'Air Max' },

  // ————————————————————————————————————————————————————————————
  //  Élargissement du pool (anti « toujours les mêmes »)
  // ————————————————————————————————————————————————————————————
  // — grand public / hits récents —
  { artist: 'Heuss L\'Enfoiré', title: 'Moulaga' },
  { artist: 'Soolking', title: 'Guérilla' },
  { artist: 'Gradur', title: 'Sheguey' },
  { artist: 'MHD', title: 'La Puissance' },
  { artist: 'Lorenzo', title: 'Fais le moonwalk' },
  { artist: 'Bigflo & Oli', title: 'Bienvenue chez moi' },
  { artist: 'Kalash', title: 'Mwaka Moon' },
  { artist: 'Ziak', title: 'Fantôme' },
  { artist: 'PNL', title: 'Onizuka' },
  { artist: 'SCH', title: 'Gomorra' },
  { artist: 'Jul', title: 'Ma jolie' },
  { artist: 'Ninho', title: 'Lettre à une femme' },
  { artist: 'Dosseh', title: 'Habitué' },
  { artist: 'Lomepal', title: 'Trop beau' },
  { artist: 'Bosh', title: 'Djomb' },
  { artist: 'Zola', title: 'Papers' },
  { artist: 'Leto', title: 'Kalash' },
  { artist: 'Freeze Corleone', title: 'Freeze Raël' },
  // — connaisseurs / classiques 2010s —
  { artist: 'Diam\'s', title: 'La Boulette' },
  { artist: 'Diam\'s', title: 'DJ' },
  { artist: 'Sefyu', title: 'Molotov 4' },
  { artist: 'Kery James', title: 'Banlieusards' },
  { artist: 'Psy 4 de la Rime', title: 'Champs Élysées' },
  { artist: 'Youssoupha', title: 'Dreamin\'' },
  { artist: 'Disiz', title: 'J\'pète les plombs' },
  { artist: 'Soprano', title: 'Cosmo' },
  { artist: 'Lefa', title: 'Feuille blanche' },
  // — diggers / patrimoine 90s-2000s —
  { artist: '113', title: 'Tonton du bled' },
  { artist: 'Lunatic', title: 'Le crime paie' },
  { artist: 'IAM', title: 'Demain c\'est loin' },
  { artist: 'IAM', title: 'Nés sous la même étoile' },
  { artist: 'Suprême NTM', title: 'Ma Benz' },
  { artist: 'Suprême NTM', title: 'That\'s My People' },
  { artist: 'MC Solaar', title: 'Nouveau Western' },
  { artist: 'MC Solaar', title: 'Caroline' },
  { artist: 'Booba', title: '92i Veyron' },
  { artist: 'Fonky Family', title: 'Sans rémission' },
  { artist: 'Oxmo Puccino', title: 'Le jour et la nuit' },
];
