// Vue de consultation AFFICHÉE SUR LA TV (Hub / assistant) : roster façon borne de jeu de combat et
// palmarès. Layout paysage : portrait fondu (tous les bords) + fiche du rappeur + stats/pouvoir ; en bas,
// tout le roster en grille (aligné à gauche, zéro scroll). Slots verrouillés cliquables → objectif à
// accomplir. Pas de P1/P2, pas de silhouette SVG fantôme.
import { useState, useRef, useEffect } from 'react';
import { AVATARS, avatarById, initials, CATEGORY_ORDER, CATEGORY_COLORS, isLegend, EPITHETS, AWARDS_INFO, awardIcon, LOCKED_SLOTS, bioOf, fmtAud } from '../data';
import { socket } from '../socket';
import GrungeBg from '../GrungeBg';
import { hasSpotifySession, spotifyLogin, searchPlaylists, getMyPlaylists, getPlaylistTracks, spotifyPlayContext, spotifyPlayUri, spotifyPause, spotifyTogglePlay, spotifyNext, spotifyPrev, spotifySeek, spotifyRepeat, spotifyShuffle, onPlayerState, spotifyLastError } from '../spotify';

// mode démo (?radiodemo) : peuple la radio avec de fausses données pour VÉRIFIER le visuel sans Spotify réel.
const RADIO_DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).has('radiodemo');
const DEMO_PLAYLISTS = Array.from({ length: 12 }).map((_, i) => ({ id: 'demo' + i, uri: 'spotify:playlist:demo' + i, name: ['Rap FR Essentiels', 'Classiques du Rap Français', 'Drill FR 🔥', 'Nouveautés Rap FR', 'Chill Rap FR', 'Marseille Vibes', 'Old School 90s', 'Égotrip', 'Rap Conscient', 'Bangers 2024', 'Freestyle FR', 'Pépites'][i] || ('Playlist ' + i), owner: ['Spotify', 'Alexandre', 'Deezer FR', 'Rafuo'][i % 4], image: '', total: 20 + i * 7 }));
const DEMO_TRACKS = [
  { uri: 't1', title: 'Otto', artist: 'SCH', durationMs: 213000, cover: '' },
  { uri: 't2', title: "J'pète les plombs", artist: 'Disiz la Peste', durationMs: 198000, cover: '' },
  { uri: 't3', title: 'Bande organisée', artist: 'SCH, Jul, Naps, Kofs, Élams, Solda, Houari', durationMs: 312000, cover: '' },
  { uri: 't4', title: 'Onizuka', artist: 'PNL', durationMs: 244000, cover: '' },
  { uri: 't5', title: 'Tout va bien', artist: 'Alonzo, Ninho, Naps', durationMs: 187000, cover: '' },
  { uri: 't6', title: 'DKR', artist: 'Booba', durationMs: 226000, cover: '' },
  { uri: 't7', title: 'Basique', artist: 'OrelSan', durationMs: 201000, cover: '' },
  { uri: 't8', title: 'Va bene', artist: 'Ninho', durationMs: 175000, cover: '' },
];

// Stations radio = ANGLES distincts (mood / époque / ville / thème), pas « rap français » redondant.
// Ce sont des requêtes de recherche (jamais d'ID de playlist morte). 1re = défaut (marche sans re-consentement).
const RADIO_STATIONS = [
  { label: 'Découvertes', q: 'nouveautés rap fr 2025' },   // le "Radar" : sons récents
  { label: 'Classiques', q: 'classiques rap français' },
  { label: 'Années 2000', q: 'rap français 2000 2010' },
  { label: 'Drill', q: 'drill fr' },
  { label: 'Chill', q: 'chill rap fr détente' },
  { label: 'Égotrip', q: 'egotrip punchlines rap fr' },
  { label: 'Marseille', q: 'rap marseille 13' },
  { label: 'Soirée', q: 'rap fr soirée ambiance' },
];

// Mémoire de session radio (module-level → survit au démontage quand on repart au hub) : on retrouve la playlist
// où on était (au pire en pause) au lieu de tout remettre à zéro.
let radioMem: null | { source: string; results: any[]; query: string; selPl: any; tracks: any[]; trkInfo: any; activeUri: string; nowPlaying: any; posBase: number } = null;

