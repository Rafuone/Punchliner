# CORRECTIFS — backlog de soirée

> Source de vérité des retours de playtest. La **boîte de retours du showroom** (à construire, voir §META)
> vient ajouter des lignes ici, rangées par page. Pour appliquer : « corrige les correctifs depuis
> CORRECTIFS.md ». On coche `[x]` quand c'est fait + on note le commit/fichier.
>
> Format d'une entrée : `- [ ] (TAG) description — piste technique / fichier`.

---

## Retours SHOWROOM 2e lot (2026-07-26 15:42-15:54) + audits

> Ce 2e lot de 20 retours m'avait ECHAPPE : je n'avais lu que le lot de 13:40-14:02. C'est ce qui explique
> le « t'as pas tout traite ». Deux audits independants lances ensuite (conformite + oeil design TV).

### Regressions que J'AVAIS introduites (les pires)
- [x] (REG-HEADER) OK **« T'as pete le header sur tous les ecrans de jeu ».** Cause : mon `overflow: hidden`
      pose sur `.wrap` pour tenir la regle anti-scroll. Or `.topbar.gamebar` SORT volontairement de `.wrap`
      (marges negatives : pleine largeur + colle au bord haut) -> il etait ROGNE. Le clipping est passe sur
      `.center` seul, et le header recoit `flex: 0 0 auto`. Verifie : header pleine largeur (1597/1596), en
      haut (top=0), sur les 5 ecrans de jeu.
- [x] (REG-CACHE) OK **Mon `overflow: hidden` MASQUAIT du contenu perdu au lieu de le regler.** L'audit design
      l'a mesure : a **5 joueurs**, le 5e etait coupe (89 px) ; en serie a 6+, les rangs 6/7/8 partaient a
      y=1074 et disparaissaient **sans barre ni indice** ; au podium, les cartes de certif etaient avalees ;
      en fin de Survivor, la 5e ligne du recap etait coupee (93 px). Corrige a la SOURCE :
      revelation en 2 colonnes des **5** joueurs (au lieu de 6), classement de serie en 2 colonnes des 6,
      grille de certifs en 2 puis 3 colonnes, paliers du recap Survivor recalibres (`lg` jusqu'a 4 lignes,
      pas 7 : une ligne `lg` fait 123 px). Verifie en clonant les lignes : **8 joueurs, 6 certifs, 10 reponses
      -> 0 element hors ecran, 0 scroll**.
- [x] (REG-FLOATBAR) OK **La barre d'actions flottante (150 px, `position: fixed`) ne reservait aucune place** :
      elle voilait le bas des listes sur revelation, podium et serie. `padding-bottom: 172px` ajoute.
- [x] (REG-VERDICTS) OK **Les tailles BAISSAIENT quand il y avait plus de joueurs** (22/18 px a 6+), soit
      l'inverse du besoin. Remontees a 26/24 px, c'est la hauteur de ligne qui se resserre.

### Demandes faites DEUX fois, enfin appliquees
- [x] (SR2-INTRO-POWERS) OK **3e etape « L'effet s'affiche en grand ici » supprimee** + titre en casse normale
      (« Les pouvoirs »). Le `text-transform: none` du CSS ne servait a rien tant que le texte etait ecrit en
      capitales DANS le JSX : lecon a retenir.
- [x] (SR2-BUZZ) OK **L'egaliseur entre le disque et le texte est retire.** A la place, des anneaux pulsent
      autour du disque BUZZ. ⚠️ Limite honnete : le pouls ne peut pas suivre la musique quand la source est
      **Spotify** (flux DRM, non analysable par la Web Audio API). Il reste rythmique dans ce cas.
- [x] (SR2-WAITING) OK **Salle d'attente : « c'est exactement l'inverse de ce que je t'ai demande ».** Il n'y
      avait QUE le nom du pouvoir. L'EFFET est maintenant la ligne principale, le nom passe en surtitre.
- [x] (SR2-CLASH-OMBRE) OK **Ombre portee du bloc vert retiree** (`.sent-check`), demandee 2 fois.
- [x] (SR2-TROPHEES-TEL) OK **La galerie du telephone revelait TOUT par defaut** (`revealTrophies = true`) :
      l'inverse de « grises jusqu'a ce qu'on les debloque ». Corrige ; « Tout voir » devient un choix explicite.

