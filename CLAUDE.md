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
`lobby` → *(l'hôte configure via ConfigWizard)* → **préchargement** (`game:preload` → la TV rapatrie TOUS les
extraits de la partie en **blob**, puis `host:preloaded` ; plafond 25 s serveur / 15 s TV) → pour chaque manche :
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
  distribue les points à la voix (**+3 000 / +6 000**), coupe le son / révèle, passe à la manche suivante.
  En mode MJ : pas d'auto-notation, pas de pouvoirs, ≥ 2 joueurs requis.
- ⚠️ **Blind Test : le son joue TOUT l'extrait** — la manche NE se coupe PAS quand tout le monde a
  répondu (c'est voulu). Seul le **quiz** se révèle dès que tous ont répondu.

## Score = AUDITEURS (match.js + index.js)
- ⚓ **ÉCHELLE ANCRÉE SUR LE RÉEL (2026-07-15)** — les certifs du jeu utilisent les **VRAIS paliers SNEP**
  (album, équivalents ventes) : **Or 50 000 · Platine 100 000 · Double 200 000 · Triple 300 000 · Diamant 500 000**.
  `certif(score, rounds)` (data.ts) compare le **TOTAL de la partie NORMALISÉ à 16 manches**
  (`norm = score / rounds × 16`) → indépendant du format joué (8/16/24) **et** vrai vis-à-vis du réel.
  *Pourquoi* : le score s'appelle « auditeurs » et les récompenses « Disque d'Or/Diamant » — les nombres doivent
  dire la vérité (un rappeur du roster qui teste le jeu le remarquerait). Ça donne aussi une **cible objective**
  de calibrage au lieu de seuils au doigt mouillé.
- **base** = **6 000** par volet (titre / artiste) **+ 6 000** si les deux (prime de précision — vaut un **3e volet**,
  donc trouver les DEUX = **18 000** = 3× le partiel). Historique : 5 000 → 10 000 (`63a4071`), puis **×0.6**
  au passage à l'échelle SNEP (le 30 000 rendait le Diamant trivial à 500 000).
- **× vitesse** (`speedMult` : ×1 dernière seconde → **×2.5** instantané, courbe **convexe** `frac^1.7` → le bonus
  chute vite quand on tarde) **× difficulté** — **3 crans** depuis le 2026-07-11 (`DIFFICULTY`, index.js) :
  Mainstream **1.0** · Connaisseur **1.5** · Puriste **2.0**. (Les crans « connaisseur 1.3 / digger 1.6 » n'existent plus.)
- ⚠️ **TOUTE valeur en auditeurs suit l'échelle.** Si tu en changes une, change les autres : sinon elle devient
  1.67× plus forte en relatif (déséquilibre silencieux). Recensées : `powers.js` (46 montants), `index.js`
  (clash `BATTLE_WIN 12 000`/`DRAW 3 600`/`BET_BONUS 2 400`, suspense **22 800**, seuil duel-au-sommet **27 000**,
  comeback **1 200** ×2 miroirs, quiz **6 000**, buzzer **+3 000**, MJ), `awards.js` (4 seuils absolus),
  `data.ts` (les ~36 textes de pouvoirs **doivent citer les montants de powers.js**), `sim-balance.mjs`.
- ⚠️ **Le barème n'est PAS le même selon le mode** — or `certif` est mode-blind :
  Blind Test `base × speed × mult` → max/manche **45 000** facile · 67 500 normal · 90 000 puriste ;
  **Buzzer** `base × mult + 3 000` (**pas de speedMult** — voulu : le temps est déjà arbitré par la course au buzz) ;
  **Quiz** `6 000 × speedMult`, mult=1 → max **15 000**.
  → Le Diamant reste **hors d'atteinte en Quiz et en Buzzer**. Voir (SCORE-MODE) dans CORRECTIFS.md.
- **Fautes** : `matchQuality` = 1.0 (exact / contient / tous les mots) vs 0.8 (faute ~20 % Levenshtein).
- **Certification** de fin (`data.ts → certif`) : **paliers SNEP réels** sur le **total normalisé 16 manches**
  (indépendant du nb de manches — voir ⚓ plus haut) :
  Espoir → Disque d'Or (50 000) → Platine (100 000) → Double (200 000) → Triple (300 000) → **Diamant (500 000)**.
- **Suspense** (`suspenseActive`) : sur la/les dernière(s) manche(s), si l'écart 1er↔2e est rattrapable
  (≤ manches restantes × 22 800), on MASQUE le classement (host = carte « scores masqués » ; joueur =
  total/rang + score de la barre en `??? aud.`). Si le leader est intouchable, on l'affiche (le plus fort
  doit gagner — pas de frustration Mario Kart). Flag `suspense` (round) / `hideBoard` (reveal).
- **Jauge de pouvoir** (`fillCharges`) : se remplit en fin de manche selon `rebalance`
  (comeback = les derniers rechargent + vite · snowball · off). 1 charge = 1 pouvoir. **Cap 3** (2026-07-10 :
  au-delà la jauge reste à 100 % sans créer de charge → force à jouer ses pouvoirs plutôt que thésauriser).
  - **Griser** (2026-07-09) : un pouvoir sans cible (vol sans meneur, sabotage sans cible, comeback si pas à la
    traîne…) est **grisé** côté joueur. Serveur `canPowerAct(room,p,pw)` → event `power:eligible` par socket au `prep`.
  - **Anim vol/dîme** : la VICTIME reçoit `power:hit` (temps réel « −X volés par Y ») + `room.powerHits` → badge
    rejoué au reveal (champ `hitBy` du résultat).

## ⚓ Le POOL = LA BASE MUSICALE CURÉE + SPOTIFY D'ABORD (2026-07-25) — `applyCuration()` / `livePool(sp)`
- **SPOTIFY EST LA SOURCE PAR DÉFAUT.** Un morceau se joue sur Spotify avec **titre + artiste** : ne pas avoir
  d'extrait Deezer résolu ne le rend PAS injouable, ça le rend `spOnly`. `livePool(sp)` :
  **Spotify prêt → tout le catalogue curé (2557 · 352 artistes)** · **repli Deezer → 2176 · 313** (on ne
  restreint QUE là). L'écran hôte **déclare sa source** (`host:source` + `spotify` dans `host:start`).
  ⚠️ Ne JAMAIS refiltrer le pool sur l'audio Deezer « pour être sûr » : c'est l'inverse de la priorité voulue.
- Filet anti-manche-muette : au préchargement, la TV vérifie sur Spotify (`spotifyResolves`) les titres sans
  repli Deezer et renvoie les introuvables (`host:preloaded {missing}`) → le serveur les **remplace** avant le départ.
- ⚠️ **La curation est le domaine d'Alexandre.** Ce qui doit sortir du jeu se marque **« hors pool » (✕) dans la
  base musicale** → `difficulty-exclude.json`. **Ne pas ajouter d'artiste en dur dans `EXCLUDE_ARTISTS`.**
  Un titre non étiqueté n'est PAS basculé en Puriste : il n'entre pas dans le jeu, point.

- **Avant**, le pool venait UNIQUEMENT des catalogues Deezer (`SEED_ARTISTS`) et la curation ne servait qu'à
  **étiqueter** ce qu'elle croisait. Mesuré : 1615 morceaux en jeu dont **1004 non curés** (donc `mid`/Puriste par
  défaut) et **350 seulement des 3306 entrées** de `canon-active.json` jouables → le tri fait dans la base
  musicale ne pilotait presque rien.
