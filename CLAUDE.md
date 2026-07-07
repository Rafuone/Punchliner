# PUNCHLINR — contexte projet

Blind-test / quiz de soirée sur le **rap FR**, façon Jackbox : l'écran (TV/PC) affiche un code, les
joueurs rejoignent depuis leur téléphone. Ce fichier réunit les règles, l'archi et les décisions pour
pouvoir reprendre le travail dans n'importe quelle conversation sans rien perdre.

> **Nom affiché = PUNCHLINR** (le E final remplacé par R : logo `.wm` + `<title>`). Le package npm
> reste `punchline`, le repo `Punchliner`.

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
  au démarrage → `POOL`). Musique du **menu** = mp3 locaux dans `client/public/music/` (LFS).
  - **Lobby hôte (écran du code)** : instru **Alpha Wann « philly flingo »** en boucle (pas la playlist
    → pas de spoil). **Crossfade doux** vers la **playlist** à l'entrée du ConfigWizard, qui **ouvre
    toujours sur « Pensées amères » de Bishok** (`MENU_TRACKS[0]`) — le son de Bishok se révèle après
    le choix des persos. Câblage dans `Host.tsx` (`lobbyAudioRef`, `fadeTo`, effet sur `configuring`).
- ⚠️ Si le **port 3001 est occupé** par une vieille instance node (sessions preview), la tuer avant
  de relancer (sinon le back ne démarre pas et sert du code périmé).

### Accès test rapide
- **`/?dev`** : rejoint direct le salon ouvert le plus récent avec un pseudo + perso aléatoires
  (bypass formulaire + character select). Ouvrir plusieurs onglets `/?dev` = plusieurs joueurs de
  test. Un lien « + ajouter un joueur test » est aussi sur l'écran hôte. (Endpoint `/api/dev/room`.)
- **Test d'intégration headless** : `node test-games.mjs` (voir [[project-test-harness]]) — joue de
  vraies parties sur toutes les configs. Nécessite un serveur en `PL_FAST` (manches raccourcies, jamais
  en prod) : `SERVER_PORT=3002 PL_FAST=1 node server/index.js`, puis `TEST_URL=http://localhost:3002
  node test-games.mjs`. Endpoint `/api/dev/answer?code=` révèle la réponse en cours (aide au test).

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
- **`playing`** (le son tourne, on répond) → **`reveal`** (réponse + scores) → … → **`final`** (podium +
  certif + **trophées** + classement de série). Depuis `final` : **Relancer une partie** (→ assistant) ou
  **Retour au salon** — on garde le cumul de série (voir plus bas). `finishGame()` remplace l'ancien final inline.

## Modes de jeu (ConfigWizard, étape « LE JEU »)
- **Blind Test** (`multi`) : tout le monde tape titre/artiste quand il veut. La carte du mode joue la
  vidéo `client/public/blind-test.mp4` en fond (muette, **uniquement quand sélectionnée**) sous le voile
  « diffusion télé » + crunch (`.keyvid` / `.keyvid-fx` dans `wizard.css`).
- **Format** (étape « LE FORMAT ») : paliers **8 / 16 / 24 / ∞** (défaut 16). Pas de 4 manches (nul pour un blind-test).
- **Buzzer** : le 1er qui buzze prend la main (8 s pour répondre, sinon lockout et le buzzer rouvre).
- **Quiz** : QCM de culture rap FR (banque `server/quiz.js`, faite main). Pas d'audio, **pas de pouvoirs**.
- **Orchestration** : `Automatique` **ou** `Maître du jeu` — un joueur anime : il voit la réponse,
  distribue les points à la voix (**+5 000 / +10 000**), coupe le son / révèle, passe à la manche suivante.
  En mode MJ : pas d'auto-notation, pas de pouvoirs, ≥ 2 joueurs requis.
- ⚠️ **Blind Test : le son joue TOUT l'extrait** — la manche NE se coupe PAS quand tout le monde a
  répondu (c'est voulu). Seul le **quiz** se révèle dès que tous ont répondu.

## Score = AUDITEURS (match.js + index.js)
- **base** = 10 000 par volet (titre / artiste) **+ 5 000** si les deux (prime de précision).
- **× vitesse** (`speedMult` : ×1 à la dernière seconde → ×2 instantané) **× difficulté**
  (facile 1.0 · connaisseur 1.3 · digger 1.6 · puriste 2.0).
- **Fautes** : `matchQuality` = 1.0 (exact / contient / tous les mots) vs 0.8 (faute ~20 % Levenshtein).
- **Certification** de fin (`data.ts → certif`, sur auditeurs/manche, indépendant du nb de manches) :
  Espoir → Disque d'Or → Platine → Double → Triple → **Diamant**.
- **Suspense** (`suspenseActive`) : sur la/les dernière(s) manche(s), si l'écart 1er↔2e est rattrapable
  (≤ manches restantes × 38 000), on MASQUE le classement (host = carte « scores masqués » ; joueur =
  total/rang + score de la barre en `??? aud.`). Si le leader est intouchable, on l'affiche (le plus fort
  doit gagner — pas de frustration Mario Kart). Flag `suspense` (round) / `hideBoard` (reveal).
