# HANDOFF — Polish wizard TV (étapes/playlist/difficulté) + trophées

> Session 2026-07-09. **TOUT FAIT ✅** (6/6). Doc conservée pour trace / reprise.
> DA : anthracite + fluo jaune-vert (`--fluo`), **carré/biseauté**, échelle TV (gros, vu de loin). HOST = TV.

## Assets ajoutés par Alexandre
- `assets/Trophy/` : + `le sans pitié..png` → copié en `client/public/trophies/sanspitie.png` (LFS). ✅
- `assets/Difficulty/` : `grand public/connaisseur/digger/puriste.png` → copiés en
  `client/public/difficulty/{facile,normal,difficile,puriste}.png` (LFS). ✅
- **Trophées SANS image encore** (repli SVG auto) : **escroc, boulet**. À générer plus tard (prompts `TROPHIES_PROMPTS.md`).

## Tâches (demande du 2026-07-09) — TOUTES FAITES
1. **[✅] Assets copiés** (sanspitie + 4 difficultés) + `.gitattributes` LFS. — commit `b6aa45b`
2. **[✅] Difficulté en IMAGES** — tuiles image-forward `<img src="/difficulty/<key>.png">` (repli SVG). — `11cc08f`
3. **[✅] Galerie trophées** — `.troph-grid.big` (`styles.css`) : minmax 230→**330** (−2 colonnes/ligne, illus plus grandes)
   + **fondu bas** (`::after` gradient image→fond de carte `#090a0d`) : plus de coupure nette. — `11cc08f`
4. **[✅] P1 + crochets retirés** — `.wz .pick .brackets, .wz .pick .p1tag {display:none !important;}` (partout). — `11cc08f`
5. **[✅] Étapes + playlist PLUS GRANDES (TV)** — thématiques 19→23, difficulté nom 22→27/desc 15→18,
   format label 19→24, options 17→21, en-têtes d'acte agrandis, pads plus hauts. — `3e8747c`
6. **[✅] Oscilloscope audio-réactif** sur tuile SÉLECTIONNÉE difficulté + format (+ Survivor) ; boucle RAF
   généralisée à toutes les `.wz canvas.scope` ; PAS sur la Carte de match (sidebar). — `74d5a4f`

## Commits (base session : `790d3a4`)
- `b6aa45b` assets + HANDOFF · `11cc08f` difficulté images + trophées + P1/crochets · `3e8747c` étapes plus grandes ·
  `74d5a4f` oscilloscope tuiles. **Pas encore push** (attendre l'accord d'Alexandre).

## Vérif faite
`cd client && npx tsc --noEmit` = 0 erreur (à chaque étape) · preview `/host` → Configurer :
difficulté 4 images + P1/crochets absents · playlist toutes thématiques visibles/plus grandes ·
oscilloscope présent+dessine sur la tuile choisie (difficulté « Connaisseur », format « 16 »), 1 seul/étape.

## Restes / pistes (hors périmètre de la demande)
- Générer les 2 illus trophées manquantes (escroc, boulet).
- Playtest live pour valider l'oscilloscope avec du vrai son (autoplay bloqué en preview → vague ~plate,
  la vague oscille quand la musique joue fort). L'effet REND déjà (bordure verte lumineuse au repos).
