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
const SCOPES = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';
const KEY = 'pl_spotify';
const VERIFIER_KEY = 'pl_sp_verifier';
// DOIT correspondre EXACTEMENT à la redirect URI déclarée dans le dashboard (http://127.0.0.1:5173/host).
const REDIRECT_URI = window.location.origin + '/host';

type Tokens = { access_token: string; refresh_token?: string; expires_at: number };

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
export function spotifyLogout() { localStorage.removeItem(KEY); ready = false; deviceId = ''; try { player?.disconnect(); } catch {} }

/* ---------- PKCE ---------- */
function b64url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randStr(n = 64) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let s = ''; for (const x of crypto.getRandomValues(new Uint8Array(n))) s += a[x % a.length]; return s;
}

export async function spotifyLogin() {
  const verifier = randStr(64);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const p = new URLSearchParams({
    client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256', code_challenge: challenge, scope: SCOPES,
  });
  window.location.href = 'https://accounts.spotify.com/authorize?' + p.toString();
}

async function exchangeCode(code: string) {
  const verifier = sessionStorage.getItem(VERIFIER_KEY) || '';
  const body = new URLSearchParams({ client_id: CLIENT_ID, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, code_verifier: verifier });
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) throw new Error('spotify token exchange failed');
  store(await r.json());
  sessionStorage.removeItem(VERIFIER_KEY);
}

// ⚠️ Spotify FAIT TOURNER le refresh_token à chaque refresh (rotation) → deux refresh concurrents (SDK + app)
// se marchent dessus et cassent la session. On SÉRIALISE : un seul refresh en vol, les autres attendent le même.
let refreshing: Promise<Tokens | null> | null = null;
async function doRefresh(): Promise<Tokens | null> {
  const t = load(); if (!t?.refresh_token) return null;
  const body = new URLSearchParams({ client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token: t.refresh_token });
  try {
    const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!r.ok) return null; // token invalide → on NE vide PAS la session (l'utilisateur pourra recliquer), mais pas de crash
    store(await r.json());
    return load();
  } catch { return null; }
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
  if (p.get('code')) {
    try { await exchangeCode(p.get('code')!); } catch (e) { /* échange raté → l'utilisateur pourra recliquer */ }
    window.history.replaceState({}, '', window.location.pathname);
    return true;
  }
  if (p.get('error')) window.history.replaceState({}, '', window.location.pathname);
  return false;
}

/* ---------- Web Playback SDK ---------- */
let player: any = null;
let deviceId = '';
let ready = false;
let initing = false; // garde-fou double-init (React StrictMode)

export function isSpotifyReady() { return ready && !!deviceId; }

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
  player.addListener('authentication_error', () => { ready = false; onState('auth_error'); });
  player.addListener('account_error', () => { ready = false; onState('premium_required'); });
  player.addListener('initialization_error', () => { ready = false; onState('error'); });
  // état de lecture (now-playing) → pour la barre de lecture de la Radio
  player.addListener('player_state_changed', (s: any) => {
    const t = s?.track_window?.current_track;
    const np = t ? { paused: !!s.paused, name: t.name, artist: (t.artists || []).map((a: any) => a.name).join(', '), image: t.album?.images?.[0]?.url || '' } : null;
    stateSubs.forEach((cb) => { try { cb(np); } catch {} });
  });
  player.connect();
}

/* ---------- Radio : now-playing + lecture de playlists ---------- */
type NowPlaying = { paused: boolean; name: string; artist: string; image: string } | null;
const stateSubs: Array<(s: NowPlaying) => void> = [];
export function onPlayerState(cb: (s: NowPlaying) => void) { stateSubs.push(cb); return () => { const i = stateSubs.indexOf(cb); if (i >= 0) stateSubs.splice(i, 1); }; }

// Recherche des playlists (pour les stations radio + la recherche libre). Pas de refonte de Spotify : on liste juste.
export async function searchPlaylists(query: string, limit = 12): Promise<Array<{ name: string; uri: string; image: string; owner: string }>> {
  const token = await getToken(); if (!token) return [];
  try {
    const r = await fetch('https://api.spotify.com/v1/search?type=playlist&market=FR&limit=' + limit + '&q=' + encodeURIComponent(query), { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) return [];
    const items = (await r.json())?.playlists?.items || [];
    return items.filter(Boolean).map((p: any) => ({ name: p.name, uri: p.uri, image: p.images?.[0]?.url || '', owner: p.owner?.display_name || 'Spotify' }));
  } catch { return []; }
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

/* ---------- recherche + lecture ---------- */
const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

async function findUri(title: string, artist: string): Promise<{ uri: string; durationMs: number } | null> {
  const token = await getToken(); if (!token) return null;
  const q = `track:${title} artist:${artist}`;
  const r = await fetch('https://api.spotify.com/v1/search?type=track&limit=5&market=FR&q=' + encodeURIComponent(q), { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const items = (await r.json())?.tracks?.items || [];
  const want = norm(artist);
  const hit = items.find((t: any) => (t.artists || []).some((a: any) => { const n = norm(a.name); return n && (n.includes(want) || want.includes(n)); })) || items[0];
  return hit ? { uri: hit.uri, durationMs: hit.duration_ms || 0 } : null;
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