### Passe typographique TV (mesuree, pas jugee a l'oeil)
- [x] (TV-LOGO) OK **Logo du header** fige a 24 px -> `clamp(24-40px)`, et hauteur de header constante
      (elle sautait de 115 a 92 px selon l'ecran).
- [x] (TV-LETTERSPACING) OK **Interlettrage plafonne a .06em** sur les labels (il montait a .18em, voire .5em :
      a 3 m les mots se desagregent). Corrige au passage « TROPHEE SUIVANT DANS 4 S » qui se lisait « 4 S ».
- [x] (TV-PLANCHER) OK **Plancher de lisibilite** sur les labels les plus petits : `.tro-cd`, `.tro-wlabel`,
      `.v-rap`, `.v-hits`, `aud.` du podium (8,4 px mesures !), 2e/3e places, `≈ aud./manche`.
- [x] (TV-BOUTON) OK **Bouton primaire unifie a 28 px** (il valait 15, 17 ou 23 px selon l'ecran).
- [x] (TV-CADRATINS) OK **5 descriptions de trophees** contenaient encore un tiret cadratin (`server/awards.js`),
      affichees en 28 px sur la TV. Corrigees.

### Reste a faire du 2e lot (non traite a ce stade)
- [ ] (SR2-PODIUM) **« Pas epique, juste un scroll reveal basique. »** Il veut du cinematographique, pas des
      elements qui arrivent l'un apres l'autre. A repenser (son ? camera ? mise en scene du 1er ?).
- [ ] (SR2-RUSHEND) **« Faut la revoir entierement, il n'y a pas grand chose qui va »** : trop large, pas
      coherent avec le reste, illisible. La refonte en 2 ecrans n'a pas suffi.
- [ ] (SR2-CLASH-VS) **Mettre le VS au CENTRE** sur clash-intro, clash-reveal, clash-draw et ph-clash-intro
      (« Clash duel au sommet » reste en haut). + animation qui barre le perdant, couronne qui arrive sur le
      gagnant. + le jaune du nul doit passer en gris.
- [ ] (SR2-CLASH-PLAY) **Les deux decomptes ne s'enchainent pas clairement** : « il y a un decompte qui demande
      titre et artiste, puis un deuxieme ou il faut titre ou artiste. Comment ca s'enchaine, j'arrive pas a
      comprendre ? » -> il faut UN seul chrono qui montre visuellement le palier.
- [ ] (SR2-SUSPENSE) **L'ecran de suspense sert-il a quelque chose ?** Sa conclusion : il suffit de ne pas
      afficher les scores de la derniere manche avant le podium. Donc supprimer l'ecran.
- [ ] (SR2-SERIE) **Mettre le disque de certif AUTOUR de l'avatar** (procede deja utilise au classement final)
      au lieu d'une colonne de plus a droite.
- [ ] (SR2-CHALLENGER) **Taille du pouvoir trop grande** (risque de deborder sur le CTA) + **retirer le divider**
      entre le texte et les blocs de stats.
- [ ] (SR2-HUB-TROPHEES) **La condition de deblocage doit etre ECRITE**, pas au survol. Et remplacer le cadenas
      par l'image du trophee **tres pixelisee** (gros pixels noir et blanc).
- [ ] (SR2-TROPHEES-ALIGN) **Les galeries TV et telephone sont deux pages differentes** : les aligner.
- [ ] (SR2-PREP) **Trop bavard** : 3 lignes, c'est trop ; mais 3-4 mots par ligne, c'est trop peu. A resserrer.
- [ ] (SR2-CLASH-DUEL-TEL) **« T'as rien corrige, elle est catastrophique »** : bandeau rouge, bloc +12 000,
      hauteur. Les retours du 1er lot tiennent toujours.
- [ ] (SR2-ECHELLE) **Echelle typographique globale** proposee par l'audit (5 niveaux : 112 / 56 / 34 / 26 /
      22 px, rien sous 22 px sur `/host`, Clash Display reserve aux 2 niveaux du haut). Aujourd'hui : **42
      tailles distinctes**, **407 declarations `font-size`**, **158 usages de la police d'affichage contre 46**
      de la police de texte, **130 `text-transform: uppercase`**. C'est LA cause du « manque de coherence ».
- [ ] (SR2-LARGEUR) **Le conteneur est un conteneur desktop** : `.wrap { max-width: 1040px }` -> le contenu
      occupe **60 % d'un ecran 1600**. C'est la cause racine du « tout est trop petit ». Passer a ~1440 px sur
      `/host`, mais APRES les corrections de debordement (sinon on transforme 3 troncatures en dix).
- [ ] (SR2-REGISTRE) **Tutoiement et vouvoiement coexistent** (« Scanne le QR » vs « Misez sur le vainqueur »).

---

## Retours SHOWROOM du 2026-07-26 (31 pages relues) - reste a faire

> Le detail de chaque retour est dans `RETOURS-SHOWROOM.md`. Ici, ce qui n'est PAS encore fait.

### Transverse
- [x] (DA-CADRATIN) OK **Tirets cadratins supprimes de tous les textes affiches** (118 lignes -> « · »).
      Regle posee : « j'en veux pas, jamais nulle part dans toute l'app ».
- [x] (SFX-HORN) OK **Son « sirene » supprime** (`sfx('horn')` sur l'anim de rang) + retire du catalogue.
- [ ] (DA-MAJUSCULES) **Majuscules et letter-spacing : passe globale a faire.** Retire des bannieres de
      pouvoir et du prechargement, mais il en reste beaucoup (clash, quiz, eyebrows). Une phrase entiere en
      capitales se lit mal, surtout de loin.
- [ ] (DA-POLICE) **La police d'affichage (a empattements) est mise PARTOUT** - « c'est trop ». A doser :
      la garder pour les titres forts (CLASH, VS, noms de rappeurs), pas pour le reste.
- [ ] (DA-COHERENCE) **Manque de coherence globale** : « il y a des moments ou tu ecris d'une maniere,
      d'autres fois d'une autre ». Definir 3-4 styles de texte et s'y tenir.

### TV
- [x] (SR-POWERS) OK **Affichage des pouvoirs refait** : l'EFFET devient la ligne principale, le nom du
      pouvoir passe en surtitre, et la banniere a une **largeur fixe** (avant elle suivait le contenu, d'ou
      « certains prennent toute la largeur et d'autres non »).
- [x] (SR-RUSHEND) OK **Fin de run Survivor scindee en 2 ecrans** (le run, puis le classement mondial),
      aucun des deux ne scrolle ; la liste du run s'adapte (taille + 2 colonnes au-dela de 7 morceaux).
- [x] (SR-TROPHEES-SCROLL) OK **La remise des trophees ne scrolle plus** + hierarchie titre/description
      (la description etait aussi blanche et aussi grasse que le titre).
- [x] (SR-FOND) OK **Prechargement et intro pouvoirs : fond opaque** (on voyait le lobby au travers).
- [x] (SR-SUSPENSE) OK **Le suspense ne revele plus titre/artiste** : sinon on reconstitue les scores.
- [x] (SR-TROPHEES-GRISES) OK **Trophees grises tant que non debloques**, condition au survol seulement.
- [x] (SR-REVEAL8) OK **Plus aucun scroll a la revelation.** J'ai ecarte le defilement automatique demande :
      il oblige a ATTENDRE pour lire les derniers, et pendant ce temps la manche suivante arrive. A la place,
      la liste passe en **2 colonnes des 6 joueurs** (lignes resserrees) : tout le monde est visible d'un
      coup, sans rien bouger. Si le defilement te manque, c'est 3 lignes a rajouter.
- [x] (SR-PODIUM-ANIM) OK **Podium mis en scene.** Les marches montent DANS L'ORDRE (3e a 0,15 s, 2e a
      0,95 s, vainqueur a 1,75 s en plus lent et plus haut), la marche du 1er **pulse** une fois, puis le
      classement se remplit ligne par ligne. Respecte `prefers-reduced-motion`.
- [ ] (SR-BUZZ-SON) **Le bloc « son en cours » du buzzer n'est pas beau.** Reprendre l'effet de la selection
      des modes : bordure qui oscille avec la musique.
- [x] (SR-TAILLES) OK **Passe de tailles TV.** Noms au lobby 14 -> **26 px** (cartes elargies) · consigne de
      la fenetre pouvoirs sortie de `.muted` -> **22-32 px** en texte plein · propositions du quiz 17 px en
      MAJUSCULES/serif -> **24-34 px en casse normale, police d'interface**, avec de la place pour les
      reponses longues. Replis compacts sous 900 px pour ne rien casser sur telephone.
- [x] (SR-PLAYING-FONT) OK **Punchline sous le vinyle** passee en Satoshi (police d'interface), **22-34 px**,
      casse normale, contraste remonte (`--muted2` -> `--txt`). Les 15 formules tournaient deja au hasard a
      chaque manche. **Reste** : l'equilibre des hauteurs dans le header.
- [ ] (SR-SURVIVOR-TV) **Survivor pas oriente solo** : ne pas afficher les autres joueurs, montrer le score
      du joueur en GRAND et ce qu'il a repondu.
- [x] (SR-CLASH-TYPO) OK **Consigne du clash refaite.** Elle etait collee au mot CLASH, en capitales, avec un
      `letter-spacing: .32em` qui separait toutes les lettres. C'est maintenant une vraie phrase, en casse
      normale, dans un cadre a elle, detachee du gros mot : « Il faut le **titre** ET l'**artiste** » ->
      « Plus que l'**artiste** suffit ! » au palier.
- [x] (SR-CLASH-REVEAL) OK **Resultat en 3 temps** (le morceau, puis les deux camps, puis les parieurs un a
      un) au lieu d'un affichage brutal. Et la liste des parieurs passe en **2 colonnes des 4 personnes** :
      avant, elle s'allongeait vers le bas et cassait l'alignement des deux camps.
- [x] (SR-CLASH-INTRO) OK **Equilibre typographique revu.** La police d'affichage etait mise partout ; elle
      est desormais reservee a CLASH / VS / au nom du rappeur. Le pseudo du joueur, l'accroche et la pastille
      de bonus passent en police d'interface, en casse normale.
- [x] (SR-WIZARD) OK **Deux reglages ajoutes.** « **Sans pouvoirs** » (jauge de pouvoir) : blind test pur,
      aucune fenetre d'activation, la jauge ne se remplit jamais. « **Au hasard** » (difficulte) : le serveur
      tire une des trois difficultes **au lancement**, une fois pour la partie (pas manche par manche, sinon
      le bareme et la fenetre de reponse bougeraient en cours de route). Verifie en jouant :
      0 fenetre pouvoirs en « sans pouvoirs » (14 en temoin), et 3 difficultes distinctes sur 6 parties,
      chacune stable du debut a la fin (`scratchpad/verify-newmodes.mjs`).
- [ ] (SR-INTRO-POWERS) **La page d'intro pouvoirs ne convainc pas** (« je ne vois pas l'interet »,
      « l'effet s'affiche en grand ici : on s'en fout »). A repenser ou supprimer.
- [x] (SR-RADIO-ETOILE) OK **Etoile retiree** du bouton « Mes playlists ».

- [x] (SR-NOSCROLL-TV) OK **Regle « jamais de scroll » tenue sur les 12 ecrans TV pleine page** (revelation,
      suspense, podium, serie, trophees, fin de Survivor, challenger, manche, quiz, lobby, prep).
      ⚠️ Piege trouve en mesurant : `.wrap` est en `flex: 1` dans `.app`, donc `flex-basis: 0%` -> lui poser
      une `height` n'a **aucun effet**. Il faut borner `.app` ET donner `min-height: 0` aux enfants flex,
      sinon ils refusent de retrecir sous leur contenu. Verifie ecran par ecran : 0 scroll, 0 bouton coupe,
      0 element tronque.

### Telephone
- [x] (SR-SPEC-REACT) OK **Les spectateurs du Survivor peuvent reagir** (roue de reactions) au lieu de
      rester totalement passifs.
- [x] (SR-PH-PREP) OK **Fenetre pouvoirs revue.** Hierarchie inversee : l'**effet** passe a 20 px en texte
      plein, le **nom** du pouvoir devient un surtitre de 14 px. Le bouton perd son ombre portee de 10 px
      (« bouton de jouet », hors DA) au profit d'angles nets + halo discret, comme le reste de l'app.
      Contenu remonte en haut d'ecran au lieu d'etre centre.
- [x] (SR-PH-FINAL) OK **Fin de partie remontee** (plus de centrage vertical qui gaspillait l'ecran sur un
      petit telephone) ; les actions restent en bas, a portee de pouce.
- [ ] (SR-PH-LOBBY) **Salon : majuscules incoherentes**, description du pouvoir peu lisible, tout trop centre.
- [x] (SR-PH-TROPHEES) OK **Bandes jaunes supprimees.** C'etait la bordure haute de 2 px en fluo sur CHAQUE
      carte : en grille, ca faisait un mur de traits jaunes. Remplacee par un lisere fin, teinte a 35 %.
- [x] (SR-PH-CLASH) OK **Intro du clash refaite sur telephone** : on reprend le carton VS de la TV en format
      mobile (gros mot CLASH, portraits 96 px qui arrivent de chaque cote, VS au centre), plus d'emoji.
      **Pseudos longs** : teste avec « Jean-Baptiste de la Montagne » sur 375 px -> **0 debordement** sur les
      4 ecrans de clash + fin de partie + fenetre pouvoirs (avant : scroll horizontal). Cause trouvee :
      `flex: 1` sans `min-width: 0` sur les boutons de pari, et un `19vw` qui faisait deborder le mot CLASH.
- [ ] (SR-TROPHEES-OBSOLETES) **A trancher** : « A l'ancienne » et « La Releve » existent TOUJOURS et sont
      toujours decernes (27 trophees des deux cotes, aucun ecart). Les retirer pour de bon ?

---

## Soirée du 2026-07-26 — retours de playtest (lot complet)

> Tout est consigné ici tel que remonté. `[x]` = corrigé ET vérifié · `[ ]` = à faire.

### 🔊 Audio (le plus grave)
- [x] (AUDIO-LATENCE) ✅ **« Parfois la musique mettait 12 secondes à charger »** — alors que le préchargement
      était censé régler ça. Il le réglait… **pour Deezer seulement**. Le préchargement met les extraits Deezer
      en blob, mais côté **Spotify** chaque manche refaisait une **recherche** (`/v1/search`) avant de pouvoir
      jouer : la latence revenait manche après manche, préchargement ou pas. Corrigé sur deux plans :
      (1) `findUri` est désormais **mémoïsé** (`uriCache` dans `spotify.ts`) ;
      (2) le serveur envoie **TOUTE la playlist** à résoudre au préchargement (`preloadPayload`, champ `sp`),
      plus seulement les titres sans repli Deezer → au coup d'envoi, jouer = **un seul PUT**, zéro recherche.
- [x] (AUDIO-DOUBLE) ✅ **Deux musiques simultanées en Buzzer.** Cause : les reprises de son (après un buzz raté,
      et à la révélation) utilisaient `spotifyTogglePlay()` — une **bascule**, qui DEVINE l'état ; quand l'état
      réel diffère elle fait l'inverse, et on se retrouve avec Deezer + Spotify en même temps. Remplacé par une
      reprise **explicite** (`spotifyResume`), les 3 appels supprimés. + **garde-fou « une seule source à la
      fois »** (1 s) : si les deux lecteurs tournent, le non-propriétaire est coupé.
- [ ] (AUDIO-MENU) **La musique du menu (choix des modes) se met en pause ou se coupe toute seule.** Pas
      reproduit. Piste : `fadeTo` / `stopAllMusicExcept('menu')` + le `kick` de 1500 ms qui ne surveille que
      l'extrait de manche, pas `menuAudioRef`.

### 🎵 Répétition des morceaux
- [x] (REPEAT-MODES) ✅ **« Si on l'a eu en Blind Test elle peut pas revenir en Buzzer ou en Survivor. »**
      Diagnostic initial FAUX de ma part : j'avais mesuré 6 parties de Blind Test enchaînées (96 manches,
      **0 répétition**) et conclu à un salon recréé. Alexandre a maintenu → **il avait raison** :
      **Survivor ne participait pas du tout à la mémoire du salon**. `rushPickTrack` ne LISAIT pas
      `playedTracks` et n'y ÉCRIVAIT rien (il n'avait que `rushUsed`, remis à zéro à chaque run). Donc Survivor
      rejouait des sons déjà entendus ailleurs, **et** les siens revenaient ensuite en Blind Test / Buzzer.
      La mémoire est maintenant **commune à tous les modes**, avec cascade de replis pour ne jamais bloquer un
      run long. Vérifié : blindtest → buzzer → survivor → blindtest → survivor → buzzer dans le même salon,
      **54 sons, 54 distincts, 0 répétition** (`scratchpad/verify-crossmode.mjs`).
- [x] (RESTART-REDIRECT) ✅ **« Retour au salon » renvoyait avant la sélection des modes.** `relance(true)`
      basculait sur l'assistant dans l'**ack** du serveur, en course avec l'event `lobby` qui arrive juste
      après → on retombait au salon. La bascule se fait maintenant **avant** l'émission.
      (Lien avec le point précédent : recréer un salon efface la mémoire des morceaux.)

### 🎮 Manches & règles
- [x] (CLASH-PALIER) ✅ **Palier de fin de clash.** Exiger titre + artiste tout du long rendait les fins
      stériles. Les **8 dernières secondes** (sur 22), l'**ARTISTE SEUL** suffit à emporter le duel. La bascule
      est **annoncée** — TV : « Titre ET artiste » → « Plus que l'ARTISTE ! » (event `battle:ease`, animation) ;
      téléphone : le bandeau de récompense change de consigne. Le départage de fin pondère en conséquence
      (artiste = 2 points, titre = 1). Vérifié : `scratchpad/verify-clash-ease.mjs` — artiste seul **refusé**
      avant le palier, **gagnant** après, bascule bien reçue par les joueurs.
- [x] (CLASH-REGLE) ✅ **Décision déléguée → titre + artiste, avec départage.** Le premier qui a **les deux**
      gagne (même exigence que le Buzzer) ; les volets partiels sont mémorisés et, au temps écoulé, **celui qui
      en a le plus l'emporte** (nul si égalité) — sans ce départage, exiger les deux transformerait la plupart
      des clashs en match nul. La consigne est **annoncée** sur la TV (« Titre ET artiste ») et sur le téléphone
      (« au 1ᵉʳ qui a titre + artiste ») ; quand un joueur ne trouve qu'un volet, le tél lui dit **ce qui manque**
      au lieu de « pas ça ». Vérifié : `scratchpad/verify-clash-rule.mjs` (double-hit gagne · titre seul des deux
      côtés = nul).
- [x] (SURVIVOR-REPONSES) ✅ **Réponses visibles + récap de fin de run.** Le serveur tient un **journal de run**
      (`room.rushLog`) : chaque morceau, ce que le joueur a tapé (y compris les tentatives ratées) et le verdict
      (`hit`/`partial`/`pass`/`timeout`). (1) À chaque enchaînement, le téléphone annonce **« C'était … »** —
      avant, on passait au suivant sans jamais donner la réponse. (2) `rush:end` porte le journal → la TV déroule
      **tout le run** en fin de partie, morceau par morceau, avec la saisie du joueur et les points.
      Vérifié : `scratchpad/verify-survivor-recap.mjs` (8 annonces, récap de 9 morceaux, verdicts cohérents).

### ✅ Acceptation des réponses (confusion en jeu)
- [x] (MATCH-FEAT-2) ✅ **Les feats sont surtout dans le TITRE — confirmé par la mesure.** 145 titres du pool en
      portent un, contre **0** dans le champ artiste côté Deezer (côté canon : 74 titres / 510 artistes). Le
      mécanisme les lisait déjà (extraction sur titre + artiste), mais il ratait les marqueurs **anglais et
      alternatifs** (« with », « w/ », « invité », « duo avec ») → l'artiste invité n'existait alors nulle part
      pour le matching. Ajoutés. Balayages re-passés : **934 feats testés, 1 raté** (un nom en japonais), et
      **0 faux positif** sur 3963 réponses hors sujet.
- [x] (MATCH-FEAT) ✅ **Le feat trouvé n'était pas compté.** Trouvé en balayant le VRAI pool, pas en lisant le
      code : les featurings marqués « feat./ft./avec » passaient déjà à **99,9 %** (929 testés, 1 raté — un nom
      en japonais). Le trou était ailleurs : les artistes **co-crédités sans « feat. »**, séparés par une
      virgule, « & », « x », « vs » (« Bigflo & Oli », « SCH, Jul, Naps ») → **30,6 % n'étaient pas acceptés**
      (183 testés, 56 ratés). Nouvelle fonction `artistForms()` dans `match.js` : artiste principal + feats +
      **co-crédités séparés** + alias de sigle. Après correctif : **0 %** de ratés sur les deux balayages.
      Contrôle anti-laxisme : 3977 réponses hors sujet testées → **1 acceptée à tort** (0,03 %, « GLK » vs
      « PLK », dû à la tolérance de faute pré-existante, pas au changement). `scratchpad/verify-feats*.mjs`.
- [x] (MATCH-OPAQUE) ✅ **D'où viennent les points.** Le serveur trace maintenant chaque source hors-réponse
      dans un champ `why` (plancher garanti, gratte du vétéran, revenu régulier, copié sur le meilleur, quitte ou
      double raté, muselé par un sabotage, faute pardonnée) et la révélation l'affiche sous le joueur, montant par
      montant. Avant, un joueur marquait sans avoir trouvé et le jeu paraissait cassé.

### 🧠 Quiz
- [ ] (QUIZ-MAINSTREAM) **Questions Mainstream globalement mauvaises.**
- [ ] (QUIZ-PURISTE) **Questions Puriste : « mouais, pas vraiment ».**
- [x] (QUIZ-PUNCHLINE) ✅ **Quota de punchlines.** La catégorie existait bien (37 questions) mais n'était tirée
      qu'au hasard : **16 punchlines sur 241 questions** en Mainstream → ~0,5 attendue sur 8 manches, donc une
      partie entière pouvait n'en voir **aucune** (mesuré : 144 parties sur 200 sans la moindre punchline).
      `pickQuiz` en garantit désormais **~1 sur 4 manches**, avec recyclage propre à la catégorie (la banque est
      mince). Mesuré après correctif : **0 partie sans punchline · 2,00 par partie de 8**, y compris sur
      40 quiz d'affilée dans le même salon, sans doublon interne.
- [ ] (QUIZ-BANQUE-PL) **Étoffer la banque de punchlines** : 37 seulement (16 facile · 15 normal · 6 difficile).
      Le quota les fait tourner vite — au-delà de ~8 quiz dans un salon, elles se répètent.

### 🎬 Showroom (banc d'essai)
- [x] (SHOWROOM-COMPLET) ✅ **Tous les écrans sont parcourables** — 21 scènes → **50** (28 TV · 22 téléphone).
      Manquaient notamment : assistant de configuration, page d'intro pouvoirs, préchargement, suspense,
      les 3 phases de clash absentes (paris / duel / palier), remise des trophées, classement de série,
      arrivée d'un challenger, fin de run Survivor + récap, les 3 pages du hub TV (roster / palmarès / radio),
      MJ côté TV ; et côté téléphone : character select, salon, changement de rappeur, roster, palmarès,
      Survivor (joueur + spectateur + fin), les 4 écrans de clash, pupitre MJ, révélation masquée.
      **Pourquoi ils manquaient** : ces écrans ne dépendent pas du serveur mais d'un **état LOCAL** (assistant,
      hub, étape de fin, character select). Ajout d'un **pont showroom** — des champs `__*` que le serveur
      n'envoie **jamais** (`__configuring`, `__hubView`, `__finalStep`, `__troIdx`, `__unlock`, `__preloading`,
      `__step`, `__joined`, `__changing`) : en partie réelle le bloc est inerte.
      Deux bugs du banc d'essai corrigés au passage : (1) l'étape de fin demandée était **écrasée** par l'effet
      qui remet le podium quand les trophées arrivent ; (2) le mock répondait toujours `playerId: 'me'`, donc
      « je suis duelliste », « j'avais parié » et le pupitre MJ rendaient **toujours la vue spectateur**.
      Vérifié en chargeant les **50 scènes** une par une : 50/50 rendent, 0 erreur console.

