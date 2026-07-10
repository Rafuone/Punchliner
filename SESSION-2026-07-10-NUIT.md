# Session autonome — nuit du 2026-07-10 (débrief)

Salut Alexandre. Voici ce qui a été fait pendant que tu dormais, en mode « brute » mais **prudent** :
chaque bloc est **commité** (arbre jamais cassé), vérifié `tsc` + `vite build`, et pour beaucoup
vérifié en vrai (test headless / navigateur).

⚠️ **AVANT DE TESTER : redémarre le serveur** (port 3001) — il garde le pool + l'état en mémoire, donc
les correctifs **serveur** (buzzer, survivor, scoring, pouvoirs, filtre thème) ne s'appliquent qu'après relance.
Puis recharge le client (Ctrl+F5).

---

## 🛠️ Les 2 OUTILS que tu m'as demandés (le gros gain de temps)

### 1. Le SHOWROOM — `http://localhost:5173/showroom`
Toutes les interfaces (TV + téléphone), **les VRAIES pages** (pas de maquette approximative) : je monte
les vrais composants `Host`/`Player` pilotés hors-ligne par un mock. Donc **c'est exact au pixel**.
- Nav à gauche : 📺 Écran/TV (lobby, prep, blind, reveal, podium, buzzer, quiz, survivor) · 📱 Téléphone
  (formulaire, prep, jeu, reveal, buzz, quiz, fin, salle d'attente).
- **Le téléphone s'affiche DANS un cadre de téléphone** (390px) → tu vois exactement le rendu mobile. La TV
  est en 16:9. Bouton **« ↻ Rejouer l'anim »** pour revoir les animations d'entrée.
- **Boîte de retours par page** (en bas) : tu écris, tu **postes**, ça s'enregistre dans **`RETOURS-SHOWROOM.md`**
  (rangé par page). Ensuite tu me dis **« corrige les retours du showroom »** et je pioche dedans. (Si le serveur
  n'est pas lancé, ça garde en local + bouton ↓ pour télécharger le .md.)
- Le formulaire → clique « Entre dans le cercle » pour ouvrir le **character-select** (interactif).
- ⚠️ L'audio des extraits et l'enregistrement des retours ont besoin du serveur (`npm run dev`).

### 2. La BASE MUSICALE — `http://localhost:5173/base-musicale.html`
Les **1986 titres jouables** du blind-test, classés par difficulté curée (Grand public 262 · Connaisseur 647
· Digger 612 · Puriste 465) + **507 exclus** (non-rap). Recherche, filtres par bande, **écoute des extraits**,
tri. Dis-moi ce qui est mal classé / à retirer et je réapplique. (Idéal pour vérifier le Quiz aussi plus tard.)

---

## ✅ CORRECTIFS APPLIQUÉS (par commit)

**Bugs bloquants** (`8b087cc`)
- Son qui ne s'arrête plus + **softlock buzzer** (race play/pause : le pause du buzz était « avalé »). Corrigé
  Deezer + Spotify + reprise buzz. **À confirmer en live** (dépend du timing réseau réel).
- **Pouvoirs = UNIQUEMENT Blind Test** (plus en Buzzer/Quiz) : fenêtre + activation + jauge.
- **SFX scratch** trop long → **scratch de platine SYNTHÉTISÉ** (~140 ms, vif, coupable net). Tunables dans `sfx.ts`.
- **Déblocables** : les 5 (Freeze/Lino/Diam's/Disiz/Caba&JJ) sont **jouables** au character-select (le gating cassé retiré).

**Cycle 1** (`63a4071`)
- Thème **« Love / RnB » retiré** · **Lorenzo entièrement exclu** · **défaut = Grand public**.
- **Buzzer 8 s → 15 s** pour répondre · mot « BUZZER » qui débordait du disque **corrigé** · +3 bugs buzzer
  (déco du buzzeur, plafond qui tronquait la réponse, réponse vide).
- **Musique du Quiz réparée** (instru Alpha Wann en fond doux tout le long).
- **Cap des charges 5 → 3** (au-delà ça ne charge plus → force à jouer).
- **Alias « NTM » = Suprême NTM** (+ Gims, Sexion, Psy 4) · **prime titre+artiste +5000 → +10000** · **Diamant 50k → 46k**.

**Cycle 2a — logique** (`88fe22b`)
- **Survivor** : les 1ers sons sont désormais **garantis grand public** (fenêtre proportionnelle + plafond de bande).
- **BUG filtre thème** (haute sév.) : les thèmes sélectionnés **ne filtraient rien** (`theme` au lieu de `themes`) → corrigé.

**Cycle 2b — pouvoirs + playlists** (`e606665`)
- **Bannière GÉANTE** à chaque activation de pouvoir sur la TV (« MOMO ACTIVE VOL — effet ») + **explicatif**
  « c'est quoi un pouvoir ? » à la 1re fenêtre. Répond à « on comprend pas quand ça s'active ».
- **Aperçu d'artistes** sous chaque playlist (drill→Gazo/Freeze…, marseille→Jul/SCH/Alonzo…) pour se projeter.

**Cycle 2c — UI TV** (`21eecea`)
- **Boutons flottants** (barre en bas + dégradé) au reveal / podium / pupitre MJ.
- **Ladder densifié** (tient sur la TV, plus de scroll) · **anim de changement de place** (montée/descente) ·
  **réactions grossies** qui remontent plus haut · **arrivée d'un perso** un peu réduite (bouton plus collé en bas).

**Showroom + base musicale** (`13ae46e`, `88fe22b`) — voir plus haut.

---

## ⏳ DÉFÉRÉ (fait exprès, pour ne rien casser de nuit)
- **Séparation podium / classement de série** en 2 écrans + **« Rejouer (mêmes réglages) »** : le plan est prêt,
  mais il **entre en conflit** avec les boutons flottants (les deux restructurent la fin du podium). À appliquer
  proprement **en bloc** (revue ensemble). Le plan est en mémoire.
- **Quiz plus fun** (questions humour type « qui n'a PAS été clashé par Booba ? », streams, « finis la punchline »)
  : à écrire **à la main** (véracité critique — pas une flotte d'agents). J'ai laissé ça pour qu'on le fasse au propre.
- **Question Heuss l'Enfoiré** (réponse dans l'énoncé) : à corriger dans `quiz-bank.json` (à retrouver ensemble).
- **Approfondir le pool grand public** (>262) : nécessite de résoudre un canon sur Deezer (réseau) → à faire quand tu es là.
- **Intégration du CLASH** dans la vraie boucle (jamais déclenché en soirée) : gros morceau, risqué de nuit → à finir ensemble.
- **Anim d'arrivée / nouveaux persos** affinée, **MJ dans le showroom** : petits + à peaufiner via tes retours showroom.

Tout le détail des retours de la soirée est dans **`CORRECTIFS.md`**.

---

## 📌 À décider / à me dire
1. **Diamant à 46k + prime +10000** : à sentir en jeu (peut-être encore ajustable).
2. **Scratch synthétisé** : écoute-le (active un pouvoir) — si le « zig » ne te plaît pas, les paramètres sont
   commentés en haut de `sfx.ts` (S1/GAP/S2, sweeps). Dis-moi « plus court / plus aigu / deux coups » etc.
3. **Volume musique en Grand public** : tu voulais un peu plus fort — dis-moi le mode/écran précis et je pousse.
4. Utilise le **showroom** : poste tes retours par page, puis « corrige les retours du showroom ».
