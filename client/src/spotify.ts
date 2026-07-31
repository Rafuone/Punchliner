// ════════════════════════════════════════════════════════════════════════
//  Intégration Spotify (écran HÔTE uniquement)
// ════════════════════════════════════════════════════════════════════════
// Source de lecture OPTIONNELLE, en plus de Deezer (qui reste le repli auto).
//  - Auth : Authorization Code + PKCE (public, PAS de client secret).
//  - Lecture : Web Playback SDK → l'onglet /host devient un device Spotify Connect.
//    On joue le morceau COMPLET et on `position_ms` où on veut → l'extrait démarre
//    au milieu, exactement comme voulu (offset choisi/aléatoire).
//  - PREMIUM OBLIGATOIRE. Sans Premium/connexion → rien ne joue ici, l'hôte
//    retombe sur Deezer.
//  - Contexte sécurisé requis : ouvrir l'hôte via http://127.0.0.1:5173/host
//    (localhost refusé par la redirect URI Spotify 2025). Les téléphones ne
//    touchent JAMAIS Spotify.
//
// L'EQ/glow réactif de l'hôte lit le <audio> de la page via WebAudio ; le son
// Spotify passe par un lecteur isolé (DRM) → l'EQ ne réagira pas pendant Spotify.
// (Compromis assumé : la MUSIQUE prime. À améliorer plus tard si besoin.)

const CLIENT_ID = '4b5842ddb3ef4a1f9f14b789a0a35706';
// playlist-read-private/-collaborative = nécessaires pour /v1/me/playlists (« Mes playlists »), sinon 403 "Insufficient client scope".
const SCOPES = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state playlist-read-private playlist-read-collaborative';
const KEY = 'pl_spotify';
const VERIFIER_KEY = 'pl_sp_verifier';
// DOIT correspondre EXACTEMENT à la redirect URI déclarée dans le dashboard (http://127.0.0.1:5173/host).
const REDIRECT_URI = window.location.origin + '/host';

type Tokens = { access_token: string; refresh_token?: string; expires_at: number };

// Dernière erreur Spotify lisible par l'humain → affichée à l'écran (radio) pour diagnostiquer sans la console.
let lastError = '';
export function spotifyLastError() { return lastError; }
const setErr = (m: string) => { lastError = m; if (m) console.warn('[SPOTIFY] ' + m); };

/* ---------- stockage token ---------- */
function load(): Tokens | null { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
function store(j: any) {
  const prev = load();
  const t: Tokens = {
    access_token: j.access_token,
    refresh_token: j.refresh_token || prev?.refresh_token,
    expires_at: Date.now() + (j.expires_in || 3600) * 1000,
  };
  localStorage.setItem(KEY, JSON.stringify(t));
}
export function hasSpotifySession() { return !!load(); }
export function spotifyLogout() { localStorage.removeItem(KEY); ready = false; deviceId = ''; try { player?.disconnect(); } catch {} player = null; initing = false; } // reset COMPLET (sinon toute reconnexion future est bloquée par la garde de initSpotifyPlayer)

/* ---------- PKCE ---------- */
function b64url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randStr(n = 64) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let s = ''; for (const x of crypto.getRandomValues(new Uint8Array(n))) s += a[x % a.length]; return s;
}

// Spotify (policy 2025) exige une redirect URI en IP loopback LITTÉRALE : « localhost » est REFUSÉ.
// Ouvert ailleurs que sur http://127.0.0.1, le bouton « Connecter » ne peut RIEN faire (spotifyLogin sort
// aussitôt) → ça donne un bouton mort. On renvoie ici la MÊME page en 127.0.0.1 pour proposer le clic qui
// débloque, ou '' quand on est déjà au bon endroit.
export function spotifyLoopbackUrl(): string {
  if (typeof window === 'undefined') return '';
  const l = window.location;
  if (l.hostname === '127.0.0.1') return '';
  return `http://127.0.0.1:${l.port || '5173'}${l.pathname}${l.search}`;
}