### 📺 Lisibilité TV (rappel : /host = une TÉLÉ, vue de loin)
- [x] (TV-POUVOIRS) ✅ **Le nom du pouvoir en grand ne sert à rien — ce qui compte c'est ce qu'il FAIT.**
      L'**effet** passe en gros (22 px) et devient la ligne principale ; le nom du pouvoir + le joueur passent
      en sous-titre. Idem sur les pastilles compactes de la manche.
- [x] (TV-TROPHEES) ✅ **Trophées agrandis.** Séquence de remise : illustration `clamp(190→290px)` → **`260→420px`**,
      description 16-24 px → **22-34 px** et passée en couleur pleine. Récap du podium : icône 44 → **96 px**,
      titre 19 → **30 px**, description 13,5 → **19 px**, cartes élargies (300-420 px).
- [x] (TV-ANSWERED) ✅ **Noms des répondants : 12 px → 26 px** (+ pastilles élargies). Repli à 15 px sous 900 px
      de large pour ne pas casser l'affichage téléphone.
- [x] (TV-SERIE) ✅ **Récap de toute la soirée trop petit.** Le classement général de la série passe en échelle
      TV (classe `.board.big`) : avatars 26 → **56 px**, noms → **34 px**, totaux → **38 px**, certifs → 20 px,
      lignes plus hautes et tableau élargi à 1000 px. Repli compact sous 900 px (téléphone) pour ne rien casser.
