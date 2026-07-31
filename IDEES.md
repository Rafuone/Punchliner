# IDÉES — modes de jeu au chaud

> Concepts validés en discussion mais **volontairement pas commencés** (on finit les chantiers ouverts
> d'abord). Les retours/bugs actionnables vivent dans `CORRECTIFS.md` ; ici c'est le **design** des modes
> futurs, avec les décisions déjà prises pour ne pas refaire le débat.
>
> Décidé le 2026-07-15 avec Alexandre.

---

## 1. « Complète la punchline » — PRIORITÉ SI ON EN LANCE UN

**Le pitch.** L'extrait joue. À la punchline, **la voix se coupe mais le beat continue** — le moment où le
rappeur tend le micro au public. Les joueurs tapent le mot manquant sur leur téléphone. **Révélation : la
voix revient** et on entend le vrai mot dans le morceau.

**Pourquoi ce mode.** C'est le plus « PUNCHLINR » de tous (c'est dans le nom). Il réutilise le moteur
existant presque tel quel : extrait audio + `server/match.js` (matching tolérant aux fautes) +
`speedMult` (prime de vitesse). Son coût est du **contenu**, pas de la technique.

**Décisions de design actées :**
- **Ne pas couper tout le son.** Couper la voix, garder l'instru (isolation via **Demucs**, déjà outillé
  au chantier gimmicks — voir `project-gimmicks-shelved`). Le silence sec crée un blanc gênant et casse
  l'énergie ; le beat qui tourne fait office de compte à rebours naturel (~8 s).
- **MVP possible sans Demucs** : coupure sèche du son. Même jeu, moins classe. Voie d'entrée valable.
- **Le moment TV = la révélation** : on entend la vraie voix dire le mot → les têtes se relèvent.
- **Tout passe par l'AUDIO, on n'affiche pas la punchline en texte.** Double raison : (1) les paroles sont
  sous droits — faire deviner *un mot* est un usage minimal, mais afficher le texte à l'écran = zone grise
  si le jeu sort un jour ; (2) c'est meilleur pour le jeu — on entend, on complète, c'est plus rap.
- **Saisie libre, pas QCM** : le kiff c'est de sortir le mot de sa tête ; le QCM tue le « j'ai la ref ».
  Choisir des punchlines dont le mot manquant est **court** → frappe rapide.
- ⚠️ Adapter le matching : `match.js` tolère ~20 % de Levenshtein, ce qui sur un mot de 4 lettres revient
  à exiger l'exact. À ajuster, + accepter les variantes (pluriel, verlan, orthographes).

**Le vrai coût :** corpus **fait main** (~150 punchlines à choisir + timecoder). Rien d'automatisable :
il faut du jugement humain sur ce qui est culte. Même nature de travail que la banque de quiz.

**Déjà en germe dans le backlog :** `CORRECTIFS.md` → `(QUIZ-IDÉE) « Finis la punchline »` — avec la
contrainte utile : en Grand public, **uniquement** des punchlines archi-connues de sons archi-connus.

---

## 2. « Le juste prix du rap » — estimation au curseur

**Le pitch.** Question à réponse chiffrée. Chacun place un **curseur** sur son téléphone, le plus proche
marque. Révélation animée sur la TV.

**Pourquoi c'est bon.** Le curseur est parfait sur mobile. Tout le monde a un avis même sans être expert
(**inclusif**), et la révélation est un vrai moment collectif. Zéro tête baissée.

**Le risque réel :** ça peut virer **trivia scolaire** et ressembler au Quiz en moins bien. Ce qui le
sauve = le **type de question** : l'estimation doit être **intuitive mais incertaine** — tout le monde a
un feeling, personne n'est sûr. La question doit se **débattre**, pas se réciter.
- ❌ « En quelle année est sorti X » = par-cœur, sec.
- ✅ « Quel âge avait X sur son premier album », « combien de semaines n°1 » = feeling, débat, cris.

**⚠️ Piège technique majeur — ne pas utiliser les années Deezer comme vérité.** Le pool est truffé de
**rééditions** (on déduplique déjà pour ça dans `tierSlice`), et on s'est déjà fait avoir avec QALF daté
2020. Une donnée fausse dans un jeu de culture = décrédibilisation immédiate en soirée. Comme pour le
quiz : **vérification à la main**, pas de génération auto (véracité critique).

**Le vrai coût :** une base de données vérifiée à la main. C'est un chantier de **données**, pas de jeu.

---

## 3. Mode rythme (type Guitar Hero) — PARKÉ, mais pas mort

**L'idée initiale.** Jusqu'à 4 joueurs, la musique tourne, chacun tape des flèches en rythme sur son
téléphone.

**Conclusion de l'analyse de faisabilité (2026-07-15) :**

**La latence réseau n'est PAS le bloqueur.** La règle : on ne juge jamais le timing à l'arrivée du message
sur le serveur. On horodate le tap **côté téléphone** (position dans la chanson) et on envoie ce timestamp
→ le réseau ne retarde que le *feedback*, pas le *score*. L'infra existe déjà (**`serverNow`**, la sync
d'horloge tel↔TV posée au playtest 3). L'audio doit jouer sur **un seul appareil : la TV** (4 téléphones
qui jouent le même mp3 = cacophonie garantie).

**Les 3 vrais obstacles :**
1. **Le regard** (le plus grave). Flèches sur le tel = 4 joueurs tête baissée, la TV ne sert à rien,
   personne ne se regarde → ça tue l'esprit soirée. Flèches sur la TV = 4 couloirs illisibles de loin
   (cf. `feedback-host-is-a-tv`). C'est un dilemme structurel du genre.
2. **La beatmap.** Le pool = des centaines de titres résolus dynamiquement → impossible à la main.
   Il faudrait générer hors-ligne : détection **BPM** (flèches sur les temps — simple et fiable) ou
   **onsets** (accents réels — plus vivant). Le pipeline audio du chantier gimmicks (ffmpeg/Demucs)
   pourrait servir, avec un cache façon `.pool-cache.json`.
3. **La latence audio de SORTIE** (pas le réseau) : une enceinte/barre **Bluetooth** ajoute 100–300 ms
   entre la position logique et ce que le joueur entend → il tape « en retard » alors qu'il est juste.
   Solution éprouvée : un **calibrateur d'offset** réglable une fois par soirée. À prévoir dès le départ.

**La seule version qui resterait « party » :** un **mode survie à élimination**, pas un Guitar Hero solo.
Tu rates → tu perds une vie → ton avatar **explose sur la TV**, gros son, les autres relèvent la tête pour
voir qui a sauté. Les éliminations ramènent le regard sur l'écran commun ; entre deux extraits, tête haute.
Cousin naturel du **Survivor** et du **CLASH**.

**Et pour le rendre THÉMATIQUE** (sinon c'est un jeu d'adresse générique posé à côté du concept) : isoler
la voix (Demucs) et faire taper **les ad-libs** du rappeur plutôt que des flèches abstraites. Tout le monde
les connaît, c'est marrant, et ça donne un sens rap au tap.

**Décision :** parké. Alexandre : « j'aimerais pas que le gameplay repose uniquement là-dessus ».

---

## Principe transverse (vaut pour tout nouveau mode)

**Quelque chose de spectaculaire doit vivre sur la TV** — une explosion, une révélation, un curseur qui se
fige — pour que les têtes se relèvent régulièrement. Le téléphone est l'**input**, la TV est le
**spectacle qu'on regarde ensemble**. Un mode où les 4 joueurs fixent leur écran n'est pas un party game.