const hideOnErr = (e: any) => { e.currentTarget.style.display = 'none'; };
// icônes note + play en SVG (le glyphe texte ▶/♪ se rendait en EMOJI géant sur certains systèmes → cassé)
const NOTE = <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ display: 'block' }}><path d="M9 17V5l10-2v12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6.5" cy="17" r="2.5" /><circle cx="16.5" cy="15" r="2.5" /></svg>;
const PLAY = (s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true"><polygon points="7 4 20 12 7 20 7 4" fill="currentColor" /></svg>;

// icônes lecteur (SVG propres, DA) — plus d'emoji
const svg = (d: any, size = 16) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const IC = {
  shuffle: svg(<><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" /></>),
  repeat: svg(<><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>),
  prev: svg(<><polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none" /><rect x="4" y="4" width="2.4" height="16" rx="1" fill="currentColor" stroke="none" /></>),
  next: svg(<><polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none" /><rect x="17.6" y="4" width="2.4" height="16" rx="1" fill="currentColor" stroke="none" /></>),
  play: (s = 18) => svg(<polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" />, s),
  pause: (s = 18) => svg(<><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" /></>, s),
  expand: svg(<><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></>),
  minimize: svg(<><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></>),
};
// Logo Spotify officiel (toujours en couleur) — repris tel quel de l'assistant (ConfigWizard) pour le badge de la radio.
const SPOTIFY_ICO = '<svg width="15" height="15" viewBox="0 0 168 168" aria-hidden="true"><path fill="#1ed760" d="M83.996.277C37.747.277.253 37.77.253 84.019c0 46.251 37.494 83.741 83.743 83.741 46.254 0 83.744-37.49 83.744-83.741 0-46.246-37.49-83.738-83.745-83.738l.001-.004zm38.404 120.78a5.217 5.217 0 01-7.18 1.73c-19.662-12.01-44.414-14.73-73.564-8.07a5.222 5.222 0 01-6.249-3.93 5.213 5.213 0 013.926-6.25c31.9-7.291 59.263-4.15 81.337 9.34 2.46 1.51 3.24 4.72 1.73 7.18zm10.25-22.805c-1.89 3.075-5.91 4.045-8.98 2.155-22.51-13.839-56.823-17.846-83.448-9.764-3.453 1.043-7.1-.903-8.148-4.35a6.538 6.538 0 014.354-8.143c30.413-9.228 68.222-4.758 94.072 11.127 3.07 1.89 4.04 5.91 2.15 8.976v-.001zm.88-23.744c-26.99-16.031-71.52-17.505-97.289-9.684-4.138 1.255-8.514-1.081-9.768-5.219a7.835 7.835 0 015.221-9.771c29.581-8.98 78.756-7.245 109.83 11.202a7.823 7.823 0 012.74 10.733c-2.2 3.722-7.02 4.949-10.73 2.739z"/></svg>';
const cats = [...CATEGORY_ORDER, ...Array.from(new Set(AVATARS.map((a) => a.cat))).filter((c) => !CATEGORY_ORDER.includes(c))];
const ROSTER = [...cats.flatMap((cat) => AVATARS.filter((a) => a.cat === cat && !a.locked)), ...AVATARS.filter((a) => a.locked)]; // par catégorie, puis les déblocables (révélés, à part) à la fin

export default function HubBrowse({ mode, onClose, onRadioPlay, onRadioStop }: { mode: 'roster' | 'trophies' | 'leaderboard' | 'radio'; onClose: () => void; onRadioPlay?: () => void; onRadioStop?: () => void }) {
  const [selId, setSelId] = useState(AVATARS[0].id);
  const figRef = useRef<HTMLDivElement>(null);
  const sel = avatarById(selId) || AVATARS[0];
  const lockedSel = LOCKED_SLOTS.find((s) => s.id === selId) || null;
  const bio = bioOf(selId);
  const [board, setBoard] = useState<any[]>([]); // classement mondial Survivor (chargé quand mode = leaderboard)
  const [radioResults, setRadioResults] = useState<any[]>([]); // playlists (bibliothèque, station ou recherche)
  const [radioQuery, setRadioQuery] = useState('');
  const [radioLoading, setRadioLoading] = useState(false);
  const [radioSource, setRadioSource] = useState<string>('mine'); // 'mine' | libellé station | 'search'
  const [radioActiveUri, setRadioActiveUri] = useState<string>(''); // playlist EN LECTURE (surlignée)
  const [radioInfo, setRadioInfo] = useState<string>(''); // code d'info quand la liste est vide (diagnostic)
  const [nowPlaying, setNowPlaying] = useState<any>(null); // {paused,name,artist,image}
  const [spReady, setSpReady] = useState(false);
  const [selPl, setSelPl] = useState<any>(null); // playlist OUVERTE dans le panneau latéral
  const [tracks, setTracks] = useState<any[]>([]);
  const [trkInfo, setTrkInfo] = useState<{ loading: boolean; total: number; durationMs: number; info: string }>({ loading: false, total: 0, durationMs: 0, info: '' });
  const posRef = useRef({ base: 0, at: 0 }); // position lecture (base + horodatage) → barre de progression interpolée
  const [, setUiTick] = useState(0);         // force le re-render de la barre pendant la lecture
  const [bigPlayer, setBigPlayer] = useState(0); // vue « now playing » plein écran (mode Cinéma) : 0 = fermé, 1-4 = animation d'ouverture (à départager)
  const [bigClosing, setBigClosing] = useState(false); // joue l'animation d'ouverture EN REVERSE avant de démonter
  const closeTimer = useRef<any>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (selPl) setSelPl(null); else onClose(); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [selPl]);
  useEffect(() => {
    if (mode !== 'leaderboard') return;
    socket.emit('leaderboard:get', { n: 30 }, (r: any) => { if (r?.ok) setBoard(r.top || []); });
  }, [mode]);
  // Radio : now-playing + défaut « Découvertes ». À la SORTIE : on coupe la radio + on relance la musique du menu.
  useEffect(() => {
    if (mode !== 'radio') return;
    if (RADIO_DEMO) { setSpReady(true); setRadioResults(DEMO_PLAYLISTS); setRadioSource('mine'); openPlaylist(DEMO_PLAYLISTS[0]); setNowPlaying({ paused: false, name: 'Otto', artist: 'SCH', image: '', position: 74000, duration: 213000, shuffle: true, repeat: 1 }); posRef.current = { base: 74000, at: Date.now() }; return; }
    const rdy = hasSpotifySession(); setSpReady(rdy);
    const off = onPlayerState((s) => { setNowPlaying(s); posRef.current = { base: s?.position || 0, at: Date.now() }; });
    if (radioMem) {
      // retour depuis le hub → on restaure la session (playlist où on était, en pause). Pas de reset.
      setRadioSource(radioMem.source); setRadioResults(radioMem.results); setRadioQuery(radioMem.query);
      setSelPl(radioMem.selPl); setTracks(radioMem.tracks); setTrkInfo(radioMem.trkInfo); setRadioActiveUri(radioMem.activeUri);
      if (radioMem.nowPlaying) { setNowPlaying({ ...radioMem.nowPlaying, paused: true }); posRef.current = { base: radioMem.posBase, at: Date.now() }; }
    } else if (rdy) { loadMine(); } // à l'arrivée : MES playlists (les seules lisibles + le plus utile)
    // connexion Spotify via popup pendant qu'on est dans la radio → on passe "connecté" + on charge Mes playlists
    const onConnected = () => { setSpReady(true); loadMine(); };
    window.addEventListener('pl-spotify-connected', onConnected);
    return () => { off(); window.removeEventListener('pl-spotify-connected', onConnected); spotifyPause(); onRadioStop?.(); }; // quitter la radio → stop
  }, [mode]);
  // sauvegarde live de la session radio → restaurable au prochain retour (cf. radioMem)
  useEffect(() => {
    if (mode !== 'radio' || RADIO_DEMO) return;
    radioMem = { source: radioSource, results: radioResults, query: radioQuery, selPl, tracks, trkInfo, activeUri: radioActiveUri, nowPlaying, posBase: nowPlaying ? (nowPlaying.paused ? nowPlaying.position : posRef.current.base) : 0 };
  }, [mode, radioSource, radioResults, radioQuery, selPl, tracks, trkInfo, radioActiveUri, nowPlaying]);
  // tick pour animer la barre de progression pendant la lecture
  useEffect(() => {
    if (mode !== 'radio' || !nowPlaying || nowPlaying.paused) return;
    const id = setInterval(() => setUiTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [mode, nowPlaying]);
  // fermeture du plein écran : joue l'anim d'ouverture EN REVERSE puis démonte
  function closeBig() { if (bigClosing) return; setBigClosing(true); clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => { setBigPlayer(0); setBigClosing(false); }, 360); }
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  async function loadResults(promise: Promise<{ items: any[]; info: string }>, source: string) {
    setRadioLoading(true); setRadioSource(source); setRadioInfo(''); setSelPl(null);
    const res = await promise;
    setRadioResults(res.items); setRadioInfo(res.info); setRadioLoading(false);
  }
  function loadMine() { setRadioQuery(''); loadResults(getMyPlaylists(50), 'mine'); }
  function runStation(st: { label: string; q: string }) { setRadioQuery(''); loadResults(searchPlaylists(st.q, 20), st.label); }
  function runSearch(q: string) { if (!q.trim()) return; loadResults(searchPlaylists(q, 20), 'search'); }
  async function openPlaylist(p: any) {
    setSelPl(p);
    if (RADIO_DEMO) { setTracks(DEMO_TRACKS); setTrkInfo({ loading: false, total: DEMO_TRACKS.length, durationMs: DEMO_TRACKS.reduce((s, t) => s + t.durationMs, 0), info: '' }); return; }
    setTracks([]); setTrkInfo({ loading: true, total: 0, durationMs: 0, info: '' });
    const r = await getPlaylistTracks(p.id);
    setTracks(r.tracks); setTrkInfo({ loading: false, total: r.total, durationMs: r.durationMs, info: r.info });
  }
  async function playWhole(p: any) { const ok = await spotifyPlayContext(p.uri); if (ok) { setRadioActiveUri(p.uri); onRadioPlay?.(); } }
  async function playTrack(t: any) { const ok = await spotifyPlayUri(t.uri); if (ok) onRadioPlay?.(); }
  const radioMsg = (i: string) => (({ 'no-token': 'Spotify déconnecté — reconnecte-toi.', 'http-400': 'Session Spotify invalide — reconnecte-toi.', 'http-401': 'Session Spotify expirée — reconnecte-toi.', 'http-403': 'Accès refusé par Spotify (403) — reconnecte-toi.', 'all-null': 'Spotify n’a renvoyé que des playlists non lisibles (bug connu). Essaie une autre station.', 'empty': 'Aucune playlist ici. Choisis une station ou cherche.', 'network': 'Spotify injoignable (réseau).' } as any)[i] || (i.startsWith('http-') ? `Erreur Spotify (${i.slice(5)}) — reconnecte-toi.` : 'Rien à afficher.'));
  const fmtDur = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const fmtTotal = (ms: number) => { const m = Math.round(ms / 60000); return m >= 60 ? (Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0')) : (m + ' min'); };
  // avatar rond réutilisable (même markup/classe .med que l'écran de jeu) — GROS car affiché sur TV
  const avNode = (id?: string) => { const a = avatarById(id || ''); return <span className="med" style={{ width: 54, height: 54, fontSize: 20, background: a?.color || 'linear-gradient(150deg,#7C5CFF,#432E8C)' }}>{a?.img ? <img src={`/avatars/${a.id}.png`} alt="" onError={hideOnErr} /> : initials(a?.name || id || '?')}</span>; };

  // glitch VHS (déchirures de tracking) sur le portrait
  useEffect(() => {
    if (mode !== 'roster' || lockedSel) return;
    const fig = figRef.current; if (!fig) return;
    let timer: any;
    const fire = () => {
      const r = Math.random(), strong = r < 0.4, big = r < 0.15;
      const gx = (Math.random() * 2 - 1) * (big ? 26 : strong ? 15 : 6);
      const gh = big ? 12 + Math.random() * 22 : strong ? 5 + Math.random() * 12 : 2 + Math.random() * 7;
      fig.style.setProperty('--gy', (Math.random() * 82).toFixed(1) + '%');
      fig.style.setProperty('--gh', gh.toFixed(1) + '%');
      fig.style.setProperty('--gx', gx.toFixed(1) + 'px');
      fig.classList.add(strong ? 'glx-strong' : 'glx');
      window.setTimeout(() => fig.classList.remove('glx', 'glx-strong'), (strong ? 100 : 55) + Math.random() * (strong ? 240 : 100));
      timer = window.setTimeout(fire, 480 + Math.random() * 2400);
    };
    timer = window.setTimeout(fire, 500 + Math.random() * 1500);
    return () => { window.clearTimeout(timer); fig.classList.remove('glx', 'glx-strong'); };
  }, [mode, selId, lockedSel]);

  // filtres VHS (aberration chromatique) réutilisés par le portrait + les déchirures. (Plus de silhouette #bust.)
  const defs = (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      <filter id="vhs" x="-6%" y="-3%" width="112%" height="106%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.001 0.021" numOctaves={1} seed={5} result="w" />
        <feDisplacementMap in="SourceGraphic" in2="w" scale={2.4} xChannelSelector="R" yChannelSelector="G" result="d" />
        <feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cr" />
        <feOffset in="cr" dx={-3} dy={0.6} result="cro" />
        <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cg" />
        <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cb" />
        <feOffset in="cb" dx={3} dy={-0.6} result="cbo" />
        <feBlend in="cro" in2="cg" mode="screen" result="crg" />
        <feBlend in="crg" in2="cbo" mode="screen" />
      </filter>
      <filter id="vhs-strong" x="-10%" y="-5%" width="120%" height="110%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.002 0.03" numOctaves={1} seed={9} result="w2" />
        <feDisplacementMap in="SourceGraphic" in2="w2" scale={5} xChannelSelector="R" yChannelSelector="G" result="d2" />
        <feColorMatrix in="d2" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cr2" />
        <feOffset in="cr2" dx={-8} dy={1.4} result="cro2" />
        <feColorMatrix in="d2" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cg2" />
        <feColorMatrix in="d2" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cb2" />
        <feOffset in="cb2" dx={8} dy={-1.4} result="cbo2" />
        <feBlend in="cro2" in2="cg2" mode="screen" result="crg2" />
        <feBlend in="crg2" in2="cbo2" mode="screen" />
      </filter>
    </defs></svg>
  );

  if (mode === 'trophies') {
    return (
      <div className="hub-overlay trophies-page">
        <GrungeBg />
        <button className="tvros-back" onClick={onClose}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          RETOUR
        </button>
        <div style={{ position: 'relative', zIndex: 1, padding: '62px clamp(24px,4vw,64px) 40px' }}>
          <div className="tro-head">
            <h1 className="wm tro-title">LES <span className="d">TROPHÉES</span></h1>
          </div>
          <p className="muted tro-sub">Décernés en fin de partie selon tes exploits (et tes plantages). <b style={{ color: 'var(--txt)' }}>{AWARDS_INFO.length}</b> à décrocher.</p>
          <div className="troph-grid big">
            {AWARDS_INFO.map((t) => (
              <div className={`troph ${t.salty ? 'salty' : ''}`} key={t.id}>
                {/* image du trophée si présente (client/public/trophies/<id>.png), sinon repli sur l'icône SVG */}
                <span className="troph-ic">
                  <img className="troph-img" src={`/trophies/${t.id}.png`} alt="" onError={hideOnErr} />
                  <span className="troph-svg" dangerouslySetInnerHTML={{ __html: awardIcon(t.icon) }} />
                </span>
                <div className="troph-title">{t.title}</div>
                <div className="troph-desc">{t.blurb}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'leaderboard') {
    // les scores dépendent de la config (difficulté + chrono + pression) → on l'affiche pour comparer à config égale
    const DIFF_LB: any = { facile: 'Facile', normal: 'Connaisseur', difficile: 'Digger', puriste: 'Puriste' };
    const PACE_LB: any = { chill: 'Clément', normal: 'Équilibré', hardcore: 'Sous pression' };
    const cfgChip = (t: any) => `${DIFF_LB[t.difficulty] || t.difficulty || 'Normal'} · ${t.startSec || 60}s · ${PACE_LB[t.pace || 'normal']}`;
    return (
      <div className="hub-overlay">
        <GrungeBg />
        <button className="tvros-back" onClick={onClose}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          RETOUR
        </button>
        <div className="wrap" style={{ position: 'relative', zIndex: 1, maxWidth: 'none', padding: '62px clamp(24px,4vw,64px) 40px' }}>
          <div className="topbar" style={{ justifyContent: 'center', gap: 16 }}>
            <h1 className="wm" style={{ fontSize: 'clamp(28px,3.2vw,46px)' }}>CLASSEMENT <span className="d">MONDIAL</span></h1>
            <span className="gpill">Survivor</span>
          </div>
          <p className="muted" style={{ textAlign: 'center', margin: '2px 0 30px', fontSize: 15 }}>Le contre-la-montre — meilleurs scores, tous salons confondus. <b style={{ color: 'var(--txt)' }}>Chaque score porte sa config</b> (les options changent tout).</p>
          {board.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', marginTop: 70, fontSize: 'clamp(18px,2vw,24px)' }}>Aucun score pour l'instant.<br />Lance un <b style={{ color: 'var(--fluo)' }}>Survivor</b> pour ouvrir le classement.</p>
          ) : (
            <div className="board tvbig" style={{ maxWidth: 1080, margin: '0 auto' }}>
              {board.map((t: any, i: number) => (
                <div className={`prow ${i === 0 ? 'lead' : ''}`} key={i} style={{ animation: `rowin .3s ease ${Math.min(i, 12) * 0.035}s both` }}>
                  <span className="who"><span className="rk">{i + 1}</span>{avNode(t.avatar)}<span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{t.name}<span className="lb-cfg">{cfgChip(t)}</span></span></span>
                  <span className="row" style={{ gap: 24, alignItems: 'baseline' }}>
                    <span className="gain zero" style={{ fontSize: 'clamp(16px,1.7vw,22px)' }}>{t.tracks} ✓</span>
                    <span className="pts">{fmtAud(t.score)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'radio') {
    const sourceLabel = radioSource === 'mine' ? 'Mes playlists' : radioSource === 'search' ? `Recherche « ${radioQuery} »` : radioSource;
    // on masque les playlists ÉDITORIALES de Spotify (owner « Spotify ») hors « Mes playlists » : illisibles/injouables (403).
    const shownResults = radioSource === 'mine' ? radioResults : radioResults.filter((p: any) => (p.owner || '').toLowerCase() !== 'spotify');
    // morceau en cours : le SDK ne donne que name/artist → on repère la ligne jouée par match du titre (normalisé)
    const rn = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    const npName = nowPlaying && !nowPlaying.paused ? rn(nowPlaying.name) : '';
    const playlistPlaying = !!selPl && (radioActiveUri === selPl.uri || (!!npName && tracks.some((t: any) => rn(t.title) === npName)));
    return (
      <div className="hub-overlay radio-overlay">
        <GrungeBg />
        <button className="tvros-back" onClick={onClose}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          RETOUR
        </button>
        <span className={`sp-badge radio-spbadge ${spReady ? 'on' : ''}`}><span className="srclogo" dangerouslySetInnerHTML={{ __html: SPOTIFY_ICO }} />Spotify</span>
        <div className="radio-wrap" style={{ position: 'relative', zIndex: 1, paddingBottom: nowPlaying ? 116 : 26 }}>
          <div className="radio-topbar">
            <h1 className="wm radio-title">RADIO PUNCHLINR</h1>
          </div>

          {!spReady ? (
            <div className="radio-empty tall">
              <div className="radio-empty-ico">{NOTE}</div>
              <p className="muted" style={{ fontSize: 16 }}>La radio a besoin de <b style={{ color: 'var(--txt)' }}>Spotify (Premium)</b> connecté.</p>
              <button className="btn warm" onClick={() => { try { localStorage.setItem('pl_radio_return', '1'); } catch {} spotifyLogin(); }}>Connecter Spotify</button>
            </div>
          ) : (
            <div className="radio-body">
              <div className="radio-main">
                <div className="radio-head">
                  <div className="radio-stations">
                    <button className={`radio-chip chip-mine ${radioSource === 'mine' ? 'on' : ''}`} onClick={loadMine}><span className="rc-star">★</span>Mes playlists</button>
                    {RADIO_STATIONS.map((st) => (
                      <button key={st.q} className={`radio-chip ${radioSource === st.label ? 'on' : ''}`} onClick={() => runStation(st)}>{st.label}</button>
                    ))}
                  </div>
                  <form className="radio-search" onSubmit={(e) => { e.preventDefault(); runSearch(radioQuery); }}>
                    <span className="rs-ico" aria-hidden="true">⌕</span>
                    <input className="field" placeholder="Rechercher une playlist sur Spotify…" value={radioQuery} onChange={(e) => setRadioQuery(e.target.value)} />
                    <button className="btn warm rs-go" type="submit">Chercher</button>
                  </form>
                </div>

                {!radioLoading && shownResults.length > 0 && (
                  <div className="radio-sub"><b>{sourceLabel}</b><span>{shownResults.length} playlist{shownResults.length > 1 ? 's' : ''}</span></div>
                )}

                {radioLoading ? (
                  <div className="radio-grid">{Array.from({ length: 12 }).map((_, i) => (
                    <div className="radio-card skel" key={i}><div className="radio-cover" /><div className="skl-line" style={{ width: '80%', marginTop: 9 }} /><div className="skl-line" style={{ width: '55%', marginTop: 6 }} /></div>
                  ))}</div>
                ) : shownResults.length === 0 ? (
                  <div className="radio-empty">
                    <p className="muted" style={{ maxWidth: 460, fontSize: 15 }}>{radioMsg(radioInfo)}</p>
                    {(radioInfo === 'no-token' || radioInfo.startsWith('http-')) && <button className="btn warm" onClick={() => { try { localStorage.setItem('pl_radio_return', '1'); } catch {} spotifyLogin(); }}>Reconnecter Spotify</button>}
                    {spotifyLastError() && <p className="radio-diag">⚙ {spotifyLastError()}</p>}
                  </div>
                ) : (
                  <div className="radio-grid">
                    {shownResults.map((p: any) => (
                      <button key={p.uri} className={`radio-card ${selPl?.uri === p.uri ? 'sel' : ''} ${radioActiveUri === p.uri ? 'on' : ''}`} onClick={() => openPlaylist(p)} title={p.name}>
                        <div className="radio-cover">{p.image ? <img src={p.image} alt="" onError={hideOnErr} /> : <span>{NOTE}</span>}{radioActiveUri === p.uri ? <span className="radio-eq"><i /><i /><i /></span> : <span className="radio-play">{PLAY(15)}</span>}</div>
                        <div className="radio-name">{p.name}</div>
                        <div className="radio-owner">{[p.total ? `${p.total} titres` : '', p.owner].filter(Boolean).join(' · ')}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selPl && (
                <aside className="radio-panel">
                  <div className="rpl-head">
                    <div className="rpl-cover">{selPl.image ? <img src={selPl.image} alt="" onError={hideOnErr} /> : <span>{NOTE}</span>}</div>
                    <div className="rpl-info">
                      <div className="rpl-kicker">Playlist</div>
                      <div className="rpl-name" title={selPl.name}>{selPl.name}</div>
                      <div className="rpl-meta">{[selPl.owner, trkInfo.total ? `${trkInfo.total} titres` : '', trkInfo.durationMs ? fmtTotal(trkInfo.durationMs) : ''].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>
                  {playlistPlaying
                    ? <button className="btn rpl-play playing" onClick={() => spotifyTogglePlay()}><span className="rpl-eq"><i /><i /><i /></span> {nowPlaying && nowPlaying.paused ? 'En pause — reprendre' : 'En cours de lecture'}</button>
                    : <button className="btn warm rpl-play" onClick={() => playWhole(selPl)}><span className="rpl-play-ic">{PLAY(15)}</span> Lancer la playlist</button>}
                  <div className="rpl-tracks">
                    {trkInfo.loading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <div className="rtrack skel" key={i}><span className="rt-idx" /><div className="rt-cov" /><div className="rt-main"><div className="skl-line" style={{ width: '70%' }} /><div className="skl-line" style={{ width: '45%', marginTop: 5 }} /></div><span className="skl-line" style={{ width: 32 }} /></div>
                      ))
                    ) : tracks.length === 0 ? (
                      <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                        {trkInfo.info === 'not-owned' ? (
                          <><div style={{ fontSize: 30, marginBottom: 8 }}>🔒</div>
                          <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>Spotify (mode dév) ne montre les titres que de <b style={{ color: 'var(--txt)' }}>tes</b> playlists. Celle-ci n’est pas à toi — mais tu peux quand même <b style={{ color: 'var(--fluo)' }}>la lancer</b> ▶.</p></>
                        ) : (
                          <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>{trkInfo.info && trkInfo.info !== 'empty' ? radioMsg(trkInfo.info) : 'Playlist vide.'}</p>
                        )}
                        {spotifyLastError() && <p className="radio-diag" style={{ marginTop: 10 }}>⚙ {spotifyLastError()}</p>}
                      </div>
                    ) : tracks.map((t: any, i: number) => {
                      const rowPlaying = !!npName && rn(t.title) === npName; // ce titre est celui qui joue
                      return (
                      <button className={`rtrack ${rowPlaying ? 'playing' : ''}`} key={t.uri + i} onClick={() => playTrack(t)} title={`${t.title} — ${t.artist}`}>
                        <span className="rt-idx">{i + 1}</span>
                        <div className="rt-cov">{t.cover ? <img src={t.cover} alt="" onError={hideOnErr} /> : <span>{NOTE}</span>}{rowPlaying ? <span className="rt-eq"><i /><i /><i /></span> : <span className="rt-play">{PLAY(13)}</span>}</div>
                        <div className="rt-main"><div className="rt-t">{t.title}</div><div className="rt-a">{t.artist}</div></div>
                        <span className="rt-dur">{fmtDur(t.durationMs)}</span>
                      </button>
                      );
                    })}
                  </div>
                </aside>
              )}
            </div>
          )}
        </div>

        {nowPlaying && (() => {
          const dur = nowPlaying.duration || 0;
          const pos = nowPlaying.paused ? nowPlaying.position : Math.min(dur, posRef.current.base + (Date.now() - posRef.current.at));
          const frac = dur ? Math.min(1, pos / dur) : 0;
          const rep = nowPlaying.repeat || 0;
          const controls = (lg = false) => (
            <div className="rp-controls">
              <button className={`rp-btn sm ${nowPlaying.shuffle ? 'act' : ''}`} onClick={() => spotifyShuffle(!nowPlaying.shuffle)} title="Aléatoire" aria-label="Aléatoire">{IC.shuffle}</button>
              <button className="rp-btn" onClick={() => spotifyPrev()} title="Précédent" aria-label="Précédent">{IC.prev}</button>
              <button className={`rp-btn play ${lg ? 'lg' : ''}`} onClick={() => spotifyTogglePlay()} aria-label={nowPlaying.paused ? 'Lecture' : 'Pause'}>{nowPlaying.paused ? IC.play(lg ? 30 : 18) : IC.pause(lg ? 30 : 18)}</button>
              <button className="rp-btn" onClick={() => spotifyNext()} title="Suivant" aria-label="Suivant">{IC.next}</button>
              <button className={`rp-btn sm ${rep > 0 ? 'act' : ''}`} onClick={() => spotifyRepeat(rep === 0 ? 'context' : rep === 1 ? 'track' : 'off')} title={rep === 2 ? 'Répéter ce morceau' : rep === 1 ? 'Répéter la playlist' : 'Activer la boucle'} aria-label="Boucle"><span className="rp-ic-wrap">{IC.repeat}{rep === 2 && <span className="rp-one">1</span>}</span></button>
            </div>
          );
          const bar = () => <div className="rp-bar" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); if (dur) spotifySeek(Math.round(((e.clientX - r.left) / r.width) * dur)); }}><div className="rp-fill" style={{ width: (frac * 100) + '%' }}><span className="rp-knob" /></div></div>;
          // titre plein écran : on ANTICIPE la longueur → taille réduite si long (jamais > 2 lignes)
          const nm = nowPlaying.name || '';
          const bigNameFs = nm.length > 40 ? 'clamp(20px,2.6vw,34px)' : nm.length > 26 ? 'clamp(25px,3.2vw,42px)' : nm.length > 16 ? 'clamp(30px,3.9vw,52px)' : 'clamp(34px,4.6vw,62px)';
          return (
            <>
              {bigPlayer > 0 && (
                <div className={`radio-big cine bigv${bigPlayer}${bigClosing ? ' closing' : ''}`} style={nowPlaying.image ? ({ ['--art' as any]: `url("${nowPlaying.image}")` }) : undefined}>
                  <div className="rbig-backdrop" aria-hidden="true" />
                  <button className="rbig-min" onClick={closeBig} title="Réduire" aria-label="Réduire">{IC.minimize}</button>
                  <div className="rbig-stage">
                    <div className="rbig-cover">{nowPlaying.image ? <img src={nowPlaying.image} alt="" /> : <span>{NOTE}</span>}</div>
                    <div className="rbig-panel">
                      <div className="rbig-kicker">Radio Punchlinr · en lecture</div>
                      <div className="rbig-name" style={{ fontSize: bigNameFs }}>{nowPlaying.name}</div>
                      <div className="rbig-artist">{nowPlaying.artist}</div>
                      <div className="rbig-prog"><span className="rp-time">{fmtDur(pos)}</span>{bar()}<span className="rp-time">{fmtDur(dur)}</span></div>
                      {controls(true)}
                    </div>
                  </div>
                </div>
              )}
              <div className="radio-player">
                <div className="rp-track">
                  {nowPlaying.image ? <img src={nowPlaying.image} alt="" /> : <div className="rp-ph">{NOTE}</div>}
                  <div className="rp-meta"><div className="rp-name">{nowPlaying.name}</div><div className="rp-artist">{nowPlaying.artist}</div></div>
                </div>
                <div className="rp-center">
                  {controls(false)}
                  <div className="rp-prog"><span className="rp-time">{fmtDur(pos)}</span>{bar()}<span className="rp-time">{fmtDur(dur)}</span></div>
                </div>
                <div className="rp-right">
                  <div className="rp-exps">
                    <button className={`rp-btn sm rp-exp ${bigPlayer > 0 ? 'act' : ''}`} onClick={() => setBigPlayer(1)} title="Plein écran" aria-label="Plein écran">{IC.expand}</button>
                  </div>
                  <button className="rp-cut" onClick={() => { spotifyPause(); setBigPlayer(0); setRadioActiveUri(''); }} title="Couper la radio" aria-label="Couper la radio">×</button>
                </div>
              </div>
            </>
          );
        })()}
      </div>
    );
  }

  // ---- roster ----
  const nmU = sel.name.toUpperCase();
  const nameFs = nmU.length > 12 ? 'clamp(34px,4.4vw,58px)' : nmU.length > 8 ? 'clamp(42px,5.2vw,72px)' : 'clamp(50px,6vw,84px)';
  const SL = sel.statLabels || ['Flow', 'Punch', 'Tech', 'Aura'];
  const statRows: [string, number][] = [[SL[0], sel.stats.flow], [SL[1], sel.stats.punch], [SL[2], sel.stats.tech], [SL[3], sel.stats.aura]];
  const idx = lockedSel ? LOCKED_SLOTS.indexOf(lockedSel) + 1 : 0;

  return (
    <div className={`hub-overlay tvros${isLegend(sel.cat) && !lockedSel ? ' irid' : ''}`} style={{ ['--c' as any]: lockedSel ? '#20222a' : sel.color, ['--cc' as any]: lockedSel ? '#7d8590' : CATEGORY_COLORS[sel.cat] }}>
      {defs}
      <button className="tvros-back" onClick={onClose}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        RETOUR
      </button>

      <div className="tvros-hero">
        {/* portrait (fondu tous bords) */}
        <div className="tvros-fig" ref={figRef}>
          <div className="tvros-figglow" />
          {lockedSel ? (
            <div className="tvros-lockq">?</div>
          ) : sel.img ? (
            <>
              <img className="tvros-portrait" src={`/avatars/${sel.id}.png`} alt="" onError={hideOnErr} />
              <img className="tvros-portrait tear" src={`/avatars/${sel.id}.png`} alt="" aria-hidden="true" onError={hideOnErr} />
            </>
          ) : (
            <div className="tvros-lockq">{initials(sel.name)}</div>
          )}
        </div>

        {/* colonne infos : nom, fiche, stats/pouvoir (ou objectif si verrouillé) */}
        <div className="tvros-side">
          <div className="tvros-nameblock">
            <div className="tvros-catchip"><span>{lockedSel ? 'Verrouillé' : sel.cat}</span></div>
            <div className="tvros-name" style={{ fontSize: lockedSel ? 'clamp(46px,5.6vw,84px)' : nameFs }}>{lockedSel ? '???' : nmU}</div>
            <div className="tvros-epi">{lockedSel ? `Challenger mystère n°${idx}` : `« ${EPITHETS[sel.id] || sel.power.name} »`}</div>
          </div>

          {lockedSel ? (
            <div className="tvros-obj">
              <div className="tvros-blabel">Objectif à accomplir</div>
              <div className="tvros-objtxt">{lockedSel.objective}</div>
              <div className="tvros-objnote">Réussis-le en partie pour révéler ce rappeur.</div>
            </div>
          ) : (
            <>
              {bio && (
                <div className="tvros-bio">
                  <div className="tvros-tags">
                    {bio.from && <span>{bio.from}</span>}
                    {bio.since && <span>Depuis {bio.since}</span>}
                    {bio.sales && <span className="sales">{bio.sales}</span>}
                  </div>
                  <div className="tvros-bionote">{bio.note}</div>
                </div>
              )}
              <div className="tvros-divider" />
              <div className="tvros-statpow">
                <div className="tvros-block tvros-stats">
                  <div className="tvros-blabel">Statistiques</div>
                  {statRows.map(([lab, v]) => (
                    <div className="tvros-srow" key={lab}>
                      <span className="tvros-slab">{lab}</span>
                      <span className="tvros-sbar">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= v ? 'on' : ''} />)}</span>
                    </div>
                  ))}
                </div>
                <div className="tvros-block tvros-pow">
                  <div className="tvros-blabel">Pouvoir signature</div>
                  <div className="tvros-pname">{sel.power.name}</div>
                  <div className="tvros-pfx">{sel.power.effect}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* GRILLE : tout le roster, aligné à gauche, tuiles biseautées */}
      <div className="tvros-grid">
        {ROSTER.map((a) => (
          <button key={a.id} className={`tvcell ${isLegend(a.cat) ? 'irid' : ''} ${selId === a.id ? 'sel' : ''}`} style={{ ['--cc' as any]: CATEGORY_COLORS[a.cat], ['--c' as any]: a.color }}
            onMouseEnter={() => setSelId(a.id)} onClick={() => setSelId(a.id)} title={a.name}>
            {a.img ? <img src={`/avatars/${a.id}.png`} alt={a.name} onError={hideOnErr} /> : <span className="ini">{initials(a.name)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