- [ ] (TV-TAILLES) **Problèmes de taille d'interface un peu partout** — passe globale d'échelle TV à faire.
      (Faits à ce jour : trophées, noms des répondants, pouvoirs, récap de série.)

### 📱 Téléphone
- [x] (SPOIL-TEL) ✅ **Les trophées et l'arrivée du challenger s'affichaient AUSSI sur les téléphones** → tout
      le monde lisait le résultat sur son écran avant que la TV ne le révèle, la séquence tombait à plat.
      Retirés du téléphone ; ils restent **enregistrés** (`pl_trophies` / `UNLOCK_KEY`) pour la galerie et pour
      débloquer le rappeur. C'est la TV qui décerne.
- [x] (UX-SCROLL) ✅ **Affordance de défilement ajoutée** : barre de scroll VISIBLE au repos (fluo à 45 % au lieu
      d'un gris à 15 % invisible sur l'anthracite) + **dégradé de bord droit** qui dit « ça continue ». L'amorce
      de 4e vignette existait déjà et ne suffisait manifestement pas.
- [x] (UX-REACTIONS) ✅ **Refonte en ROUE radiale, modèle « quick chat » des jeux console en ligne.** L'ancien
      tiroir demandait 3 appuis précis sur de petites cibles → personne ne réagissait. Désormais : **un seul
      geste continu** — on appuie sur le bouton, on glisse vers un quartier (les 4 catégories : Hype / Chambre /
      Rage / Respect), le quartier s'ouvre en **sous-actions** sur la même couronne, on glisse dessus, on
      relâche : envoyé. Les cibles sont visées à l'**angle**, pas au pixel, donc on peut viser vite et mal.
      Le pilotage en 2 appuis reste possible (tap le bouton, tap le quartier, tap l'action) et le centre annule
      / remonte d'un cran. Vérifié dans le navigateur, en vraie partie : appui → 4 quartiers, glissé → 6
      sous-actions, surlignage suivant le doigt, relâché → toast « Chaud envoyé » **et bulle reçue sur la TV**.

### 🔓 Déblocables
- [x] (UNLOCK-MUSIQUE) ✅ **Diam's arrivait sur « Confession nocturne » au lieu de « La Boulette ».** Le titre
      était pourtant correct dans le code : c'est `/api/unlock-preview` qui ne validait **que l'artiste** —
      le repli `artist:"X" titre` de `resolveTrack` accepte n'importe quel morceau de X. On exige désormais que
      le **titre** corresponde. Vérifié : les 5 arrivées résolvent le bon morceau.
- [x] (UNLOCK-SILENCE) ✅ **Challengers muets / en retard.** L'extrait était demandé **au moment de l'arrivée**
      (fetch → résolution Deezer → rapatriement à froid = plusieurs secondes, ou rien). `prefetchUnlockSong` le
      rapatrie dès `game:final`, pendant le podium et les trophées → il est prêt quand la séquence démarre.

### ⚖️ Équilibrage
- [x] (POWER-ORTHO) ✅ **Le simulateur mentait — mais l'équilibre, lui, tient.** Le doute d'Alexandre sur le sim
      était fondé : `sim-balance.mjs` faisait `p.full = true` pour `nofault`/`ace`, c'est-à-dire qu'il offrait
      **titre + artiste garantis** (6 000 → 18 000, ×3 inconditionnel). Or tolérer les fautes ne fait pas
      CONNAÎTRE un artiste qu'on ignore : le vrai effet est étroit (tolérance ~20 % → ~40 %, et suppression de la
      décote 0,8), et ne joue que sur les manches réellement mal orthographiées. Modèle refait (`P_TYPO`,
      `P_TYPO_LOST`, constantes explicites et réglables).
      **Résultat : les chiffres bougent peu** — solaar 21,8 → **21,1 %**, alphawann 22,6 → **20,5 %**. Les deux
      restent en plein milieu du pack (cible 18-27 %). Donc **les valeurs de `powers.js` n'étaient pas le
      problème** ; elles étaient juste validées pour une mauvaise raison.
- [x] (POWER-ORTHO-UX) ✅ **Le vrai défaut est ailleurs : ces pouvoirs sont INVISIBLES.** On les active et rien
      ne se voit — ils ne paient que si l'on écrit mal, ce que le joueur ne sait jamais. Le serveur mesure
      désormais ce que la tolérance a **réellement rattrapé** (écart avec la notation stricte) et l'affiche à la
      révélation : « faute pardonnée · +X auditeurs ». Aucun changement de valeur.

---

## Passe du 2026-07-25 — avant soirée (tout vérifié en jouant, headless + navigateur)

- [x] (POOL-CURATION) ✅ **Le tri de la base musicale ne pilotait presque RIEN.** Mesuré sur le pool réel :
      1615 morceaux en jeu, dont **1004 dans aucune liste curée** (→ bande `mid` = Puriste par défaut), et
      **350 seulement des 3306 entrées de `canon-active.json`** étaient jouables. Le reste du tri (2389 entrées
      avec un audio Deezer résolu) n'entrait jamais dans le jeu : le POOL venait uniquement des catalogues
      Deezer de `SEED_ARTISTS`, la curation ne servait qu'à étiqueter ce qu'elle croisait au passage.
      → **`applyCuration()`** ([index.js](server/index.js)) : `POOL = (canon-active ∩ audio dz) ∪ (pool Deezer
      DÉJÀ étiqueté)`, moins les exclusions. Rejouée à CHAQUE boot (le `.pool-cache.json` reste brut → un
      rebuild ne peut plus effacer le canon, cf. mémoire « pool cache efface l'audio du canon »).
      Résultat mesuré au boot : **2177 morceaux curés · 314 artistes · top 605 / high 1009 / mid 563**.
      `trackBand` accepte désormais la bande portée par `canon-active.json` en repli de `difficulty-labels.json`.
      Fenêtre de fraîcheur du cache pool : **3 j → 30 j** (un cache « périmé » relançait une reconstruction
      Deezer de ~5 min pile au moment de lancer une soirée ; la curation, elle, est relue à chaque boot).
- [x] (UN-ARTISTE-UNE-MANCHE) ✅ **Un artiste ne peut plus tomber deux fois dans la même partie.** La dédup
      existante portait sur artiste+**titre** (ré-éditions) : rien n'empêchait 3 Booba. Nouveau `artistKey()`
      (artiste PRINCIPAL, avant `feat./&/x/,` → « Booba » ≡ « Booba feat. Kaaris »), appliqué dans
      `sampleBalancedByEra` (saut des artistes déjà servis, l'équilibrage d'époques est conservé), dans le
      chemin mono-décennie, dans le **son du clash** et dans le flux **Survivor**. Repli `fillUp()` si le
      pool venait à manquer (jamais atteint : ≥230 artistes distincts par bande).
      Vérifié : 24 manches × facile/normal/puriste + buzzer 16 → **0 doublon d'artiste, 0 doublon de titre**.
- [x] (PRELOAD) ✅ **Toute la playlist est préchargée avant la 1re manche.** Le son démarrait avec une latence
      variable (fetch + décodage au `playing`) — et ce délai **mange les pouvoirs à fenêtre** : le brouillage
      de Vald (NQNT, 4,5 s) est compté depuis le début de manche **serveur**, donc un son en retard de 2 s ne
      valait plus que 2,5 s. Le serveur envoie `game:preload` avec TOUTES les URL, la TV les rapatrie en
      **blob** (4 en parallèle) et n'ouvre la manche 1 qu'à son feu vert (`host:preloaded`, plafond 25 s côté
      serveur / 15 s côté TV). Écran « ON CHARGE LES SONS » + barre de progression (échelle TV).
      Le son du **clash** est en plus choisi dès l'intro (14,5 s d'avance au lieu de 0).
      Vérifié dans le navigateur : l'élément `<audio>` de manche joue bien depuis une URL `blob:`.
- [x] (PREP-STOP) ✅ **La fenêtre pouvoirs s'arrête dès que tout le monde a tranché** (activé OU passé) au lieu
      d'aller au bout de ses 10 s. `checkPrepDone` n'était plus qu'un no-op volontaire → vrai contrôle +
      événement `prep:done` (TV et téléphones raccourcissent leur compteur). Grâce de 900 ms, puis le décompte
      de 3 s existant enchaîne — on a toujours le temps de LIRE qui a lancé quoi. Mesuré : **~108 ms** au lieu
      de la fenêtre complète.
- [x] (BUG-BATTLE-GO) ✅ **`battle:go` arrivait EN DOUBLE sur l'écran hôte** (il est dans la room `code` *et*
      ciblé par `hostId`) : d'abord sa version avec `preview`/`sp`, puis la version publique **sans**. Son
      handler rejouait alors `playRound()` sans piste → **en mode Spotify, ce 2e appel repassait sur la branche
      Deezer et COUPAIT la musique du clash**. Corrigé par `.except(room.hostId)`. Trouvé en jouant, pas en lisant.
- [x] (CLASH-TV) ✅ **Clash re-vérifié de bout en bout**, chemin **forcé** ET chemin **automatique** : `intro →
      bets → tally → go → answer → reveal → host:next`, 8 manches jouées quand même, son du clash ni déjà joué
      ni d'un artiste de la partie. (Pour mémoire : le crash PC de la soirée n'est pas le clash — il survient
      en pleine LECTURE d'extrait, manches 3-4, avant tout clash ; cause système, cf. mémoire.)
- [x] (CLASH-DEV) ✅ **Bouton « + clash test »** ajouté sur l'écran hôte (révélation, dev only, ≥3 joueurs) —
      `host:forceBattle` n'était émis par personne malgré le commentaire du code.