- **Jauge de pouvoir** (`fillCharges`) : se remplit en fin de manche selon `rebalance`
  (comeback = les derniers rechargent + vite · snowball · off). 1 charge = 1 pouvoir. Cap 5.

## Multi-parties : série, trophées, salle d'attente (server/index.js + server/awards.js)
- **Le salon survit à une partie.** À la fin (`finishGame`), on **cumule dans la série** : par joueur
  `total` (auditeurs cumulés), `gameWins`, `totalRounds`. `host:restart` (« Rejouer / Retour au salon »)
  repart au lobby en **gardant** ce cumul (score/charges/stats de partie remis à zéro). `host:resetSeries`
  efface le cumul. Le podium montre la partie + (dès la 2ᵉ partie) le **classement général** (certif sur le total).
- **Trophées de fin** (façon TowerFall) : `server/awards.js` (`computeAwards`, ~22 récompenses, 3 max,
  pondérées + jitter pour varier, réparties sur des joueurs différents). Basés sur des **stats de partie**
  (`p.stat` : tentatives/trouvailles/1ers/perfects/best/zéros/pouvoirs/solo/1re-2e mi-temps/pire rang),
  accumulées dans les handlers de réponse + `endRound`. Textes côté serveur, **icônes** seules côté client
  (`data.ts → AWARD_ICONS` / `awardIcon`, SVG dessinés).
- **Salle d'attente** : un **nouveau** joueur qui rejoint **en pleine partie** est accepté avec `waiting:true`
  (avant : refusé). Il est **exclu** des scores/écrans de jeu (`publicPlayers` filtre `waiting`), voit
  « Partie en cours », et devient **actif au prochain lobby** (`host:restart` lève `waiting`). Son perso reste réservé.

## Pouvoirs — source de vérité = `server/powers.js`
- **Activés dans la fenêtre `prep` AVANT la musique** (sinon on activerait en connaissant déjà la
  réponse → exploit). Bouton **Passer** ; la fenêtre se ferme dès que tout le monde est prêt (max 10 s).
- `data.ts` porte le **nom + texte d'effet** affichés ; `powers.js` porte la **mécanique + valeurs**.
- Mécaniques : `double{mult}`, `bonus{amount,refuel}`, `wager{mult,penalty}`, `steal{amount}`,
  `sabotage{targets,grab}`, `hint{self}`, `safety{floor,self}`, `momentum{base,per}`,
  `decay{base,factor}`, `comeback{factor,cap}`, `firstblood{base,first}`, `veteran{rounds,floor}`,
  `freeze{self}`, `jam{ms,self}`, `nofault{self}`, `ace{mult}` (nofault + double),
  `tax{amount}` (prélève à TOUS), `allin{per}` (vide toutes les charges → per×charges),
  `draft{frac}` (part du meilleur score adverse de la manche), `combo{base,per,cap}` (×mult qui
  grossit avec la série), `sustain{amount,rounds}` (revenu garanti N manches — echo/slowburn).
  (`backfire` a existé pour Cortex puis abandonné : un pouvoir qui fait perdre des points = injouable.)
- **Force ~ tier de carrière** (S > A > B). Défensifs (`safety`) : petit `self` offensif ; denial
  (`sabotage`) : petit `grab`. **Génies incompris = volontairement les PLUS FAIBLES** (~5-8 % winrate,
  gagnable mais ultra dur) SAUF **Bishok** (exception « rigolote », correct).
- Désactivés en **Quiz** et **MJ**. Immunités : `safety` et `veteran` protègent du vol/sabotage.

### Équilibrage — `sim-balance.mjs` (outil clé)
- `node sim-balance.mjs` : joue des parties à skill égal (seul le pouvoir diffère) sur **les 4
  DIFFICULTÉS** (facile→puriste) et sort le **winrate par difficulté + moyenne + SPREAD**. À relancer
  après chaque changement de valeurs dans `powers.js`.
- **La difficulté change tout** : `hint` (indices) ~inutile en facile (~8 %) mais fort en puriste
  (~35 %) ; `momentum` l'INVERSE (facile ~45 % / puriste ~11 %) ; `veteran` fort en difficile. Un gros
  **SPREAD** = pouvoir très sensible à la difficulté. Cible : pack ~18-27 %, ratés au fond.
- Le sim est un **modèle** (skill égal, usage heuristique) : il attrape les gros déséquilibres, pas
  les subtilités. Le vrai playtest à plusieurs reste le juge final. Voir aussi [[project-test-harness]]
  (`test-games.mjs`) pour le test d'INTÉGRATION (vraies parties, tous les modes).

## Roster (data.ts → AVATARS) — 36 rappeurs
- Champs : `id, name, color, cat, power{name,effect}, stats{flow,punch,tech,aura}(1-5), statLabels?,
  img?, crop?`. `statLabels` = libellés de stats custom (cas **Bishok** : Complot/Maroc/Conscience/Révolte).
  `crop` = `{ z? }` (zoom vignette) + `{ y? }` (focale verticale du showcase, ex. maillot de Bishok).
