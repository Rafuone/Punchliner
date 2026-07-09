import { useState, useEffect, useRef } from 'react';
import { avatarById, initials } from '../data';
import '../wizard.css';

/* ====== réglages envoyés au serveur (mappés depuis le wizard) ====== */
export type WizSettings = { rounds: number; difficulty: string; mode: string; mj: boolean; mjId?: string; rebalance: string; era: string; theme: string; rushStartSec?: number; rushPace?: string; quizNoVf?: boolean; rushPlayerId?: string };
type Music = { nowPlaying: number; musicOn: boolean; onToggle: () => void; onNext: () => void; onPrev: () => void; bassRef: { current: number }; barsRef: { current: number[] }; waveRef?: { current: Uint8Array }; tracks: { title: string; artist: string }[] };
type Player = { id: string; name: string; avatar?: string };
type SpotifyCtl = { state: string; spotifyOn: boolean; deezerOn: boolean; onToggleSpotify: () => void; onToggleDeezer: () => void };
type Props = { poolSize: number; roomCode: string; players: number; playerList?: Player[]; onStart: (s: WizSettings) => void; onBack: () => void; music: Music; onOpenHub?: (mode: 'roster' | 'trophies' | 'leaderboard' | 'radio') => void; spotify?: SpotifyCtl };

/* ====== données (architecture 5 étapes) ====== */
const GAMES = [
  // desc = UNE ligne courte et explicite (les cartes sont sur une TV, vue de loin → pas de pavé de 3 lignes)
  { id: 'blind', name: 'Blind Test', cat: 'Station · Live', family: 'multi', soon: false, desc: 'Tous ensemble, le plus rapide gagne.' },
  { id: 'buzz', name: 'Buzzer', cat: 'Station · Duel', family: 'multi', soon: false, desc: 'Le premier qui buzze prend la main.' },
  { id: 'quiz', name: 'Quiz', cat: 'Station · Culture', family: 'multi', soon: false, desc: 'Blazes, années, albums… en QCM.' },
  { id: 'rush', name: 'Survivor', cat: 'Station · Chrono', family: 'solo', soon: false, desc: 'Enchaîne les sons, bats le record.' },
  { id: 'adventure', name: 'Aventure', cat: 'Station · Campagne', family: 'solo', soon: true, desc: 'Campagne solo à débloquer.' },
];
const ERAS = [
  { id: 'all', big: '∞', lab: 'Toutes', sub: 'époques' },
  { id: '90', big: '90', lab: 'Nineties', sub: 'boom bap' },
  { id: '00', big: '00', lab: '2000s', sub: 'l’âge d’or' },
  { id: '10', big: '10', lab: '2010s', sub: 'la bascule' },
  { id: '20', big: '20', lab: '2020s', sub: 'nouvelle vague' },
];
const THEMES_MAIN = [
  { id: 'all', name: 'Tout le rap FR', sub: 'Aucun filtre', wide: true },
  { id: 'boombap', name: 'Boom bap', sub: 'Sample & kick' },
  { id: 'drill', name: 'Drill', sub: '808 & slides' },
  { id: 'marseille', name: 'Marseille', sub: '13 organisé' },
  { id: 'conscient', name: 'Conscient', sub: 'Plume & fond' },
  { id: 'street', name: 'Street', sub: 'Bitume brut' },
  { id: 'nouvelle', name: 'Nouvelle vague', sub: 'Mélo & auto' },
];
const THEMES_EXTRA = [
  { id: 'paris', name: 'Paris', sub: 'Capitale' }, { id: 'club', name: 'Club', sub: 'Banger' },
  { id: 'egotrip', name: 'Egotrip', sub: 'Punchlines' }, { id: 'oldschool', name: 'Old school', sub: 'Les anciens' },
  { id: 'feats', name: 'Gros feats', sub: 'Collabs' }, { id: 'love', name: 'Love / RnB', sub: 'Sentiments' },
  { id: 'legendes', name: 'Légendes', sub: 'Le panthéon' }, { id: 'trap', name: 'Trap FR', sub: 'Hi-hats' },
];
const DIFFS = [
  { key: 'facile', name: 'Grand public', desc: 'Les gros hits, tout le monde connaît', signal: 1 },
  { key: 'normal', name: 'Connaisseur', desc: 'Classiques + sons bien connus', signal: 2 },
  { key: 'difficile', name: 'Digger', desc: 'Deep cuts, sons moins streamés', signal: 3 },
  { key: 'puriste', name: 'Puriste', desc: 'Le fond du bac, pour les vrais', signal: 4 },
];
const FORMATS = [
  { rounds: 8, label: 'Petit set', desc: 'Une partie courte pour lancer la soirée.' },
  { rounds: 16, label: 'Set complet', desc: 'Le format standard, équilibré et nerveux.' },
  { rounds: 24, label: 'Marathon', desc: 'Pour les longues sessions et les vrais diggers.' },
  { rounds: 'inf' as const, label: 'Sans fin', desc: 'On enchaîne jusqu’à ce que quelqu’un lâche.' },
];
const REBALANCE = [
  { key: 'comeback', name: 'Comeback', desc: 'À la traîne = jauge qui monte plus vite.' },
  { key: 'snowball', name: 'Snowball', desc: 'Plus tu gagnes, plus ta jauge monte.' },
  { key: 'off', name: 'Neutre', desc: 'Même vitesse de jauge pour tout le monde.' },
];
const ORCHESTRATION = [
  { key: 'auto', name: 'Automatique', desc: 'L’app arbitre seule, sans animateur.' },
  { key: 'mj', name: 'Maître du jeu', desc: 'Un animateur au pupitre mène la partie.' },
];
// ===== Survivor (contre-la-montre) : options PROPRES au mode (le format en manches n'a pas de sens ici) =====
const RUSH_STARTS = [
  { sec: 45, label: 'Sprint', desc: 'Court et nerveux.' },
  { sec: 60, label: 'Standard', desc: 'Le format de référence.' },
  { sec: 90, label: 'Longue', desc: 'De la marge pour scorer.' },
  { sec: 120, label: 'Endurance', desc: 'Pour tenir un max de temps.' },
];
// (Le "pace"/pression du chrono a été retiré : le Survivor n'a plus qu'UN réglage, le chrono de départ,
//  et une difficulté progressive — pour des classements mondiaux comparables par créneau.)
const STEP_TITLES = ['LE <span class="em">JEU</span>', 'LA <span class="em">PLAYLIST</span>', 'LA <span class="em">DIFFICULTÉ</span>', 'LE <span class="em">FORMAT</span>', 'LES <span class="em">RÉGLAGES</span>'];
const STEP_SUB = [
  'Choisis la station. Chaque mode est un gameplay à part entière.',
  'Deux axes combinables : l’époque et la thématique. Le rap FR, c’est large.',
  'La force du signal : de la radio grand public au fond du bac.',
  'Le compteur de manches : la longueur du show.',
  'Les faders de fin de chaîne. Ajuste, ou lance quand tu veux.',
];