- [x] (SPOTIFY-FIRST) ✅ **Le pool suit la SOURCE, et Spotify est la source par défaut.** Ma 1re version
      construisait le pool sur l'audio **Deezer** résolu (`dz`) — c'était à l'envers : sur Spotify un morceau se
      joue avec **titre + artiste**, ne pas avoir d'extrait Deezer ne le rend pas injouable. Les titres sans `dz`
      sont désormais marqués `spOnly` et `livePool(sp)` décide :
      **Spotify prêt → 2557 titres · 352 artistes** (tout le catalogue curé) · **repli Deezer → 2176 · 313**
      (on ne « crope » que là, sinon la manche serait muette). L'écran hôte **déclare sa source** (`host:source`,
      + `spotify` renvoyé à chaque `host:start`) — le serveur ne peut pas la deviner. Le compteur de morceaux du
      salon suit la source.
      Filet : pendant le préchargement, la TV **vérifie sur Spotify** les titres sans repli Deezer
      (`spotifyResolves`) et renvoie ceux qu'elle ne résout pas → le serveur les **remplace** par de l'audio
      Deezer sûr **avant** le coup d'envoi. Plus une seule manche muette possible. Vérifié en jouant les 3 cas
      (Spotify / Deezer / tous les titres `spOnly` déclarés introuvables) : `scratchpad/verify-spotify.mjs`.
      ⚠️ Le chemin de LECTURE Spotify n'a PAS été touché : `spotify.ts` = **+6 lignes, 0 modification** (une
      nouvelle fonction `spotifyResolves`) ; dans `playRound`, l'appel `spotifyPlay` et le cas « ça marche »
      sont inchangés, seule la branche d'échec **sans** extrait Deezer (cas qui n'existait pas avant) est neuve.
- [x] (SPOTIFY-DROP) ✅ **Spotify perdu EN PLEINE PARTIE** (token expiré / device perdu / bascule manuelle) :
      c'est le seul risque que « Spotify d'abord » ajoutait — ~15 % des titres (381/2557) n'ont pas de repli
      Deezer, donc les manches à venir auraient été muettes (avant, tout avait un repli). `repairPlaylistForDeezer`
      remplace immédiatement les manches **à venir** sans extrait ; ni la manche en cours ni les manches jouées
      ne bougent. Vérifié en coupant Spotify à la manche 3 d'une partie de 24 : **21 manches ensuite, 0 muette**
      (`scratchpad/verify-spdrop.mjs`).
- [x] (CURATION-HORS-POOL) ✅ **« Hors pool » = la seule liste d'exclusion.** Un titre non étiqueté n'est plus
      basculé en Puriste par défaut : il n'entre simplement pas dans le jeu. Et j'avais ajouté 9 artistes en dur
      dans `EXCLUDE_ARTISTS` **de ma propre initiative — retiré**, la curation se fait dans la base musicale
      (✕ → `difficulty-exclude.json`), pas dans le code. Seul ajustement conservé : le ban d'artiste se testait
      sur une clé qui **concatène les feats**, donc un banni repassait dès qu'il avait un invité (« Fatal Bazooka
      feat. Vitaa » tombé en MAINSTREAM) → testé sur l'artiste principal.
- [x] (UNLOCK-REARM) ✅ **Déblocables ré-armés.** Le système était intact (verrou, conditions, révélation
      « nouveau challenger », roster « ??? »), mais pendant la période où le verrou avait été retiré (ticket
      BUG-UNLOCK) les appareils ont accumulé des déblocages fantômes dans `localStorage pl_unlocked` : plus
      rien ne se débloquait puisque tout l'était déjà. Clé **versionnée** `UNLOCK_KEY = 'pl_unlocked_v2'`
      ([data.ts](client/src/data.ts)), partagée par Player/Host/HubBrowse → tout le monde repart verrouillé
      et regagne les 5 en jouant (1 par config : Blind Test / Quiz / Buzzer / Puriste / Mainstream).
      À rebumper si on veut relancer une « saison ».

---

## Audit de bugs 2026-07-15 (26 agents adversariaux) — 15 confirmés / 5 réfutés

- [x] (BUG-RÉESSAI) ✅ **5 régressions du ré-essai anti-T9, corrigées.** Toutes introduites par la feature
      elle-même, toutes sur le **chemin heureux** (T9 massacre → je corrige → je marque) :
      1. **« Réponse envoyée » ET « Pas ça… » affichés ensemble** — le feedback de l'essai raté survivait au
         ré-essai qui marque (aucun `else` ne le nettoyait). Le joueur qui venait de marquer 14 400 lisait
         « Pas ça… » pendant 20 s.
      2. **Joueur MUSELÉ (sabotage) : « Pas ça… » sur une réponse JUSTE** + boucle de ré-essais. Le client
         se fiait à `points`, or un muselé a `points = 0` sur une bonne réponse. → **On se fie désormais à
         `titleHit`/`artistHit`** (que le serveur envoyait déjà) : c'est LA bonne source de vérité.
      3. **Perte du focus clavier à chaque essai raté** : `submitted` servait à la fois de verrou anti
         double-clic ET de bascule d'affichage → le formulaire était démonté/remonté. → **`sending` (verrou
         d'envoi) dissocié de `submitted` (a trouvé)**.
      4. **L'erreur « Trop d'essais » n'était jamais affichée** (le joueur voyait un « Pas ça… » périmé et un
         bouton qui ne répondait plus). → `setFeedback({ msg: res.error })` + rendu du message.
      5. **« La Mitraillette » rendue INDÉCERNABLE** par mon propre correctif `att = 1/manche` (son seuil est
         `total + 3`, or `att ≤ total`). → **nouvelle stat `subs`** (soumissions brutes) pour la Mitraillette,
         `att` (manches tentées) reste la base du ratio du **Sniper**. Les 2 trophées revivent.
      Bonus : **« Le Sniper » ne peut plus être volé** par un revenu PASSIF (`sustain`/`momentum` incrémentent
      `scored` sans réponse → ratio > 1) : borné par `Math.min(scored, att)`.
- [x] (BUG-LEADERBOARD) ✅ 2026-07-15 — **Classement Survivor PURGÉ** (accord explicite d'Alexandre).
      Il mélangeait **TROIS barèmes** → rangs faux et records ingagnables. Ma migration ×0.6 de la nuit était
      **insuffisante** : les entrées venaient d'échelles différentes (`Macron Demission 129219` datait d'un
      barème encore antérieur, prime 5 000) et `sameCfg` (leaderboard.js) ne compare QUE le créneau, jamais
      l'échelle → tri brut sur 3 monnaies. **Aucune migration ne pouvait marcher** : on ignore de quel barème
      vient chaque entrée. `server/leaderboard.json` → `[]` (gitignored, se régénère au 1er score).
      Backup des 8 entrées : `scratchpad/backup-avant-echelle/leaderboard-AVANT-PURGE.json.bak`.
      ⚠️ **Leçon** : le leaderboard n'enregistre NI version NI échelle. Si l'économie rebouge un jour, il
      faudra le re-purger — ou lui ajouter un champ `scale`/`v` pour pouvoir filtrer au lieu de tout jeter.
- [x] (BUG-CLASH-NUL) ✅ 2026-07-15 — **Les 2 mensonges du clash nul corrigés** (vérifié par un test dédié
      qui force un nul : `scratchpad/verify-clash-nul.mjs`, 5/5).
      - Le duelliste voyait « ±0 » alors qu'il touchait **+3 600** : `b.points` valait `0` en cas de nul au lieu
        de `BATTLE_DRAW`. Corrigé serveur + affiché en vert sur le téléphone ET sur la TV.
      - Le parieur lisait « Tu n'avais pas parié. » : la branche nulle de `endBattle` ne renvoyait aucun
        `betResults`. Corrigé → `{ won: false, cancelled: true, pick }`, et le téléphone affiche « Personne n'a
        trouvé — pari annulé, rien de perdu. » ⚠️ Le `pick` vient du **serveur** (et non du `betPick` local,
        remis à null par `battle:intro`) → survit à une reconnexion pendant `battle-reveal`.
      Payload vérifié : `{"draw":true,"points":3600,"bets":[{"won":false,"cancelled":true,"pick":"a"}]}`.
- [x] (BUG-SUSPENSE-QUIZ) ✅ 2026-07-15 — **Le suspense ne masque plus à tort en Quiz.** Le seuil de
      rattrapage est désormais **dépendant du mode** : `quiz → 15 000` (son vrai plafond : 6 000 × 2.5),
      sinon 22 800. Avant, on masquait le classement alors que le leader était mathématiquement intouchable.
      ⚠️ **Le BUZZER reste volontairement à 22 800** : son plafond réel (base × mult + 3 000) monterait à
      39 000 en Puriste, ce qui **élargirait** le masquage — l'inverse de l'intention. 22 800 sous-estime,
      donc il montre plutôt qu'il ne masque : c'est le sens SÛR.
- [x] (BUG-MUET-MJ) ✅ 2026-07-15 — **« Le Muet » ne peut plus misfire en Maître du jeu** : `if (c.mj) return null`
      (même patron que `sage` et `radin`). En MJ on répond à la voix → `att` = 0 pour TOUT le monde, le trophée
      serait tombé au hasard. Le trophée ne déclarait même pas le paramètre `c` — il n'avait aucun accès au
      contexte. LATENT (MJ désactivé côté client), corrigé quand même pour que la réactivation soit propre.
