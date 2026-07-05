# PUNCHLINE — contexte projet

Blind-test / quiz de soirée sur le **rap FR**, façon Jackbox : l'écran (TV/PC) affiche un code, les
joueurs rejoignent depuis leur téléphone. Ce fichier réunit les règles, l'archi et les décisions pour
pouvoir reprendre le travail dans n'importe quelle conversation sans rien perdre.

## Façon de travailler (IMPORTANT)
- **On code DIRECTEMENT dans le vrai projet.** Pas d'exploration/maquette jetable à côté qu'on
  réintègre ensuite (ça a coûté ~3 h une fois). On itère en prod, on corrige en place.
- **Git** : branche `main`, remote `origin` = https://github.com/Rafuone/Punchliner . Commit/push
  **uniquement quand l'utilisateur le demande**. Médias en **Git LFS** (voir plus bas).
- Le jeu n'est **pas encore en ligne / pas finalisé** → on n'a pas besoin de se prendre la tête, on
  construit et on ajuste.
- Le proprio (Alexandre) parle **français**. Réponses en français.

## Stack & lancement
- Monorepo npm workspaces : **`client/`** (Vite + React + TypeScript) et **`server/`** (Node ESM +
  Express + Socket.IO).
- `npm run dev` (racine) lance en parallèle : le serveur (`node --watch`, **port 3001**) et le client
  (Vite, **port 5173**). Le client parle au serveur en Socket.IO (origine relative → marche en LAN).
- **Écran hôte** (la TV) : `/host`. **Joueur** (téléphone) : `/`.
- Audio du jeu = **extraits Deezer 30 s** (le serveur résout `SEED_TRACKS` via l'API publique Deezer
  au démarrage → `POOL`). Musique du **menu** = mp3 locaux dans `client/public/music/` (5 titres).
- ⚠️ Si le **port 3001 est occupé** par une vieille instance node (sessions preview), la tuer avant
  de relancer (sinon le back ne démarre pas et sert du code périmé).

### Accès test rapide
- **`/?dev`** : rejoint direct le salon ouvert le plus récent avec un pseudo + perso aléatoires
  (bypass formulaire + character select). Ouvrir plusieurs onglets `/?dev` = plusieurs joueurs de
  test. Un lien « + ajouter un joueur test » est aussi sur l'écran hôte. (Endpoint `/api/dev/room`.)

## Médias & Git LFS
- **En LFS** (`.gitattributes`) : `client/public/avatars/*.png` et `client/public/music/*.mp3`.
- **`assets/`** = originaux bruts (portraits pleine résolution, mp3 sources) → **gitignored**, restent
  en local. Workflow : déposer les images dans `assets/Roster/`, puis les copier vers
  `client/public/avatars/<id>.png` (nom = id du perso en minuscule).
- Prompts de génération des portraits : **`AVATARS_PROMPTS.md`** (16-bit pixel art, fighting-game
  select, **rim light vert `#a6ff00`**, fond anthracite baigné orange-rosé).