export async function spotifyLogin() {
  // Spotify (policy 2025) EXIGE une redirect URI en IP loopback LITTÉRALE (http://127.0.0.1) : « localhost » ET les IP
  // de LAN en http:// sont REFUSÉS. REDIRECT_URI = origin + '/host' → si l'hôte n'est PAS ouvert sur http://127.0.0.1,
  // l'écran Spotify répond « Invalid redirect URI » et la popup ne revient JAMAIS avec un code (= « jamais connecté »).
  // On bloque tôt avec un message clair au lieu d'une popup vouée à l'échec. (Les téléphones gardent l'IP LAN, indépendant.)
  if (window.location.hostname !== '127.0.0.1') {
    setErr('Pour Spotify : ouvre l’hôte sur http://127.0.0.1:' + (window.location.port || '5173') + '/host · Spotify refuse « localhost » et les IP du réseau local.');
    return;
  }
  const verifier = randStr(64);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  // verifier en localStorage (PAS sessionStorage) : un aller-retour OAuth peut vider le sessionStorage sur
  // certains navigateurs → code_verifier perdu → échange 400 (invalid_grant). localStorage survit à coup sûr.
  localStorage.setItem(VERIFIER_KEY, verifier);
  setErr('');
  const p = new URLSearchParams({
    client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256', code_challenge: challenge, scope: SCOPES,
  });
  const url = 'https://accounts.spotify.com/authorize?' + p.toString();
  // POPUP au lieu d'une redirection pleine page → l'app (et la partie en cours) ne se rechargent PAS.
  // Le code revient via postMessage (voir listenSpotifyAuth + main.tsx). Repli redirection si la popup est bloquée.
  const w = 480, h = 720;
  const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
  // marqueur : le prochain retour ?code sur /host = notre fenêtre popup. FIABLE même si window.opener est neutralisé
  // par la politique COOP (auquel cas postMessage ne marche pas → on passe par un event localStorage, cf. main.tsx).
  try { localStorage.setItem('pl_sp_popup', '1'); } catch {}
  const popup = window.open(url, 'pl-spotify-auth', `width=${w},height=${h},left=${left},top=${top}`);
  if (!popup) { try { localStorage.removeItem('pl_sp_popup'); } catch {} window.location.href = url; } // popup bloquée → repli redirection
}

// Échange le code OAuth contre le token (exporté pour que la POPUP le fasse elle-même — le verifier est en
// localStorage, partagé). Renvoie true si OK.
export async function exchangeSpotifyCode(code: string): Promise<boolean> {
  try { await exchangeCode(code); return true; } catch { return false; }
}

// À appeler dans la fenêtre PRINCIPALE : la popup a échangé le token et signale via postMessage (si window.opener
// dispo) OU via un event localStorage `pl_sp_done` (repli anti-COOP). onDone(true) = session prête → réinit du SDK.
export function listenSpotifyAuth(onDone: (ok: boolean) => void) {
  const finish = (ok: boolean, error?: string) => { if (error) setErr('Spotify a refusé l’autorisation : ' + error); onDone(!!ok); };
  const onMsg = (e: MessageEvent) => { if (e.origin !== window.location.origin || !e.data || !e.data.__spotify_auth) return; finish(!!e.data.__spotify_auth.ok, e.data.__spotify_auth.error); };
  const onStorage = (e: StorageEvent) => { if (e.key !== 'pl_sp_done' || !e.newValue) return; try { const d = JSON.parse(e.newValue); finish(!!d.ok, d.error); } catch {} };
  window.addEventListener('message', onMsg);
  window.addEventListener('storage', onStorage); // storage event = fiable entre fenêtres même origine, indépendant de window.opener
  return () => { window.removeEventListener('message', onMsg); window.removeEventListener('storage', onStorage); };
}