/* ====== SVG (dessinés — zéro emoji) ====== */
const arrowL = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3l-5 5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const arrowR = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const play = '<svg width="19" height="19" viewBox="0 0 18 18" fill="none"><path d="M5.6 3.9 L14.3 9 L5.6 14.1 Z" fill="currentColor" stroke="currentColor" stroke-width="2.9" stroke-linejoin="round" stroke-linecap="round"/></svg>';
const chevron = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const rosterIco = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.2"/><rect x="9" y="1" width="6" height="6" rx="1.2"/><rect x="1" y="9" width="6" height="6" rx="1.2"/><rect x="9" y="9" width="6" height="6" rx="1.2"/></svg>';
const trophyIco = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4v1.5A3.4 3.4 0 0 0 7.3 10M17 5h3v1.5A3.4 3.4 0 0 1 16.7 10"/><path d="M9.6 13v3.2h4.8V13M8.2 20.5h7.6"/></svg>';
const leaderIco = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="8" width="4" height="7" rx="1"/><rect x="6" y="3" width="4" height="12" rx="1"/><rect x="11" y="10" width="4" height="5" rx="1"/></svg>';
const radioIco = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="9" r="2.2"/><path d="M8 6.8V3l4-1.4" stroke-linecap="round"/><path d="M3.5 5a6 6 0 0 0 0 8M12.5 5a6 6 0 0 1 0 8" stroke-linecap="round"/></svg>';
const bracketsSvg = '<span class="p1tag">P1</span><span class="brackets"><b class="tl"></b><b class="tr"></b><b class="bl"></b><b class="br"></b></span>';
// Logo Spotify officiel (reste vert quelle que soit l'activation → "en couleur"). Deezer = wordmark actuel (voir JSX).
const spotifyIco = '<svg width="15" height="15" viewBox="0 0 168 168" aria-hidden="true"><path fill="#1ed760" d="M83.996.277C37.747.277.253 37.77.253 84.019c0 46.251 37.494 83.741 83.743 83.741 46.254 0 83.744-37.49 83.744-83.741 0-46.246-37.49-83.738-83.745-83.738l.001-.004zm38.404 120.78a5.217 5.217 0 01-7.18 1.73c-19.662-12.01-44.414-14.73-73.564-8.07a5.222 5.222 0 01-6.249-3.93 5.213 5.213 0 013.926-6.25c31.9-7.291 59.263-4.15 81.337 9.34 2.46 1.51 3.24 4.72 1.73 7.18zm10.25-22.805c-1.89 3.075-5.91 4.045-8.98 2.155-22.51-13.839-56.823-17.846-83.448-9.764-3.453 1.043-7.1-.903-8.148-4.35a6.538 6.538 0 014.354-8.143c30.413-9.228 68.222-4.758 94.072 11.127 3.07 1.89 4.04 5.91 2.15 8.976v-.001zm.88-23.744c-26.99-16.031-71.52-17.505-97.289-9.684-4.138 1.255-8.514-1.081-9.768-5.219a7.835 7.835 0 015.221-9.771c29.581-8.98 78.756-7.245 109.83 11.202a7.823 7.823 0 012.74 10.733c-2.2 3.722-7.02 4.949-10.73 2.739z"/></svg>';
const KEYART: Record<string, string> = {
  blind: `<svg viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="560" fill="#141517"/><g transform="translate(200 250)"><circle r="118" fill="rgba(0,0,0,.4)"/><circle r="112" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2.5"/><circle r="86" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1"/><circle r="64" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1"/><circle r="40" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.5)" stroke-width="2"/><circle r="8" fill="#fff"/><g stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".85"><line x1="-172" y1="34" x2="-172" y2="-34"/><line x1="-150" y1="52" x2="-150" y2="-52"/><line x1="-128" y1="26" x2="-128" y2="-26"/><line x1="172" y1="34" x2="172" y2="-34"/><line x1="150" y1="52" x2="150" y2="-52"/><line x1="128" y1="26" x2="128" y2="-26"/></g><g stroke="rgba(255,255,255,.28)" stroke-width="2" fill="none"><circle r="140"/><circle r="164"/></g></g></svg>`,
  buzz: `<svg viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="560" fill="#111214"/><g transform="translate(200 300)"><ellipse cx="0" cy="118" rx="120" ry="34" fill="rgba(0,0,0,.5)"/><ellipse cx="0" cy="66" rx="118" ry="46" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.45)" stroke-width="2.5"/><path d="M-118 66v-18a118 46 0 0 1 236 0v18" fill="rgba(0,0,0,.4)" stroke="rgba(255,255,255,.35)" stroke-width="2"/><ellipse cx="0" cy="34" rx="96" ry="40" fill="rgba(255,255,255,.1)" stroke="#fff" stroke-width="3"/><ellipse cx="0" cy="26" rx="70" ry="30" fill="rgba(255,255,255,.16)" stroke="rgba(255,255,255,.6)" stroke-width="2"/><ellipse cx="-22" cy="16" rx="26" ry="12" fill="rgba(255,255,255,.3)"/><g stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".8"><line x1="130" y1="-30" x2="168" y2="-46"/><line x1="140" y1="6" x2="182" y2="4"/><line x1="130" y1="42" x2="168" y2="56"/><line x1="-130" y1="-30" x2="-168" y2="-46"/><line x1="-140" y1="6" x2="-182" y2="4"/><line x1="-130" y1="42" x2="-168" y2="56"/></g></g></svg>`,
  quiz: `<svg viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="560" fill="#131315"/><g transform="translate(200 250)"><g transform="rotate(-8) translate(-150 -6)"><rect x="-42" y="-52" width="84" height="104" rx="4" fill="rgba(0,0,0,.5)" stroke="rgba(255,255,255,.16)" stroke-width="1.5"/><circle r="26" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1.5"/><circle r="5" fill="rgba(255,255,255,.16)"/></g><g transform="rotate(8) translate(150 -6)"><rect x="-42" y="-52" width="84" height="104" rx="4" fill="rgba(0,0,0,.5)" stroke="rgba(255,255,255,.16)" stroke-width="1.5"/><circle r="26" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1.5"/><circle r="5" fill="rgba(255,255,255,.16)"/></g><rect x="-72" y="-96" width="144" height="192" rx="4" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.3)" stroke-width="2.5"/><text x="0" y="34" text-anchor="middle" font-family="'Clash Display',sans-serif" font-size="130" font-weight="700" fill="rgba(255,255,255,.7)">?</text></g></svg>`,
  rush: `<svg viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="560" fill="#121315"/><g transform="translate(200 272)"><rect x="-22" y="-178" width="44" height="22" rx="5" fill="rgba(255,255,255,.5)"/><line x1="0" y1="-156" x2="0" y2="-130" stroke="rgba(255,255,255,.5)" stroke-width="7" stroke-linecap="round"/><circle r="120" fill="rgba(0,0,0,.4)" stroke="rgba(255,255,255,.5)" stroke-width="3"/><circle r="104" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1.5"/><g stroke="rgba(255,255,255,.5)" stroke-width="3" stroke-linecap="round"><line x1="0" y1="-110" x2="0" y2="-92"/><line x1="0" y1="110" x2="0" y2="92"/><line x1="-110" y1="0" x2="-92" y2="0"/><line x1="110" y1="0" x2="92" y2="0"/></g><line x1="0" y1="0" x2="0" y2="-80" stroke="#fff" stroke-width="6" stroke-linecap="round"/><line x1="0" y1="0" x2="56" y2="32" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle r="9" fill="#fff"/></g></svg>`,
  adventure: `<svg viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="560" fill="#121315"/><g stroke="rgba(255,255,255,.5)" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="2 15"><path d="M120 480 C 40 380, 340 350, 210 255 C 90 180, 320 150, 215 78"/></g><g fill="rgba(255,255,255,.55)"><circle cx="120" cy="480" r="10"/><circle cx="210" cy="255" r="7"/></g><g transform="translate(215 78)"><path d="M0 6 v-52" stroke="rgba(255,255,255,.6)" stroke-width="4" stroke-linecap="round"/><path d="M0 -46 h36 l-10 12 10 12 h-36 z" fill="rgba(255,255,255,.6)"/></g></svg>`,
};
const vhsOverlay = '<div class="vhs"><div class="lines"></div><div class="band"></div><div class="flick"></div></div>';
// crunch/grésille fin par-dessus la vidéo Blind Test (reprise de la DA showcase perso : scanlines + bruit chroma + bande + voile froid)
const keyvidFx = '<i class="kvl"></i><i class="kvt"></i><i class="kvn"></i><i class="kvb"></i>';
// vidéo « diffusion télé » de fond, par mode (jouée UNIQUEMENT quand la carte est sélectionnée). Blind + Buzzer + Quiz.
const VID_GAMES: Record<string, string> = { blind: '/blind-test.mp4', buzz: '/buzzer.mp4', quiz: '/quiz.mp4', rush: '/cypher.mp4' };
function dial(active: boolean) {
  const c = active ? 'var(--fluo)' : 'rgba(255,255,255,.28)';
  return `<svg class="dial" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="16" fill="rgba(0,0,0,.35)" stroke="${c}" stroke-width="2"/><g stroke="${c}" stroke-width="1.4" opacity=".7"><line x1="20" y1="6" x2="20" y2="9"/><line x1="34" y1="20" x2="31" y2="20"/><line x1="20" y1="34" x2="20" y2="31"/><line x1="6" y1="20" x2="9" y2="20"/></g><line x1="20" y1="20" x2="${active ? 28 : 14}" y2="12" stroke="${active ? 'var(--fluo)' : '#fff'}" stroke-width="2.4" stroke-linecap="round"/><circle cx="20" cy="20" r="3" fill="${c}"/></svg>`;
}
const A = '#eef0f1', F = '#E4FF1A';
const DIFF_ILLU = [
  `<svg viewBox="0 0 128 128" fill="none"><g stroke="${A}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="64" cy="96" rx="46" ry="16"/><ellipse cx="64" cy="96" rx="24" ry="8"/><path d="M18 96V83M110 96V83M40 100V88M88 100V88"/><path d="M18 83a46 16 0 0 1 92 0"/><path d="M30 80V54M98 80V54"/><path d="M22 50h16v8H22zM90 50h16v8H90z" fill="${F}" fill-opacity="0.16" stroke="${F}"/><circle cx="64" cy="42" r="24"/><circle cx="64" cy="42" r="15" stroke-width="1.6"/><circle cx="64" cy="42" r="4.5" fill="${F}" fill-opacity="0.28" stroke="${F}"/><circle cx="64" cy="42" r="1.6" fill="${A}" stroke="none"/></g></svg>`,
  `<svg viewBox="0 0 128 128" fill="none"><g stroke="${A}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M28 60a36 36 0 0 1 72 0"/><rect x="20" y="56" width="16" height="24" rx="5" fill="rgba(255,255,255,.08)" stroke="${A}"/><rect x="92" y="56" width="16" height="24" rx="5" fill="rgba(255,255,255,.08)" stroke="${A}"/><rect x="38" y="72" width="52" height="38" rx="6"/><rect x="46" y="80" width="36" height="18" rx="3" fill="${F}" fill-opacity="0.14" stroke="${F}"/><circle cx="56" cy="89" r="4.5" stroke="${F}"/><circle cx="72" cy="89" r="4.5" stroke="${F}"/><path d="M46 104h8M60 104h8M74 104l6 0" stroke-width="2.2"/></g></svg>`,
  `<svg viewBox="0 0 128 128" fill="none"><g stroke="${A}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 66l44-10 44 10v34l-44 12-44-12z" fill="rgba(255,255,255,.05)" stroke="${A}"/><path d="M20 66l44 10 44-10M64 76v36"/><path d="M30 62v34M37 61v35M44 60v36M51 61v35"/><path d="M62 40l22 5v34l-22-5z" fill="${F}" fill-opacity="0.16" stroke="${F}"/><circle cx="88" cy="52" r="14"/><circle cx="88" cy="52" r="5" stroke="${F}"/></g></svg>`,
  `<svg viewBox="0 0 128 128" fill="none"><g stroke="${A}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M64 20l-30 46h60z" fill="${F}" fill-opacity="0.12" stroke="${F}" stroke-width="1.6"/><rect x="34" y="30" width="60" height="60" rx="4"/><rect x="41" y="37" width="46" height="46" rx="3"/><circle cx="64" cy="60" r="18"/><circle cx="64" cy="60" r="11" stroke-width="1.4"/><circle cx="64" cy="60" r="6" fill="${F}" fill-opacity="0.26" stroke="${F}"/><rect x="40" y="98" width="48" height="20" rx="3" fill="rgba(255,255,255,.05)" stroke="${A}"/><path d="M46 104h5v4h-5zM55 104h5v4h-5zM64 104h5v4h-5zM73 104h5v4h-5z" fill="${F}" fill-opacity="0.2" stroke="${F}" stroke-width="1.6"/></g></svg>`,
];
const H = (s: string) => ({ dangerouslySetInnerHTML: { __html: s } });