- ℹ️ **5 « bugs » RÉFUTÉS** par la passe adversariale (utile à savoir pour ne pas les re-chercher) : le muselé
      qui volerait `firstScorerId` à Damso · la table de certif d'`end-game-mock.html` (maquette, pas du
      runtime) · la certif ×16 au reload MJ · le plafond « Disque d'Or » en MJ · « La Mitraillette
      mathématiquement indécernable » **au buzzer** (prémisse fausse : le buzzer n'incrémente pas `att`).

---

## Chantier 2026-07-15 — ÉCHELLE ANCRÉE SNEP + anti-T9 (fait de nuit, à valider au playtest #5)

- [x] (ÉCHELLE) ✅ **Les certifs sont ancrées sur les VRAIS paliers SNEP.** `certif()` compare désormais le
      **total normalisé 16 manches** (`score / rounds × 16`) à **Or 50 000 · Platine 100 000 · Double 200 000 ·
      Triple 300 000 · Diamant 500 000**. Base double-hit **30 000 → 18 000** (6 000/volet + 6 000 de prime).
      **174 valeurs en auditeurs** passées à **×0.6** sur 12 fichiers (cartographie exhaustive avant écriture).
      *Pourquoi* : le score s'appelle « auditeurs » et les récompenses « Disque d'Or/Diamant » — les nombres
      doivent dire la vérité (Jewel Usain, rappeur du roster, doit tester le jeu). Bénéfice réel = une **cible
      objective de calibrage** au lieu de seuils au doigt mouillé.
      **Vérifié par le calcul** (Mainstream, 16 manches) : excellent (titre+artiste ~10 s, 100 %) → **504 835 =
      Diamant** · très bon → Triple · bon → Double · moyen (titre seul la moitié) → **Or** · faible → Espoir.
      Le Diamant tolère ~1 manche ratée. **Vérifié par le sim** : winrates avant/après → écart **moyen 1,25 pt**
      (= le bruit statistique) ⇒ **l'équilibre relatif est préservé**. **Vérifié par test-games** : **18/18, 0 échec,
      32/32 pouvoirs exercés**. Migration : `server/leaderboard.json` (8 scores Survivor) ×0.6, ordre préservé.
- [x] (ÉCHELLE-SUITE) ✅ 2026-07-15 — **Pouvoirs recalibrés : le pack est resserré de 2×.**
      **Étendue du pack (39 pouvoirs, hors Génies incompris) : 15,0-30,6 % → 17,1-24,9 %** (15,6 → **7,8 pts**).
      **Aucun au-dessus de 27 %.** Validé à 4000 parties/difficulté (`sim-OK.txt` dans le scratchpad).
      Les 5 gros mouvements : `plk` bonus **29,5 → 18,7** · `okis` sustain **30,6 → 20,6** · `medine` safety
      **15,0 → 20,3** · `iam` safety **15,1 → 19,8** · `fabe` veteran **18,4 → 21,4**.
      **La cause de PLK (le pire, 50 % en Mainstream)** : `refuel: true` rend sa charge dès qu'il marque → en
      Mainstream (~90 % de réussite) son bonus tourne à **CHAQUE manche**, donc il est payé ~14×/partie. Un
      montant fixe y devient énorme. `amount` 7500 → **4300**, ce qui écrase aussi son spread (32,6 → ~2).
      ⚠️ **Règle apprise, à retenir avant de retoucher ces valeurs** :
      - `refuel` (plk) et `sustain` (okis, jewelusain) sont payés **plusieurs fois par activation** → leur
        montant doit rester PETIT. Très sensibles : 600 d'écart sur `plk` = ~5 pts de winrate.
      - `safety`/`veteran` : le **floor** ne sert JAMAIS en Mainstream (on marque bien plus) → c'est le `self`
        qui porte le pouvoir. Monter le floor ne remonte que le Puriste, et **très vite** : `fabe` à 12 600
        est monté à **41,5 % en Puriste** (rente : on y marque rarement, donc le plancher tombe à chaque manche).
        Redescendu à 10 200. Son spread (24,7) est **structurel**, pas un bug — cf. CLAUDE.md « veteran fort en difficile ».
      - **Le bruit du sim est de ±2 pts à 4000 parties** (mesuré : `medine` a bougé de 21,0 → 17,1 sans qu'on
        y touche). **Ne jamais conclure sur un écart < 3 pts**, et toujours valider à 4000 (pas à 1200).
      - `sim-balance.mjs` accepte maintenant `PL_SIM_GAMES=1200` pour itérer vite (bruit plus élevé).
      **2 bugs du sim corrigés au passage** : l'en-tête affichait encore une colonne « DIGGER » (colonnes
      décalées après le passage à 3 crans — il est désormais GÉNÉRÉ depuis `DIFFS`), et le refuel plafonnait
      à `Math.min(5)` au lieu du **cap 3** réel du serveur.
      **`data.ts` resynchronisé** : 14 textes de pouvoirs remis à la vérité de `powers.js` (audit : 42 montants,
      **0 drift**). ⚠️ L'audit v1 ratait **Bishok** en silence (son entrée AVATARS est sur PLUSIEURS lignes) —
      le script v2 (`scratchpad/audit-textes.mjs`) découpe par entrée, plus par ligne.