async function exchangeCode(code: string) {
  const verifier = localStorage.getItem(VERIFIER_KEY) || sessionStorage.getItem(VERIFIER_KEY) || '';
  if (!verifier) { setErr('Reconnexion : code de sécurité (verifier) introuvable · reclique « Reconnecter ».'); throw new Error('no verifier'); }
  const body = new URLSearchParams({ client_id: CLIENT_ID, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: verifier });
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    setErr('Échange du code refusé par Spotify (HTTP ' + r.status + ') · ' + txt + ' · redirect_uri=' + REDIRECT_URI);
    throw new Error('spotify token exchange failed');
  }
  store(await r.json());
  localStorage.removeItem(VERIFIER_KEY); sessionStorage.removeItem(VERIFIER_KEY);
  setErr('');
}

// ⚠️ Spotify FAIT TOURNER le refresh_token à chaque refresh (rotation) → deux refresh concurrents (SDK + app)
// se marchent dessus et cassent la session. On SÉRIALISE : un seul refresh en vol, les autres attendent le même.
let refreshing: Promise<Tokens | null> | null = null;
async function doRefresh(): Promise<Tokens | null> {
  const t = load(); if (!t?.refresh_token) return null;
  const body = new URLSearchParams({ client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token: t.refresh_token });
  // On NE vide la session QUE si le refresh_token est DÉFINITIVEMENT mort (invalid_grant). Avant, tout 400/401
  // (blip réseau, 429, 5xx, désync horloge) détruisait la session → l'hôte devait redonner l'autorisation Spotify
  // en boucle (20×/soirée). Désormais : erreur transitoire = on GARDE la session + petit retry.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      if (r.ok) { store(await r.json()); return load(); }
      const txt = await r.text().catch(() => '');
      console.warn('[SPOTIFY] refresh HTTP ' + r.status + ' · ' + txt);
      if (/invalid_grant/i.test(txt)) { localStorage.removeItem(KEY); ready = false; deviceId = ''; return null; } // vraiment mort → reconnexion
      await new Promise((res) => setTimeout(res, 500)); // transitoire → on réessaie une fois, session conservée
    } catch (e) { console.warn('[SPOTIFY] refresh réseau KO', e); await new Promise((res) => setTimeout(res, 500)); }
  }
  return null; // échec transitoire : session CONSERVÉE (on retentera au prochain besoin)
}
function refresh(): Promise<Tokens | null> {
  if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null; });
  return refreshing;
}

async function getToken(): Promise<string | null> {
  let t = load(); if (!t) return null;
  if (Date.now() > t.expires_at - 120000) t = await refresh(); // marge 2 min : on rafraîchit AVANT expiration
  return t?.access_token || null;
}

// À appeler au montage de l'hôte : si on revient de Spotify (?code=), on échange le code.
export async function handleSpotifyRedirect(): Promise<boolean> {
  const p = new URLSearchParams(window.location.search);
  const err = p.get('error');
  if (err) { setErr('Spotify a refusé l’autorisation : ' + err); window.history.replaceState({}, '', window.location.pathname); return false; }
  if (p.get('code')) {
    try { await exchangeCode(p.get('code')!); } catch (e) { /* setErr déjà positionné dans exchangeCode → visible à l'écran */ }
    window.history.replaceState({}, '', window.location.pathname);
    return true;
  }
  return false;
}

/* ---------- Web Playback SDK ---------- */
let player: any = null;
let deviceId = '';
let ready = false;
let initing = false; // garde-fou double-init (React StrictMode)

export function isSpotifyReady() { return ready && !!deviceId; }
// Détruit le player courant → force initSpotifyPlayer à RECONSTRUIRE un SDK avec un token FRAIS (à appeler après une nouvelle auth popup).
export function resetSpotifyPlayer() { try { player?.disconnect(); } catch {} player = null; ready = false; deviceId = ''; initing = false; }

function loadSdk(): Promise<void> {
  return new Promise((res, rej) => {
    if (document.getElementById('sp-sdk')) return res();
    const s = document.createElement('script');
    s.id = 'sp-sdk'; s.src = 'https://sdk.scdn.co/spotify-player.js';
    s.onload = () => res(); s.onerror = () => rej(new Error('sdk load failed'));
    document.head.appendChild(s);
  });
}