// OSCILLOSCOPE : trace la forme d'onde LE LONG du VRAI contour ARRONDI de la carte (canvas débordant → la vague
// oscille de part et d'autre de la bordure). Forme d'onde LISSÉE (K points moyennés) → grosses vagues qui réagissent
// à la musique, pas du grésillement. Amplitude ∝ volume (le time-domain gonfle quand ça joue fort, sans saturer).
function drawScope(canvas: HTMLCanvasElement, wave: Uint8Array) {
  const W = canvas.clientWidth, H2 = canvas.clientHeight, len = wave?.length || 0;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  if (!W || !H2 || !len) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.round(W * dpr), ch = Math.round(H2 * dpr);
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H2);
  const PAD = 30;   // = |inset| du canvas : le bord de la carte est ici (le tracé suit CE contour, pas un rectangle inséré)
  const R = 10;     // rayon des coins = border-radius des cartes (bordure réactive raccord avec la bordure fixe arrondie)
  const x0 = PAD, y0 = PAD, x1 = W - PAD, y1 = H2 - PAD;
  const w = x1 - x0, h = y1 - y0; if (w <= 4 * R || h <= 4 * R) return;
  const sw = w - 2 * R, sh = h - 2 * R, arc = (Math.PI / 2) * R, perim = 2 * sw + 2 * sh + 4 * arc;
  const cx0 = x0 + R, cy0 = y0 + R, cx1 = x1 - R, cy1 = y1 - R;
  type P = { px: number; py: number; nx: number; ny: number };
  const segs: Array<{ l: number; at: (u: number) => P }> = [
    { l: sw, at: (u) => ({ px: cx0 + u * sw, py: y0, nx: 0, ny: -1 }) },
    { l: arc, at: (u) => { const a = -Math.PI / 2 + u * Math.PI / 2; return { px: cx1 + R * Math.cos(a), py: cy0 + R * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) }; } },
    { l: sh, at: (u) => ({ px: x1, py: cy0 + u * sh, nx: 1, ny: 0 }) },
    { l: arc, at: (u) => { const a = u * Math.PI / 2; return { px: cx1 + R * Math.cos(a), py: cy1 + R * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) }; } },
    { l: sw, at: (u) => ({ px: cx1 - u * sw, py: y1, nx: 0, ny: 1 }) },
    { l: arc, at: (u) => { const a = Math.PI / 2 + u * Math.PI / 2; return { px: cx0 + R * Math.cos(a), py: cy1 + R * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) }; } },
    { l: sh, at: (u) => ({ px: x0, py: cy1 - u * sh, nx: -1, ny: 0 }) },
    { l: arc, at: (u) => { const a = Math.PI + u * Math.PI / 2; return { px: cx0 + R * Math.cos(a), py: cy0 + R * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) }; } },
  ];
  const pointAt = (s: number): P => { s = ((s % perim) + perim) % perim; for (const seg of segs) { if (s <= seg.l) return seg.at(seg.l ? s / seg.l : 0); s -= seg.l; } return segs[0].at(0); };
  // forme d'onde LISSÉE en K points de contrôle (moyennés) → grosses vagues au lieu du grésillement
  const K = 22, ctrl = new Array<number>(K), chunk = len / K;
  for (let k = 0; k < K; k++) { let s = 0, c = 0; const a = Math.floor(k * chunk), b = Math.floor((k + 1) * chunk); for (let i = a; i < b; i++) { s += wave[i]; c++; } ctrl[k] = ((c ? s / c : 128) - 128) / 128 * 1.6; } // ×1.6 = gain (le menu joue doux) → oscille + fort
  const AMP = 22, N = 240;
  const roll = (performance.now() / 1000) * 0.32; // défilement → la vague "coule" nettement autour de la carte
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = pointAt(t * perim);
    const cf = (t + roll) * K, k0 = ((Math.floor(cf) % K) + K) % K, k1 = (k0 + 1) % K, fr = cf - Math.floor(cf);
    let a = (ctrl[k0] * (1 - fr) + ctrl[k1] * fr) * AMP;
    const lim = PAD - 3; if (a > lim) a = lim; else if (a < -lim) a = -lim; // reste dans le canvas
    const X = p.px + p.nx * a, Y = p.py + p.ny * a;
    if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
  }
  ctx.closePath();
  ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(228,255,26,.55)'; ctx.shadowBlur = 8;
  ctx.strokeStyle = 'rgba(228,255,26,.95)'; ctx.stroke();
}

