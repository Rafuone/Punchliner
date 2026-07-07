# PUNCHLINR — Prompts des visuels de trophées

Petites **images carrées** (remplacent les icônes SVG du palmarès), **même DA que les avatars**
(16-bit SNES, contour vert acide, fond anthracite baigné orange-rosé). ~28 trophées.

- Cible fichier : `client/public/trophies/<id>.png` (carré, ~256×256). L'`id` est dans la colonne du tableau
  et correspond à `server/awards.js` / `data.ts → AWARDS_INFO`.
- Comme c'est **petit**, on vise un **emblème lisible d'un coup d'œil** (1–2 objets max), pas une scène chargée.
- On assume la **culture hip-hop/rap** : micro doré, chaîne en or, boombox, vinyle, cassette, spray, snapback,
  ceinture de champion, ring de boxe… (pas besoin de vrais rappeurs — ça reste petit).

## LE PROMPT (colle-le, change juste `[SCÈNE]`)

```
16-bit SNES-era pixel art badge, crisp visible pixels, limited palette, no text, no logo, no letters.
Composition: a single centered emblem, chunky and readable at small size, filling a square 1:1 frame.
Background: dark anthracite washed in a warm orange-to-pink neon glow (sunset haze), subtle film grain.
Lighting: bold acid-green rim light hugging the emblem — the PUNCHLINR signature glow — cool neon-green
edge popping against the warm orange-pink background.
Subject: [SCÈNE]
Vibe: 90s–2000s French rap / hip-hop iconography, street, a little grimy.
```

- **Couleurs = DA de l'app** : contour **vert bombe** (`#a6ff00` / jaune acide `#e4ff1a`) sur **fond anthracite + halo orange-rosé**.
- Pour les **salés** (chambrage), pousse le côté **cartoon/ironique** ; pour les **flatteurs**, plus **héroïque/doré**.
- Astuce cohérence : garde le **même cadrage carré + même halo** partout → la grille du palmarès reste homogène.

## Les [SCÈNE] — trophées complets

### Flatteurs (dorés / héroïques)

| Trophée | id | [SCÈNE] |
|---|---|---|
| Comeback King | `comeback` | A hooded rapper rising off the canvas of a boxing ring, one fist and a golden crown lifting into a green spotlight. |
| Rouleau Compresseur | `ecrasant` | A heavy gold-chain steamroller flattening a row of tiny microphones — total domination. |
| Photo Finish | `photofinish` | Two microphones neck-and-neck crossing a checkered finish line, one edging ahead by a pixel. |
| Le Sniper | `sniper` | A golden microphone built like a sniper scope, crosshair locked dead-center on a spinning vinyl bullseye. |
| La Machine | `machine` | A boombox packed with pistons and gears, blasting steady sound-wave rings — an unstoppable rap machine. |
| Réflexe Éclair | `reflexe` | A hand slamming a red buzzer at lightning speed, electric acid-green sparks flying off. |
| Sans-Faute | `sansfaute` | A clean spray-painted green check mark on a brick wall, the tag still dripping fresh, flawless lines. |
| Le Puriste | `puriste` | A diamond-studded vinyl record held up like a holy relic in two hands, reverent glow. |
| Le Gros Move | `diamant` | A single huge diamond bursting out of a cracked speaker cone, shards flying. |
| Cavalier Seul | `solo` | A lone rapper under one narrow spotlight on an otherwise dark empty stage, mic raised high. |
| Le Métronome | `metronome` | A gold metronome ticking, its pendulum a small microphone, perfectly steady beat lines. |
| Le Diesel | `diesel` | An old lowrider backfiring a puff of smoke then rocketing forward on acid-green flames — slow start, big finish. |
| Le Sage | `sage` | A calm hooded rapper sitting cross-legged, a halo of small vinyls floating around his head, zero bling — pure talent. |
| Le Perdant Magnifique | `perdantmagnifique` | A rapper on the 2nd-place podium step tossing confetti anyway, huge proud grin despite the silver. |
| La Ceinture | `champion` | A championship boxing belt with a golden microphone as its center medallion, the rap king's belt. |

### Salés (chambrage / cartoon)

| Trophée | id | [SCÈNE] |
|---|---|---|
| La Mitraillette | `mitraillette` | A graffiti spray can shaped like a tommy gun, spraying a wild hail of tiny microphones everywhere. |
| Feu de Paille | `feudepaille` | A firework-microphone that bursts bright then fizzles down into a sad little curl of smoke. |
| Le Braqueur | `braqueur` | A masked rapper in a bandana snatching a gold chain, a loot bag with a dollar sign over his shoulder. |
| Le Kamikaze | `kamikaze` | A rapper riding a rocket-powered microphone shooting straight up, two dice tumbling beside him — all in. |
| Le Sans-Pitié | `sanspitie` | A crowned rapper standing over rivals' turned-out empty pockets, gold coins raining into his open hand. |
| L'Escroc | `escroc` | A sly grinning rapper with an ace card up his sleeve, winking, wearing an obviously fake plastic gold chain. |
| Le Rendement | `boulet` | A rapper tangled in his own mic cable dragging a ball-and-chain, score meter stuck near empty. |
| Le Fantôme | `fantome` | A translucent ghost-rapper floating, his hand passing right through a microphone, a big zero on the meter. |
| Le Muet | `muet` | A dusty forgotten microphone with a spider web on the stand and a zipped-shut mouth icon beside it. |
| La Lanterne Rouge | `lanterne` | A weary rapper at the very back of the pack holding up a glowing red lantern in the dark. |
| Le Touriste | `touriste` | A rapper in a loud flowery tourist shirt with a camera and a folded map — no mic in sight, just visiting. |
| Le Frimeur | `frimeur` | A rapper buried under a ridiculous mountain of fake gold chains, tripping over them, a last-place ribbon pinned on. |
| Le Radin | `radin` | A stingy rapper clutching a thick fan of unused power-up cards to his chest, a moth fluttering out of his empty wallet. |

## Câblage (quand les images seront prêtes)
- Déposer chaque PNG dans `client/public/trophies/<id>.png`.
- Ajouter la règle **LFS** : `client/public/trophies/*.png filter=lfs diff=lfs merge=lfs -text` dans `.gitattributes`.
- Basculer l'affichage icône → image : dans le palmarès (Player + `HubBrowse` + cartes de fin `Host`),
  afficher `<img src="/trophies/<id>.png">` si présente, sinon garder `awardIcon()` en repli.
