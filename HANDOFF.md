# HANDOFF — Polish wizard TV (étapes/playlist/difficulté) + trophées

> Session en cours (2026-07-09). Contexte limité → doc pour reprendre si besoin. Coche au fur et à mesure.
> DA : anthracite + fluo jaune-vert (`--fluo`), **carré/biseauté**, échelle TV (gros, vu de loin). HOST = TV.

## Assets ajoutés par Alexandre
- `assets/Trophy/` : + `le sans pitié..png` → copié en `client/public/trophies/sanspitie.png` (LFS). ✅
- `assets/Difficulty/` : `grand public/connaisseur/digger/puriste.png` → copiés en
  `client/public/difficulty/{facile,normal,difficile,puriste}.png` (LFS). Images CARRÉES, détaillées (comme les trophées). ✅
- **Trophées SANS image encore** (repli SVG) : **escroc, boulet** (Le Rendement). À générer plus tard.

## Tâches (demande du 2026-07-09)
1. **[✅ FAIT] Assets copiés** (sanspitie + 4 difficultés) + `.gitattributes` LFS (`client/public/difficulty/*.png`, `client/public/trophies/*.png`).
2. **[  ] Difficulté en IMAGES** — étape difficulté du wizard (`ConfigWizard.tsx` `step === 2 && !isRush`, tuiles `.diff-tile` + `.diff-illu`).
   Remplacer l'illustration SVG (`DIFF_ILLU`) par `<img src="/difficulty/<key>.png">` (key = d.key : facile/normal/difficile/puriste), tuile IMAGE-FORWARD (grande image carrée). CSS `.diff-tile`/`.diff-illu` dans `wizard.css`.
3. **[  ] Galerie trophées** — `.troph-grid.big` (`styles.css` ~1008) : **enlever ≥2 colonnes par ligne** → `minmax(230px→~330px)` (images ENCORE plus grandes). Et **fondu en bas** de la carte (le bas s'arrête net) : dégradé image→fond de carte (ex. `::after` linear-gradient transparent→`var(--surf...)` en bas de `.troph-ic`).
4. **[  ] Virer P1 + coins résiduels** — le tag `P1` (`.p1tag`) et les crochets d'angle (`.brackets`, `.pick .brackets b`, `.pick.on .p1tag`) sur les cartes/tuiles sélectionnées. `wizard.css` (~140-146) + JSX `ConfigWizard.tsx` (chercher `p1tag`, `brackets`, `bracketsSvg`). Les RETIRER partout.
5. **[  ] Étapes + playlist PLUS GRANDES (TV)** — tout est écrit trop petit. Playlist : années DÉJÀ 36px, thématiques DÉJÀ toutes affichées ; **agrandir encore** (pads plus grands/plus lisibles, titres d'étape). Format/Chrono/Réglages aussi. `wizard.css` (`.pad`, `.diff-tile`, `.fmt-tile`, `.opt`, `.act-*`, `.stage-title`).
6. **[  ] Effet OSCILLOSCOPE audio-réactif** sur les tuiles de difficulté + gros éléments des autres étapes (pas seulement la partie gauche / pas la Carte de match à droite). Voir `ConfigWizard.tsx` : `drawScope`, `waveRef`, boucle RAF audio-réactive (la home l'a). Le porter sur les tuiles (canvas/overlay réactif au son par tuile, ou glow réactif). **Le + complexe → à faire en dernier.**

## Commits
- Base avant cette session : `790d3a4`.
- (mettre à jour au fur et à mesure)

## Vérif
`cd client && npx tsc --noEmit` · preview `/host` → Configurer → étapes. Serveur inchangé cette passe.
