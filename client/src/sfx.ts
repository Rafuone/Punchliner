// MAQUETTE de sons (test) — previews Freesound chargées à la volée (connexion requise).
// But : se faire une idée. On remplacera par la sélection finale, rapatriée en local dans public/sfx/.
// Coupe le son : localStorage.setItem('pl_sfx_off','1'). Réactive : removeItem.
const URLS: Record<string, string> = {
  hover: 'https://cdn.freesound.org/previews/488/488382_10523948-lq.mp3',   // UIHover2 (survol)
  click: 'https://cdn.freesound.org/previews/611/611451_10912485-lq.mp3',   // clic bouton / tuile
  confirm: 'https://cdn.freesound.org/previews/729/729216_15690038-lq.mp3', // valider / bonne réponse / rejoint
  error: 'https://cdn.freesound.org/previews/343/343017_5968849-lq.mp3',    // faute / raté
  scratch: 'https://cdn.freesound.org/previews/661/661404_14498354-lq.mp3', // reveal / activation pouvoir
  horn: 'https://cdn.freesound.org/previews/131/131930_1542102-lq.mp3',     // victoire / hype
  countdown: 'https://cdn.freesound.org/previews/849/849886_17559721-lq.mp3', // UI TextBlip 08 (tick 3-2-1)
  launch: 'https://cdn.freesound.org/previews/542/542043_6856600-lq.mp3',   // GASP UI Notification 1 (lancer la partie)
  recap: 'https://cdn.freesound.org/previews/484/484632_10392137-lq.mp3',   // LCHZ 140 Bass 06 (boucle sur le récap)
  airhorn: 'https://cdn.freesound.org/previews/414/414208_6938106-lq.mp3',  // "Airhorn" (sélection d'Alexandre) — cheat code
};
const VOL: Record<string, number> = { hover: 0.34, click: 0.5, confirm: 0.6, error: 0.58, scratch: 0.62, horn: 0.6, countdown: 0.5, launch: 0.62, recap: 0.4, airhorn: 0.65 };
// Durée MAX de lecture (ms) par son : au-delà on COUPE net. Absent = le son joue en entier.
// NB : 'scratch' est désormais SYNTHÉTISÉ (playScratch, WebAudio) → il ne passe plus par ce cap.
const MAXMS: Record<string, number> = {};
const stopTimers: Record<string, ReturnType<typeof setTimeout> | undefined> = {};
const cache: Record<string, HTMLAudioElement> = {};
const off = () => { try { return localStorage.getItem('pl_sfx_off') === '1'; } catch { return false; } };

// ─────────────────────────────────────────────────────────────────────────────
// SCRATCH SYNTHÉTISÉ (WebAudio) — remplace la preview Freesound (trop longue/"grande").
// Un "zig" de DJ COURT (~130 ms) : bruit blanc filtré par un BANDPASS résonant (Q élevé →
// le bruit devient "pitché" comme un vinyle scrubé) + double coup rapide "wi-chi" (2 strokes),
// avec sweep de fréquence du filtre ET de playbackRate (aller-retour de la main sur la platine).
// Déterministe, offline, coupable net (sfxStop('scratch') / sfxStopAll).
// TUNING : voir les const S1/GAP/S2 (durées) et les valeurs de sweep du bandpass/playbackRate ci-dessous.
let actx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
const scratchSources = new Set<AudioBufferSourceNode>();
const scratchMasters = new Set<GainNode>();

function scratchCtx(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    if (!actx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  } catch { return null; }
}
function scratchNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = Math.floor(ctx.sampleRate * 0.4);            // 0,4 s de bruit blanc, bouclé pendant le scrub
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}
// Coupe TOUS les scratches synth en cours (net). Appelé par sfxStop('scratch') / sfxStopAll().
function stopScratch() {
  try {
    scratchSources.forEach((s) => { try { s.stop(); } catch {} try { s.disconnect(); } catch {} });
    scratchSources.clear();
    scratchMasters.forEach((m) => { try { m.gain.cancelScheduledValues(0); m.gain.setValueAtTime(0, m.context.currentTime); m.disconnect(); } catch {} });
    scratchMasters.clear();
  } catch {}
}
export function playScratch() {
  try {
    if (typeof window === 'undefined' || off()) return;
    const ctx = scratchCtx(); if (!ctx) return;
    const vol = VOL.scratch ?? 0.6;
    const t0 = ctx.currentTime + 0.001;
    // Durées des deux coups (s) — total ≈ 0,12 s + petite queue ≈ 140 ms. Baisse S1/S2 pour + vif.
    const S1 = 0.055, GAP = 0.010, S2 = 0.055;
    const end = t0 + S1 + GAP + S2;

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);

    const src = ctx.createBufferSource();
    src.buffer = scratchNoise(ctx);
    src.loop = true;

    const bp = ctx.createBiquadFilter();  // résonance = pitch du scrub
    bp.type = 'bandpass'; bp.Q.value = 9;
    const hp = ctx.createBiquadFilter();  // vire le grave/rumble
    hp.type = 'highpass'; hp.frequency.value = 350;
    src.connect(bp); bp.connect(hp); hp.connect(master);

    // Enveloppe de gain : coup 1 (attaque vive → chute) puis coup 2 (re-attaque → extinction).
    const g = master.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(vol, t0 + 0.006);
    g.exponentialRampToValueAtTime(0.05, t0 + S1);
    g.exponentialRampToValueAtTime(vol, t0 + S1 + GAP + 0.006);
    g.exponentialRampToValueAtTime(0.0001, end);

    // Sweep de fréquence du bandpass = le mouvement "wi" (montée) puis "chi" (descente).
    const f = bp.frequency;
    f.setValueAtTime(500, t0);
    f.exponentialRampToValueAtTime(2600, t0 + S1);
    f.setValueAtTime(2600, t0 + S1 + GAP);
    f.exponentialRampToValueAtTime(600, end);

    // Sweep de playbackRate = la main qui pousse puis tire le vinyle (renforce le scrub).
    const r = src.playbackRate;
    r.setValueAtTime(1.2, t0);
    r.linearRampToValueAtTime(2.2, t0 + S1);
    r.linearRampToValueAtTime(0.75, end);

    src.start(t0);
    src.stop(end + 0.02);
    scratchSources.add(src); scratchMasters.add(master);
    src.onended = () => {
      try { src.disconnect(); bp.disconnect(); hp.disconnect(); master.disconnect(); } catch {}
      scratchSources.delete(src); scratchMasters.delete(master);
    };
  } catch { /* no-op */ }
}
// ─────────────────────────────────────────────────────────────────────────────