// state: 'ready' | 'offline' | 'auth_error' | 'premium_required' | 'no_token' | 'error'
export async function initSpotifyPlayer(onState: (s: string) => void) {
  if (initing || player) return; // déjà lancé
  initing = true;
  const token = await getToken();
  if (!token) { initing = false; onState('no_token'); return; }
  // On enregistre le callback SDK AVANT de charger le script (sinon on peut rater l'event "ready").
  const sdkReady = new Promise<void>((res) => {
    if ((window as any).Spotify) return res();
    (window as any).onSpotifyWebPlaybackSDKReady = () => res();
  });
  try { await loadSdk(); } catch { initing = false; onState('error'); return; }
  await sdkReady;
  player = new (window as any).Spotify.Player({
    name: 'PUNCHLINR', volume: 0.85,
    getOAuthToken: async (cb: (t: string) => void) => { const t = await getToken(); if (t) cb(t); },
  });
  player.addListener('ready', ({ device_id }: any) => { deviceId = device_id; ready = true; onState('ready'); });
  player.addListener('not_ready', () => { ready = false; onState('offline'); });
  player.addListener('authentication_error', async () => {
    // token rejeté par le SDK (souvent : access token périmé) → on tente UN refresh silencieux + reconnexion
    // AVANT de demander à l'hôte de se reconnecter à la main. Évite une ré-autorisation inutile.
    const fresh = await refresh();
    if (fresh) { try { player.connect(); return; } catch {} }
    ready = false; onState('auth_error');
  });
  player.addListener('account_error', () => { ready = false; onState('premium_required'); });
  player.addListener('initialization_error', () => { ready = false; onState('error'); });
  // état de lecture (now-playing) → pour la barre de lecture de la Radio
  player.addListener('player_state_changed', (s: any) => {
    const t = s?.track_window?.current_track;
    const np = t ? { paused: !!s.paused, name: t.name, artist: (t.artists || []).map((a: any) => a.name).join(', '), image: t.album?.images?.[0]?.url || '', position: s.position || 0, duration: s.duration || t.duration_ms || 0, shuffle: !!s.shuffle, repeat: s.repeat_mode || 0 } : null;
    stateSubs.forEach((cb) => { try { cb(np); } catch {} });
  });
  player.connect();
  initing = false; // succès : on relâche le verrou (la garde `player` empêche toujours une double-init) → ré-init possible après reset
}

/* ---------- Radio : now-playing + lecture de playlists ---------- */
type NowPlaying = { paused: boolean; name: string; artist: string; image: string; position: number; duration: number; shuffle: boolean; repeat: number } | null;
const stateSubs: Array<(s: NowPlaying) => void> = [];
export function onPlayerState(cb: (s: NowPlaying) => void) { stateSubs.push(cb); return () => { const i = stateSubs.indexOf(cb); if (i >= 0) stateSubs.splice(i, 1); }; }

