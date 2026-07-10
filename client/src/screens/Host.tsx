import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { socket } from '../socket';
import { avatarById, initials, DIFFICULTIES, MODES, REBALANCE, MENU_TRACKS, fmtAud, certif, awardIcon, REACTIONS, END_REACTIONS, CERTIF_TIER, UNLOCKS, AVATARS, CATEGORY_COLORS } from '../data';
import ConfigWizard from './ConfigWizard';
import HubBrowse from './HubBrowse';
import ChallengerReveal from './ChallengerReveal';
import GrungeBg from '../GrungeBg';
import { sfx, sfxLoopStop, sfxStop, playAirhorns } from '../sfx';
import { handleSpotifyRedirect, hasSpotifySession, initSpotifyPlayer, resetSpotifyPlayer, spotifyPlay, spotifyPause, spotifyTogglePlay, spotifyLogin, spotifyLogout, listenSpotifyAuth } from '../spotify';

// Démo (?revealdemo) : sélectionner n'importe quel challenger déblocable et rejouer son arrivée épique (vérif visuelle).
const REVEAL_DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).has('revealdemo');

// Fond du lobby (écran du code) : instru d'Alpha Wann. Crossfade vers la playlist (Bishok) à l'entrée du ConfigWizard.
const LOBBY_TRACK = '/music/alphawann-philly-flingo.mp3';

const C = 2 * Math.PI * 54;
const HKEY = 'pl_host';
const SILENT = 'data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAgICAgICAgICAgIA=';
// Petites punchlines qui tournent sous le vinyle (TV, vues de loin) : COURTES = lues en un clin d'oeil.
const PLAY_QUIPS = ['Balance le son', 'Ça sent le classique', "Tends bien l'oreille", 'Prod de malade', 'Devine avant le drop', 'Chuuut... ça arrive', 'Le beat parle pour lui', 'Qui reconnait ?'];

// prénom du podium à taille ADAPTATIVE (façon maillot de basket) : grand si court, réduit s'il déborde
function fitName(el: HTMLDivElement | null, maxW: number, base: number, min: number) {
  if (!el) return;
  el.style.whiteSpace = 'nowrap'; el.style.fontSize = base + 'px';
  const w = el.scrollWidth;
  if (w > maxW) el.style.fontSize = Math.max(min, Math.floor(base * maxW / w)) + 'px';
}

// Un rappeur a-t-il été DÉBLOQUÉ cette partie ? (conditions UNLOCKS, testées par joueur) → id du perso, sinon null.
function computeUnlock(d: any, already: Set<string>): string | null {
  const activeBoard = (d.scores || []).filter((p: any) => !p.isMJ);
  const rounds = d.rounds || 0;
  const diff = d.settings?.difficulty; const mode = d.settings?.mode;
  for (let i = 0; i < activeBoard.length; i++) {
    const p = activeBoard[i];
    const myAwards = (d.awards || []).filter((a: any) => a.playerId === p.id).map((a: any) => a.id);
    const ctx = { won: i === 0, rank: i + 1, certifShort: certif(p.score, rounds).short, awardIds: myAwards, difficulty: diff, mode, rounds };
    const hit = UNLOCKS.find((u) => !already.has(u.id) && u.check(ctx as any)); // JAMAIS un déjà débloqué → il ne réapparaît pas
    if (hit) return hit.id;
  }
  return null;
}

function Med({ avatarId, size = 38 }: { avatarId?: string; size?: number }) {
  const a = avatarById(avatarId);
  return <span className="med" style={{ width: size, height: size, fontSize: Math.round(size * 0.37), background: a?.color || 'linear-gradient(150deg,#7C5CFF,#432E8C)' }}>
    {a?.img ? <img src={`/avatars/${a.id}.png`} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : initials(a?.name || '?')}
  </span>;
}

// "CD" de certification (or / platine / 2×–3× / diamant) : disque métallique qui tourne, avatar au centre
// (label du vinyle). La matière change selon le palier de certif → chacun repart avec sa plaque sur la TV.
function CertifDisc({ score, rounds, size = 92, avatarId }: { score: number; rounds: number; size?: number; avatarId?: string }) {
  const c = certif(score, rounds);
  const tier = CERTIF_TIER[c.short] ?? 0;
  return (
    <span className={`certdisc certdisc-t${tier}`} style={{ width: size, height: size }} title={c.label}>
      <span className="cd-sheen" />
      <span className="cd-grooves" />
      <span className="cd-shine" />
      <span className="cd-label">{avatarId ? <Med avatarId={avatarId} size={Math.round(size * 0.4)} /> : <span className="cd-hole" />}</span>
    </span>
  );
}

// CLASH : couleur d'un combattant = couleur de SA CATÉGORIE (via l'id du rappeur choisi = player.avatar).
const catColor = (id?: string) => CATEGORY_COLORS[avatarById(id)?.cat || ''] || 'var(--fluo)';
// nom du RAPPEUR (l'avatar) — le pseudo du joueur reste .name côté données
const rapName = (id?: string) => avatarById(id)?.name || id || '';
// Vrai/Faux : classe couleur (vert = Vrai, rouge = Faux)
const vfClass = (c: string) => (c === 'Vrai' ? ' vrai' : c === 'Faux' ? ' faux' : '');