export function sfx(key: keyof typeof URLS) {
  try {
    if (typeof window === 'undefined' || off()) return;
    if (key === 'scratch') { playScratch(); return; } // route spéciale → scratch synthétisé (pas de preview)
    const url = URLS[key]; if (!url) return;
    let a = cache[key];
    if (!a) { a = new Audio(url); a.preload = 'auto'; cache[key] = a; }
    a.currentTime = 0; a.volume = VOL[key] ?? 0.5;
    a.play().catch(() => {}); // autoplay bloqué tant que pas d'interaction : ignoré
    if (stopTimers[key]) { clearTimeout(stopTimers[key]); stopTimers[key] = undefined; }
    const cap = MAXMS[key];
    if (cap) stopTimers[key] = setTimeout(() => { try { a.pause(); a.currentTime = 0; } catch {} stopTimers[key] = undefined; }, cap);
  } catch { /* no-op */ }
}

// AIRHORN "façon DJ" (le vrai son "Airhorn" de la sélection d'Alexandre), joué en RAFALE qui se chevauche
// ("bap-bap-bap-baaaap") : 3 coups courts coupés + le dernier entier. Utilisé pour le cheat code.
export function playAirhorns() {
  try {
    if (typeof window === 'undefined' || off()) return;
    const url = URLS.airhorn; if (!url) return;
    const vol = VOL.airhorn ?? 0.6;
    const starts = [0, 235, 470, 760]; // ms — départ de chaque coup (se chevauchent)
    starts.forEach((ms, i) => setTimeout(() => {
      const a = new Audio(url); a.volume = vol; a.play().catch(() => {});
      if (i < starts.length - 1) setTimeout(() => { try { a.pause(); } catch {} }, 250); // coupe les coups courts, garde le dernier entier
    }, ms));
  } catch { /* no-op */ }
}

// Boucle (musique de fond, ex. récap). Un seul loop à la fois.
let loopEl: HTMLAudioElement | null = null;
let loopKey = '';
export function sfxLoop(key: keyof typeof URLS) {
  try {
    if (typeof window === 'undefined' || off()) return;
    if (loopKey === key && loopEl && !loopEl.paused) return;
    sfxLoopStop();
    const url = URLS[key]; if (!url) return;
    const a = new Audio(url); a.loop = true; a.volume = VOL[key] ?? 0.4;
    a.play().catch(() => {});
    loopEl = a; loopKey = key;
  } catch { /* no-op */ }
}
export function sfxLoopStop() {
  try { if (loopEl) { loopEl.pause(); loopEl.currentTime = 0; } } catch {}
  loopEl = null; loopKey = '';
}

// Coupe NET un son ponctuel (et son timer de garde). sfxStopAll() = tout couper — appelé aux transitions
// de phase pour que le SFX de la fenêtre pouvoirs ne déborde JAMAIS sur le début de la musique de manche.
export function sfxStop(key: keyof typeof URLS) {
  try {
    if (key === 'scratch') stopScratch(); // scratch = synth WebAudio → coupe les noeuds, pas d'élément <audio>
    if (stopTimers[key]) { clearTimeout(stopTimers[key]); stopTimers[key] = undefined; }
    const a = cache[key]; if (a) { a.pause(); a.currentTime = 0; }
  } catch {}
}
export function sfxStopAll() {
  try { Object.keys(cache).forEach((k) => sfxStop(k as keyof typeof URLS)); } catch {}
  try { stopScratch(); } catch {} // le scratch n'est jamais dans `cache` (synth) → coupe explicitement
  sfxLoopStop();
}

// NAPPAGE GLOBAL : un son au survol (hover) et au clic de tout élément interactif, partout dans l'app,
// sans câbler chaque bouton. Appelé une fois depuis main.tsx.
let uiInit = false;
export function initUiSfx() {
  if (uiInit || typeof document === 'undefined') return;
  uiInit = true;
  const SEL = 'button, a[href], .cs-cell, .tvcell, [role="button"], .buzzer';
  let lastHover: Element | null = null;
  let lastHoverAt = 0;
  document.addEventListener('pointerover', (e) => {
    const el = (e.target as Element)?.closest?.(SEL);
    if (!el || el === lastHover) return;
    lastHover = el;
    if ((el as HTMLButtonElement).disabled) return;
    const t = Date.now(); if (t - lastHoverAt < 40) return; lastHoverAt = t; // throttle léger
    sfx('hover');
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    const el = (e.target as Element)?.closest?.(SEL);
    if (el && el === lastHover) lastHover = null;
  }, { passive: true });
  document.addEventListener('click', (e) => {
    const el = (e.target as Element)?.closest?.(SEL);
    if (!el || (el as HTMLButtonElement).disabled) return;
    sfx('click');
  }, { passive: true });
}
