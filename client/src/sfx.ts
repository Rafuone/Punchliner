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
};
const VOL: Record<string, number> = { hover: 0.22, click: 0.35, confirm: 0.5, error: 0.5, scratch: 0.55, horn: 0.6, countdown: 0.4, launch: 0.5, recap: 0.4 };
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