export default function ConfigWizard({ poolSize, roomCode, players, playerList = [], onStart, onBack, music, onOpenHub, spotify }: Props) {
  const [step, setStep] = useState(0);
  const [game, setGame] = useState('blind');
  const [era, setEra] = useState('all');
  const [theme, setTheme] = useState('all');
  const [diff, setDiff] = useState('normal');
  const [rounds, setRounds] = useState<number | 'inf'>(16);
  const [rebalance, setRebalance] = useState('comeback');
  const [orch, setOrch] = useState('auto');
  const [mjId, setMjId] = useState('');
  const [showPlayers, setShowPlayers] = useState(false); // popover "qui est dans le salon"
  const [rushStartSec, setRushStartSec] = useState(60); // Survivor : chrono de départ (SEUL réglage — difficulté progressive)
  const [quizNoVf, setQuizNoVf] = useState(false);       // Quiz : exclure les Vrai/Faux
  const [rushPlayerId, setRushPlayerId] = useState('');  // Survivor : le joueur désigné (solo)

  // Le Maître du jeu ne s'applique qu'au Blind Test : Buzzer = 100% auto, Quiz/Survivor = objectifs.
  const mjAllowed = game === 'blind';
  const isQuiz = game === 'quiz', isRush = game === 'rush';
  const powersMode = game === 'blind' || game === 'buzz'; // seuls modes à pouvoirs (jauge de rééquilibrage utile)
  const showRebalance = powersMode && orch !== 'mj';       // jauge cachée en Quiz/Survivor (pas de pouvoirs) et en MJ (pouvoirs off)
  useEffect(() => { if (!mjAllowed && orch === 'mj') setOrch('auto'); }, [mjAllowed, orch]);
  useEffect(() => { if (isRush && step === 2) setStep(3); }, [isRush, step]); // Survivor n'a pas d'étape difficulté : on ne s'y arrête jamais

  const themeName = [...THEMES_MAIN, ...THEMES_EXTRA].find((t) => t.id === theme)?.name || '';
  const eraName = era === 'all' ? 'Toutes époques' : (ERAS.find((e) => e.id === era)!.big + 's · ' + ERAS.find((e) => e.id === era)!.lab);
  // chaque étape porte son index RÉEL (step). Survivor n'a PAS d'étape difficulté (progressive) → on la retire
  // du parcours : une étape en moins dans la carte de match.
  const rows = [
    { step: 0, k: 'Le jeu', v: GAMES.find((g) => g.id === game)!.name },
    isQuiz
      ? { step: 1, k: 'Questions', v: quizNoVf ? 'Sans Vrai/Faux' : 'QCM + Vrai/Faux' }
      : { step: 1, k: 'Playlist', v: themeName + (era === 'all' ? '' : ' · ' + ERAS.find((e) => e.id === era)!.big + 's') },
    ...(isRush ? [] : [{ step: 2, k: 'Difficulté', v: DIFFS.find((d) => d.key === diff)!.name }]),
    isRush
      ? { step: 3, k: 'Chrono', v: rushStartSec + ' s' }
      : { step: 3, k: isQuiz ? 'Questions' : 'Format', v: rounds === 'inf' ? 'Sans fin' : rounds + (isQuiz ? ' questions' : ' manches') },
    { step: 4, k: isRush ? 'Le joueur' : 'Réglages', v: isRush ? (playerList.find((p) => p.id === rushPlayerId)?.name || 'À choisir') : showRebalance ? (ORCHESTRATION.find((o) => o.key === orch)!.name + ' · ' + REBALANCE.find((r) => r.key === rebalance)!.name) : (orch === 'mj' && mjAllowed ? 'Maître du jeu' : 'Automatique') },
  ];
  const visibleSteps = rows.map((r) => r.step);       // étapes réellement présentes pour ce mode
  const stepPos = Math.max(0, visibleSteps.indexOf(step)); // position visible (0-based) de l'étape courante
  const last = step === visibleSteps[visibleSteps.length - 1];
  // titres / sous-titres d'étape adaptés au mode (Quiz : pas de playlist ; Survivor : chrono au lieu du format)
  const stepTitles = [
    STEP_TITLES[0],
    isQuiz ? 'LES <span class="em">QUESTIONS</span>' : STEP_TITLES[1],
    STEP_TITLES[2],
    isRush ? 'LE <span class="em">CHRONO</span>' : STEP_TITLES[3],
    STEP_TITLES[4],
  ];
  const stepSubs = [
    STEP_SUB[0],
    isQuiz ? 'Le style de questions : QCM seul, ou avec les Vrai/Faux.' : STEP_SUB[1],
    isRush ? 'La difficulté MONTE toute seule : ça démarre facile, puis de plus en plus pointu.' : STEP_SUB[2],
    isRush ? 'Le temps de départ — c\'est ton créneau au classement mondial.' : isQuiz ? 'Le nombre de questions du quiz.' : STEP_SUB[3],
    STEP_SUB[4],
  ];
  function launch() {
    const r = rounds === 'inf' ? Math.min(poolSize, 50) : Math.min(rounds, poolSize);
    const isMj = orch === 'mj' && mjAllowed;
    const mode = game === 'buzz' ? 'buzzer' : game === 'quiz' ? 'quiz' : game === 'rush' ? 'rush' : 'multi';
    onStart({ rounds: r, difficulty: diff, mode, mj: isMj, mjId: isMj ? (mjId || playerList[0]?.id) : undefined, rebalance, era, theme,
      rushStartSec: isRush ? rushStartSec : undefined, quizNoVf: isQuiz ? quizNoVf : undefined,
      rushPlayerId: isRush ? (rushPlayerId || playerList[0]?.id) : undefined });
  }

  // vidéo « diffusion télé » de la carte sélectionnée (Blind/Buzzer/Quiz) : couleur + lecture + déchirures de
  // tracking (MÊME effet analogique que le showcase perso) ; les autres → N&B, sur pause. Refs par mode.
  const vidRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const tearRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    const active = step === 0 && !!VID_GAMES[game];
    const v = vidRefs.current[game], tear = tearRefs.current[game], card = cardRefs.current[game];
    // ne joue QUE la vidéo du mode sélectionné ; met les autres en pause
    Object.keys(VID_GAMES).forEach((id) => {
      const playThis = active && id === game;
      [vidRefs.current[id], tearRefs.current[id]].forEach((el) => {
        if (!el) return; el.muted = true;
        if (playThis) { const p = el.play(); if (p?.catch) p.catch(() => {}); } else { try { el.pause(); } catch {} }
      });
    });
    if (!active || !card) return;
    // pilote de glitch : déchirures de tracking ORGANIQUES (intervalles/tailles aléatoires), repris du showcase perso
    let timer: any;
    const fire = () => {
      const r = Math.random(), strong = r < 0.52, big = r < 0.24;
      const gx = (Math.random() * 2 - 1) * (big ? 40 : strong ? 22 : 9);
      const gh = big ? 12 + Math.random() * 26 : strong ? 6 + Math.random() * 14 : 3 + Math.random() * 8;
      card.style.setProperty('--gy', (Math.random() * 80).toFixed(1) + '%');
      card.style.setProperty('--gh', gh.toFixed(1) + '%');
      card.style.setProperty('--gx', gx.toFixed(1) + 'px');
      if (tear && v) { try { tear.currentTime = v.currentTime; } catch {} }
      card.classList.add(strong ? 'glx-strong' : 'glx');
      window.setTimeout(() => card.classList.remove('glx', 'glx-strong'), (strong ? 110 : 60) + Math.random() * (strong ? 240 : 110));
      timer = window.setTimeout(fire, 320 + Math.random() * 1700);
    };
    timer = window.setTimeout(fire, 400 + Math.random() * 900);
    return () => { window.clearTimeout(timer); card.classList.remove('glx', 'glx-strong'); };
  }, [game, step]);

  // fond grunge (béton/xerox/coulures) peint en canvas — comme l'exploration
  const texRef = useRef<HTMLCanvasElement | null>(null);
  const launchRef = useRef(launch); launchRef.current = launch;
  useEffect(() => {
    const cv = texRef.current; if (!cv) return; const ctx = cv.getContext('2d'); if (!ctx) return;
    const paint = () => {
      const W = cv.clientWidth, H = cv.clientHeight; if (W < 2 || H < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < 26; i++) { const x = Math.random() * W, y = Math.random() * H, r = 120 + Math.random() * 360; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, Math.random() < 0.5 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      const density = Math.min(90000, Math.floor((W * H) / 26));
      for (let i = 0; i < density; i++) { const x = Math.random() * W, y = Math.random() * H, dark = Math.random() < 0.62; ctx.fillStyle = dark ? `rgba(0,0,0,${0.1 + Math.random() * 0.35})` : `rgba(255,255,255,${0.03 + Math.random() * 0.1})`; ctx.fillRect(x, y, Math.random() < 0.85 ? 1 : 2, Math.random() < 0.85 ? 1 : 2); }
      for (let i = 0; i < 14; i++) { const x = Math.random() * W, y = Math.random() * H, r = 30 + Math.random() * 140; const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r); g.addColorStop(0, `rgba(0,0,0,${0.06 + Math.random() * 0.1})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      ctx.lineCap = 'round';
      for (let i = 0; i < 40; i++) { const x = Math.random() * W, y = Math.random() * H * 0.6, len = 40 + Math.random() * 260; ctx.strokeStyle = `rgba(0,0,0,${0.04 + Math.random() * 0.08})`; ctx.lineWidth = 0.6 + Math.random() * 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() * 4 - 2), y + len); ctx.stroke(); }
      for (let i = 0; i < 22; i++) { const x = Math.random() * W, y = Math.random() * H, len = 20 + Math.random() * 90, a = Math.random() * 0.6 - 0.3; ctx.strokeStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`; ctx.lineWidth = 0.5 + Math.random(); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke(); }
    };
    // coalesce toutes les peintures lourdes via UNE rAF (annule-et-replanifie) → plus de double peinture au montage
    // (ResizeObserver.observe() peint aussitôt) ni de repaint par event pendant un drag de resize. Sortie visuelle identique.
    let raf = 0; const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(paint); };
    schedule();
    let ro: any = null; if ((window as any).ResizeObserver) { ro = new ResizeObserver(schedule); ro.observe(cv); }
    window.addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(raf); if (ro) ro.disconnect(); window.removeEventListener('resize', schedule); };
  }, []);
  // audio-réactif : le glow du sélectionné suit le beat (basses) + l'égaliseur suit le spectre réel.
  const wzRef = useRef<HTMLDivElement | null>(null);
  const npEqRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let raf = 0, cur = 0;
    const loop = () => {
      const t = music.bassRef?.current || 0; cur += (t - cur) * 0.4;
      wzRef.current?.style.setProperty('--pulse', cur.toFixed(3));
      const eq = npEqRef.current, bands = music.barsRef?.current;
      if (eq && bands) { const k = eq.children, n = k.length; for (let i = 0; i < n; i++) (k[i] as HTMLElement).style.height = (12 + (bands[Math.floor((i / n) * bands.length)] || 0) * 88) + '%'; }
      const wave = music.waveRef?.current;
      if (wave) { const cvs = document.querySelectorAll<HTMLCanvasElement>('.wz canvas.scope'); for (let i = 0; i < cvs.length; i++) drawScope(cvs[i], wave); } // oscilloscope sur la bordure de CHAQUE carte sélectionnée (jeu / difficulté / format)
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  // navigation clavier SPATIALE : la flèche va vers l'élément visuellement le plus proche dans CETTE direction
  // (cartes de jeu, rail des étapes, boutons). Entrée = valider l'élément focus (comportement natif du bouton).
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const dir = ({ ArrowRight: 'r', ArrowLeft: 'l', ArrowUp: 'u', ArrowDown: 'd' } as Record<string, string>)[e.key];
      if (!dir) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)) return;
      const items = (Array.from(document.querySelectorAll('.wz button:not([disabled])')) as HTMLElement[])
        .filter((el) => el.offsetParent !== null && el.getClientRects().length > 0);
      if (!items.length) return;
      e.preventDefault();
      if (!ae || !items.includes(ae)) { ((document.querySelector('.wz .keycard.sel') as HTMLElement) || (document.querySelector('.wz .stagecol button:not([disabled])') as HTMLElement) || items[0]).focus(); return; }
      const cr = ae.getBoundingClientRect(); const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
      let best: HTMLElement | null = null, bestScore = Infinity;
      for (const el of items) {
        if (el === ae) continue;
        const r = el.getBoundingClientRect(); const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
        const inDir = dir === 'r' ? dx > 6 : dir === 'l' ? dx < -6 : dir === 'd' ? dy > 6 : dy < -6;
        if (!inDir) continue;
        const along = (dir === 'r' || dir === 'l') ? Math.abs(dx) : Math.abs(dy);
        const perp = (dir === 'r' || dir === 'l') ? Math.abs(dy) : Math.abs(dx);
        const score = along + perp * 2.4; // privilégie l'axe de la direction, pénalise l'écart perpendiculaire
        if (score < bestScore) { bestScore = score; best = el; }
      }
      if (best) best.focus();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  // à l'entrée sur l'étape « jeu », on pose le focus clavier sur le jeu sélectionné (Blind Test par défaut)
  useEffect(() => {
    if (step !== 0) return;
    const id = requestAnimationFrame(() => (document.querySelector('.wz .keycard.sel') as HTMLElement)?.focus?.());
    return () => cancelAnimationFrame(id);
  }, [step]);

  return (
    <div className="wz" ref={wzRef}>
      {/* filtres VHS (aberration chromatique R/B + micro-wobble) — repris du showcase perso, pour la vidéo Blind Test */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
        <filter id="wzvhs" x="-6%" y="-3%" width="112%" height="106%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.001 0.021" numOctaves={1} seed={5} result="w" />
          <feDisplacementMap in="SourceGraphic" in2="w" scale={3.6} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cr" />
          <feOffset in="cr" dx={-4.2} dy={0.9} result="cro" />
          <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cg" />
          <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cb" />
          <feOffset in="cb" dx={4.2} dy={-0.9} result="cbo" />
          <feBlend in="cro" in2="cg" mode="screen" result="crg" />
          <feBlend in="crg" in2="cbo" mode="screen" />
        </filter>
        <filter id="wzvhs-strong" x="-10%" y="-5%" width="120%" height="110%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.002 0.03" numOctaves={1} seed={9} result="w2" />
          <feDisplacementMap in="SourceGraphic" in2="w2" scale={7} xChannelSelector="R" yChannelSelector="G" result="d2" />
          <feColorMatrix in="d2" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cr2" />
          <feOffset in="cr2" dx={-11} dy={2.2} result="cro2" />
          <feColorMatrix in="d2" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cg2" />
          <feColorMatrix in="d2" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cb2" />
          <feOffset in="cb2" dx={11} dy={-2.2} result="cbo2" />
          <feBlend in="cro2" in2="cg2" mode="screen" result="crg2" />
          <feBlend in="crg2" in2="cbo2" mode="screen" />
        </filter>
      </defs></svg>
      <div className="backdrop">
        <div className="concrete" /><canvas className="wz-tex" ref={texRef} /><div className="halftone" /><div className="grain" /><div className="xeroxbands" /><div className="scan" /><div className="vignette" />
        <div className="gaffer" /><div className="ghostnum">{stepPos + 1}</div>
      </div>

      <div className="hud-top">
        <div className="sessionbar">
          <div className="brand">
            <h1 className="wm">PUNCHLIN<span className="d">R</span></h1>
          </div>
          <div className="sess-right">
            <span className="gpill onair"><span className="dot live" />ON&nbsp;AIR</span>
            <div className="players-wrap">
              <button className="gpill players-btn" onClick={() => setShowPlayers((v) => !v)} aria-expanded={showPlayers}>
                {players}&nbsp;joueur{players > 1 ? 's' : ''} <span {...H(chevron)} />
              </button>
              {showPlayers && (
                <div className="players-pop">
                  <div className="pp-head">Dans le salon</div>
                  {playerList.length === 0
                    ? <div className="pp-empty">Personne n'a encore rejoint.</div>
                    : playerList.map((p) => { const a = avatarById(p.avatar); return (
                        <div className="pp-row" key={p.id}>
                          <span className="pp-av" style={{ background: a?.color || '#5639bf' }}>{a?.img ? <img src={`/avatars/${a.id}.png`} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : initials(a?.name || p.name)}</span>
                          <span className="pp-name">{p.name}</span>
                          {a && <span className="pp-rap">{a.name}</span>}
                        </div>
                      ); })}
                </div>
              )}
            </div>
            {spotify && (
              <div className="srcgroup" role="group" aria-label="Source audio">
                <button
                  className={`gpill srcpill sp ${spotify.state === 'ready' && spotify.spotifyOn ? 'on' : 'off'}`}
                  onClick={spotify.onToggleSpotify}
                  title={spotify.state === 'ready'
                    ? (spotify.spotifyOn ? 'Spotify actif (prioritaire) — cliquer pour couper' : 'Spotify en veille — cliquer pour activer')
                    : spotify.state === 'premium_required' ? 'Spotify : compte Premium requis'
                    : spotify.state === 'connecting' ? 'Connexion à Spotify…' : 'Connecter Spotify'}>
                  <span className="srclogo" {...H(spotifyIco)} />Spotify
                </button>
                <button
                  className={`gpill srcpill dz ${spotify.deezerOn ? 'on' : 'off'}`}
                  onClick={spotify.onToggleDeezer}
                  title={spotify.deezerOn ? 'Deezer actif — cliquer pour couper' : 'Deezer coupé — cliquer pour activer'}>
                  <img className="dzimg" src="/deezer.svg" alt="" aria-hidden="true" /><span className="dzword">deezer</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="scene">
        <div className={`stagecol ${step === 0 ? 'games' : ''}`}>
          <div className="act-inner" key={step}>
            <div className="act-head">
              <div className="act-title-wrap">
                <div className="act-kicker"><span className="actno"><span>ACTE 0{stepPos + 1}</span></span><span className="actlabel">Sélection</span></div>
                <h2 className="act-title" {...H(stepTitles[step])} />
              </div>
              <div className="act-salon"><span className="act-salon-lbl">Salon</span><span className="act-salon-code">{roomCode}</span></div>
            </div>

            {step === 0 && (() => {
              const gameCard = (g: any) => (
                <button key={g.id} ref={(el) => { cardRefs.current[g.id] = el; }} className={`keycard pick g-${g.id} ${game === g.id ? 'sel on' : ''} ${g.soon ? 'locked' : ''}`} onClick={() => !g.soon && setGame(g.id)} onFocus={() => !g.soon && setGame(g.id)}>
                  <div className="kclip">
                    <div className="keyart" {...H(KEYART[g.id] || '')} />
                    {VID_GAMES[g.id] && (
                      <>
                        <video className="keyvid" ref={(el) => { vidRefs.current[g.id] = el; }} src={VID_GAMES[g.id]} muted loop playsInline preload="auto" disablePictureInPicture />
                        <video className="keyvid-tear" ref={(el) => { tearRefs.current[g.id] = el; }} src={VID_GAMES[g.id]} muted loop playsInline preload="auto" aria-hidden="true" disablePictureInPicture />
                        <div className="keyvid-fx" {...H(keyvidFx)} />
                      </>
                    )}
                    <span {...H(vhsOverlay)} />
                    <div className="kshade" />
                  </div>
                  <div className="reccue"><i />REC</div>
                  {g.soon ? <span className="badge-soon"><span><span className="dot" style={{ width: 6, height: 6 }} />Bientôt</span></span> : <span className="badge-live"><span><span className="dot" style={{ width: 6, height: 6 }} />Jouable</span></span>}
                  <div className="kbody"><div className="kcat">{g.cat}</div><div className="kname">{g.name}</div><div className="kdesc">{g.desc}</div><span className="kfam">{g.family === 'solo' ? '1 joueur · record' : '2 à 8 joueurs'}</span></div>
                  {g.id === 'rush' && onOpenHub && (
                    <span className="kclass" role="button" tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); onOpenHub('leaderboard'); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onOpenHub('leaderboard'); } }}>
                      <span {...H(leaderIco)} /> Classement
                    </span>
                  )}
                  {game === g.id && <canvas className="scope" aria-hidden="true" />}
                </button>
              );
              return (
                <div className="games-groups">
                  <div className="games-group multi">
                    <div className="games-glabel">Multijoueur <span>· la soirée à plusieurs</span></div>
                    <div className="games-stage">{GAMES.filter((g) => g.family === 'multi').map(gameCard)}</div>
                  </div>
                  <div className="games-group solo">
                    <div className="games-glabel">Solo <span>· records &amp; campagne</span></div>
                    <div className="games-stage">{GAMES.filter((g) => g.family === 'solo').map(gameCard)}</div>
                  </div>
                </div>
              );
            })()}

            {step === 1 && isQuiz && (
              <div className="axis" style={{ maxWidth: 660 }}>
                <div className="axis-head"><span className="axis-chip"><span>Type de questions</span></span><span className="axis-note">Le style du quiz</span></div>
                <div className="opt-stack">
                  <button className={`opt ${!quizNoVf ? 'sel' : ''}`} onClick={() => setQuizNoVf(false)}><span className="ol"><b>QCM + Vrai / Faux</b><small>Toutes les questions : les QCM à 4 choix ET les Vrai / Faux.</small></span></button>
                  <button className={`opt ${quizNoVf ? 'sel' : ''}`} onClick={() => setQuizNoVf(true)}><span className="ol"><b>QCM uniquement</b><small>On vire les Vrai / Faux — que des questions à 4 choix.</small></span></button>
                </div>
              </div>
            )}
            {step === 1 && !isQuiz && (
              <>
                <div className="axis">
                  <div className="axis-head"><span className="axis-chip"><span>Époque</span></span><span className="axis-note">Tune la décennie</span></div>
                  <div className="tuner">{ERAS.map((e) => (
                    <button key={e.id} className={`knob ${era === e.id ? 'sel' : ''}`} onClick={() => setEra(e.id)}><span {...H(dial(era === e.id))} /><span className="kl"><b>{e.big === '∞' ? 'TOUT' : e.big + 's'}</b><small>{e.sub}</small></span></button>
                  ))}</div>
                </div>
                <div className="axis">
                  <div className="axis-head"><span className="axis-chip"><span>Thématique · Ville · Sous-genre</span></span><span className="axis-note">Appuie sur un poussoir</span></div>
                  {/* TOUTES les thématiques affichées d'emblée (on a la place) — plus de bouton « plus de thématiques » */}
                  <div className="pads">{[...THEMES_MAIN, ...THEMES_EXTRA].map((t) => (
                    <button key={t.id} className={`pad ${(t as any).wide ? 'wide' : ''} ${theme === t.id ? 'sel' : ''}`} onClick={() => setTheme(t.id)}><span className="led" /><span className="pl"><b>{t.name}</b><small>{t.sub}</small></span></button>
                  ))}</div>
                </div>
              </>
            )}

            {step === 2 && !isRush && (
              <div className="grid-diff">{DIFFS.map((d, i) => (
                <button key={d.key} className={`diff-tile pick ${diff === d.key ? 'sel on' : ''}`} onClick={() => setDiff(d.key)}>
                  {diff === d.key && <canvas className="scope" aria-hidden="true" />}
                  <div className="diff-illu"><img src={`/difficulty/${d.key}.png`} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /><span className="diff-illu-svg" {...H(DIFF_ILLU[i])} /></div>
                  <div className="diff-idx">Signal {d.signal}/4</div>
                  <div className="diff-name">{d.name}</div>
                  <div className="vu">{[0, 1, 2, 3].map((b) => <i key={b} className={b < d.signal ? (d.signal === 4 && b === 3 ? 'hot' : 'on') : ''} />)}</div>
                  <div className="diff-desc">{d.desc}</div>
                </button>
              ))}</div>
            )}

            {step === 3 && !isRush && (
              <div className="grid-fmt">{FORMATS.map((f) => {
                const inf = f.rounds === 'inf';
                const disabled = !inf && (f.rounds as number) > poolSize;
                return (
                  <button key={String(f.rounds)} className={`fmt-tile pick ${inf ? 'inf warm' : ''} ${rounds === f.rounds ? 'sel on' : ''} ${disabled ? 'disabled' : ''}`} onClick={() => !disabled && setRounds(f.rounds)}>
                    <span {...H(bracketsSvg)} />
                    {rounds === f.rounds && <canvas className="scope" aria-hidden="true" />}
                    <div className="fmt-count">{inf ? '∞' : f.rounds}</div>
                    <div className="fmt-unit">{inf ? 'sans limite' : (isQuiz ? 'questions' : 'manches')}</div>
                    <div className="fmt-label">{f.label}</div>
                    <div className="fmt-desc">{f.desc}</div>
                  </button>
                );
              })}</div>
            )}
            {step === 3 && isRush && (
              <>
                <div className="grid-fmt">{RUSH_STARTS.map((s) => (
                  <button key={s.sec} className={`fmt-tile pick ${rushStartSec === s.sec ? 'sel on' : ''}`} onClick={() => setRushStartSec(s.sec)}>
                    <span {...H(bracketsSvg)} />
                    {rushStartSec === s.sec && <canvas className="scope" aria-hidden="true" />}
                    <div className="fmt-count">{s.sec}</div>
                    <div className="fmt-unit">secondes</div>
                    <div className="fmt-label">{s.label}</div>
                    <div className="fmt-desc">{s.desc}</div>
                  </button>
                ))}</div>
              </>
            )}

            {step === 4 && (
              <div className="settings-grid">
                {showRebalance && (
                <div className="setblock">
                  <div className="set-lbl"><span className="axis-chip"><span>Jauge de pouvoir</span></span></div>
                  <div className="opt-stack">{REBALANCE.map((r) => (
                    <button key={r.key} className={`opt ${rebalance === r.key ? 'sel' : ''}`} onClick={() => setRebalance(r.key)}><span className="ol"><b>{r.name}</b><small>{r.desc}</small></span></button>
                  ))}</div>
                </div>
                )}
                {isRush && (
                  <div className="setblock">
                    <div className="set-lbl"><span className="axis-chip"><span>Qui joue ?</span></span></div>
                    {playerList.length === 0
                      ? <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '4px 2px 0' }}>Le Survivor est <b style={{ color: 'var(--txt)' }}>solo</b> : un seul joueur relève le défi. Personne n'a rejoint — le 1er à entrer jouera (ou reviens ici le choisir).</p>
                      : <><div className="opt-stack">{playerList.map((p) => (
                          <button key={p.id} className={`opt ${rushPlayerId === p.id ? 'sel' : ''}`} onClick={() => setRushPlayerId(p.id)}><span className="ol"><b>{p.name}</b><small>{avatarById(p.avatar)?.name || 'Au contre-la-montre'}</small></span></button>
                        ))}</div>
                        <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '10px 2px 0' }}>Choisis <b style={{ color: 'var(--txt)' }}>qui joue</b> — les autres regardent.{rushPlayerId ? '' : ' (à défaut, ce sera le 1er entré.)'}</p></>}
                  </div>
                )}
                {isQuiz && (
                  <div className="setblock">
                    <div className="set-lbl"><span className="axis-chip"><span>Quiz</span></span></div>
                    <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: '4px 2px 0' }}>Le Quiz s’arbitre tout seul : pas de pouvoirs ni d’animateur. Le plus rapide et juste rafle la mise.</p>
                  </div>
                )}
                {!isRush && (
                <div className="setblock">
                  <div className="set-lbl"><span className="axis-chip"><span>Orchestration</span></span></div>
                  <div className="opt-stack">{ORCHESTRATION.map((o) => {
                    const locked = o.key === 'mj' && !mjAllowed;
                    return (
                      <button key={o.key} className={`opt ${orch === o.key ? 'sel' : ''}`} disabled={locked} style={locked ? { opacity: .4, cursor: 'not-allowed' } : undefined} onClick={() => !locked && setOrch(o.key)}>
                        <span className="ol"><b>{o.name}</b><small>{locked ? 'Uniquement en Blind Test — le Buzzer se note tout seul.' : o.desc}</small></span>
                      </button>
                    );
                  })}</div>
                  {orch === 'mj' && mjAllowed && (
                    <div style={{ marginTop: 14 }}>
                      <div className="eyebrow" style={{ marginBottom: 8 }}>Qui anime ? <span className="muted" style={{ fontWeight: 600 }}>(ne joue pas)</span></div>
                      {playerList.length === 0
                        ? <p className="muted" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.4 }}>Personne n'a encore rejoint. Le mode Maître du jeu demande au moins 2 joueurs — 1 anime, les autres jouent.</p>
                        : <div className="opt-stack">{playerList.map((p) => (
                            <button key={p.id} className={`opt ${(mjId || playerList[0]?.id) === p.id ? 'sel' : ''}`} onClick={() => setMjId(p.id)}><span className="ol"><b>{p.name}</b><small>Animateur — voit la réponse, distribue les points à la voix</small></span></button>
                          ))}</div>}
                    </div>
                  )}
                </div>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="hud-side">
          <div className="mc-head"><div className="mc-title"><span className="lbl">Carte de match</span></div></div>
          <div className="mc-rows">
            {rows.map((r, idx) => (
              <button key={r.step} className={`mc-row ${step === r.step ? 'active' : ''}`} onClick={() => setStep(r.step)}>
                <span className="mc-badge"><span>{String(idx + 1).padStart(2, '0')}</span></span>
                <span className="mc-l"><span className="k">{r.k}</span><span className="v">{r.v}</span></span>
              </button>
            ))}
          </div>
          <div className="mc-foot">
            <div className={`nowplaying ${music.musicOn && music.nowPlaying >= 0 ? '' : 'paused'}`}>
              <div className="np-eq" ref={npEqRef}>{[0, 1, 2, 3, 4, 5, 6].map((i) => <i key={i} />)}</div>
              <div className="np-txt">
                <div className="npv">{music.nowPlaying >= 0 ? music.tracks[music.nowPlaying].title : 'Musique du menu'}</div>
                <div className="nps">{music.nowPlaying >= 0 ? music.tracks[music.nowPlaying].artist : 'aléatoire · morceaux entiers'}</div>
              </div>
              <div className="np-ctrls">
                <button className="np-mute" onClick={music.onPrev} aria-label="Précédent"><svg width="13" height="13" viewBox="0 0 15 15" fill="currentColor"><path d="M4 3h1.5v9H4zM12 3v9l-6-4.5z" /></svg></button>
                <button className="np-mute" onClick={music.onNext} aria-label="Suivant"><svg width="13" height="13" viewBox="0 0 15 15" fill="currentColor"><path d="M9.5 3H11v9H9.5zM3 3v9l6-4.5z" /></svg></button>
                <button className="np-mute" onClick={music.onToggle} aria-label="Musique">
                  {music.musicOn
                    ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 5.5h2.5L9 3v9L5.5 9.5H3z" fill="currentColor" /><path d="M11 5.5c1 1 1 3 0 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                    : <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 5.5h2.5L9 3v9L5.5 9.5H3z" fill="currentColor" /><path d="M10.5 5l3.5 3.5M14 5l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>}
                </button>
              </div>
            </div>
            <button className="btn launch-full" onClick={launch}><span {...H(play)} /> LANCER LA PARTIE</button>
          </div>
        </aside>
      </div>

      <div className="hud-bot">
        <button className="btn ghost" onClick={() => (stepPos === 0 ? onBack() : setStep(visibleSteps[stepPos - 1]))}><span {...H(arrowL)} /> Retour</button>
        <div className="hint"><kbd>↑ ↓ ← →</kbd> se déplacer · <kbd>Entrée</kbd> valider</div>
        <div className="spacer" />
        <button className="btn hublink" onClick={() => onOpenHub?.('roster')}><span {...H(rosterIco)} /> Roster</button>
        <button className="btn hublink" onClick={() => onOpenHub?.('trophies')}><span {...H(trophyIco)} /> Palmarès</button>
        <button className="btn hublink" onClick={() => onOpenHub?.('radio')}><span {...H(radioIco)} /> Radio</button>
        {/* Ni « Suivant » ni « Lancer » ici : un SEUL CTA primaire = « Lancer la partie » dans la carte de match (à droite).
            Navigation des étapes au clavier (← → · Entrée) — voir le hint ci-dessus. */}
      </div>
    </div>
  );
}