- **Maintenant** : `POOL = (canon-active.json ∩ audio Deezer résolu `dz`) ∪ (pool Deezer DÉJÀ étiqueté)`, moins
  `difficulty-exclude.json`. Rejoué **à chaque boot** (`applyCuration()` dans `loadPool`, les 2 branches) → le
  `.pool-cache.json` reste **brut** et un rebuild ne peut plus effacer le canon. `trackBand` prend la bande de
  `difficulty-labels.json`, sinon celle portée par `canon-active.json`, sinon `mid`.
  → mesuré au boot : **2177 morceaux · 314 artistes · top 605 / high 1009 / mid 563**. Interrupteur `CURATED_ONLY`.
- **Fraîcheur du cache pool : 30 jours** (était 3 j — un cache périmé relançait une reconstruction Deezer de ~5 min
  pile au moment de lancer une soirée).
- ⚠️ **Un artiste = UNE SEULE manche par partie** (`artistKey()` = artiste principal, avant `feat./&/x/,`).
  Appliqué à `sampleBalancedByEra`, au chemin mono-décennie, au **son du clash** et à **Survivor**. `fillUp()`
  relâche la règle uniquement si le pool manque (jamais atteint : ≥230 artistes distincts par bande).

## Difficulté du POOL = liste CURÉE (2026-07-09, remplace le rank/recoScore)
- **Le rank Deezer était faux** pour « grand public » (deep cuts d'artistes connus classés faciles, vieux rap sous-coté).
  Remplacé par des **bandes pré-calculées à la main** : `server/difficulty-labels.json` = `{ "artiste|titre" normalisé →
  'top'|'high'|'mid'|'deep' }` (facile/normal/difficile/puriste). `server/difficulty-exclude.json` = titres **NON-RAP** (variété/
  pop/EDM : Stromae, Amel Bent, Magic System, Wallen, DJ Snake, Vianney…) écartés du jeu.
- **Serveur** (`index.js`) : `dnorm()` (normalise la clé), `trackBand(t)` (bande depuis le fichier, défaut 'mid'),
  `isOffTopic(t)` (exclus → `livePool` les filtre), `computeBands()` (memoïsé : bande + éraNorm pour l'ordre). `tierSlice`
  filtre par bande + dédup des ré-éditions + backfill adjacent. **Survivor** (`rushRankedPool`) suit AUSSI ces bandes
  (grand public d'abord) + rampe douce (`RUSH_RAMP_SCALE 58`, `EXP 1.9`). `recoScore`/`artistPeaks` gardés (legacy).
- **Construction des labels** = flottes d'agents (jugement humain sur les VRAIS titres, PAS le streaming) + vérif, puis
  scripts offline (scratchpad `expand-pool*.mjs`) qui résolvent un **canon** de tubes sur Deezer et l'ajoutent au pool.
  `server/canon-grandpublic.json` (≈370 tubes grand public) · `server/canon-difficile-puriste.json` (digger/puriste curés
  à la main par Alexandre : 1 titre EMBLÉMATIQUE par artiste de niche — pas de deep cut d'artiste connu). Le pool élargi
  vit dans `.pool-cache.json` (**gitignored, local**) ; `seedHash` inchangé → le serveur charge le cache élargi.
- **Facile plafonne à ~262** (canon résolu ; ~107 titres introuvables sur Deezer). Pour + de volume PROPRE : replier les
  canons dans `SEED_TRACKS` + vrai rebuild. **Outil de curation** (artifact, `scratchpad/build-diff-tool.mjs`) : listes
  complètes recolorables (vert=GP/bleu=Connaisseur/orange=Digger/rose=Puriste/✕=Retirer) → export JSON à réappliquer.
- ⚠️ **Après tout changement de labels/exclude/pool : REDÉMARRER le serveur** (il garde le pool + le classement en mémoire).

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
  réponse → exploit). Bouton **Passer** ; la fenêtre se ferme **dès que tout le monde a tranché** (max 10 s) —
  `checkPrepDone` (était un no-op) + event `prep:done` qui raccourcit le compteur TV **et** téléphone. Grâce de
  900 ms, puis le décompte de 3 s existant laisse le temps de lire qui a lancé quoi.
- ⚠️ **La latence audio mangeait les pouvoirs à fenêtre** (Vald/NQNT : 4,5 s comptées depuis le début de manche
  SERVEUR → un son en retard de 2 s ne valait plus que 2,5 s). D'où le **préchargement blob** de toute la
  playlist avant la manche 1 (voir la boucle de jeu). Le son du **clash** est choisi dès l'intro (14,5 s d'avance).
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
- **5 DÉBLOCABLES** (`locked: true` : Freeze Corleone, Lino, Diam's, Disiz, Caballero & JeanJass) — cachés du
  character-select, « ??? » dans le roster, une condition chacun (`UNLOCKS`, une par CONFIG : Blind Test / Quiz /
  Buzzer / Puriste / Mainstream) testée en fin de partie côté TV **et** côté téléphone → arrivée épique
  (`ChallengerReveal`) puis jouables. Persistés **par appareil** dans **`UNLOCK_KEY`** (`data.ts`).
  ⚠️ La clé est **versionnée** (`pl_unlocked_v2` depuis le 2026-07-25) : **la bumper remet tout le monde à zéro**
  (les 5 redeviennent verrouillés et se regagnent). C'est le seul « reset de saison » disponible.

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
- **Avatars ronds** : `.med` (Host `Med` / Player `RMed`) + `.pp-av` (popover salon) affichent la PHOTO
  du rappeur (rond), initiales en repli. Blazes longs → le popster « dans le salon » wrap sur 2 lignes.
- **HubBrowse.tsx** — vue de consultation **sur la TV** (Host lobby → « Le roster » / « Le palmarès ») :
  roster façon jeu de combat + galerie des trophées. (Le téléphone garde ses propres accès sur l'accueil.)
- **Changer de rappeur** : `player:changeChar` (serveur, lobby only) ; bouton « Changer de rappeur » sur le
  lobby joueur → rouvre le character-select en mode `changing`. Entre deux parties, pas en pleine partie.
- **Trophées — visuels** : `TROPHIES_PROMPTS.md` (prompts pixel art 16-bit, refs rap) → futurs
  `client/public/trophies/<id>.png` (LFS), à basculer icône→image avec repli.
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
- `server/tracks.js` — `SEED_TRACKS` / `SEED_ARTISTS` / `ARTIST_TAGS` (résolus via Deezer → POOL).
- `server/difficulty-labels.json` — bandes de difficulté curées `{ clé → top/high/mid/deep }` (source de vérité, PAS le rank).
- `server/difficulty-exclude.json` — titres NON-RAP écartés du jeu. `server/canon-grandpublic.json` / `canon-difficile-puriste.json` — canons curés.
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