// Recherche des playlists (stations + recherche libre). Renvoie les résultats ET un code d'info (pour AFFICHER la
// vraie cause quand c'est vide : token mort, 401, bug "items null" de Spotify…).
// ⚠️ limit MAX = 20 : au-delà (ex. 40) Spotify renvoie 400 "Invalid limit" (cap réel < doc, découvert au playtest).
export type PlaylistItem = { id: string; name: string; uri: string; image: string; owner: string; total: number };
export type PlaylistTrack = { uri: string; title: string; artist: string; durationMs: number; cover: string };
export async function searchPlaylists(query: string, limit = 20): Promise<{ items: PlaylistItem[]; info: string }> {
  const token = await getToken(); if (!token) return { items: [], info: 'no-token' };
  const lim = Math.min(Math.max(1, Math.floor(limit) || 20), 50);
  const mapItems = (raw: any[]) => raw.filter(Boolean).map((p: any) => ({ id: p.id, name: p.name || 'Playlist', uri: p.uri, image: p.images?.[0]?.url || '', owner: p.owner?.display_name || 'Spotify', total: p.tracks?.total || 0 }));
  const q = encodeURIComponent(query);
  // Spotify renvoie parfois des 400 à MESSAGE TROMPEUR ("Invalid limit") sur la recherche selon les paramètres.
  // → on essaie de la variante la + riche à la + basique et on garde la 1re qui rend des résultats (auto-réparation).
  const variants = [
    `type=playlist&q=${q}&limit=${lim}&market=FR`,
    `type=playlist&q=${q}&limit=${lim}`,
    `type=playlist&q=${q}&market=FR`,
    `type=playlist&q=${q}`,
  ];
  let lastStatus = 0, lastBody = '', lastVariant = '';
  try {
    for (const v of variants) {
      const r = await fetch('https://api.spotify.com/v1/search?' + v, { headers: { Authorization: 'Bearer ' + token } });
      if (!r.ok) { lastStatus = r.status; lastBody = (await r.text().catch(() => '')).slice(0, 120); lastVariant = v; continue; }
      const items = mapItems((await r.json())?.playlists?.items || []);
      if (items.length) { setErr(''); return { items, info: '' }; } // 1re variante qui rend des playlists → gagné
      lastStatus = 200; lastVariant = v; // 200 mais items null/vides → on tente une variante + simple
    }
    // rien n'a donné de résultat : on remonte la vraie cause à l'écran (statut + variante + corps Spotify)
    if (lastStatus && lastStatus !== 200) { setErr('[v3] Recherche playlists HTTP ' + lastStatus + ' · token=' + token.length + ' car. · [' + lastVariant + '] · ' + lastBody); return { items: [], info: 'http-' + lastStatus }; }
    setErr(''); return { items: [], info: lastStatus === 200 ? 'all-null' : 'empty' };
  } catch { return { items: [], info: 'network' }; }
}

// Lance une playlist (context_uri) sur notre device, en aléatoire (ambiance radio). Renvoie false si non jouable.
export async function spotifyPlayContext(contextUri: string): Promise<boolean> {
  const token = await getToken(); if (!token || !deviceId) return false;
  try {
    await fetch('https://api.spotify.com/v1/me/player/shuffle?state=true&device_id=' + deviceId, { method: 'PUT', headers: { Authorization: 'Bearer ' + token } }).catch(() => {});
    const r = await fetch('https://api.spotify.com/v1/me/player/play?device_id=' + deviceId, {
      method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ context_uri: contextUri }),
    });
    return r.ok || r.status === 204;
  } catch { return false; }
}
export async function spotifyTogglePlay() { try { await player?.togglePlay(); } catch {} }
export async function spotifyNext() { try { await player?.nextTrack(); } catch {} }
export async function spotifyPrev() { try { await player?.previousTrack(); } catch {} }
export async function spotifySeek(ms: number) { try { await player?.seek(Math.max(0, ms)); } catch {} }
async function playerCmd(path: string) { // repeat/shuffle passent par l'API REST (le SDK ne les expose pas)
  const token = await getToken(); if (!token || !deviceId) return;
  try { await fetch('https://api.spotify.com/v1/me/player/' + path + (path.includes('?') ? '&' : '?') + 'device_id=' + deviceId, { method: 'PUT', headers: { Authorization: 'Bearer ' + token } }); } catch {}
}
export async function spotifyRepeat(state: 'off' | 'context' | 'track') { await playerCmd('repeat?state=' + state); }
export async function spotifyShuffle(on: boolean) { await playerCmd('shuffle?state=' + (on ? 'true' : 'false')); }

