# HANDOFF — Sprint pré-soirée (2026-07-09)

> Contexte serré (invités imminents). Tout ci-dessous est **commité** sur `main`, **pas poussé** (attendre l'accord d'Alexandre).
> ⚠️ **Le serveur de jeu doit être REDÉMARRÉ** pour prendre les changements serveur + le cache enrichi.

## FAIT cette session (commits récents)
1. **Trophées** : `escroc` + `Le Rendement` retirés (ni gagnables ni visibles) · galerie TV **5 par ligne**.
2. **Survivor scoring** : titre **OU** artiste suffit (avance) ; partiel = +3 s, les deux = +9 s + max de points ; expliqué avant le départ.
3. **Multi-thèmes** : on peut cocher plusieurs styles (union). **Fix bug « Légendes »** (id `legendes` ≠ tag `legend` → filtrait rien).
4. **Duel ≥ 3 joueurs** (garde-fou dans `pickBattleDuelists`, force 2→3).
5. **Spotify** : pill grisé après auth corrigé (`resetSpotifyPlayer()` au retour du popup).
6. **Classement Survivor (rushend)** refait en page de consultation (retour haut-gauche, plus de dégradé sur le logo).
7. **Jauge de pouvoir** : le losange de la charge en cours **se remplit** visiblement (`.charges i.fill`, `--cf`).
8. **DIFFICULTÉ — refonte complète** (le point critique) ⤵
9. **Feats** : matching des featurings réparé ⤵

## DIFFICULTÉ (source de vérité = `server/difficulty-labels.json`)
- Le rank de streaming était FAUX (Oxmo « L'Enfant Seul », Niska « Jota » en facile). Remplacé par une **liste curée** :
  chaque VRAI titre du pool jugé par **notoriété grand public** (radio/tubes, pas le streaming) via une flotte d'agents +
  un passage de **vérification sévère**. `gp→facile, connu→normal, niche/obscur→difficile/puriste`.
- Le stream ne sert plus qu'à l'**ordre** au sein d'un niveau, **ajusté à l'époque** (percentile dans la décennie).
- Code : `server/index.js` → `DIFF_LABELS` (load), `dnorm()`, `notoTier()`, `computeBands()` (memoïsé), `tierSlice()` réécrit
  (bandes par label + tri + backfill adjacent + **dédup des ré-éditions**). `recoScore`/`artistPeaks` gardés pour Survivor.
- Bandes obtenues : facile ~48 (strict) / normal ~455 / difficile ~934 / puriste ~935. Vérifié : facile = Diam's, IAM
  « Petit frère »/« Je danse le Mia », GIMS « Bella », NTM « Laisse pas traîner ton fils »… ; les 4 pièges bien HORS facile.
- **Preview validée par Alexandre** : Artifact « PUNCHLINR — Difficultés à valider » (50/niveau).
- **RÉGÉNÉRER les labels** si besoin : voir la flotte `punchlinr-grandpublic-tiering` (workflow) → `allLabels`/`verdicts` dans
  `…/tasks/wnterr2nw.output` ; le script de build écrit `server/difficulty-labels.json` (clé = `dnorm(artiste)|dnorm(titre)`).
  Si Alexandre veut **élargir le facile** : promouvoir le haut de `connu` (par éraNorm) vers `gp`.

## FEATS (taper un featuring = points)
- Bug : les feats venaient SEULEMENT du parsing du titre ; les vrais featurings (ex. Hamza sur « Jota ») sont dans les
  **contributors** de l'API Deezer (`/track/{id}`), jamais lus.
- **Fix appliqué (hors-ligne)** : `scratchpad/enrich-feats.mjs` a enrichi `server/.pool-cache.json` (1204 feats ajoutés, 957
  titres, 0 échec). « Jota » → `feats:["Hamza"]` ✅. Le serveur lit ce cache au boot (seedHash inchangé → pas de rebuild).
- ⚠️ **TODO robustesse** : le cache (`.pool-cache.json`) est **gitignored** et local. Si un jour il est reconstruit, les feats
  disparaissent. À FAIRE : ajouter `enrichFeats()` dans `loadPool()` (patron = `enrichYears`, mais per-track, sans dédup album ;
  fetch `/track/{id}` → `.contributors` role≠main → `t.feats`) + **PAS** de bump seedHash sauf si on veut forcer un rebuild.

## À FAIRE / OUVERT
- Redémarrer le serveur de jeu (obligatoire).
- (Optionnel) élargir le pool facile si trop court en jeu réel.
- `enrichFeats()` code (voir ci-dessus) pour survivre à un rebuild du cache.
- Playtest live des difficultés à plusieurs.

## Vérifs faites
`node --check server/index.js` OK · client `npx tsc --noEmit` 0 erreur · **boot serveur OK** (`[pool] 2405 morceaux`) ·
simulation tiering conforme · « Jota » feats OK.
