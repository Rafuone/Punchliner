# PUNCHLINE

Blind test / quiz de soirée sur le rap français, façon Jackbox : l'écran (télé) affiche un code, les joueurs rejoignent depuis leur téléphone.

## Lancer en local

```bash
npm install
npm run dev
```

- **Écran hôte** (sur la télé / le PC) : http://localhost:5173/host
- **Joueurs** (téléphones sur le même Wi-Fi) : `http://<IP-DE-TON-PC>:5173`
  (trouve l'IP avec `ipconfig` → carte Wi-Fi, IPv4, ex. `192.168.1.42`)

Autorise Node dans le pare-feu Windows (profil **Privé**) au premier lancement, et mets le réseau Wi-Fi en **Privé**.

## Stack

- **client/** — React + Vite + TypeScript, thème liquid glass, Socket.IO client (origine relative → marche en LAN sans reconfig)
- **server/** — Node + Express + Socket.IO, salons en mémoire, résolution des extraits via l'API publique Deezer, matching flou des réponses

## MVP

Blind test multi en mode automatique : salon + code → lobby → manches chronométrées (extrait Deezer 30 s, on tape titre/artiste) → révélation + scores → podium. Les pouvoirs, rivalités, certifications, mode maître du jeu, etc. viennent ensuite (voir la bible du jeu).
