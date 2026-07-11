# EXPLORATION 9901 — mode solo (idéation)

Prototypes de concept pour le **mode solo** de PUNCHLINR. Ce n'est **pas** encore intégré au jeu — ce sont
des maquettes autonomes pour se projeter. On reprendra plus tard.

> **Nom « 9901 »** = punchline d'Hautain : *arrivé au niveau 99, trop fort, tu repars au 01.* → c'est la
> mécanique : on grimpe 01→99, à 99 on **prestige** et on repart de zéro (roguelike + montée de niveaux RPG).

## La direction validée (après itérations avec Alexandre)
- **PAS de blind-test, PAS de « devine plus vite », PAS de sélection d'attaque au menu, PAS d'écriture de
  punchlines** (Alexandre n'est pas rappeur → les bars sont pré-écrites, on les *performe*).
- **Un jeu qui se VIT, pas qui se lit.** Gameplay **au clavier**, **rythmé**, lié à la **musique**.
- **Vue façon Pokémon** (MC de dos au premier plan, ennemi en face), plus détaillée, 8/16-bit « cool ».
- Le perso **bouge** (gestes de MC sur le beat, lève le mic quand il spitte), **mic drop** à la victoire.
- **Trash-talk** en boîte de dialogue **entre les phases** (validé). Message de défaite « repars au 01 » gardé.
- **Roguelike** : bonus entre les combats, ennemis **aléatoires**, les **2 derniers fixes** = **Lieutenant + Boss**.
- **MODE FEU** quand le public est plein (couplet ×2, le beat s'emballe).

## Le scénario (gros récit street)
- Come-up depuis rien : tu rappes dans ta chambre, un pote t'entend, premiers lives qui ne prennent pas, puis un buzz.
- Tu découvres des **machinations** (trafic, carrières truquées, talents enterrés) tenues par un **patron dans l'ombre**,
  révélé à la fin. Sous-intrigues (le pote qui trahit, la rappeuse enterrée, le label piège…).
- Tour de France région par région (Marseille/vétéran, 9-3/drill, Paris/plume, Lyon, Lille…).
- **Scène post-générique façon Avengers** (16-bit) : le patron FR n'était qu'un pion → un **Américain** dans l'ombre
  (gag interne : **Jay-Z**) → teaser « à suivre : 9902 ».

## Les fichiers
- **`demo-flow-9901.html`** — ⭐ LA bonne piste : affrontement de rap **au clavier** (flèches sur le beat), vue Pokémon,
  trash-talk, mic drop, bonus roguelike. Boucle complète jouable (intro→couplet→dégâts→victoire→bonus→combat suivant).
- `exploration-9901.html` — page de pitch visuelle (scénario / mécanique / carte / post-générique), écran d'arcade néon.
- `demo-clash-9901.html` — 1re tentative (clic sur des cartes de « bars ») — **abandonnée** (trop « browser game », pas fun).
  Gardée pour archive (la mécanique de combo par rimes + faiblesse de style peut resservir).

## Reste à faire (quand on reprend)
- Régler le **feeling du timing** du rythme (fenêtre de hit, vitesse des notes) — le seul truc non validé (demande un humain).
- Plus de **jus** (persos plus détaillés, KO/mic drop plus épiques, plus d'anims MC).
- Enchaîner le **scénario** entre les combats (dialogues, sous-intrigues, la carte de France).
- Décider de **l'intégration** : c'est un jeu à part du « mode soirée » (multi/QR) → sans doute un menu séparé.
- Brancher de **vrais extraits** / instrus (le beat actuel est synthétisé WebAudio pour la démo).