// Les playlists de l'utilisateur (= sa bibliothèque → le vrai « Tout »). Renvoie [] + info si vide/erreur.
export async function getMyPlaylists(limit = 50): Promise<{ items: PlaylistItem[]; info: string }> {
  const token = await getToken(); if (!token) return { items: [], info: 'no-token' };
  try {
    const r = await fetch('https://api.spotify.com/v1/me/playlists?limit=' + Math.min(50, limit), { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) { const txt = await r.text().catch(() => ''); setErr('[v3] Mes playlists HTTP ' + r.status + ' · ' + txt.slice(0, 120)); return { items: [], info: 'http-' + r.status }; }
    const raw = ((await r.json())?.items || []) as any[];
    const items = raw.filter(Boolean).map((p: any) => ({ id: p.id, name: p.name || 'Playlist', uri: p.uri, image: p.images?.[0]?.url || '', owner: p.owner?.display_name || 'moi', total: p.tracks?.total || 0 }));
    setErr('');
    return { items, info: items.length ? '' : 'empty' };
  } catch { return { items: [], info: 'network' }; }
}

// Les titres d'une playlist : cover/titre/artiste/durée. `/playlists/{id}/tracks` a été supprimé (fév. 2026) →
// on utilise `/items`. ⚠️ RÈGLE PLATEFORME (Development Mode, fév. 2026) : `/items` ne renvoie les titres QUE si le
// user connecté POSSÈDE la playlist (ou en est collaborateur). Playlist d'un AUTRE user → 403, INCONTOURNABLE en
// code (Extended Quota requis, fermé aux hobbyistes). MAIS on peut toujours la LANCER (context_uri) — seul
// l'affichage des titres est bloqué → on renvoie info 'not-owned' pour messager clairement sans écran vide.
export async function getPlaylistTracks(id: string): Promise<{ tracks: PlaylistTrack[]; total: number; durationMs: number; info: string }> {
  const token = await getToken(); if (!token) return { tracks: [], total: 0, durationMs: 0, info: 'no-token' };
  const auth = { Authorization: 'Bearer ' + token };
  const mapTracks = (items: any[]): PlaylistTrack[] => (items || []).map((it: any) => it?.track || it?.item || it).filter((t: any) => t && t.uri).map((t: any) => ({
    uri: t.uri, title: t.name || '?', artist: (t.artists || []).map((a: any) => a.name).join(', ') || '?',
    durationMs: t.duration_ms || 0, cover: t.album?.images?.[t.album.images.length - 1]?.url || t.album?.images?.[0]?.url || '',
  }));
  const B = 'https://api.spotify.com/v1/playlists/' + id;
  const urls = [B + '/items?limit=100&additional_types=track', B + '/items?limit=100'];
  let lastStatus = 0, lastBody = '';
  try {
    for (const url of urls) {
      const r = await fetch(url, { headers: auth });
      if (r.ok) {
        const tracks = mapTracks((await r.json())?.items);
        if (tracks.length) { setErr(''); return { tracks, total: tracks.length, durationMs: tracks.reduce((s, t) => s + t.durationMs, 0), info: '' }; }
        lastStatus = 200; continue;
      }
      lastStatus = r.status; lastBody = (await r.text().catch(() => '')).slice(0, 120);
    }
    if (lastStatus === 403) { setErr(''); return { tracks: [], total: 0, durationMs: 0, info: 'not-owned' }; } // pas ta playlist → jouable, titres masqués (mode dév)
    if (lastStatus && lastStatus !== 200) { setErr('[v6] Titres playlist HTTP ' + lastStatus + ' · id=' + id + ' · ' + lastBody); return { tracks: [], total: 0, durationMs: 0, info: 'http-' + lastStatus }; }
    setErr(''); return { tracks: [], total: 0, durationMs: 0, info: 'empty' };
  } catch { return { tracks: [], total: 0, durationMs: 0, info: 'network' }; }
}

// Joue UN morceau précis (par uri) sur notre device — clic sur une ligne de la tracklist.
export async function spotifyPlayUri(uri: string): Promise<boolean> {
  const token = await getToken(); if (!token || !deviceId) return false;
  try {
    const r = await fetch('https://api.spotify.com/v1/me/player/play?device_id=' + deviceId, {
      method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [uri] }),
    });
    return r.ok || r.status === 204;
  } catch { return false; }
}

