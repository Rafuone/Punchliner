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
const cache: Record<string, HTMLAudioElement> = {};
const off = () => { try { return localStorage.getItem('pl_sfx_off') === '1'; } catch { return false; } };

export function sfx(key: keyof typeof URLS) {
  try {
    if (typeof window === 'undefined' || off()) return;
    const url = URLS[key]; if (!url) return;
    let a = cache[key];
    if (!a) { a = new Audio(url); a.preload = 'auto'; cache[key] = a; }
    a.currentTime = 0; a.volume = VOL[key] ?? 0.5;
    a.play().catch(() => {}); // autoplay bloqué tant que pas d'interaction : ignoré
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