## Boucle de jeu (server/index.js)
`lobby` → *(l'hôte configure via ConfigWizard)* → pour chaque manche :
- **`prep`** (fenêtre POUVOIRS, modes à pouvoirs) **ou** `countdown` 5 s (quiz / MJ) →
- **`playing`** (le son tourne, on répond) → **`reveal`** (réponse + scores) → … → **`final`** (podium + certif).

## Modes de jeu (ConfigWizard, étape « LE JEU »)
- **Blind Test** (`multi`) : tout le monde tape titre/artiste quand il veut.
- **Buzzer** : le 1er qui buzze prend la main (8 s pour répondre, sinon lockout et le buzzer rouvre).
- **Quiz** : QCM de culture rap FR (banque `server/quiz.js`, faite main). Pas d'audio, **pas de pouvoirs**.
- **Orchestration** : `Automatique` **ou** `Maître du jeu` — un joueur anime : il voit la réponse,
  distribue les points à la voix (+50/+100), coupe le son / révèle, passe à la manche suivante.
  En mode MJ : pas d'auto-notation, pas de pouvoirs, ≥ 2 joueurs requis.

## Score = AUDITEURS (match.js + index.js)
- **base** = 10 000 par volet (titre / artiste) **+ 5 000** si les deux (prime de précision).
- **× vitesse** (`speedMult` : ×1 à la dernière seconde → ×2 instantané) **× difficulté**
  (facile 1.0 · connaisseur 1.3 · digger 1.6 · puriste 2.0).
- **Fautes** : `matchQuality` = 1.0 (exact / contient / tous les mots) vs 0.8 (faute ~20 % Levenshtein).
- **Certification** de fin (`data.ts → certif`, sur auditeurs/manche, indépendant du nb de manches) :
  Espoir → Disque d'Or → Platine → Double → Triple → **Diamant**.
- **Jauge de pouvoir** (`fillCharges`) : se remplit en fin de manche selon `rebalance`
  (comeback = les derniers rechargent + vite · snowball · off). 1 charge = 1 pouvoir. Cap 5.

## Pouvoirs — source de vérité = `server/powers.js`
- **Activés dans la fenêtre `prep` AVANT la musique** (sinon on activerait en connaissant déjà la
  réponse → exploit). Bouton **Passer** ; la fenêtre se ferme dès que tout le monde est prêt (max 10 s).
- `data.ts` porte le **nom + texte d'effet** affichés ; `powers.js` porte la **mécanique + valeurs**.
- Mécaniques : `double{mult}`, `bonus{amount,refuel}`, `wager{mult,penalty}`, `steal{amount}`,
  `sabotage{targets,grab}`, `hint{self}`, `safety{floor,self}`, `momentum{base,per}`,
  `decay{base,factor}`, `comeback{factor,cap}`, `firstblood{base,first}`, `veteran{rounds,floor}`,
  `freeze{self}`, `jam{ms,self}`, `nofault{self}`, `ace{mult}` (nofault + double).
- **Force ~ tier de carrière** (S > A > B). Les pouvoirs **défensifs** (`safety`) ont un petit `self`
  offensif pour rester viables ; le **denial** (`sabotage`) a un petit `grab` (vol perso).
- Désactivés en **Quiz** et **MJ**. Immunités : `safety` et `veteran` protègent du vol/sabotage.

### Équilibrage — `sim-balance.mjs` (outil clé)
- `node sim-balance.mjs` : joue **6 000 parties à skill égal** (seul le pouvoir diffère) et sort le
  **winrate + tier list**. À relancer après chaque changement de valeurs dans `powers.js`.
- Cible : **delta ~6-8 %** de winrate entre tous (attendu 20 % à 5 joueurs). État actuel ≈ **16,6-23,2 %**.
  Historique : on est parti de 4 %-72 % (multiplicateurs cassés) → calibré en plusieurs passes.
- Le sim est un **modèle** (skill égal, usage des pouvoirs heuristique) : il attrape les gros
  déséquilibres, pas les subtilités. Le vrai playtest à plusieurs reste le juge final.

## Roster (data.ts → AVATARS) — 26 rappeurs
- Champs : `id, name, color, cat, power{name,effect}, stats{flow,punch,tech,aura}(1-5), img?, crop?`.
- **Catégories** (ordre = `CATEGORY_ORDER`) : Légende · Mainstream · Rap game · Plume · Conscient ·
  Drill · Nouvelle scène · Troll.
- **Portrait** : `client/public/avatars/<id>.png` (LFS). Les 26 en ont un.
- **Perso unique par salon** : quand un joueur prend un rappeur, il devient **grisé « PRIS »** en
  direct pour les autres (serveur `player:watch` + refus au `player:join` si déjà pris).

## Écrans clés (client/src/screens/)
- **Host.tsx** — la TV : lobby (code + QR), prep, playing (disque/chrono ou QCM), reveal, final ;
  musique du menu (aléatoire) ; **EQ + glow vert réactifs au son** (analyse FFT réelle).
- **Player.tsx** — le téléphone : formulaire (code + blaze), **character select** (showcase : grande
  image, nom en bas en blanc + surnom, stats à droite ; roster **groupé par catégorie en scroll
  horizontal**, vignettes **recadrées sur le visage**, zoom par perso via `crop`), fenêtre prep
  (Activer/Passer), jeu, **pupitre Maître du jeu**.
- **ConfigWizard.tsx** — assistant de config en 5 actes (Jeu / Playlist / Difficulté / Format / Réglages).
- DA « street » : anthracite crade + fluo jaune-vert (`styles.css`, `wizard.css`).

## Fichiers importants
- `server/index.js` — boucle de jeu, handlers Socket.IO, scoring, pouvoirs, MJ, quiz, lock perso.
- `server/powers.js` — définitions des pouvoirs (valeurs calibrées par le sim).
- `server/match.js` — matching des réponses (normalize, levenshtein, gradeAnswer, speedMult).
- `server/quiz.js` — banque de questions du mode Quiz.
- `server/tracks.js` — `SEED_TRACKS` (résolus via Deezer).
- `client/src/data.ts` — roster, catégories, certif, fmtAud, difficultés, `MENU_TRACKS`.
- `sim-balance.mjs` — simulateur d'équilibrage.
- `AVATARS_PROMPTS.md` — prompts de génération des portraits.

## En cours / pistes (non fait)
- Pouvoirs reportés (demandent une comparaison inter-joueurs en fin de manche) : **1v1 duel** (Booba),
  **copie de réponse** (le « biter »). Autres idées à creuser : bloquer un joueur le tour suivant,
  auto-complétion en écrivant, divinatoire/spy live.
- **Quiz** : étoffer la banque ; un vrai « qui a dit cette punchline ? » demande une source de paroles.
- **Mode Solo / campagne** (arcade, boss, déblocage) : annoncé « bientôt », pas commencé.
- Playtests réels à plusieurs pour valider l'équilibrage sur le terrain.