- **Catégories** (ordre = `CATEGORY_ORDER`) : Légende · Mainstream · Rap game · Plume · Conscient ·
  Drill · Nouvelle scène · **Rookies** · **Génies incompris** (dernière). (« Troll » supprimée.)
  - **Rookies** = nouvelle scène FR (Bouss, Huntrill, Jolagreen23, Jungle Jack, La Fève, Okis).
  - **Génies incompris** = rappeurs-mèmes ratés (Cortex, Bilal du 92, Alex du 76) + **Bishok** (pote
    d'Alexandre, l'exception). Stats plafonnées à 2 sauf Bishok. Effet holo « sticker » = ABANDONNÉ.
- **Portrait** : `client/public/avatars/<id>.png` (LFS). Tous en ont un. Bishok = ex-fichier « Youcef ».
- **Perso unique par salon** : quand un joueur prend un rappeur, il devient **grisé « PRIS »** en
  direct pour les autres (serveur `player:watch` + refus au `player:join` si déjà pris).

## Écrans clés (client/src/screens/)
- **Host.tsx** — la TV : lobby (code + QR **centré**, bloc aéré, PAS de dock musique), prep, playing
  (disque/chrono ou QCM), reveal, final ; **EQ + glow vert réactifs au son** (FFT réelle, côté ConfigWizard).
  ⚠️ **Le proprio retravaille la page d'accueil (lobby)** — éviter d'y toucher sans coordination.
- **Player.tsx** — le téléphone : formulaire (code + blaze, bouton **« Entre dans le cercle »** réf.
  Fianso), **character select** (showcase grande image + nom + surnom `EPITHETS` + stats ; roster
  **groupé par catégorie en scroll horizontal**, vignettes recadrées via `crop`, anneau de sélection
  uniforme), fenêtre prep (Activer/Passer), jeu, **pupitre Maître du jeu**, **salle d'attente**.
  - **Hub** (écran d'accueil) : boutons **« Le roster »** (`step:'roster'` = character-select en mode
    browse, façon Street Fighter) et **« Le palmarès »** (`step:'trophies'` = galerie `AWARDS_INFO` ;
    débloqués en `localStorage pl_trophies`, le reste grisé « ??? / à découvrir », toggle Tout voir/Masquer).
- **Avatars ronds** : `.med` (Host `Med` / Player `RMed`) affiche la PHOTO du rappeur (rond), initiales en repli.
- **ConfigWizard.tsx** — assistant en 5 actes (Jeu / Playlist / Difficulté / Format / Réglages) ;
  dock musique ; **compteur de joueurs cliquable → liste « qui est dans le salon »**. Cartes de mode
  qui s'empilent sous 960px ; l'artwork est clippé dans `.kclip` (le tag P1/brackets ne sont plus rognés).
- **GrungeBg.tsx** — fond grunge canvas (béton/coulures/rayures) monté derrière le form + le lobby.
- DA « street » : anthracite crade + fluo jaune-vert + **grunge** (`styles.css`, `wizard.css`).

## Fichiers importants
- `server/index.js` — boucle de jeu, handlers Socket.IO, scoring, pouvoirs, MJ, quiz, lock perso,
  reconnexion (par `playerId`, marche en pleine partie), `PL_FAST` (test), `/api/dev/*`.
- `server/powers.js` — définitions des pouvoirs (valeurs calibrées par le sim).
- `server/awards.js` — catalogue des **trophées de fin** + `computeAwards` (icônes côté `data.ts`).
- `server/match.js` — matching des réponses (normalize, levenshtein, gradeAnswer, speedMult).
- `server/quiz.js` — banque de questions du mode Quiz.
- `server/tracks.js` — `SEED_TRACKS` (résolus via Deezer).
- `client/src/data.ts` — roster, catégories, certif, fmtAud, difficultés, `MENU_TRACKS`, `isLegend/isGenie`,
  `AWARD_ICONS`/`awardIcon` (icônes SVG des trophées).
- `sim-balance.mjs` — simulateur d'équilibrage (difficulté-aware). `test-games.mjs` — test d'intégration headless.
- `AVATARS_PROMPTS.md` — prompts de génération des portraits.

## En cours / pistes (non fait)
- **Page d'accueil (lobby hôte)** : refonte en cours par le proprio.
- **Musique du beat de menu** : c'est l'instru d'Alpha Wann pour l'instant ; le proprio peut fournir
  un autre morceau à câbler à la place (sur le lobby).
- Idées de pouvoirs pas encore faites : **1v1 duel** (Booba), bloquer un joueur le tour suivant, spy live.
  (Le « biter »/copie a inspiré `draft` = Bouss.)
- **Quiz** : étoffer la banque ; un vrai « qui a dit cette punchline ? » demande une source de paroles.
- **Mode Solo / campagne** : le bloc « bientôt » a été retiré du ConfigWizard, à refaire plus tard.
- Playtests réels à plusieurs pour valider l'équilibrage sur le terrain.
