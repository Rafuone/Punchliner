# CORRECTIFS — backlog de soirée

> Source de vérité des retours de playtest. La **boîte de retours du showroom** (à construire, voir §META)
> vient ajouter des lignes ici, rangées par page. Pour appliquer : « corrige les correctifs depuis
> CORRECTIFS.md ». On coche `[x]` quand c'est fait + on note le commit/fichier.
>
> Format d'une entrée : `- [ ] (TAG) description — piste technique / fichier`.

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
- [ ] (DIFF) **Défaut = Grand public.** Le mode difficulté doit s'ouvrir sur `facile` par défaut dans le
      ConfigWizard (la plupart des soirées jouent grand public).
- [ ] (POOL) **Plus de volume de sons en Grand public** (facile plafonne ~262). Replier les canons dans
      `SEED_TRACKS` + vrai rebuild pour élargir proprement.

### 🔊 Musique / son
- [ ] (SON) **Musique dans le Quiz** (jamais posée alors que demandé) : mettre l'instru du **1er écran
      lobby** (le beat des QR codes = **Alpha Wann « philly flingo »**), **volume bas** pour ne pas gêner
      la lecture des questions. Câblage : `Host.tsx` (`lobbyAudioRef` / audio par phase).
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
- [ ] (BUG-QUIZ) **Question Heuss l'Enfoiré** : on demande son nom complet mais **la réponse est dans la
      question**. Corriger l'item dans `server/quiz-bank.json`.
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
- [ ] (BUG-CLASH) **Aucun clash déclenché de toute la soirée** alors que plein de parties serrées. Problème
      d'intégration : la manche battle n'est pas branchée dans la vraie boucle (moteur fait+testé mais
      `BATTLE_AUTO=false`, showroom seulement). Vérifier le déclenchement dans `server/index.js` + Host/Player.

### 🎯 Matching / scoring
- [ ] (MATCH) **« NTM » doit compter pour « Suprême NTM »** (tout le monde dit NTM). Ajouter l'alias.
      `server/match.js` / aliases d'artistes.
- [ ] (SCORE) **Diamant trop dur** (car dur de trouver titre + artiste). Donner **plus de valeur quand on
      trouve les DEUX** (prime de précision plus haute). `server/match.js` + `index.js` (base +5000 → à monter).
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