export default function Host() {
  const [phase, setPhase] = useState<'connecting' | 'lobby' | 'prep' | 'countdown' | 'playing' | 'reveal' | 'final' | 'rushend' | 'battle-intro' | 'battle-bet' | 'battle-play' | 'battle-reveal'>('connecting');
  const [countdown, setCountdown] = useState(0);
  const [code, setCode] = useState('');
  const [poolSize, setPoolSize] = useState(0);
  const [players, setPlayers] = useState<any[]>([]);
  const [settings, setSettings] = useState({ difficulty: 'normal', mode: 'multi', rounds: 8, mj: false, rebalance: 'comeback' });
  const lastWizRef = useRef<any>(null); // dernier payload de l'assistant → « Rejouer » (Survivor) sans reperdre era/theme/chrono/pace
  const [configuring, setConfiguring] = useState(false);
  const [hubView, setHubView] = useState<null | 'roster' | 'trophies' | 'leaderboard' | 'radio'>(null); // consultation roster / palmarès / classement / radio sur la TV
  // Easter egg : code Konami (↑↑↓↓←→←→ B A) → pluie des portraits + flash « CHEAT » sur la TV (visuel pur pour l'instant).
  const [cheat, setCheat] = useState<any[] | null>(null);
  const cheatTimer = useRef<any>(null);
  function triggerCheat() {
    const pool = AVATARS.filter((a) => a.img);
    const drops = Array.from({ length: 56 }, () => { const a = pool[Math.floor(Math.random() * pool.length)]; return { id: a.id, x: Math.random() * 100, s: Math.round(46 + Math.random() * 74), d: +(Math.random() * 1.3).toFixed(2), dur: +(2 + Math.random() * 1.7).toFixed(2), rot: Math.round((Math.random() * 2 - 1) * 540) }; });
    setCheat(drops); playAirhorns();
    clearTimeout(cheatTimer.current); cheatTimer.current = setTimeout(() => setCheat(null), 4300);
  }
  useEffect(() => {
    const seq = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
    let idx = 0;
    const h = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (k === seq[idx]) { idx++; if (idx === seq.length) { idx = 0; triggerCheat(); } } else idx = (k === seq[0] ? 1 : 0); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);
  const [powerFeed, setPowerFeed] = useState<any[]>([]); // pouvoirs activés (qui + quoi + effet) → mis en avant sur la TV
  const powerKeyRef = useRef(0);
  const [powerBanner, setPowerBanner] = useState<any>(null); // bannière GÉANTE d'activation d'un pouvoir (TV, vue de loin) — auto-masquée
  const powerBannerTimer = useRef<any>(null);
  const [round, setRound] = useState<any>({ index: 0, total: 0, endsAt: 0, durationMs: 25000, mode: 'multi', difficulty: '' });
  const [answered, setAnswered] = useState<string[]>([]);
  const [buzzWinner, setBuzzWinner] = useState<{ name: string; avatar?: string | null; endsAt?: number; answerMs?: number } | null>(null);
  const [reveal, setReveal] = useState<any>(null);
  const [battle, setBattle] = useState<any>(null); // manche CLASH (1v1 + paris) : {a,b,flavor,tallyA,tallyB,endsAt,betMs,durationMs,reveal}
  const [revealStep, setRevealStep] = useState(0); // 0 = réponses seules · 1 = + classement (on affiche l'un PUIS l'autre)
  const [rankAnim, setRankAnim] = useState(false); // reveal : anim climb/drop RETARDÉE (visible) — off au montage, puis on après un court délai
  const [finalScores, setFinalScores] = useState<any[]>([]);
  const [awards, setAwards] = useState<any[]>([]);       // trophées de la partie qui vient de finir
  const [finalStep, setFinalStep] = useState<'podium' | 'trophies'>('podium'); // fin de partie : podium → showcase trophées
  const [troIdx, setTroIdx] = useState(-1);              // index du trophée AFFICHÉ (-1 = aucun encore)
  const [troBusy, setTroBusy] = useState(false);         // pendant l'animation slot
  const [troSlot, setTroSlot] = useState<any>(null);     // item qui défile pendant le slot
  const [troCd, setTroCd] = useState(0);                 // décompte auto avant le trophée suivant
  const troTimer = useRef<any>(null);
  const troCdRef = useRef<any>(null);
  const [series, setSeries] = useState<any>(null);       // cumul de la série (multi-parties)
  const unlockedRef = useRef<Set<string>>(new Set((() => { try { return JSON.parse(localStorage.getItem('pl_unlocked') || '[]'); } catch { return []; } })())); // challengers DÉJÀ débloqués (persistés) → on ne les redéclenche jamais
  const [pendingUnlock, setPendingUnlock] = useState<string | null>(null); // rappeur débloqué cette partie (arrivée du Challenger)
  const [showReveal, setShowReveal] = useState(false);   // l'overlay d'arrivée est en cours
  const [finalRounds, setFinalRounds] = useState(0);     // nb de manches de la partie (pour la certif)
  const [rushEnd, setRushEnd] = useState<any>(null);     // fin de run Survivor (résultats + top 10 mondial)
  const [waiting, setWaiting] = useState(0);             // joueurs en salle d'attente
  const [error, setError] = useState('');
  const [joinBase, setJoinBase] = useState(window.location.origin.replace(/\/$/, ''));
  const [now, setNow] = useState(Date.now());
  const clockOffset = useRef(0); // horloge serveur-autoritaire → le décompte TV et téléphone dérivent du MÊME temps
  const [reactions, setReactions] = useState<any[]>([]); // taunts flottants (façon Meet)
  const reactKeyRef = useRef(0);
  const [prepEndsAt, setPrepEndsAt] = useState(0);
  const [prepReady, setPrepReady] = useState<{ count: number; total: number }>({ count: 0, total: 0 });
  const previewRef = useRef<any>({ url: '', clipMs: 30000, startAt: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clipTimer = useRef<any>(null);
  const audioRetryRef = useRef<any>(null);   // relances programmées quand le son échoue (auto-réparation)
  const wantAudioRef = useRef(false);         // true = un extrait DOIT être en train de jouer (manche en cours)
  const seekedUrlRef = useRef<string>('');    // extrait déjà positionné au startAt → on ne rembobine PAS à chaque reprise (auto-réparation)
  const menuAudioRef = useRef<HTMLAudioElement | null>(null);
  const [nowPlaying, setNowPlaying] = useState(-1);
  const [musicOn, setMusicOn] = useState(true);
  const musicOnRef = useRef(true);
  const startedRef = useRef(false);
  const curRef = useRef(-1);
  const lobbyAudioRef = useRef<HTMLAudioElement | null>(null); // instru du lobby (Alpha Wann), en boucle
  const configuringRef = useRef(false);
  const [spState, setSpState] = useState<string>('idle'); // Spotify : idle | connecting | ready | offline | premium_required | auth_error | error | no_token
  const spReadyRef = useRef(false);                        // true = lecteur Spotify prêt
  const [spotifyOn, setSpotifyOn] = useState(true);        // source Spotify activée (prioritaire si prête)
  const [deezerOn, setDeezerOn] = useState(true);          // source Deezer activée (repli)
  const spotifyOnRef = useRef(true);
  const deezerOnRef = useRef(true);
  const usingSpotifyRef = useRef(false); // source RÉELLEMENT en cours pour la manche (≠ capacité) → la reprise après buzz vise la bonne
  const buzzActiveRef = useRef(false); // buzzer : un buzz est en cours → bloque tout (re)démarrage d'extrait (le son reste coupé pendant la réponse)
  const audioReadyRef = useRef(false);   // l'autoplay a-t-il été débloqué par un geste ? false au reload à froid (TV rechargée en pleine partie)
  const [audioLocked, setAudioLocked] = useState(false); // reload en pleine partie sans geste → autoplay bloqué → on affiche « cliquer pour le son »

  // Lecture d'une manche : Spotify si activé+prêt (extrait au milieu contrôlé), sinon Deezer.
  function playRound(d: any) {
    if (buzzActiveRef.current) return; // un buzz est en cours → on NE (re)démarre PAS le son (il doit rester coupé le temps de la réponse)
    const useSp = spotifyOnRef.current && spReadyRef.current && d?.sp?.title;
    if (useSp) {
      usingSpotifyRef.current = true;
      wantAudioRef.current = false; try { audioRef.current?.pause(); } catch {} // on laisse la main à Spotify
      // introuvable sur Spotify → on retombe TOUJOURS sur Deezer (au moins une source doit sonner, même si Deezer est « éteint » côté préférence : mieux vaut du son que le silence)
      spotifyPlay(d.sp.title, d.sp.artist, (d.startAt || 0) > 0).then((ok) => { if (buzzActiveRef.current) { try { spotifyPause(); } catch {} return; } if (!ok) { usingSpotifyRef.current = false; playPreview(d.preview, d.startAt); } }); // un buzz arrivé PENDANT le play() Spotify en vol (recherche réseau) serait avalé → on recoupe à la résolution (buzzActiveRef seul : wantAudioRef reste volontairement false en lecture Spotify)
    } else { usingSpotifyRef.current = false; playPreview(d.preview, d.startAt); }
  }
  // Bascule d'une source (au moins UNE reste toujours active → jamais de silence).
  function toggleSpotify() {
    if (spState !== 'ready') { if (spState === 'auth_error' || spState === 'error') spotifyLogout(); if (spState !== 'premium_required') spotifyLogin(); return; } // pas connecté → login
    const nv = !spotifyOn; setSpotifyOn(nv); spotifyOnRef.current = nv;
    if (!nv && !deezerOnRef.current) { setDeezerOn(true); deezerOnRef.current = true; } // Spotify off alors que Deezer off → on rallume Deezer
  }
  function toggleDeezer() {
    const nv = !deezerOn;
    if (!nv && !(spotifyOnRef.current && spState === 'ready')) return; // ne pas éteindre Deezer si Spotify n'est pas prêt à prendre le relais
    setDeezerOn(nv); deezerOnRef.current = nv;
  }

  // Spotify : au montage, on absorbe un éventuel retour OAuth (?code=) puis on (re)connecte le lecteur si session.
  useEffect(() => {
    (async () => {
      await handleSpotifyRedirect();
      let backToRadio = false;
      try { backToRadio = localStorage.getItem('pl_radio_return') === '1'; if (backToRadio) localStorage.removeItem('pl_radio_return'); } catch {}
      if (hasSpotifySession()) {
        setSpState('connecting');
        initSpotifyPlayer((s) => { setSpState(s); spReadyRef.current = (s === 'ready'); });
      }
      // reconnexion lancée DEPUIS la radio → on rouvre la radio au retour (sinon on retombe au lobby = boucle)
      // que le token soit OK (playlists) ou KO (message d'erreur ⚙ précis affiché) — plus de retour au lobby dans le vide.
      if (backToRadio) setHubView('radio');
    })();
  }, []);

  // Auth Spotify en POPUP : la fenêtre principale reçoit le code (postMessage) → on init le lecteur SANS
  // recharger l'app (l'hôte reste dans sa partie). Corrige aussi l'incohérence "hub déconnecté / radio connectée".
  useEffect(() => listenSpotifyAuth((ok) => {
    if (!ok) return;
    resetSpotifyPlayer(); // token FRAIS après le popup → on détruit l'ancien player (sinon initSpotifyPlayer no-op et le pill reste grisé)
    setSpState('connecting');
    initSpotifyPlayer((s) => { setSpState(s); spReadyRef.current = (s === 'ready'); });
    window.dispatchEvent(new Event('pl-spotify-connected')); // notifie la radio (si ouverte)
  }), []);

  function applyState(state: any) {
    setPlayers(state.players || []);
    setSettings((s) => ({ ...s, difficulty: state.settings?.difficulty || s.difficulty, mode: state.settings?.mode || s.mode }));
    if (state.phase === 'playing' && state.round) {
      setRound(state.round); setBuzzWinner(state.buzz?.winnerName ? { name: state.buzz.winnerName, avatar: state.buzz.winnerAvatar, endsAt: state.buzz.endsAt || 0, answerMs: state.buzz.answerMs || 15000 } : null); setNow(Date.now()); setPhase('playing');
      if (state.round.mode === 'rush' && state.round.scores) setPlayers(state.round.scores);
      playRound(state.round);
    } else if (state.phase === 'rushend') {
      setRushEnd(state.rushEnd); setPhase('rushend');
    } else if (state.phase === 'prep' && state.round) {
      setRound(state.round); setPrepEndsAt(state.round.endsAt || 0); setPrepReady({ count: 0, total: 0 }); setNow(Date.now()); setPhase('prep');
    } else if (state.phase === 'reveal' && state.reveal) {
      setReveal(state.reveal); setPlayers(state.reveal.scores); if (state.round) setRound((r: any) => ({ ...r, ...state.round })); setPhase('reveal');
    } else if (state.phase === 'final' && state.final) {
      setFinalScores(state.final.scores); setAwards(state.final.awards || []); setSeries(state.final.series || null); setFinalRounds(state.final.rounds || round.total || 0); setPhase('final');
    } else if (typeof state.phase === 'string' && state.phase.startsWith('battle') && state.battle) {
      // reprise en pleine manche CLASH : on restaure l'état si le serveur le fournit, sinon repli lobby
      setBattle(state.battle); setNow(Date.now()); setPhase(state.phase);
      if (state.phase === 'battle-play' && state.battle.preview) playRound(state.battle);
    } else setPhase('lobby');
  }

  useEffect(() => {
    const boot = () => {
      let saved: any = null;
      try { saved = JSON.parse(localStorage.getItem(HKEY) || 'null'); } catch {}
      if (saved?.code && saved?.hostToken) {
        socket.emit('host:reclaim', saved, (res: any) => {
          if (res?.ok) { setCode(res.code); setPoolSize(res.poolSize); applyState(res.state); }
          else { localStorage.removeItem(HKEY); create(); }
        });
      } else create();
    };
    const create = () => socket.emit('host:create', {}, (res: any) => {
      if (res?.ok) { setCode(res.code); setPoolSize(res.poolSize); setPhase('lobby'); localStorage.setItem(HKEY, JSON.stringify({ code: res.code, hostToken: res.hostToken })); }
    });
    if (socket.connected) boot();
    socket.on('connect', boot);
    socket.on('lobby', (d: any) => { setError(''); setPlayers(d.players); setRound((r: any) => ({ ...r, total: d.totalRounds })); setWaiting(d.waiting || 0); if (typeof d.poolSize === 'number') setPoolSize(d.poolSize); if (d.phase === 'lobby') { setPhase('lobby'); sfxLoopStop(); } });
    socket.on('round:prep', (d: any) => { if (typeof d.serverNow === 'number') clockOffset.current = d.serverNow - Date.now(); setError(''); setReveal(null); setAnswered([]); setBuzzWinner(null); setPowerFeed([]); setRound((r: any) => ({ ...r, index: d.index ?? r.index, total: d.total ?? r.total })); setPrepEndsAt(d.endsAt || 0); setPrepReady({ count: 0, total: 0 }); setNow(Date.now()); setPhase('prep'); });
    socket.on('prep:ready', (d: any) => setPrepReady({ count: d.count || 0, total: d.total || 0 }));
    socket.on('round:countdown', (d: any) => { sfxStop('scratch'); setError(''); setReveal(null); setAnswered([]); setBuzzWinner(null); setPowerFeed([]); setRound((r: any) => ({ ...r, index: d.index ?? r.index, total: d.total ?? r.total })); setCountdown(d.seconds || 5); setPhase('countdown'); });
    socket.on('round:host', (d: any) => { sfxStop('scratch'); if (typeof d.serverNow === 'number') clockOffset.current = d.serverNow - Date.now(); setReveal(null); setAnswered([]); setBuzzWinner(null); buzzActiveRef.current = false; setRound(d); setPhase('playing');
      if (d.mode === 'quiz') { wantAudioRef.current = false; clearTimeout(audioRetryRef.current); previewRef.current = { url: '', clipMs: 30000, startAt: 0 }; try { audioRef.current?.pause(); } catch {} spotifyPause(); } // QUIZ = pas d'extrait de jeu ; on garde l'instru de menu (Alpha Wann) en fond
      else playRound(d); });
    // Mode Survivor (contre-la-montre) : le son s'enchaîne automatiquement à chaque nouveau morceau
    socket.on('rush:host', (d: any) => { setError(''); setRound(d); if (d.scores) setPlayers(d.scores); setPhase('playing'); playRound(d); });
    socket.on('rush:state', (d: any) => { setRound(d); if (d.scores) setPlayers(d.scores); });
    socket.on('rush:end', (d: any) => { wantAudioRef.current = false; audioRef.current?.pause(); spotifyPause(); clearTimeout(audioRetryRef.current); setRushEnd(d); setPhase('rushend'); });
    socket.on('player:answered', (d: any) => setAnswered((a) => (a.includes(d.name) ? a : [...a, d.name])));
    // buzz : le son SE COUPE (sinon on buzze, on écoute tranquille, puis on répond = trop facile)
    socket.on('buzz:winner', (d: any) => { if (typeof d.serverNow === 'number') clockOffset.current = d.serverNow - Date.now(); buzzActiveRef.current = true; wantAudioRef.current = false; try { audioRef.current?.pause(); } catch {} spotifyPause(); clearTimeout(audioRetryRef.current); setBuzzWinner({ name: d.name, avatar: d.avatar, endsAt: d.endsAt || 0, answerMs: d.answerMs || 15000 }); setNow(Date.now()); }); // buzzActiveRef : verrou anti-relance du son PENDANT que le buzzeur répond (course avec playRound)
    // le buzzeur a raté → le buzzer rouvre et le son REPREND pour les autres (SEULEMENT la source active de la manche,
    // sinon on relancerait une piste Spotify périmée EN PLUS de Deezer = double son)
    socket.on('buzz:open', () => { buzzActiveRef.current = false; wantAudioRef.current = true; if (usingSpotifyRef.current) spotifyTogglePlay(); else if (previewRef.current.url) playPreview(previewRef.current.url, previewRef.current.startAt, 0); setBuzzWinner(null); }); // le buzzeur a raté → le buzzer rouvre ; reprise Deezer via playPreview (gardé buzzActiveRef + re-check dans le .then) pour éviter le softlock si un 2e buzz arrive pendant le play() de reprise
    socket.on('round:reveal', (d: any) => { setReveal(d); setPlayers(d.scores); setPhase('reveal'); buzzActiveRef.current = false;
      // BUZZER : le son avait été coupé au buzz → on le REMET pour la révélation (titre + artiste). En Blind Test wantAudioRef reste true → no-op.
      if (!wantAudioRef.current && previewRef.current.url) { wantAudioRef.current = true; if (usingSpotifyRef.current) { try { spotifyTogglePlay(); } catch {} } else playPreview(previewRef.current.url, previewRef.current.startAt, 0); }
    });
    socket.on('game:final', (d: any) => { wantAudioRef.current = false; audioRef.current?.pause(); spotifyPause(); previewRef.current = { url: '', startAt: 0 }; clearTimeout(audioRetryRef.current); setFinalScores(d.scores); setAwards(d.awards || []); setSeries(d.series || null); setFinalRounds(d.rounds || 0); setPendingUnlock(null); setShowReveal(false); setPhase('final'); }); // musique de podium retirée ; le déblocage se joue APRÈS les trophées ; un challenger déjà débloqué ne réapparaît plus
    socket.on('power:used', (d: any) => { const key = powerKeyRef.current++; setPowerFeed((f) => [...f.slice(-4), { ...d, key }]); sfx('scratch'); setPowerBanner({ ...d, key }); clearTimeout(powerBannerTimer.current); powerBannerTimer.current = setTimeout(() => setPowerBanner((b: any) => (b && b.key === key ? null : b)), 4600); }); // + bannière géante 4,6 s (déborde volontairement sur le décompte → entre dans la manche)
    socket.on('scores:update', (d: any) => setPlayers(d.scores));
    socket.on('reaction', (d: any) => {
      const key = reactKeyRef.current++;
      const side = key % 2 === 0 ? 'l' : 'r';      // alterne gauche/droite : reste dans les MARGES, jamais devant le contenu centré
      const pos = 1.5 + Math.random() * 7;         // 1,5–8,5 % depuis le bord (couloir latéral étroit)
      setReactions((rs) => [...rs.slice(-5), { ...d, key, side, pos }]);
      setTimeout(() => setReactions((rs) => rs.filter((r) => r.key !== key)), 4800);
    });
    socket.on('room:closed', (d: any) => { wantAudioRef.current = false; audioRef.current?.pause(); setError(d.reason || 'Salon fermé.'); localStorage.removeItem(HKEY); sfxLoopStop(); });
    // ---- Manche CLASH (battle 1v1 + paris) ----
    socket.on('battle:intro', (d: any) => { wantAudioRef.current = false; try { audioRef.current?.pause(); } catch {} spotifyPause(); clearTimeout(audioRetryRef.current); setBattle({ a: d.a, b: d.b, flavor: d.flavor, betBonus: d.betBonus, win: d.win, tallyA: [], tallyB: [] }); setPhase('battle-intro'); });
    socket.on('battle:bets', (d: any) => { setBattle((b: any) => ({ ...b, endsAt: d.endsAt, betMs: d.betMs })); setNow(Date.now()); setPhase('battle-bet'); });
    socket.on('battle:tally', (d: any) => setBattle((b: any) => ({ ...b, tallyA: d.a || [], tallyB: d.b || [] })));
    socket.on('battle:go', (d: any) => { setBattle((b: any) => ({ ...b, endsAt: d.endsAt, durationMs: d.durationMs })); setNow(Date.now()); setPhase('battle-play'); playRound(d); });
    socket.on('battle:reveal', (d: any) => { setBattle((b: any) => ({ ...b, reveal: d })); if (d.scores) setPlayers(d.scores); wantAudioRef.current = false; try { audioRef.current?.pause(); } catch {} spotifyPause(); clearTimeout(audioRetryRef.current); setPhase('battle-reveal'); });
    return () => ['connect', 'lobby', 'round:prep', 'prep:ready', 'round:countdown', 'round:host', 'rush:host', 'rush:state', 'rush:end', 'player:answered', 'buzz:winner', 'buzz:open', 'round:reveal', 'game:final', 'power:used', 'scores:update', 'reaction', 'room:closed', 'battle:intro', 'battle:bets', 'battle:tally', 'battle:go', 'battle:reveal'].forEach((e) => socket.off(e as any));
  }, []);

  useEffect(() => { if (!['playing', 'prep', 'battle-bet', 'battle-play'].includes(phase)) return; const id = setInterval(() => setNow(Date.now() + clockOffset.current), 100); return () => clearInterval(id); }, [phase]);
  useEffect(() => { if (phase !== 'countdown') return; const id = setInterval(() => setCountdown((c) => Math.max(1, c - 1)), 1000); return () => clearInterval(id); }, [phase]);
  useEffect(() => { if (phase === 'countdown') sfx('countdown'); }, [countdown, phase]); // tick raccord avec chaque chiffre du décompte
  const prepSec = phase === 'prep' ? Math.max(0, Math.ceil((prepEndsAt - now) / 1000)) : -1;
  useEffect(() => { if (phase === 'prep' && prepSec > 0) sfx('countdown'); }, [prepSec]); // idem pendant l'activation des pouvoirs
  // Podium : les trophées se révèlent UN PAR UN, à la MAIN (l'hôte clique) — on prend le temps de lire.
  // On remet juste le compteur à zéro à chaque nouveau podium.
  // reset du showcase des trophées à chaque nouvelle fin de partie
  useEffect(() => { setFinalStep('podium'); setTroIdx(-1); setTroBusy(false); setTroSlot(null); clearTimeout(troTimer.current); clearInterval(troCdRef.current); }, [awards]);
  // Reveal en DEUX temps qui se REMPLACENT (jamais les deux à l'écran) : 1) qui a répondu quoi + points
  // gagnés, puis 2) le classement. L'hôte passe à l'étape 2 à la MAIN (bouton « Voir les scores ») ;
  // repli automatique à 30 s si personne ne clique — on a tout le temps de lire, même à 6 joueurs.
  useEffect(() => {
    if (phase !== 'reveal') { setRevealStep(0); return; }
    setRevealStep(0);
    const t = setTimeout(() => setRevealStep(1), 30000);
    return () => clearTimeout(t);
  }, [phase, reveal]);
  // Reveal — on RETARDE l'anim de classement (climb/drop) pour qu'elle soit VISIBLE : le board arrive figé,
  // puis les lignes montent/descendent ~0,7 s après. Un son marque un GROS mouvement (quelqu'un venu de loin).
  useEffect(() => {
    if (phase !== 'reveal' || revealStep < 1 || !reveal || reveal.hideBoard) { setRankAnim(false); return; }
    setRankAnim(false);
    const big = (reveal.scores || []).some((p: any) => !p.isMJ && Math.abs(p.rankDelta || 0) >= 3);
    const t = setTimeout(() => { setRankAnim(true); if (big) sfx('horn'); }, 700);
    return () => clearTimeout(t);
  }, [phase, revealStep, reveal]);
  // AUTO-RÉPARATION DU SON (priorité : la musique doit marcher à chaque fois). Pendant qu'un extrait
  // doit jouer, si le navigateur le coupe (suspension autoplay, onglet en veille, hoquet réseau), on le
  // relance : au moindre geste, au retour de l'onglet, et via une horloge de garde toutes les 2,5 s.
  useEffect(() => {
    const musicPhase = (phase === 'playing' || phase === 'reveal' || phase === 'battle-play') && round.mode !== 'quiz';
    if (!musicPhase) return;
    const kick = () => { const a = audioRef.current; if (a && wantAudioRef.current && a.paused && !a.ended && previewRef.current.url) playPreview(previewRef.current.url, previewRef.current.startAt, 0); };
    const onGesture = () => { audioReadyRef.current = true; setAudioLocked(false); kick(); }; // tout geste débloque l'autoplay + relance le son
    const onVis = () => { if (document.visibilityState === 'visible') kick(); };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    document.addEventListener('visibilitychange', onVis);
    const wd = setInterval(kick, 1500); // filet de sécurité ; l'essentiel se répare via onPause (instantané)
    return () => { window.removeEventListener('pointerdown', onGesture); window.removeEventListener('keydown', onGesture); document.removeEventListener('visibilitychange', onVis); clearInterval(wd); };
  }, [phase, round.mode]);
  useEffect(() => {
    fetch('/api/net').then((r) => r.json()).then(({ ip }) => {
      const loc = window.location; const local = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
      setJoinBase(local && ip ? `${loc.protocol}//${ip}:${loc.port || '5173'}` : loc.origin.replace(/\/$/, ''));
    }).catch(() => {});
  }, []);

  /* ---- musique du menu : aléatoire, morceaux entiers, historique préc/suiv ---- */
  const histRef = useRef<number[]>([]);
  const posRef = useRef(-1);
  const bassRef = useRef(0);        // niveau de basses (0..1) → "beat" pour le glow
  const barsRef = useRef<number[]>([0, 0, 0, 0, 0, 0, 0]); // bandes de l'égaliseur (0..1)
  const waveRef = useRef<Uint8Array>(new Uint8Array(0)); // forme d'onde temporelle (oscilloscope) — 128 = silence
  const acRef = useRef<any>(null);  // AudioContext + analyser
  const dockEqRef = useRef<HTMLSpanElement | null>(null);  // barres EQ du dock (peintes en RAF)
  function pickTrack(cur: number) {
    // Lecture SÉQUENTIELLE (aléatoire désactivé tant que l'ouverture est imposée sur Bishok).
    // À réactiver le random quand on retirera Bishok. Évite les répétitions rapprochées.
    if (MENU_TRACKS.length <= 1) return 0;
    return (cur + 1) % MENU_TRACKS.length;
  }
  function ensureAnalyser() {
    const a = menuAudioRef.current; if (!a || acRef.current) return;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
      const ctx = new AC(); const src = ctx.createMediaElementSource(a); const an = ctx.createAnalyser();
      an.fftSize = 256; src.connect(an); an.connect(ctx.destination);
      acRef.current = { ctx, an, data: new Uint8Array(an.frequencyBinCount), wave: new Uint8Array(an.fftSize) };
      waveRef.current = acRef.current.wave; // partagé (rempli à chaque frame) → l'oscilloscope du ConfigWizard le lit
      const NB = 7, USABLE = 96; // on ignore le très haut du spectre (souvent muet)
      const loop = () => {
        const o = acRef.current; if (!o) return;
        // rien ne joue (musique du menu en pause pendant toute une partie) → on NE calcule PAS la FFT (l'EQ/oscillo
        // qui la consomment sont démontés en jeu). Économise du CPU/batterie sur la TV, le loop se réveille à la reprise.
        if (menuAudioRef.current?.paused) { requestAnimationFrame(loop); return; }
        o.an.getByteFrequencyData(o.data);
        o.an.getByteTimeDomainData(o.wave); // forme d'onde brute pour l'oscilloscope
        // "beat" : énergie des basses (bins 1..7)
        let s = 0; for (let i = 1; i < 8; i++) s += o.data[i];
        bassRef.current = Math.min(1, s / (7 * 205));
        // bandes de l'égaliseur réparties sur le spectre utile (avec lissage)
        const bands = barsRef.current;
        for (let b = 0; b < NB; b++) {
          const start = Math.floor((b / NB) * USABLE), end = Math.floor(((b + 1) / NB) * USABLE);
          let sum = 0, cnt = 0; for (let i = start; i < end; i++) { sum += o.data[i]; cnt++; }
          const v = cnt ? sum / cnt / 255 : 0;
          bands[b] += (Math.min(1, v * 1.3) - bands[b]) * 0.5;
        }
        // peint les barres du dock si affichées
        const eq = dockEqRef.current;
        if (eq) { const k = eq.children, n = k.length; for (let i = 0; i < n; i++) (k[i] as HTMLElement).style.height = (12 + (bands[Math.floor((i / n) * NB)] || 0) * 88) + '%'; }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch (e) {}
  }
  // fondu de volume (crossfade) sur un élément <audio>
  function fadeTo(el: HTMLAudioElement | null, target: number, ms = 1100, pauseAtEnd = false) {
    if (!el) return;
    const any = el as any; clearInterval(any._fade);
    const from = el.volume, steps = 22, dt = Math.max(16, ms / steps); let i = 0;
    any._fade = setInterval(() => {
      i++; el.volume = Math.max(0, Math.min(1, from + (target - from) * (i / steps)));
      if (i >= steps) { clearInterval(any._fade); if (pauseAtEnd && target === 0) el.pause(); }
    }, dt);
  }
  // lance / réanime l'instru du lobby en fondu
  function playLobby(vol = 0.32) {
    const a = lobbyAudioRef.current; if (!a || !musicOnRef.current) return;
    if (!a.src || a.src.indexOf(LOBBY_TRACK) < 0) a.src = LOBBY_TRACK;
    a.loop = true;
    if (a.paused) { a.volume = 0; a.play().then(() => fadeTo(a, vol, 1100)).catch(() => {}); }
    else fadeTo(a, vol, 700);
  }
  function playMenuTrack(i: number, pushHist = true) {
    const a = menuAudioRef.current; if (!a) return;
    a.src = MENU_TRACKS[i].src; a.volume = 0.38;
    a.play().then(() => { ensureAnalyser(); acRef.current?.ctx?.resume?.(); curRef.current = i; setNowPlaying(i); if (pushHist) { histRef.current = histRef.current.slice(0, posRef.current + 1); histRef.current.push(i); posRef.current = histRef.current.length - 1; } }).catch(() => {});
  }
  function nextTrack() {
    if (posRef.current < histRef.current.length - 1) { posRef.current += 1; playMenuTrack(histRef.current[posRef.current], false); }
    else playMenuTrack(pickTrack(curRef.current), true);
  }
  function prevTrack() {
    if (posRef.current > 0) { posRef.current -= 1; playMenuTrack(histRef.current[posRef.current], false); }
  }
  function startMenu() {
    if (startedRef.current || !musicOnRef.current) return;
    startedRef.current = true;
    playMenuTrack(0); // au démarrage : toujours le son de Bishok (MENU_TRACKS[0]) ; puis lecture séquentielle (plus d'aléatoire)
  }
  function toggleMusic() {
    const on = !musicOn; setMusicOn(on); musicOnRef.current = on;
    const a = menuAudioRef.current; if (!a) return;
    if (on) { if (!startedRef.current) startMenu(); else a.play().catch(() => {}); }
    else a.pause();
  }
  // LOBBY (écran du code) = instru d'Alpha Wann (pas la playlist → pas de spoil du son de Bishok, qui
  // n'ouvre la playlist qu'au ConfigWizard). On tente l'autoplay ; à défaut, le 1er geste la lance.
  useEffect(() => {
    const h = () => { if (!configuringRef.current) playLobby(); };
    window.addEventListener('pointerdown', h);
    window.addEventListener('keydown', h);
    return () => { window.removeEventListener('pointerdown', h); window.removeEventListener('keydown', h); };
  }, []);
  // bascule CROSSFADE lobby(Alpha Wann) ↔ playlist(Bishok). Le clic "Configurer" sert de geste utilisateur.
  useEffect(() => {
    configuringRef.current = configuring;
    if (configuring) {
      fadeTo(lobbyAudioRef.current, 0, 1100, true);               // fond sortant : l'instru du lobby
      if (musicOnRef.current) { startMenu(); const ma = menuAudioRef.current; if (ma) { ma.volume = 0; fadeTo(ma, 0.38, 1100); } } // entrant : Bishok
    } else {
      fadeTo(menuAudioRef.current, 0, 800, true);                 // sortant : la playlist
      startedRef.current = false; curRef.current = -1; setNowPlaying(-1);
      if (musicOnRef.current) playLobby();                        // entrant : l'instru du lobby
    }
  }, [configuring]);
  // hors lobby (en jeu) : on coupe tout le menu ; sur le lobby (hors config) : on (ré)essaie l'instru
  useEffect(() => {
    const quizGame = round.mode === 'quiz';
    if (phase === 'lobby') { if (!configuring && musicOnRef.current) playLobby(); }                 // lobby (hors config) : instru normale (0.32)
    else if (quizGame && musicOnRef.current) playLobby(0.2);                                          // QUIZ en jeu : Alpha Wann en fond DOUX, JAMAIS coupée entre les questions (dépend de round.mode → démarre dès la 1re manche quiz, plus de course de fade)
    else { menuAudioRef.current?.pause(); const la = lobbyAudioRef.current; if (la && !la.paused) fadeTo(la, 0, 500, true); } // autres modes en jeu : on coupe menu/lobby (le son de manche prend le relais)
  }, [phase, round.mode]);

  // Lecture de l'extrait — AUTO-RÉPARANTE, sans aucun bouton ni geste. La page est déjà "déverrouillée"
  // depuis le clic "Lancer", donc play() marche en programmatique : si le navigateur coupe le son, on le
  // relance tout seul (retries ici + events onPause/onError de l'élément + horloge de garde plus bas).
  function playPreview(url: string, startAt = 0, attempt = 0) {
    if (buzzActiveRef.current) return; // buzz en cours → pas de démarrage d'extrait
    const a = audioRef.current; if (!a || !url) return;
    previewRef.current = { url, startAt };
    wantAudioRef.current = true;
    clearTimeout(audioRetryRef.current);
    try { acRef.current?.ctx?.resume?.(); } catch {} // réveille l'audio de la page si suspendu
    if (a.src !== url) a.src = url;
    a.volume = 1;
    const p = a.play();
    if (p && p.then) {
      p.then(() => { if (buzzActiveRef.current || !wantAudioRef.current) { try { a.pause(); } catch {} return; } audioReadyRef.current = true; setAudioLocked(false); try { if (startAt && seekedUrlRef.current !== url) { if (Math.abs(a.currentTime - startAt / 1000) > 1) a.currentTime = startAt / 1000; seekedUrlRef.current = url; } } catch {} }) // le pause() du buzz peut être AVALÉ si play() était encore en vol → on re-vérifie à la résolution et on recoupe ; sinon le son PART (autoplay ok) ; seek 1x par extrait
       .catch(() => { if (!audioReadyRef.current) setAudioLocked(true); if (wantAudioRef.current && attempt < 6) audioRetryRef.current = setTimeout(() => playPreview(url, startAt, attempt + 1), 300); }); // bloqué SANS geste (reload à froid) → invite ; sinon retry (watchdog)
    }
  }
  function start() {
    const a = audioRef.current;
    if (a) { a.src = SILENT; a.play().then(() => a.pause()).catch(() => {}); audioReadyRef.current = true; } // ce clic « Lancer » débloque l'autoplay pour toute la partie
    sfx('launch');
    socket.emit('host:start', { rounds: settings.rounds, difficulty: settings.difficulty, mode: settings.mode, mj: settings.mj, rebalance: settings.rebalance }, (res: any) => res?.error && setError(res.error));
  }
  function startWizard(s: { rounds: number; difficulty: string; mode: string; mj: boolean; rebalance: string; mjId?: string; era?: string; themes?: string[]; rushStartSec?: number; rushPace?: string; quizNoVf?: boolean }) {
    lastWizRef.current = s; // mémorise pour un éventuel « Rejouer » (Survivor notamment)
    const a = audioRef.current;
    if (a) { a.src = SILENT; a.play().then(() => a.pause()).catch(() => {}); audioReadyRef.current = true; } // ce clic « Lancer » débloque l'autoplay pour toute la partie
    sfx('launch');
    socket.emit('host:start', s, (res: any) => res?.error && setError(res.error));
  }
  // Relance depuis le podium : retour au salon (cumul de série conservé) ; toConfig → droit dans l'assistant.
  function relance(toConfig: boolean) { socket.emit('host:restart', {}, () => { if (toConfig) setConfiguring(true); }); }
  // TROPHÉES — transition "slot" (défile puis se cale) : la MÊME partout, y compris le 1er
  function troRunSlot(target: number) {
    clearInterval(troCdRef.current); clearTimeout(troTimer.current);
    if (!awards.length) return;
    setTroBusy(true);
    let i = 0, delay = 48;
    const tick = () => {
      setTroSlot(awards[i % awards.length]); i++;
      delay *= 1.26;
      if (delay < 250) troTimer.current = setTimeout(tick, delay);
      else { setTroSlot(null); setTroIdx(target); setTroBusy(false); sfx('launch'); }
    };
    tick();
  }
  // décompte auto (confort) entre deux trophées ; le dernier ne s'auto-avance pas → boutons de fin
  useEffect(() => {
    if (phase !== 'final' || finalStep !== 'trophies' || troBusy || troIdx < 0 || troIdx >= awards.length - 1) return;
    setTroCd(12);
    troCdRef.current = setInterval(() => setTroCd((c) => { if (c <= 1) { clearInterval(troCdRef.current); troRunSlot(troIdx + 1); return 0; } return c - 1; }), 1000);
    return () => clearInterval(troCdRef.current);
  }, [phase, finalStep, troIdx, troBusy, awards.length]);
  function newSalon() {
    if (players.length && !confirm('Ouvrir un NOUVEAU salon ? Les joueurs actuels seront éjectés.')) return;
    socket.emit('host:new', {}, (res: any) => {
      if (res?.ok) { setCode(res.code); setPoolSize(res.poolSize); setPlayers([]); setWaiting(0); setConfiguring(false); setReactions([]); setPhase('lobby');
        try { localStorage.setItem(HKEY, JSON.stringify({ code: res.code, hostToken: res.hostToken })); } catch {} }
    });
  }
  function kick(id: string) { socket.emit('host:kick', { playerId: id }); }
  function resetSeries() { if (confirm('Remettre à zéro le cumul de toutes les parties ?')) socket.emit('host:resetSeries'); }

  const remaining = Math.max(0, round.endsAt - now);
  const seconds = Math.ceil(remaining / 1000);
  const frac = round.durationMs ? remaining / round.durationMs : 0;
  const buzzRemain = buzzWinner?.endsAt ? Math.max(0, buzzWinner.endsAt - now) : 0;
  const buzzSec = Math.ceil(buzzRemain / 1000);
  const buzzFrac = buzzWinner?.answerMs ? Math.max(0, Math.min(1, buzzRemain / buzzWinner.answerMs)) : 0;
  // BUZZ — tick de decompte a chaque seconde ; les 3 dernieres s : tick plus AIGU (rate>1) = urgence audible sans regarder l'ecran
  useEffect(() => { if (round.mode === 'buzzer' && buzzWinner && buzzSec > 0) sfx('countdown', buzzSec <= 3 ? { rate: 1.7 } : undefined); }, [buzzSec, buzzWinner]);
  const rushFrac = round.rushMax ? Math.max(0, Math.min(1, remaining / round.rushMax)) : 0; // jauge de temps Survivor
  // décomptes CLASH (paris puis duel) — mêmes formules que la manche standard
  const btRemain = battle?.endsAt ? Math.max(0, battle.endsAt - now) : 0;
  const btSec = Math.ceil(btRemain / 1000);
  const btBetFrac = battle?.betMs ? Math.max(0, Math.min(1, btRemain / battle.betMs)) : 0;
  const btPlayFrac = battle?.durationMs ? Math.max(0, Math.min(1, btRemain / battle.durationMs)) : 0;

  return (
    <>
    {hubView && <HubBrowse mode={hubView} onClose={() => setHubView(null)} onRadioPlay={() => { musicOnRef.current = false; menuAudioRef.current?.pause(); const la = lobbyAudioRef.current; if (la) la.pause(); }} onRadioStop={() => { musicOnRef.current = true; if (configuringRef.current) { menuAudioRef.current?.play().catch(() => {}); } else playLobby(); }} />}
    {cheat && (
      <div className="cheat-fx" aria-hidden="true">
        <div className="cheat-flash" />
        {cheat.map((p, i) => (
          <img key={i} className="cheat-p" src={`/avatars/${p.id}.png`}
            style={{ left: p.x + '%', width: p.s, height: p.s, animationDelay: p.d + 's', animationDuration: p.dur + 's', ['--rot' as any]: p.rot + 'deg' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        ))}
        <div className="cheat-title"><span className="ct-big">CHEAT</span><span className="ct-sub">tous les rappeurs dans la place</span></div>
      </div>
    )}
    {showReveal && pendingUnlock && <ChallengerReveal charId={pendingUnlock} onClose={() => { setShowReveal(false); setPendingUnlock(null); }} />}
    {REVEAL_DEMO && !showReveal && (
      <div className="reveal-demo">
        <div className="rd-title">DÉMO · arrivée d'un challenger</div>
        <div className="rd-grid">
          {AVATARS.filter((a) => a.locked).map((a) => (
            <button key={a.id} className="rd-btn" onClick={() => { setPendingUnlock(a.id); setShowReveal(true); }}>
              <img src={`/avatars/${a.id}.png`} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              <span>{a.name}</span>
            </button>
          ))}
        </div>
      </div>
    )}
    {((phase === 'lobby' && !configuring) || ['prep', 'countdown', 'playing', 'reveal', 'final', 'rushend', 'battle-intro', 'battle-bet', 'battle-play', 'battle-reveal'].includes(phase)) && <GrungeBg />}
    {reactions.length > 0 && (
      <div className="reactfloat">
        {reactions.map((r) => {
          const set = r.end ? END_REACTIONS : REACTIONS;
          return (
          <div className="reactbubble" key={r.key} style={r.side === 'r' ? { right: `${r.pos}%` } : { left: `${r.pos}%` }}>
            <span className="rb-e">{set[r.id]?.e || '🔥'}</span>
            <span className="rb-t"><b>{r.name}</b> {set[r.id]?.t || ''}</span>
          </div>
          );
        })}
      </div>
    )}
    {powerBanner && (
      <div className="powerblast" key={powerBanner.key} style={{ ['--pc' as any]: catColor(powerBanner.avatar) }} aria-hidden="true">
        <div className="pb-inner">
          <span className="pb-shine" />
          <div className="pb-av"><Med avatarId={powerBanner.avatar} size={124} /></div>
          <div className="pb-txt">
            <div className="pb-line"><b className="pb-who">{powerBanner.name}</b> ACTIVE</div>
            <div className="pb-power">{powerBanner.power}</div>
            {powerBanner.effect && <div className="pb-eff">{powerBanner.effect}</div>}
          </div>
        </div>
      </div>
    )}
    {audioLocked && (
      <button className="btn" onClick={() => { audioReadyRef.current = true; setAudioLocked(false); wantAudioRef.current = true; if (usingSpotifyRef.current) { try { spotifyTogglePlay(); } catch {} } else if (previewRef.current.url) playPreview(previewRef.current.url, previewRef.current.startAt, 0); }}
        style={{ position: 'fixed', zIndex: 400, left: '50%', bottom: 'clamp(24px,5vh,56px)', transform: 'translateX(-50%)', padding: '16px 34px', borderRadius: 999, border: '2px solid var(--fluo)', background: 'rgba(10,11,14,.94)', color: 'var(--fluo)', fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 'clamp(20px,2.4vw,30px)', letterSpacing: '.04em', cursor: 'pointer', boxShadow: '0 14px 48px rgba(0,0,0,.7)' }}>
        🔊 Cliquer pour lancer le son
      </button>
    )}
    <div className="wrap" style={{ position: 'relative', zIndex: 1 }}>
      <div className={`topbar${['prep', 'countdown', 'playing', 'reveal', 'final'].includes(phase) ? ' gamebar' : ''}`}>
        <h1 className="wm" style={{ fontSize: 24 }}>PUNCHLIN<span className="d">R</span></h1>
        <span className="row" style={{ gap: 14, alignItems: 'center' }}>
          {phase === 'lobby' && <><span className="gpill">Salon {code}</span><span className="gpill"><span className="dot" />{players.length} joueur{players.length !== 1 ? 's' : ''}</span></>}
          {['prep', 'countdown', 'playing', 'reveal'].includes(phase) && (<>
            <span className="gmeta">
              {round.mode === 'rush'
                ? <span className="gmeta-round"><span className="gl">Survivor</span><b>{round.trackNo || 1}<i> morceau</i></b></span>
                : <span className="gmeta-round"><span className="gl">Manche</span><b>{round.index + 1}<i>/{round.total}</i></b></span>}
              {round.mode !== 'quiz' && <span className="gmeta-chip">{round.difficulty}</span>}
              <span className="gmeta-chip">{players.length} j.{waiting > 0 ? ` · ${waiting} att.` : ''}</span>
            </span>
            <span className="salontag"><span className="lbl">Salon</span><b className="cd">{code}</b></span>
            <button className="btn" style={{ padding: '9px 15px', fontSize: 14 }} onClick={() => socket.emit('host:restart')}>← Salon</button>
          </>)}
        </span>
      </div>
      {error && <p className="err" style={{ textAlign: 'center' }}>{error}</p>}
      {phase === 'connecting' && <div className="center"><p className="muted">Connexion…</p></div>}

      {phase === 'lobby' && !configuring && (
        <div className="center" style={{ gap: 22, justifyContent: 'center' }}>
          <span className="eyebrow">Rejoins le salon</span>
          <div className="code glitch" data-code={code}>{code}</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div className="qr"><QRCodeSVG value={`${joinBase}/?c=${code}`} size={118} bgColor="#ffffff" fgColor="#0c0722" /></div>
            <div className="eyebrow">Scanne le QR avec ton tel</div>
            <div className="muted" style={{ fontSize: 13 }}>ou tape <b style={{ color: 'var(--txt)' }}>{joinBase.replace(/^https?:\/\//, '')}</b> + le code <b style={{ color: 'var(--txt)' }}>{code}</b></div>
          </div>

          {players.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
              <div className="eyebrow"><b style={{ color: 'var(--fluo)' }}>{players.length}</b> dans le cercle</div>
              <div className="players" style={{ maxWidth: 760 }}>
                {players.map((p) => (
                  <div className="pcard join" key={p.id} style={{ opacity: p.connected ? 1 : 0.5 }}>
                    <Med avatarId={p.avatar} />
                    <div><div className="pname">{p.name}</div><div className="muted" style={{ fontSize: 11 }}>{avatarById(p.avatar)?.name}</div></div>
                    <button className="pkick" title="Retirer ce joueur" aria-label="Retirer" onClick={() => kick(p.id)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="btn warm big" style={{ maxWidth: 360, marginTop: 8 }} onClick={() => setConfiguring(true)} disabled={poolSize < 1}>Configurer la partie →</button>
          <div className="row" style={{ gap: 18 }}>
            <button className="btn ghost" style={{ fontSize: 12, padding: '7px 13px' }} onClick={newSalon}>⟳ Nouveau salon</button>
            <a className="muted" href="/?dev" target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: 'none' }}>+ ajouter un joueur test</a>
          </div>
        </div>
      )}

      {phase === 'lobby' && configuring && (
        <ConfigWizard
          poolSize={poolSize}
          roomCode={code}
          players={players.length}
          playerList={players}
          onStart={startWizard}
          onBack={() => setConfiguring(false)}
          onOpenHub={setHubView}
          music={{ nowPlaying, musicOn, onToggle: toggleMusic, onNext: nextTrack, onPrev: prevTrack, bassRef, barsRef, waveRef, tracks: MENU_TRACKS }}
          spotify={{ state: spState, spotifyOn, deezerOn, onToggleSpotify: toggleSpotify, onToggleDeezer: toggleDeezer }}
        />
      )}

      {phase === 'countdown' && (
        <div className="center">
          <span className="eyebrow">Prépare-toi…</span>
          <div className="big-num" style={{ color: 'var(--fluo)' }}>{countdown}</div>
          <span className="url">la musique arrive</span>
        </div>
      )}

      {phase === 'prep' && (
        <div className="center" style={{ gap: 16 }}>
          <span className="eyebrow">Manche {round.index + 1} / {round.total}</span>
          <h2 className="title-xl">Activation des pouvoirs</h2>
          <div className="big-num" style={{ color: 'var(--fluo)' }}>{Math.max(0, Math.ceil((prepEndsAt - now) / 1000))}</div>
          <span className="url">{prepReady.count}/{prepReady.total} prêt{prepReady.total > 1 ? 's' : ''}</span>
          {round.index <= 1 && powerFeed.length === 0 && (
            <div className="pw-explain">
              <div className="pwx-title">C'est quoi, un pouvoir&nbsp;?</div>
              <div className="pwx-steps">
                <div className="pwx-step"><span className="pwx-ic">🎤</span><span>Chaque rappeur a <b>son pouvoir</b>&nbsp;: voler des auditeurs, doubler son score, se protéger…</span></div>
                <div className="pwx-step"><span className="pwx-ic">⚡</span><span>On l'active sur son <b>téléphone</b>, ici, entre les manches — tant qu'il reste une <b>charge</b>.</span></div>
                <div className="pwx-step"><span className="pwx-ic">📺</span><span>Son effet s'affiche <b>en grand sur la TV</b>&nbsp;: tout le monde voit qui a frappé, et comment.</span></div>
              </div>
            </div>
          )}
          {powerFeed.length > 0 ? (
            <div className="pwfeed">
              {powerFeed.map((p) => (
                <div className="pwcard" key={p.key}>
                  <Med avatarId={p.avatar} size={44} />
                  <div className="pwtxt">
                    <div className="pwhead"><b>{p.name}</b> lance <span className="pwname">{p.power}</span></div>
                    {p.effect && <div className="pweff">{p.effect}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Chaque joueur active son pouvoir — ou passe — avant que la musique démarre.</p>
          )}
        </div>
      )}

      {phase === 'playing' && (
        <div className={round.mode === 'quiz' ? 'center qz-tv' : 'center'}>
          {round.mode === 'rush' ? (
            <div style={{ width: '100%', maxWidth: 960, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <span className="playmeta">Survivor — contre-la-montre · {round.difficulty}</span>
              <div className="ring big">
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,.10)" strokeWidth="9" fill="none" />
                  <circle cx="60" cy="60" r="54" stroke={seconds <= 8 ? '#ff5a1f' : '#a6ff00'} strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - rushFrac)} />
                </svg>
                <span className="n" style={{ color: seconds <= 8 ? '#ff5a1f' : undefined }}>{seconds}</span>
              </div>
              <span className="playmeta">Morceau {round.trackNo}{round.event?.reason === 'hit' && round.event?.name ? ` · ${round.event.name} +${Math.round((round.event.addedMs || 0) / 1000)} s` : round.event?.reason === 'pass' ? ` · passé −${Math.round((round.event.removedMs || 0) / 1000)} s` : ''}</span>
              <div className="eq7" aria-hidden="true">{Array.from({ length: 11 }).map((_, i) => <i key={i} />)}</div>
              {Array.isArray(round.scores) && round.scores.length > 0 && (
                <div className="board" style={{ width: '100%', maxWidth: 560, marginTop: 4 }}>
                  {round.scores.map((p: any, i: number) => (
                    <div className={`prow ${i === 0 ? 'lead' : i === 1 ? 'p2' : i === 2 ? 'p3' : ''}`} key={p.id}>
                      <span className="who"><span className="rk">{i + 1}</span><Med avatarId={p.avatar} size={30} />{p.name}</span>
                      <span className="row" style={{ gap: 12, alignItems: 'baseline' }}>
                        <span className="gain zero">{p.tracks} ✓</span>
                        <span className="pts">{fmtAud(p.score)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : round.mode === 'quiz' ? (() => {
            const vf = (round.quiz?.choices?.length || 0) === 2;
            return (
            <>
              <div className="row" style={{ gap: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <span className="gpill" style={{ color: 'var(--fluo)', position: 'absolute', left: '50%', top: -14, transform: 'translate(-50%,-100%)', whiteSpace: 'nowrap' }}>{round.quiz?.cat}</span>
                <div className="ring" style={{ width: 92, height: 92 }}>
                  <svg viewBox="0 0 120 120">
                    <defs><linearGradient id="tgq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a6ff00" /><stop offset="1" stopColor="#e4ff1a" /></linearGradient></defs>
                    <circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,.12)" strokeWidth="10" fill="none" />
                    <circle cx="60" cy="60" r="54" stroke="url(#tgq)" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
                  </svg>
                  <span className="n" style={{ fontSize: 36 }}>{seconds}</span>
                </div>
              </div>
              <h2 className="qtitle host">{round.quiz?.q}</h2>
              <div className={'qz-grid host' + (vf ? ' vf' : '')}>
                {round.quiz?.choices?.map((c: string, i: number) => (
                  vf
                    ? <div className={'qz-opt host vf' + vfClass(c)} key={i}>{c}</div>
                    : <div className="qz-opt host" key={i}><b>{String.fromCharCode(65 + i)}</b> {c}</div>
                ))}
              </div>
              {answered.length > 0 && <div className="answered">{answered.map((n) => <span className="abadge" key={n}>{n}</span>)}</div>}
            </>
            );
          })() : round.mode === 'buzzer' ? (
            buzzWinner ? (
              /* QUELQU'UN A BUZZÉ — spotlight géant + décompte de réponse */
              <div className="buzzstage">
                <div className={`ring big buzzring${buzzSec <= 3 ? ' hot' : ''}`}>
                  <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,.10)" strokeWidth="9" fill="none" />
                    <circle cx="60" cy="60" r="54" stroke={buzzSec <= 3 ? '#ff5a4d' : '#ffb02e'} strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - buzzFrac)} style={{ transition: 'stroke-dashoffset .18s linear' }} />
                  </svg>
                  <div className="buzzav"><Med avatarId={buzzWinner.avatar || undefined} size={128} /></div>
                </div>
                <h2 className="title-xl" style={{ margin: 0 }}>À <span style={{ color: 'var(--ember)' }}>{buzzWinner.name}</span> !</h2>
                <p className="buzzmeta" style={{ color: buzzSec <= 3 ? '#ff5a4d' : 'var(--muted)' }}>tape sa réponse · <b style={{ color: buzzSec <= 3 ? '#ff5a4d' : 'var(--fluo)' }}>{buzzSec}s</b></p>
              </div>
            ) : (
              /* BUZZER OUVERT — invitation géante */
              <div className="buzzstage">
                <div className="buzzdisc"><span>BUZZ</span></div>
                <div className="eq7" aria-hidden="true">{Array.from({ length: 11 }).map((_, i) => <i key={i} />)}</div>
                <span className="playmeta">Mode buzzer · {round.difficulty}</span>
                <p className="lead">Le premier qui reconnaît le son prend la main.</p>
              </div>
            )
          ) : (
            <>
              <div className="playstage">
                <div className="vinyl">
                  <div className="grooves spin" aria-hidden="true" />
                  <span className="q">?</span>
                </div>
                <div className="ring big">
                  <svg viewBox="0 0 120 120">
                    <defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a6ff00" /><stop offset="1" stopColor="#e4ff1a" /></linearGradient></defs>
                    <circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,.10)" strokeWidth="9" fill="none" />
                    <circle cx="60" cy="60" r="54" stroke="url(#tg)" strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
                  </svg>
                  <span className="n">{seconds}</span>
                </div>
              </div>
              <div className="eq7" aria-hidden="true">{Array.from({ length: 11 }).map((_, i) => <i key={i} />)}</div>
              <span className="playmeta playquip">{PLAY_QUIPS[(round.index || 0) % PLAY_QUIPS.length]}</span>
              {answered.length > 0 && <div className="answered">{answered.map((n) => <span className="abadge" key={n}>{n}</span>)}</div>}
            </>
          )}
          {powerFeed.length > 0 && (
            <div className="pwfeed compact">
              {powerFeed.slice(-3).map((p) => (
                <div className="pwchip" key={p.key}><Med avatarId={p.avatar} size={26} /><span><b>{p.power}</b>{p.effect ? ` — ${p.effect}` : ''}</span></div>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === 'reveal' && reveal && (
        <div className="center" style={{ justifyContent: 'flex-start', paddingTop: 'clamp(12px,2.5vh,32px)', paddingBottom: 'clamp(88px,14vh,132px)', gap: 'clamp(12px,2.2vh,20px)' }}>
          <span className="eyebrow">{reveal.quiz ? 'La réponse' : "C'était…"}</span>
          {reveal.quiz ? (
            <>
              <h2 className="qtitle host">{reveal.quiz.q}</h2>
              <div className="qz-answer">{reveal.quiz.choices[reveal.quiz.answer]}</div>
            </>
          ) : (
            <div className="row" style={{ gap: 26, flexWrap: 'wrap', justifyContent: 'center' }}>
              {reveal.track.cover && <img className="cover" src={reveal.track.cover} alt="" style={{ width: 'clamp(140px,20vw,200px)', height: 'clamp(140px,20vw,200px)' }} />}
              <div style={{ textAlign: 'left', maxWidth: 460 }}>
                <div className="eyebrow" style={{ color: 'var(--muted2)', marginBottom: 2 }}>Titre</div>
                <h2 className="title-xl" style={{ marginBottom: 12 }}>{reveal.track.title}</h2>
                <div className="eyebrow" style={{ color: 'var(--muted2)', marginBottom: 2 }}>Artiste</div>
                <p className="reveal-artist" style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 'clamp(20px,3vw,32px)', margin: 0, lineHeight: 1.05 }}>{reveal.track.artist}</p>
              </div>
            </div>
          )}
          {/* ÉTAPE 1 — QUI A RÉPONDU QUOI (+ points gagnés). Disparaît quand le classement arrive (revealStep>=1). */}
          {revealStep < 1 && !round.mj && reveal.results && reveal.results.filter((r: any) => !r.isMJ && (round.mode !== 'buzzer' || r.tried)).length > 0 && (
            <div className="verdicts">
              {reveal.results.filter((r: any) => !r.isMJ && (round.mode !== 'buzzer' || r.tried)).map((r: any) => {
                const good = r.points > 0;
                return (
                  <div className={`verdict ${good ? 'good' : 'bad'}`} key={r.id}>
                    <Med avatarId={r.avatar} size={46} />
                    <div className="v-main">
                      <div className="v-who">{r.name}<span className="v-rap">{avatarById(r.avatar)?.name}</span></div>
                      <div className="v-ans">{r.answer ? <>« {r.answer} »</> : <i className="v-none">pas de réponse</i>}</div>
                      {r.power && <div className="v-pow"><span className="v-bolt">⚡</span> <b>{r.power.name}</b> — {r.power.note}</div>}
                    </div>
                    <div className="v-res">
                      {good && (r.titleHit || r.artistHit) && <span className="v-hits">{r.titleHit ? 'Titre' : ''}{r.titleHit && r.artistHit ? ' + ' : ''}{r.artistHit ? 'Artiste' : ''}</span>}
                      {reveal.hideBoard
                        ? <span className={`v-mark ${good ? 'ok' : ''}`}>{good ? '✓' : '·'}</span>
                        : <span className={`v-pts ${r.points > 0 ? '' : r.points < 0 ? 'loss' : 'zero'}`}>{r.points > 0 ? `+${fmtAud(r.points)}` : r.points < 0 ? `−${fmtAud(-r.points)}` : '—'}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {revealStep >= 1 && (reveal.hideBoard ? (
            reveal.lastRound ? (
              <div className="suspense-card final-teaser">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M9.5 13v3.3h5V13M8 20.5h8" /></svg>
                <div><b>Dernière manche bouclée</b><span>Le classement final se dévoile sur le podium. Roulement de tambour…</span></div>
              </div>
            ) : (
              <div className="suspense-card">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                <div><b>Scores masqués</b><span>Ça se joue sur la fin — le classement reste secret jusqu'au podium. Personne ne sait qui mène.</span></div>
              </div>
            )
          ) : (
          <div className="board tvbig" style={{ maxWidth: 780 }}>
            {reveal.scores.filter((p: any) => !p.isMJ).map((p: any, i: number) => {
              const r = reveal.results.find((x: any) => x.id === p.id);
              const d = p.rankDelta || 0;
              return (
                <div className={`prow ${i === 0 ? 'lead' : i === 1 ? 'p2' : i === 2 ? 'p3' : ''}${rankAnim ? (d > 0 ? ' climb' : d < 0 ? ' drop' : '') : ''}`} key={p.id} style={{ ['--d' as any]: Math.min(Math.abs(d) || 1, 4), animationDelay: `${i * 0.05}s` }}>
                  <span className="who"><span className="rk">{i + 1}</span><Med avatarId={p.avatar} size={46} />{p.name}</span>
                  <span className="row" style={{ gap: 12 }}>
                    {d !== 0 && (
                      <span style={{ color: d > 0 ? 'var(--green)' : 'var(--bad)', display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 800, fontSize: 12 }}>
                        {d > 0
                          ? <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><path d="M5 1l4 7H1z" /></svg>
                          : <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><path d="M5 9L1 3h8z" /></svg>}
                        {Math.abs(d)}
                      </span>
                    )}
                    <span className={`gain ${r && r.points > 0 ? '' : r && r.points < 0 ? 'loss' : 'zero'}`}>{r && r.points > 0 ? `+${fmtAud(r.points)}` : r && r.points < 0 ? `−${fmtAud(-r.points)}` : '·'}</span>
                    <span className="pts">{fmtAud(p.score)}</span>
                  </span>
                </div>
              );
            })}
          </div>
          ))}
          {revealStep >= 1 && !reveal.hideBoard && (() => {
            const mover = (reveal.scores || []).filter((p: any) => !p.isMJ).reduce((a: any, b: any) => (Math.abs(b.rankDelta || 0) > Math.abs(a?.rankDelta || 0) ? b : a), null);
            const dd = mover?.rankDelta || 0;
            if (Math.abs(dd) < 3) return null;
            return <div className={`bigmove ${dd < 0 ? 'down' : 'up'}${rankAnim ? ' on' : ''}`}>{dd < 0 ? 'Gros glow down' : 'Grosse remontée'} · <b>{mover.name}</b> {dd > 0 ? `▲ +${dd}` : `▼ ${dd}`}</div>;
          })()}
          <div className="floatbar">{revealStep < 1
            ? <button className="btn warm" onClick={() => setRevealStep(1)}>Voir les scores →</button>
            : <button className="btn warm" onClick={() => socket.emit('host:next')}>{round.index + 1 >= round.total ? 'Voir le podium' : 'Manche suivante'}</button>}</div>
        </div>
      )}

      {/* ====================== MANCHE CLASH (1v1 + paris) ====================== */}
      {phase === 'battle-intro' && battle?.a && (
        <div className="center" style={{ justifyContent: 'center' }}>
          <div className="bt bt-intro">
            <div className="bt-head">
              <div className="bt-clashword">CLASH</div>
              <div className="bt-clashsub">{battle.flavor === 'rattrapage' ? 'Duel pour la remontée' : 'Duel au sommet'}</div>
            </div>
            <div className="bt-versus">
              <div className="bt-portrait a" style={{ ['--cc' as any]: catColor(battle.a.avatar) }}><Med avatarId={battle.a.avatar} size={228} /></div>
              <div className="bt-vsbig">VS</div>
              <div className="bt-portrait b" style={{ ['--cc' as any]: catColor(battle.b.avatar) }}><Med avatarId={battle.b.avatar} size={228} /></div>
              <div className="bt-caption a" style={{ ['--cc' as any]: catColor(battle.a.avatar) }}><div className="bt-fightname">{rapName(battle.a.avatar)}</div><div className="bt-fightpseudo cc">{battle.a.name}</div></div>
              <div aria-hidden="true" />
              <div className="bt-caption b" style={{ ['--cc' as any]: catColor(battle.b.avatar) }}><div className="bt-fightname">{rapName(battle.b.avatar)}</div><div className="bt-fightpseudo cc">{battle.b.name}</div></div>
            </div>
            <div className="bt-bonuspill"><b>Manche bonus</b><span>Face à face</span></div>
          </div>
        </div>
      )}

      {phase === 'battle-bet' && battle?.a && (
        <div className="center" style={{ justifyContent: 'center' }}>
          <div className="bt bt-bets">
            <div className="bt-head"><div className="bt-clashword">CLASH</div><div className="bt-clashsub">Les paris sont ouverts</div></div>
            <div className="bt-betgrid">
              <div className="bt-camp a">
                <div className="bt-camphead"><Med avatarId={battle.a.avatar} size={112} /><div className="bt-campnames"><div className="bt-fightname sm">{rapName(battle.a.avatar)}</div><div className="bt-fightpseudo">{battle.a.name}</div></div></div>
                <div className="bt-camplist">{(battle.tallyA || []).map((b: any) => <div className="bt-bettor" key={b.id}><Med avatarId={b.avatar} size={56} /><span className="nm">{b.name}</span></div>)}</div>
              </div>
              <div className="bt-betmid">
                <div className="bt-betring">
                  <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,.1)" strokeWidth="9" fill="none" /><circle cx="60" cy="60" r="54" stroke="var(--fluo)" strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - btBetFrac)} /></svg>
                  <span className="n">{btSec}</span>
                </div>
                <div className="bt-betcta">Misez sur le vainqueur</div>
                <div className="bt-betreward">+{fmtAud(battle.betBonus ?? 4000)} si vous visez juste</div>
              </div>
              <div className="bt-camp b">
                <div className="bt-camphead"><Med avatarId={battle.b.avatar} size={112} /><div className="bt-campnames"><div className="bt-fightname sm">{rapName(battle.b.avatar)}</div><div className="bt-fightpseudo">{battle.b.name}</div></div></div>
                <div className="bt-camplist">{(battle.tallyB || []).map((b: any) => <div className="bt-bettor" key={b.id}><Med avatarId={b.avatar} size={56} /><span className="nm">{b.name}</span></div>)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === 'battle-play' && battle?.a && (
        <div className="center" style={{ justifyContent: 'center' }}>
          <div className="bt bt-duel">
            <div className="bt-head"><div className="bt-clashword sm">CLASH</div><div className="bt-clashsub">En duel</div></div>
            <div className="bt-duelstage">
              <div className="bt-duelside" style={{ ['--cc' as any]: catColor(battle.a.avatar) }}><Med avatarId={battle.a.avatar} size={116} /><div className="bt-duelpseudo">{battle.a.name}</div><div className="bt-duelrap">{rapName(battle.a.avatar)}</div></div>
              <div className="bt-duelcore">
                <div className="vinyl"><div className="grooves spin" aria-hidden="true" /><span className="q">?</span></div>
                <div className="ring big">
                  <svg viewBox="0 0 120 120"><defs><linearGradient id="tgb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a6ff00" /><stop offset="1" stopColor="#e4ff1a" /></linearGradient></defs><circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,.10)" strokeWidth="9" fill="none" /><circle cx="60" cy="60" r="54" stroke="url(#tgb)" strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - btPlayFrac)} /></svg>
                  <span className="n">{btSec}</span>
                </div>
              </div>
              <div className="bt-duelside" style={{ ['--cc' as any]: catColor(battle.b.avatar) }}><Med avatarId={battle.b.avatar} size={116} /><div className="bt-duelpseudo">{battle.b.name}</div><div className="bt-duelrap">{rapName(battle.b.avatar)}</div></div>
            </div>
            <div className="eq7" aria-hidden="true">{Array.from({ length: 11 }).map((_, i) => <i key={i} />)}</div>
            <div className="bt-duelmeta">Le <b>1ᵉʳ des deux</b> qui reconnaît le son rafle le clash.</div>
          </div>
        </div>
      )}

      {phase === 'battle-reveal' && battle?.reveal && (() => {
        const d = battle.reveal;
        const winA = !d.draw && d.a === d.winnerId;
        const winB = !d.draw && d.b === d.winnerId;
        const betsWon = (d.bets || []).filter((x: any) => x.won);
        const betsLost = (d.bets || []).filter((x: any) => !x.won);
        const pl = (id: string) => players.find((p: any) => p.id === id) || {};
        const bettorsA = d.draw ? [] : (winA ? betsWon : betsLost);
        const bettorsB = d.draw ? [] : (winB ? betsWon : betsLost);
        const camp = (fighter: any, win: boolean, bettors: any[]) => (
          <div className={`bt-revcamp ${win ? 'win' : 'lose'}`}>
            <div className="bt-revfighter">
              <div className="bt-crown">{win ? '👑' : ''}</div>
              <Med avatarId={fighter.avatar} size={148} />
              <div className="bt-fightname">{fighter.name}</div>
              <div className={`bt-revtag ${win ? 'win' : 'lose'}`}>{d.draw ? 'Personne n’a trouvé' : win ? `A trouvé · +${fmtAud(d.points || 0)}` : 'N’a pas trouvé'}</div>
            </div>
            <div className="bt-teamlab">{win ? 'Ont bien parié' : 'Se sont loupés'}</div>
            <div className="bt-revbettors">
              {bettors.map((b: any) => { const who = pl(b.id); return (
                <div className={`bt-bettor ${win ? 'win' : 'lose'}`} key={b.id}>
                  <Med avatarId={who.avatar} size={50} /><span className="nm">{who.name || '?'}</span>
                  <span className={`gain ${win ? '' : 'zero'}`}>{win ? `+${fmtAud(d.betBonus || 0)}` : '+0'}</span>
                </div>
              ); })}
            </div>
          </div>
        );
        return (
          <div className="center" style={{ justifyContent: 'center' }}>
            <div className="bt bt-rev">
              <div className="bt-revealtrack big">
                {d.track?.cover ? <div className="bt-cover" style={{ backgroundImage: `url(${d.track.cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }} /> : <div className="bt-cover">♪</div>}
                <div className="bt-covermeta"><div className="eyebrow">La réponse</div><div className="ttl">{d.track ? `${d.track.title} — ${d.track.artist}` : '—'}</div></div>
              </div>
              <div className="bt-revgrid">
                {camp(battle.a, winA, bettorsA)}
                {camp(battle.b, winB, bettorsB)}
              </div>
              <button className="btn warm" onClick={() => socket.emit('host:next')}>Manche suivante →</button>
            </div>
          </div>
        );
      })()}

      {phase === 'rushend' && rushEnd && (() => {
        const res = rushEnd.results || [];
        const top = rushEnd.top || [];
        return (
        <div className="hub-overlay">
          <GrungeBg />
          <button className="tvros-back" onClick={() => socket.emit('host:restart')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            RETOUR
          </button>
          <div style={{ position: 'relative', zIndex: 1, height: '100vh', maxWidth: 720, margin: '0 auto', padding: 'clamp(44px,6vh,68px) clamp(24px,4vw,56px) 26px', display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 'clamp(22px,2.8vw,34px)', letterSpacing: '.02em', margin: 0, textAlign: 'center', textTransform: 'uppercase' }}>Classement <span className="d">Survivor</span></h1>
            <p className="muted" style={{ textAlign: 'center', margin: '5px 0 16px', fontSize: 15 }}>Contre-la-montre terminé — ton record mondial.</p>
            {res[0] && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Med avatarId={res[0].avatar} size={86} />
                <div style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 'clamp(20px,2.4vw,28px)', textAlign: 'center' }}>{res[0].name} <span className="d">{fmtAud(res[0].score)} aud.</span></div>
                <div className="muted" style={{ fontSize: 14, textAlign: 'center' }}>{res[0].tracks} morceau{res[0].tracks > 1 ? 'x' : ''} trouvé{res[0].tracks > 1 ? 's' : ''} · record #{res[0].rank} au monde</div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '15px 0 16px' }}>
              <button className="btn warm big" onClick={() => relance(true)}>Rejouer → <span style={{ opacity: .7, fontWeight: 600, fontSize: 13 }}>(re-choisir le joueur)</span></button>
            </div>
            <div className="muted" style={{ textAlign: 'center', fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 8 }}>Classement mondial · Top 10</div>
            <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', width: '100%', maxWidth: 540, margin: '0 auto' }}>
              {top.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>Premier score enregistré — le classement démarre !</p>}
              <div className="board">
                {top.map((t: any, i: number) => (
                  <div className={`prow ${i === 0 ? 'lead' : i === 1 ? 'p2' : i === 2 ? 'p3' : ''}`} key={i}>
                    <span className="who"><span className="rk">{i + 1}</span><Med avatarId={t.avatar} size={30} />{t.name}</span>
                    <span className="row" style={{ gap: 12, alignItems: 'baseline' }}>
                      <span className="gain zero">{t.tracks} ✓</span>
                      <span className="pts">{fmtAud(t.score)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {phase === 'final' && (() => {
        const board = finalScores.filter((p: any) => !p.isMJ);
        const champ = board[0];
        const multi = !!series && series.gamesPlayed >= 2;
        const standings = series?.standings || [];
        const seriesLeader = standings[0];
        const gameRounds = finalRounds || round.total || 1;
        return (
        <div className="center final" style={{ justifyContent: 'flex-start', paddingTop: 'clamp(14px,3vh,44px)', paddingBottom: 'clamp(96px,17vh,150px)', gap: 20 }}>
          {finalStep === 'podium' ? (<>
          <span className="eyebrow">{multi ? `Partie ${series.gamesPlayed} — terminée` : 'Podium'}</span>
          {/* PODIUM top 3 (2 · 1 · 3) — un seul disque de certif fusionné, prénom adaptatif, aud./manche */}
          <div className="podium">
            {([[board[1], 2], [board[0], 1], [board[2], 3]] as [any, number][]).map(([p, pos]) => {
              if (!p) return null;
              const c = certif(p.score, gameRounds); const t = CERTIF_TIER[c.short] ?? 0; const isP1 = pos === 1;
              return (
                <div className={`pod p${pos}`} key={p.id}>
                  <div className={`p-cert certlabel tier-${t}`} style={{ fontSize: isP1 ? 'clamp(15px,1.8vw,20px)' : '13px', padding: isP1 ? '7px 14px' : '5px 11px' }}>{c.short}</div>
                  <CertifDisc score={p.score} rounds={gameRounds} size={isP1 ? 168 : 122} avatarId={p.avatar} />
                  <div className="p-name" ref={(el) => fitName(el, isP1 ? 240 : 176, isP1 ? 32 : 20, isP1 ? 16 : 13)}>{p.name}</div>
                  <div className="p-aud">{fmtAud(p.score)}<small> aud.</small></div>
                  <div className="p-permanche">≈ {fmtAud(Math.round(p.score / gameRounds))} <span>aud./manche</span></div>
                  <div className="ped">{pos}</div>
                </div>
              );
            })}
          </div>
          {/* LE RESTE DU CLASSEMENT (4e et +) — chacun sa plaque de certif */}
          {board.length > 3 && (
          <div className="certgrid">
            {board.slice(3).map((p, i) => {
              const c = certif(p.score, gameRounds);
              const t = CERTIF_TIER[c.short] ?? 0;
              return (
                <div className="certcard" key={p.id}>
                  <span className="cc-rk">{i + 4}</span>
                  <CertifDisc score={p.score} rounds={gameRounds} size={72} avatarId={p.avatar} />
                  <div className="cc-info">
                    <div className="cc-name">{p.name}</div>
                    <div className={`cc-cert tier-${t}`}>{c.short}</div>
                  </div>
                  <div className="cc-score">{fmtAud(p.score)}<span> aud.</span></div>
                </div>
              );
            })}
          </div>
          )}
          {multi && (
            <div className="series-wrap">
              <div className="series-head">
                <span className="eyebrow">Classement général · {series.gamesPlayed} parties</span>
                {seriesLeader && <div className="gpill" style={{ color: 'var(--fluo)', borderColor: 'var(--fluo)' }}>{seriesLeader.name} mène la série · {certif(seriesLeader.total, seriesLeader.totalRounds).short}</div>}
              </div>
              <div className="board" style={{ maxWidth: 560 }}>
                {standings.map((p: any, i: number) => (
                  <div className={`prow ${i === 0 ? 'lead' : i === 1 ? 'p2' : i === 2 ? 'p3' : ''}`} key={p.id}>
                    <span className="who"><span className="rk">{i + 1}</span><Med avatarId={p.avatar} size={26} />{p.name}
                      {p.gameWins > 0 && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>{p.gameWins} gagnée{p.gameWins > 1 ? 's' : ''}</span>}</span>
                    <span className="pts">{fmtAud(p.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="floatbar">
            {awards.length > 0
              ? <button className="btn warm" onClick={() => { setFinalStep('trophies'); troRunSlot(0); }}>Voir les trophées →</button>
              : (<>
                  <button className="btn warm" onClick={() => relance(true)}>Relancer une partie →</button>
                  <button className="btn" onClick={() => relance(false)}>Retour au salon</button>
                </>)}
            {multi && <button className="btn ghost" onClick={resetSeries}>Nouvelle série</button>}
          </div>
          </>) : (
          /* ÉTAPE TROPHÉES — showcase (un à la fois, slot, décompte auto + skip) */
          <div className="tro-stage">
            <div className="tro-card">
              {troBusy && troSlot ? (
                <div className="tro-trophy">
                  <div className="tro-ill" style={{ position: 'relative' }}><img src={`/trophies/${troSlot.id}.png`} alt="" style={{ position: 'absolute', inset: '5%', width: '90%', height: '90%', objectFit: 'contain', zIndex: 1 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /><span dangerouslySetInnerHTML={{ __html: awardIcon(troSlot.icon) }} /></div>
                  <div className="tro-name">{troSlot.title}</div>
                  <div className="tro-desc">&nbsp;</div>
                </div>
              ) : (troIdx >= 0 && awards[troIdx]) ? (
                <div className="tro-trophy pop" key={troIdx}>
                  <div className="tro-ill" style={{ position: 'relative' }}><img src={`/trophies/${awards[troIdx].id}.png`} alt="" style={{ position: 'absolute', inset: '5%', width: '90%', height: '90%', objectFit: 'contain', zIndex: 1 }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /><span dangerouslySetInnerHTML={{ __html: awardIcon(awards[troIdx].icon) }} /></div>
                  <div className="tro-name">{awards[troIdx].title}</div>
                  <div className="tro-desc">{awards[troIdx].desc}</div>
                  <div className="tro-winner"><span className="tro-wlabel">Remporté par</span><Med avatarId={awards[troIdx].avatar} size={54} /><span className="tro-wname">{awards[troIdx].playerName}</span></div>
                </div>
              ) : null}
            </div>
            <div className="tro-dots">{awards.map((_: any, i: number) => <i key={i} className={i <= troIdx ? 'on' : ''} />)}</div>
            {troIdx < awards.length - 1 ? (
              <div className="tro-nav">
                {!troBusy && <div className="tro-cd">Trophée suivant dans <b>{troCd}</b> s<i className="tro-cdbar"><b style={{ width: `${(troCd / 12) * 100}%`, transition: 'width 1s linear' }} /></i></div>}
                <button className="btn warm" style={{ maxWidth: 300 }} disabled={troBusy} onClick={() => troRunSlot(troIdx + 1)}>{troIdx + 2 >= awards.length ? 'Dernier trophée →' : 'Suivant →'}</button>
              </div>
            ) : (!troBusy && (
              pendingUnlock ? (
                <button className="btn warm" style={{ maxWidth: 460, background: 'linear-gradient(90deg,#c0182b,#ff5a1f)', color: '#fff', boxShadow: '0 0 26px -6px #ff5a1f' }} onClick={() => setShowReveal(true)}>🔓 Un nouveau challenger débloqué — Découvrir →</button>
              ) : (
                <div className="row" style={{ gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
                  <button className="btn warm" onClick={() => relance(true)}>Relancer une partie →</button>
                  <button className="btn" onClick={() => relance(false)}>Retour au salon</button>
                  {multi && <button className="btn ghost" onClick={resetSeries}>Nouvelle série</button>}
                </div>
              )
            ))}
          </div>
          )}
        </div>
        );
      })()}

      <audio ref={audioRef} preload="auto"
        onPause={() => { const a = audioRef.current; if (a && wantAudioRef.current && !a.ended && previewRef.current.url) playPreview(previewRef.current.url, previewRef.current.startAt, 0); }}
        onError={() => { if (wantAudioRef.current && previewRef.current.url) { clearTimeout(audioRetryRef.current); audioRetryRef.current = setTimeout(() => playPreview(previewRef.current.url, previewRef.current.startAt, 0), 300); } }} />
      <audio ref={menuAudioRef} preload="auto" onEnded={() => nextTrack()} />
      <audio ref={lobbyAudioRef} preload="auto" loop />
    </div>
    </>
  );
}