/* ---------- recherche + lecture ---------- */
const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// ⚠️ LATENCE (retour soirée 2026-07-26 : « la musique met 12 s à démarrer »). Le préchargement met les extraits
// DEEZER en blob, mais côté Spotify chaque manche refaisait une RECHERCHE avant de pouvoir jouer — donc l'attente
// revenait à chaque manche, préchargement ou pas. On mémorise donc la résolution : `spotifyResolves`, appelé sur
// TOUTE la playlist pendant le préchargement, remplit ce cache → au coup d'envoi, jouer = un seul PUT.
const uriCache = new Map<string, { uri: string; durationMs: number } | null>();
const uriKey = (t: string, a: string) => (t + '|' + a).toLowerCase();
export function spotifyCacheSize() { return [...uriCache.values()].filter(Boolean).length; }
export function spotifyDropCache() { uriCache.clear(); }

async function findUri(title: string, artist: string): Promise<{ uri: string; durationMs: number } | null> {
  const ck = uriKey(title, artist);
  if (uriCache.has(ck)) return uriCache.get(ck) || null;
  const hit = await findUriNet(title, artist);
  if (hit) uriCache.set(ck, hit); // on ne mémorise QUE les succès : un échec réseau ne doit pas condamner le titre
  return hit;
}

async function findUriNet(title: string, artist: string): Promise<{ uri: string; durationMs: number } | null> {
  const token = await getToken(); if (!token) return null;
  const q = `track:${title} artist:${artist}`;
  const r = await fetch('https://api.spotify.com/v1/search?type=track&limit=5&market=FR&q=' + encodeURIComponent(q), { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const items = (await r.json())?.tracks?.items || [];
  const want = norm(artist);
  const hit = items.find((t: any) => (t.artists || []).some((a: any) => { const n = norm(a.name); return n && (n.includes(want) || want.includes(n)); })) || items[0];
  return hit ? { uri: hit.uri, durationMs: hit.duration_ms || 0 } : null;
}

// Le morceau existe-t-il sur Spotify ? (préchargement : on VÉRIFIE avant la partie les titres qui n'ont aucun
// extrait Deezer de repli — un « introuvable » découvert en pleine manche = manche muette.)
export async function spotifyResolves(title: string, artist: string): Promise<boolean> {
  try { return !!(await findUri(title, artist)); } catch { return false; }
}

// Joue `title/artist` sur notre device. On démarre TOUJOURS en plein morceau (JAMAIS l'intro) : Spotify n'a plus
// d'extrait "curated" (API fermée nov. 2024), donc on choisit nous-mêmes un point ~1/3 du titre (souvent
// couplet/refrain reconnaissable). offset=true (difficulté dure) → plage plus profonde/variée.
// Renvoie false si non jouable → l'hôte retombe sur Deezer (dont le clip 30 s est déjà un extrait).
export async function spotifyPlay(title: string, artist: string, offset: boolean): Promise<boolean> {
  const token = await getToken(); if (!token || !deviceId) return false;
  let found: { uri: string; durationMs: number } | null = null;
  try { found = await findUri(title, artist); } catch { return false; }
  if (!found) return false;
  const dur = found.durationMs > 20000 ? found.durationMs : 180000; // garde-fou : durée manquante/absurde → on suppose 3 min
  const frac = offset ? (0.32 + Math.random() * 0.28) : (0.26 + Math.random() * 0.16); // dur 32-60 % · standard 26-42 %
  const pos = Math.floor(dur * frac);
  try {
    const r = await fetch('https://api.spotify.com/v1/me/player/play?device_id=' + deviceId, {
      method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [found.uri], position_ms: pos }),
    });
    return r.ok || r.status === 204;
  } catch { return false; }
}

export async function spotifyPause() { try { await player?.pause(); } catch {} }
// REPRENDRE explicitement (jamais `togglePlay` : une bascule DEVINE l'état, et quand l'état réel diffère elle
// fait exactement l'inverse — d'où « la musique ne s'arrête pas et l'autre commence » en Buzzer, 2026-07-26).
export async function spotifyResume() { try { await player?.resume(); } catch {} }
// Le lecteur Spotify joue-t-il RÉELLEMENT ? (garde-fou « une seule source à la fois » côté hôte.)
export async function spotifyIsPlaying(): Promise<boolean> {
  try { const s = await player?.getCurrentState(); return !!s && !s.paused; } catch { return false; }
}