- [ ] (ÉCHELLE-AMPLITUDE) **Delta de vitesse : à trancher AVEC une mesure.** Alexandre le trouve trop faible.
      Mesuré : 1 s de retard coûte **~1 800 pts (3,5 %)** en Blind Test · **~630 pts** en Quiz (base 10 000 →
      « quelques centaines », c'est probablement là que le ressenti est né) · **0** au buzzer (voir SCORE-MODE :
      c'est voulu). Levier propre si besoin = **l'amplitude** (×2.5 → ×3.5), PAS la courbe. **Non fait
      volontairement** : l'empiler sur la refonte d'échelle = 2 variables changées d'un coup, impossible de
      savoir laquelle a agi au playtest.
- [x] (T9) ✅ **L'autocorrection du téléphone ne massacre plus les réponses.** Cause confirmée : **aucun** champ
      de réponse ne désactivait la correction → « Nekfeu » → « Nef feu » est le comportement NORMAL du navigateur.
      Ajouté sur les **6 champs** de [Player.tsx](client/src/screens/Player.tsx) : `autoCorrect="off"
      autoCapitalize="off" spellCheck={false} autoComplete="off"` (+ `enterKeyHint="send"` sur les 4 champs de
      réponse). Nuances : le **code du salon** garde `autoCapitalize="characters"` ; le **blaze** garde la
      capitalisation auto (il n'est jamais string-matché → la majuscule ne coûte aucun point et rend mieux sur la TV).
      ⚠️ **Limite connue** : `autocorrect="off"` est fiable sur iOS mais **ignoré par Gboard/Android** —
      c'est pour ça que le ré-essai ci-dessous est le vrai filet, pas un confort.
- [x] (T9-RÉESSAI) ✅ **On peut réécrire TANT QU'ON N'A PAS MARQUÉ** (formulation exacte d'Alexandre).
      Le serveur acceptait **déjà** les tentatives multiples (max-keeping) — c'est le **client** qui verrouillait
      (`submitted`). Désormais : réponse à 0 point → le champ se rouvre ; dès qu'elle marque → verrou.
      *Pourquoi ce choix plutôt que des essais illimités* : (1) pas de brute-force pour **améliorer** un score,
      (2) le **pouvoir armé** (consommé à la 1re réponse qui marque) n'est pas gaspillé sur une réponse partielle,
      (3) le speedMult **ne punit PAS** le spam (une tentative ratée coûte 0 et le spam précoce touche le ×2.5) —
      sans cette règle, la stratégie dominante deviendrait « balancer 10 rappeurs à la seconde 1 ».
      Garde-fous : **cooldown 400 ms** (`TRY_COOLDOWN_MS`) + **plafond 8 essais/manche** (`MAX_TRIES`), et
      `p.stat.att` ne compte plus qu'**1 par manche** (sinon « La Mitraillette » devenait systématique et
      « Le Sniper » (ratio ≥ 85 %) inatteignable dès qu'on corrige un T9).
      **Vérifié en vrai** (6/6) : faux→0 & champ rouvert · juste→marque · faux APRÈS juste → **le score de la
      bonne survit** et le reveal affiche **la bonne réponse** · cooldown OK · plafond bloque à 8 et repart à 0.
      ⚠️ **Buzzer NON ouvert, volontairement** : le buzz est un pari (je prends la main ET je gèle tout le monde) ;
      avec 15 s d'essais illimités la stratégie optimale devient « buzzer à la seconde 1 puis brute-forcer ».
- [ ] (T9-BUZZER) Si le T9 fait encore des victimes **en buzzer** (c'est le mode où il est le plus toxique :
      titre **ET** artiste exigés, une lettre corrigée = lockout de la manche), préférer une **confirmation**
      (« Valider » → « Sûr ? ») plutôt que des essais multiples. Ne pas ouvrir le buzzer.

---

## Playtest #4 — soirée du 2026-07-10 (retour vocal Alexandre)

### 🎵 Pool / difficulté / catégories
- [ ] (POOL) **Supprimer la « catégorie R&B »** = thème **« Love / RnB »** dans `THEMES_EXTRA`
      ([ConfigWizard.tsx:40](client/src/screens/ConfigWizard.tsx)). Retirer le thème **et** purger les
      titres non-rap qu'il faisait remonter (Zaho, Amel Bent, Assia, Ayo, Irma…). La plupart sont déjà
      dans `server/difficulty-exclude.json` → vérifier que l'exclusion est bien appliquée (rebuild pool
      cache) et compléter la liste.
- [ ] (POOL) **Garder Disiz** : c'est du rap, ne PAS l'exclure même s'il est passé sur des sons « love ».
- [ ] (DIFF) **Lorenzo hors du Puriste** (et à réévaluer tout court). Le public rap ne l'aime pas ;
      le classer Puriste = insultant. `server/difficulty-labels.json` (`lorenzo|*`) → sortir du 'deep',
      voire l'exclure du pool. Vérifier `lorenzo|bossfinal`, `lorenzo|commedhab`.
- [x] (DIFF) ✅ **Défaut = Grand public** — était **DÉJÀ FAIT** côté client au commit `63a4071` :
      [ConfigWizard.tsx:172](client/src/screens/ConfigWizard.tsx) → `useState('facile')`. Complété le 2026-07-15 :
      le défaut du salon neuf ([index.js:490](server/index.js)) était resté à `'normal'` → aligné sur `'facile'`
      (effet fonctionnel nul — écrasé par `startGame()` — mais évite qu'un futur « lancement rapide » reparte
      en Connaisseur). ⚠️ NE PAS toucher `index.js:1188` (`DIFFICULTY[difficulty] ? difficulty : 'normal'`) :
      c'est une **validation d'entrée réseau**, pas un défaut produit.
- [ ] (POOL) **Plus de volume de sons en Grand public** (facile plafonne ~262). Replier les canons dans
      `SEED_TRACKS` + vrai rebuild pour élargir proprement.

### 🔊 Musique / son
- [x] (SON) ✅ **Musique dans le Quiz** — était **DÉJÀ FAIT** au commit `63a4071` : l'instru lobby tourne à
      **volume 0.2** (contre 0.32 au lobby) pendant tout le quiz ([Host.tsx:485](client/src/screens/Host.tsx)),
      fade-in 1100 ms / fade-out 500 ms, sans coupure entre les questions. **2 trous corrigés le 2026-07-15** :
      `round:countdown` n'envoyait pas `mode` ([index.js:618](server/index.js) et `:637`) et `round.mode`
      (initial `'multi'`) n'était jamais purgé → (1) **5 s de silence sur la 1re question** d'un quiz, (2) **instru
      parasite** pendant le décompte d'un Blind Test joué après un Quiz dans la même série. Corrigé serveur (les
      2 chemins de décompte envoient `mode`) + client ([Host.tsx:271](client/src/screens/Host.tsx) l'absorbe).
      Si le playtest dit que ça gêne la lecture : viser **0.14** (0.2 → 0.14 ≈ −45 % perçu) — et changer les
      **deux** occurrences (`Host.tsx:485` ET `:459`, sinon le toggle musique rallume à un autre volume).
- [ ] (SON) **Un peu plus de volume en Grand public** de manière générale.
- [x] (BUG-SON) ✅ 2026-07-10 — **Une musique lancée ne s'arrête plus** → a fait louper un son de buzzer ; contournement
      forcé (Radio → écraser → Salon). Bug de cycle de vie audio à corriger (arrêt/`stop` de l'élément
      entre phases). **Critique.**

### 🔔 Buzzer
- [x] (BUG-BUZZ) ✅ 2026-07-10 (Deezer + Spotify + reprise buzz:open couverts, vérif adverse ; à confirmer live) — **Softlock si on buzze trop vite** : buzzer démarre, appui immédiat → la musique continue
      de défiler et ne part plus. Reproduit 2×. À reproduire et corriger. **Critique.**
- [ ] (BUZZ) **10 s pour écrire = trop court** une fois buzzé (surtout noms longs, stress). Rallonger /
      adapter à la longueur, ou timer plus clément.
- [ ] (UI-BUZZ) **Le mot « BUZZER » déborde du cercle vert** derrière lui, surtout sur la TV. CSS à revoir.

### ⚡ Pouvoirs
- [x] (POW) ✅ 2026-07-10 — **Pouvoirs = UNIQUEMENT en Blind Test.** Les désactiver en **Buzzer** ET **Quiz** (pas adaptés).
      Vérifier `server/index.js` (garde-fou d'activation par mode).
- [ ] (POW) **Beaucoup plus de lisibilité / d'impact** : texte du pouvoir plus GROS, et surtout **montrer
      quand il s'active** (on ne comprend pas ce qui s'est passé). Mise en avant à l'activation + au reveal.
- [x] (BUG-SON) ✅ 2026-07-10 (cap 260 ms + coupe à la transition ; ajuster la valeur au goût) — **SFX de pouvoir beaucoup trop long** (~25 scratches d'affilée, infâme) et **déborde sur le
      début de la musique** (3-4 s du SFX de la phase d'avant). Le raccourcir fortement + couper à la
      transition de phase pour empêcher le chevauchement.
- [ ] (POW-IDÉE) Plus tard : **pouvoirs communs à tous** en Buzzer/Quiz pour ajouter du fun (optionnel).

### 🧠 Quiz
- [ ] (QUIZ) **Ajouter des questions drôles / culture rap décalée** (le quiz est monotone, il manque
      l'humour). Exemples donnés :
      - « Quel rappeur n'a **pas** été clashé par ce gros rageux de Booba ? »
      - Questions **streams** (« c'est qui le plus grand entre X et Y ? »)
      - « Quel rappeur a sorti une **marque de téléphone** incroyable surpassant l'iPhone ? » (réponse gag)
      → banque `server/quiz-bank.json`, écrites **à la main** (véracité critique).
- [x] (BUG-QUIZ) ✅ 2026-07-15 — **Question Heuss l'Enfoiré** : corrigé (`quiz-bank.json:258`, id `z-sur-lenfoire`).
      L'énoncé demandait de compléter « Heuss … » **puis écrivait « Heuss L'Enfoiré » six mots plus loin**.
      Patch **minimal** : suppression des 4 mots « de Heuss L'Enfoiré » → « quel mot complète **ce** nom de scène ? ».
      Aucun fait ajouté (règle de véracité), id/correct/distracteurs inchangés (anti-répétition salon préservée).
      ℹ️ La banque réelle est **`server/quiz-bank.json`** (1331 items) ; `server/quiz.js` n'est qu'un **loader**
      (le CLAUDE.md disait « banque `quiz.js` » — périmé, corrigé).
- [x] (QUIZ-SPOIL) ✅ 2026-07-15 — **Balayage exhaustif des spoils + nettoyage.** Décision d'Alexandre :
      « dégage-les, t'emmerdes pas » → pas de réécriture éditoriale. Banque **1331 → 1327**.
      **4 SUPPRIMÉES** (irréparables : la citation de l'énoncé EST la réponse, rien à sauver sans engager un fait) :
      `a-adlibssignatures-9` (slogan « Rohff Game » → Rohff) · `w-sexiongims-9` (refrain cité = le titre, Bella) ·
      `w-sexiongims-10` (citation = le titre) · `w-pnl-3` (Corbeil-**Essonnes** → Essonne ; en prime : géo pure,
      zéro rap, elle n'avait rien à faire là).
      **3 RÉPARÉES par suppression pure** (on retire l'incise qui spoile, **aucun fait ajouté** — même patron) :
      `z-sur-lenfoire` (Heuss) · `a-devineartiste-9` (Dinos : l'ancien blaze retiré, les albums « Imany »/
      « Taciturne » déjà dans l'item suffisent) · `p-villesold-1` (NTM : « de Seine-Saint-Denis » retiré, les
      leurres Aulnay/Sevran/Bobigny restent discriminants).
      **Scan final : 2 hits restants, aucun à corriger** — `pl-orel-basique` (faux positif : la punchline
      d'Orelsan **est** une répétition, corriger casserait la citation) et `w-histoireanecdotes-6` (l'émission
      s'appelle comme le genre qu'elle traite — indice léger, pas un spoil).
      ⚠️ **Piège de scan** : un scan « réponse ⊂ énoncé » naïf remonte **144 faux positifs** — les 259 Vrai/Faux
      matchent tous sur le mot « Vrai » de « Vrai ou faux : ». **Exclure `correct ∈ {Vrai, Faux}`** avant de scanner.
      ℹ️ Le loader accepte 2 formats (`quiz.js`) : QCM (**3 distracteurs**) **ou** `format:'vf'` (sans distracteurs).
- [ ] (QUIZ-IDÉE) **« Finis la punchline »** même en Grand public, mais UNIQUEMENT punchlines archi-connues
      de sons archi-connus grand public. (Fun.)

### 🏆 Multi-parties / rejouer / récaps
- [ ] (RECAP) **Séparer les 2 récaps** : le tableau « récap de TOUTES les parties du salon » (fin de partie)
      ne doit PAS être au même niveau/visuel que le récap de fin de manche. Deux écrans distincts.
- [ ] (REJOUER) **Rejouer est pénible** : ça sort à chaque fois (retour hub + refaire les réglages).
      Doit relancer vite en gardant la config.
- [ ] (SURVIVOR) **Rester dans le mode à la fin** : écran « qui veut rejouer ? » → sélection des joueurs →
      « Rejouer » relance direct (sans repasser par le hub / les réglages). Là, « Rejouer » a viré tout le
      monde vers le hub et il a fallu tout reconfigurer.

### 🎮 Survivor
- [ ] (SURVIVOR) **Trop aléatoire (pile ou face)** : des sons « censés faciles » ne le sont pas. Ex : une
      partie finie à 250k, une autre à 10k (3 sons introuvables / pas grand public). Fiabiliser la rampe de
      difficulté (`rushRankedPool`, `RUSH_RAMP_SCALE`, bandes curées) : les 1ers sons DOIVENT être grand public.

### 🔓 Personnages déblocables
- [x] (BUG-UNLOCK) ✅ 2026-07-10 (verrou retiré → les 5 jouables partout ; silhouettes « ??? » TV encore à trancher) — **Déblocables cassés** : demandé de les retirer → retirés du **character select** mais
      pas proprement. Résultat observé :
      - après déblocage, **toujours pas sélectionnables** dans le character select (on débloque un perso
        injouable) ;
      - ils apparaissent dans le **roster** (« changer de rappeur ») comme déjà débloqués ;
      - mais on **continue à les débloquer** en jouant (incohérent).
      → Décision à trancher : soit on les rend pleinement jouables (déblocage → dispo au character select),
        soit on les retire complètement (roster + système de déblocage). Fichiers : `Player.tsx`
        (character select / `changing` / `pl_unlocked`), `server/index.js`, `data.ts`.

### ✨ Animations / UI transverse
- [ ] (UI) **Anim d'arrivée d'un nouveau perso** : a fait mouche (tout le monde a kiffé) mais **un chouïa
      trop grande** → le bouton se retrouve collé en bas, relou. Réduire l'échelle / garantir le bouton visible.
- [ ] (UI) **Boutons flottants** : « Suivant » (et similaires) doivent **flotter en bas** avec un **dégradé
      foncé** dessous pour bien les repérer. Motif réutilisable à généraliser.
- [ ] (UI) **Tableaux ladder** : écrire **un peu plus petit** — ça dépasse et oblige à scroller. Adapter la
      taille à l'écran TV pour tout faire tenir.
- [ ] (UI) **Anim de changement de place** (dépassement / dégringolade dans le classement) : **manquantes**,
      déjà demandées. À ajouter (reveal / ladder).
- [ ] (UI) **Anim des réactions pendant les résultats** : **lag / pas smooth**, texte pas assez GROS et doit
      **remonter plus haut**. Fluidifier + grossir.
- [ ] (PERF) **Temps de chargement** : semble un peu long. À profiler (boot serveur / résolution pool / assets).

### 🧩 Clash (manche battle)
- [x] (CLASH) ✅ 2026-07-15 — **Le clash MARCHE. Vérifié en jouant de vraies parties headless**, pas en lisant
      le code. Le diagnostic initial (« pas branché ») était **FAUX**.
      - **Pourquoi aucun clash le 10/07** : `BATTLE_AUTO` était à `false` ce soir-là. Il est passé à `true` le
        **2026-07-12** (commit `9129d7a`, « Point de sauvegarde… », fourre-tout), soit **2 jours APRÈS** la soirée.
        Pas un bug — une question de dates. Le moteur est branché depuis `595aed0` ([index.js:811](server/index.js)
        `nextRound` → `pickBattleDuelists` → `startBattle`), Host **et** Player gèrent les 4 phases avec audio + paris.
      - **Preuve** : 6 parties réelles (`PL_FAST`, port 3002, 3 joueurs, multi **et** buzzer, 8 et 16 manches) →
        chaîne complète `battle:intro → bets → tally → go → answer → reveal → host:next`, `game:final` atteint,
        aucun softlock, aucune manche consommée. `host:restart` ×3 → **[1, 1, 1] clash par partie** : `battlesThisGame`
        est bien remis à 0 ([index.js:1221](server/index.js) et `:1638`).
      - Conditions : mode `multi`/`buzzer`, pas MJ, **≥3 actifs**, 1/partie, `min(total-2, total/2)`, jamais la
        dernière manche. Écart ≤45k = duel au sommet, sinon rattrapage (les 2 derniers). Format **∞** OK
        (`totalRounds = playlist.length`, toujours fini).
      - 🐛 **BUG TROUVÉ ET CORRIGÉ au passage** — le clash pouvait **rejouer un son de la partie en cours** :
        [`startBattlePlay`](server/index.js) omettait le 5e arg `played` de `pickPlaylist` **et** n'ajoutait jamais
        son tirage à `playedTracks` (contrairement à une manche normale, [index.js:580](server/index.js)). Donc il
        pouvait tirer un son **déjà joué** OU **encore à venir dans la playlist** — le même morceau deux fois à
        2 min d'intervalle, **dans un blind-test**. Observé : « Saiyan » joué en clash aux parties 2 **et** 4.
        Corrigé : `avoid` = copie de `playedTracks` + les manches restantes, et le son du clash est consommé.
        (La copie est **délibérée** : la branche de recyclage de `pickPlaylist` vide `played` → lui passer la vraie
        mémoire du salon l'effacerait. Ne pas « simplifier ».) Tirage de **5 candidats + random** au lieu de n=1 :
        `sampleBalancedByEra` est déterministe sur la décennie à n=1 → le clash se figeait sur une seule époque.
- [ ] (CLASH-TV) **Reste : le voir tourner à l'écran** (le juge final, jamais fait). `npm run dev` → `/host` →
      3 onglets `/?dev` → **Blind Test · Automatique · 8 manches** → le clash tombe après la révélation de la
      **manche 5**. Vérifier à l'œil : intro 4,5 s, paris 10 s (les avatars des parieurs arrivent par camp via
      `battle:tally`), 22 s de son, révélation + bouton « Manche suivante → ». Le back est prouvé, pas le rendu.
- [ ] (CLASH-DEV) **`host:forceBattle` n'est émis par PERSONNE** — le commentaire [index.js:66](server/index.js)
      promet « le lien "+ clash test" côté hôte, et test-games » : **les deux sont faux** (`grep forceBattle` ne
      trouve que la définition). Le handler marche (`phase === 'reveal'` + hôte + ≥3 joueurs). Soit on ajoute le
      bouton dev promis, soit on corrige le commentaire. En attendant : `socket.emit('host:forceBattle', {})`
      depuis la console du navigateur sur `/host`, en phase `reveal`.

### 🎯 Matching / scoring
- [x] (MATCH) ✅ **« NTM » → « Suprême NTM »** — était **DÉJÀ FAIT** au commit `63a4071` : `ALIAS_GROUPS` +
      `aliasForms()` ([match.js:73-86](server/match.js)), appliqués à l'artiste **et** aux feats ([match.js:97](server/match.js)),
      bidirectionnel. Vérifié **en exécutant le vrai code** : `gradeAnswer('NTM', {artist:'Suprême NTM'})` → `artistHit`.
      ⚠️ **NE PAS RE-APPLIQUER** : redéclarer `const ALIAS_GROUPS` = `SyntaxError` → **le serveur ne démarre plus**.
      Ajouté le 2026-07-15 : `ministere a m e r`/`amer` (seul sigle du pool encore raté ; balayage des 168 artistes).
      Écarté volontairement : `ff`/Fonky Family (alias de 2 car. → KO dès qu'il est noyé dans une phrase, et « f »
      seul matcherait à 0.8) ; B2O/Dems/SSC/GCM (surnoms, pas des sigles — risque de dérive).
- [x] (SCORE) ✅ **Diamant trop dur** — était **DÉJÀ FAIT** au commit `63a4071`, **les DEUX leviers tirés d'un coup** :
      prime de précision **+5 000 → +10 000** ([match.js:103](server/match.js) → double-hit = **30 000** = **3×** le
      partiel) **ET** seuil Diamant **50 000 → 46 000**/manche ([data.ts:41](client/src/data.ts)).
      ⚠️ **NE PAS RE-APPLIQUER** (double correction = prime 20 000 / Diamant 42 000 = sur-correction).
      Vérifié par le calcul : Diamant **est** atteignable en Blind Test — facile = titre+artiste en **≤ 13,7 s** sur
      30 s à **chaque** manche ; normal = quasi acquis si sans-faute ; puriste = acquis dès **77 %** de réussite.
      **Reste à valider au playtest #5** (jamais re-testé depuis).
- [ ] (SCORE-MODE) **`certif` est mode-blind alors que les modes ont des plafonds/manche incompatibles.**
      ⚠️ Chiffres RÉACTUALISÉS après l'ancrage SNEP du 2026-07-15 (les anciens étaient pré-refonte) :
      [data.ts](client/src/data.ts) `certif` est appelée sans le mode (Host.tsx:57/1127/1144, Player.tsx:1050) :
      - **Quiz** ([index.js](server/index.js) `6 000 × speedMult`, mult forcé à 1) → max **15 000**/manche →
        total 16 manches **240 000** → plafond = **Double Platine**. Diamant et Triple **impossibles**.
      - **Buzzer** ([index.js](server/index.js) `base × mult + 3 000`, **pas de speedMult**) → facile max
        **21 000**/manche → **336 000** en dominant TOUTES les manches = Triple. Diamant **impossible**. Et un
        seul joueur marque par manche (≈ 5 250/manche à 4 → Espoir/Or pour les autres).
      → **Arbitrage design, à trancher avec le proprio** (certif mode-aware ? barème Quiz/Buzzer réaligné ?).
      ⚠️ **Le « pas de speedMult au buzzer » est un CHOIX, pas un bug** (analysé le 15/07) : au buzzer, celui
      qui buzze en premier prend TOUT et les autres zéro — le delta entre joueurs y est déjà **maximal**, et le
      temps est arbitré par la course au buzz. Ajouter un bonus de vitesse APRÈS le buzz punirait celui qui
      réfléchit alors qu'il a déjà gagné la course. **Ne pas « corriger » ça.**
- [ ] (SIM) **`sim-balance.mjs` resynchronisé le 2026-07-15 — les pouvoirs sont à re-calibrer.** L'outil modélisait
      l'économie **d'avant le playtest #4** : base double-hit 25 000 (→ **30 000**), 4 crans de difficulté dont 2
      disparus (→ **3** : 1.0/1.5/2.0), cap charges 5 (→ **3**), accrual `18+44` (→ **`14+14`**, ~2× trop rapide).
      **Tout verdict d'équilibrage sorti depuis le 10/07 est faux.** Attendu après resync : les pouvoirs à
      **montant fixe** (`steal`, `bonus`, `firstblood`, `momentum`, `tax`) **baissent** (~20 %), les **multiplicatifs**
      (`double`, `combo`, `ace`, `wager`) **montent**, et le cap 3 pénalise l'accumulation (`allin`). Chantier à part.
- [ ] (BUG-SON) **Sons qui ne se lancent pas** (quelques fois) → manche jouée sans son. Robustesse de lecture.

---

## §META — outillage demandé (gros gain de temps)
- [ ] (META-SHOWROOM) **Répertoire de TOUTES les interfaces de jeu** navigable sans jouer de partie :
      étendre `/showroom` ([Showroom.tsx](client/src/screens/Showroom.tsx)) avec une **nav** (Host lobby /
      prep / playing / reveal / final, Player form / character-select / prep / jeu / MJ / salle d'attente,
      Quiz, Buzzer, Survivor, Clash, récaps…). Design FINAL réel (vraies polices/couleurs), pas de cadre.
- [ ] (META-FEEDBACK) **Boîte de retours dans le showroom** : un `textarea` + bouton **Poster** par page →
      endpoint serveur dev (ex. `POST /api/feedback`) qui **append** dans `CORRECTIFS.md` (rangé sous la
      section de la page courante). Ensuite « corrige les correctifs depuis CORRECTIFS.md » et je pioche ici.

## Suites / nettoyage (non bloquant)
- [ ] (CLEANUP) Code mort du système de déblocage (inoffensif, confirmé par vérif adverse) : `computeUnlock`/
      `unlockedRef`/rendu `ChallengerReveal` (Host.tsx), bloc `?revealdemo` (grille vide), `UNLOCKS`/`LOCKED_SLOTS`/
      `isLockedSlot` (data.ts), logique `lockedSel` (HubBrowse.tsx), section déblocables (Player.tsx). À supprimer
      quand on touchera au hub (⚠️ coordination lobby/hub avec le proprio).
- [ ] (SON) Uniformité défensive (optionnel) : `sfxStop('scratch')` aussi en tête de `rush:host` / `battle:go` /
      `applyState` (aujourd'hui inutile car le scratch n'y joue jamais, pouvoirs désactivés dans ces modes).
