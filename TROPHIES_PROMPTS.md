# PUNCHLINR — Prompts des visuels de trophées (v2 : simples & lisibles)

Retour du proprio sur la v1 : **trop chargé** (mec qui sort d'un ring + ville rouge + couronne + halo vert
partout = « bordel sans nom », et plus il y a de détails, plus la génération se plante). On repart propre.

## Règles (les respecter à la lettre)
- **UN SEUL emblème/objet, gros et lisible.** Pas de scène, pas de décor, pas de personnage entier, pas de
  fond compliqué (ni ville, ni ring, ni foule). Un pictogramme, façon **icône de jeu**.
- **Ça reste PETIT sur la TV** (une tuile carrée, pas la moitié de l'écran) → il faut que ça se lise d'un
  coup d'œil. Formes **épaisses**, contours nets, silhouette claire.
- **Palette limitée (2–3 couleurs)** : un objet + un accent + un fond sombre uni. **PAS de vert partout** —
  on **varie l'accent** d'un trophée à l'autre (voir colonne « accent »). Le vert reste possible, mais rare.
- **Moins de détails = moins d'erreurs.** Dans le doute, simplifie encore.

## LE PROMPT (colle-le, change juste `[ACCENT]` et `[OBJET]`)

```
16-bit pixel art game icon, single centered object, flat and bold, thick clean outline, crisp visible
pixels, minimal shading (2 tones max on the object). Limited palette: [ACCENT] object on a plain dark
charcoal background (near-black), one soft glow of the accent color behind it. No scene, no landscape, no
character, no extra props, no text, no letters, no logo. Readable at small size, high contrast, iconic.
Object: [OBJET]
```

- **[ACCENT]** = la couleur dominante de l'objet (colonne du tableau).
- **[OBJET]** = un seul objet simple, imagerie rap/hip-hop (micro, chaîne, cassette, couronne, dé, etc.).
- Cible fichier : `client/public/trophies/<id>.png` (carré ~256×256). `id` = colonne du tableau.

## Les trophées

### Flatteurs

| Trophée | id | accent | [OBJET] |
|---|---|---|---|
| Comeback King | `comeback` | or | a golden crown with a small upward arrow just under it |
| Rouleau Compresseur | `ecrasant` | rouge | a chunky steamroller drum, simple front view |
| Photo Finish | `photofinish` | blanc/rouge | a single checkered racing flag on a short pole |
| Le Sniper | `sniper` | cyan | a clean crosshair reticle centered on a single dot |
| La Machine | `machine` | bleu acier | a single cog wheel with a tiny sound-wave arc |
| Réflexe Éclair | `reflexe` | jaune | one bold lightning bolt |
| Sans-Faute | `sansfaute` | vert | one thick check mark |
| Le Puriste | `puriste` | blanc glacé | one brilliant-cut diamond |
| Le Gros Move | `diamant` | bleu glacé | a vinyl record with a diamond gem as its center label |
| Cavalier Seul | `solo` | ambre | a single downward spotlight beam cone |
| Le Métronome | `metronome` | turquoise | one classic metronome, pendulum centered |
| Le Diesel | `diesel` | orange | a single snail with a tiny exhaust puff |
| Le Sage | `sage` | blanc doré | one single feather |
| Le Perdant Magnifique | `perdantmagnifique` | argent | a silver second-place medal on a short ribbon |
| La Ceinture | `champion` | or | a championship belt buckle, oval, a star in the middle |

### Salés (chambrage)

| Trophée | id | accent | [OBJET] |
|---|---|---|---|
| La Mitraillette | `mitraillette` | rose fluo | a single graffiti spray can, nozzle up |
| Feu de Paille | `feudepaille` | orange-rouge | one burning match, flame leaning into a wisp of smoke |
| Le Braqueur | `braqueur` | anthracite/rouge | a single black bandit balaclava mask |
| Le Kamikaze | `kamikaze` | rouge | one tumbling dice showing a single pip |
| Le Sans-Pitié | `sanspitie` | cramoisi | a clenched fist wearing a chunky gold ring |
| L'Escroc | `escroc` | violet | a single ace playing card with a small hidden card behind it |
| Le Rendement | `boulet` | gris fer | one iron ball-and-chain |
| Le Fantôme | `fantome` | cyan pâle | one simple pixel ghost |
| Le Muet | `muet` | gris | a microphone crossed out by a red no-sound slash |
| La Lanterne Rouge | `lanterne` | rouge | one glowing red paper lantern |
| Le Touriste | `touriste` | teal | one small tourist camera with a neck strap |
| Le Frimeur | `frimeur` | or clinquant | one oversized gold dollar-sign chain medallion |
| Le Radin | `radin` | vert billet/gris | a closed padlock over a single coin |

## Câblage (quand les images seront prêtes)
- Déposer chaque PNG dans `client/public/trophies/<id>.png`.
- Règle LFS : `client/public/trophies/*.png filter=lfs diff=lfs merge=lfs -text` dans `.gitattributes`.
- Basculer icône → image : afficher `<img src="/trophies/<id>.png">` si présente, sinon `awardIcon()` en repli
  (palmarès Player + `HubBrowse` + cartes de fin `Host`).
