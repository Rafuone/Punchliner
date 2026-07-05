import { useState, useEffect, useRef } from 'react';
import '../wizard.css';

/* ====== réglages envoyés au serveur (mappés depuis le wizard) ====== */
export type WizSettings = { rounds: number; difficulty: string; mode: string; mj: boolean; rebalance: string };
type Music = { nowPlaying: number; musicOn: boolean; onToggle: () => void; onNext: () => void; onPrev: () => void; bassRef: { current: number }; tracks: { title: string; artist: string }[] };
type Props = { poolSize: number; roomCode: string; players: number; onStart: (s: WizSettings) => void; onBack: () => void; music: Music };

/* ====== données (architecture 5 étapes) ====== */
const GAMES = [
  { id: 'blind', name: 'Blind Test', cat: 'Station · Live', soon: false, desc: 'Tout le monde répond en même temps. Le plus rapide et juste rafle la mise.' },
  { id: 'buzz', name: 'Buzzer', cat: 'Station · Duel', soon: false, desc: 'Le premier qui buzze prend la main. Silence radio pour les autres.' },
  { id: 'quiz', name: 'Quiz', cat: 'Station · Culture', soon: true, desc: 'Qui a dit ça, quelle année, quel feat, quelle pochette. Le rap FR à la loupe.' },
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
  { rounds: 20, label: 'Échauffement', desc: 'Une manche courte pour lancer la soirée.' },
  { rounds: 30, label: 'Set complet', desc: 'Le format standard, équilibré et nerveux.' },
  { rounds: 50, label: 'Marathon', desc: 'Pour les longues sessions et les vrais diggers.' },
  { rounds: 'inf' as const, label: 'Sans fin', desc: 'On enchaîne jusqu’à ce que quelqu’un lâche.' },
];
const REBALANCE = [
  { key: 'comeback', name: 'Comeback', desc: 'À la traîne = jauge plus rapide (façon TowerFall).' },
  { key: 'snowball', name: 'Snowball', desc: 'Plus tu gagnes, plus ta jauge monte.' },
  { key: 'off', name: 'Neutre', desc: 'Même vitesse de jauge pour tout le monde.' },
];
const ORCHESTRATION = [
  { key: 'auto', name: 'Automatique', desc: 'L’app arbitre seule, sans animateur.' },
  { key: 'mj', name: 'Maître du jeu', desc: 'Un animateur au pupitre mène la partie.' },
];
const STEP_TITLES = ['LE <span class="em">JEU</span>', 'LA <span class="em">PLAYLIST</span>', 'LA <span class="em">DIFFICULTÉ</span>', 'LE <span class="em">FORMAT</span>', 'LES <span class="em">RÉGLAGES</span>'];
const STEP_SUB = [
  'Choisis la station. Chaque mode est un gameplay à part entière.',
  'Deux axes combinables : l’époque et la thématique. Le rap FR, c’est large.',
  'La force du signal : de la radio grand public au fond du bac.',
  'Le compteur de manches : la longueur du show.',
  'Les faders de fin de chaîne. Défauts déjà calés.',
];

/* ====== SVG (dessinés — zéro emoji) ====== */
const arrowL = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3l-5 5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const arrowR = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const play = '<svg width="19" height="19" viewBox="0 0 18 18" fill="none"><path d="M5.6 3.9 L14.3 9 L5.6 14.1 Z" fill="currentColor" stroke="currentColor" stroke-width="2.9" stroke-linejoin="round" stroke-linecap="round"/></svg>';
const chevron = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const bracketsSvg = '<span class="p1tag">P1</span><span class="brackets"><b class="tl"></b><b class="tr"></b><b class="bl"></b><b class="br"></b></span>';
const KEYART: Record<string, string> = {
  blind: `<svg viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="560" fill="#141517"/><g transform="translate(200 250)"><circle r="118" fill="rgba(0,0,0,.4)"/><circle r="112" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2.5"/><circle r="86" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1"/><circle r="64" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1"/><circle r="40" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.5)" stroke-width="2"/><circle r="8" fill="#fff"/><g stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".85"><line x1="-172" y1="34" x2="-172" y2="-34"/><line x1="-150" y1="52" x2="-150" y2="-52"/><line x1="-128" y1="26" x2="-128" y2="-26"/><line x1="172" y1="34" x2="172" y2="-34"/><line x1="150" y1="52" x2="150" y2="-52"/><line x1="128" y1="26" x2="128" y2="-26"/></g><g stroke="rgba(255,255,255,.28)" stroke-width="2" fill="none"><circle r="140"/><circle r="164"/></g></g></svg>`,
  buzz: `<svg viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="560" fill="#111214"/><g transform="translate(200 300)"><ellipse cx="0" cy="118" rx="120" ry="34" fill="rgba(0,0,0,.5)"/><ellipse cx="0" cy="66" rx="118" ry="46" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.45)" stroke-width="2.5"/><path d="M-118 66v-18a118 46 0 0 1 236 0v18" fill="rgba(0,0,0,.4)" stroke="rgba(255,255,255,.35)" stroke-width="2"/><ellipse cx="0" cy="34" rx="96" ry="40" fill="rgba(255,255,255,.1)" stroke="#fff" stroke-width="3"/><ellipse cx="0" cy="26" rx="70" ry="30" fill="rgba(255,255,255,.16)" stroke="rgba(255,255,255,.6)" stroke-width="2"/><ellipse cx="-22" cy="16" rx="26" ry="12" fill="rgba(255,255,255,.3)"/><g stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".8"><line x1="130" y1="-30" x2="168" y2="-46"/><line x1="140" y1="6" x2="182" y2="4"/><line x1="130" y1="42" x2="168" y2="56"/><line x1="-130" y1="-30" x2="-168" y2="-46"/><line x1="-140" y1="6" x2="-182" y2="4"/><line x1="-130" y1="42" x2="-168" y2="56"/></g></g></svg>`,
  quiz: `<svg viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="560" fill="#131315"/><g transform="translate(200 250)"><g transform="rotate(-8) translate(-150 -6)"><rect x="-42" y="-52" width="84" height="104" rx="4" fill="rgba(0,0,0,.5)" stroke="rgba(255,255,255,.16)" stroke-width="1.5"/><circle r="26" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1.5"/><circle r="5" fill="rgba(255,255,255,.16)"/></g><g transform="rotate(8) translate(150 -6)"><rect x="-42" y="-52" width="84" height="104" rx="4" fill="rgba(0,0,0,.5)" stroke="rgba(255,255,255,.16)" stroke-width="1.5"/><circle r="26" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1.5"/><circle r="5" fill="rgba(255,255,255,.16)"/></g><rect x="-72" y="-96" width="144" height="192" rx="4" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.3)" stroke-width="2.5"/><text x="0" y="34" text-anchor="middle" font-family="'Clash Display',sans-serif" font-size="130" font-weight="700" fill="rgba(255,255,255,.7)">?</text></g></svg>`,
};
const vhsOverlay = '<div class="vhs"><div class="lines"></div><div class="band"></div><div class="flick"></div></div>';
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

export default function ConfigWizard({ poolSize, roomCode, players, onStart, onBack, music }: Props) {
  const [step, setStep] = useState(0);
  const [game, setGame] = useState('blind');
  const [era, setEra] = useState('all');
  const [theme, setTheme] = useState('all');
  const [diff, setDiff] = useState('normal');
  const [rounds, setRounds] = useState<number | 'inf'>(30);
  const [rebalance, setRebalance] = useState('comeback');
  const [orch, setOrch] = useState('auto');
  const [themeExp, setThemeExp] = useState(false);

  const themeName = [...THEMES_MAIN, ...THEMES_EXTRA].find((t) => t.id === theme)?.name || '';
  const eraName = era === 'all' ? 'Toutes époques' : (ERAS.find((e) => e.id === era)!.big + 's · ' + ERAS.find((e) => e.id === era)!.lab);
  const rows = [
    { i: '01', k: 'Le jeu', v: GAMES.find((g) => g.id === game)!.name },
    { i: '02', k: 'Playlist', v: themeName + ' · ' + (era === 'all' ? 'Toutes époques' : eraName) },
    { i: '03', k: 'Difficulté', v: DIFFS.find((d) => d.key === diff)!.name },
    { i: '04', k: 'Format', v: rounds === 'inf' ? 'Sans fin' : rounds + ' manches' },
    { i: '05', k: 'Réglages', v: ORCHESTRATION.find((o) => o.key === orch)!.name + ' · ' + REBALANCE.find((r) => r.key === rebalance)!.name },
  ];
  const last = step === 4;
  function launch() {
    const r = rounds === 'inf' ? Math.min(poolSize, 50) : Math.min(rounds, poolSize);
    onStart({ rounds: r, difficulty: diff, mode: game === 'buzz' ? 'buzzer' : 'multi', mj: orch === 'mj', rebalance });
  }

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
    paint();
    let ro: any = null; if ((window as any).ResizeObserver) { ro = new ResizeObserver(() => paint()); ro.observe(cv); }
    const onR = () => paint(); window.addEventListener('resize', onR);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', onR); };
  }, []);
  // égaliseur audio-réactif : la bordure du sélectionné pulse selon les basses (onde, non-linéaire).
  const wzRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let raf = 0, cur = 0;
    const loop = () => { const t = music.bassRef?.current || 0; cur += (t - cur) * 0.4; wzRef.current?.style.setProperty('--pulse', cur.toFixed(3)); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  // navigation clavier (flèches + Entrée)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setStep((s) => Math.min(4, s + 1));
      else if (e.key === 'ArrowLeft') setStep((s) => { if (s > 0) return s - 1; onBack(); return s; });
      else if (e.key === 'Enter') setStep((s) => { if (s === 4) { launchRef.current(); return s; } return Math.min(4, s + 1); });
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <div className="wz" ref={wzRef}>
      <div className="backdrop">
        <div className="concrete" /><canvas className="wz-tex" ref={texRef} /><div className="halftone" /><div className="grain" /><div className="xeroxbands" /><div className="scan" /><div className="vignette" />
        <div className="gaffer" /><div className="ghostnum">{step + 1}</div>
      </div>

      <div className="hud-top">
        <div className="sessionbar">
          <div className="brand">
            <h1 className="wm">PUNCHLIN<span className="d">E</span></h1>
          </div>
          <div className="sess-right">
            <span className="gpill onair"><span className="dot live" />ON&nbsp;AIR</span>
            <span className="gpill"><span className="dot" />Salon&nbsp;<span className="roomcode">{roomCode}</span></span>
            <span className="gpill">{players}&nbsp;joueur{players > 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <div className="scene">
        <div className="stagecol">
          <div className="act-inner" key={step}>
            <div className="act-head">
              <div className="act-title-wrap">
                <div className="act-kicker"><span className="actno"><span>ACTE 0{step + 1}</span></span><span className="actlabel">Sélection</span></div>
                <h2 className="act-title" {...H(STEP_TITLES[step])} />
              </div>
              <p className="act-sub">{STEP_SUB[step]}</p>
            </div>

            {step === 0 && (
              <>
              <div className="games-stage">
                {GAMES.map((g) => (
                  <button key={g.id} className={`keycard pick g-${g.id} ${game === g.id ? 'sel on' : ''} ${g.soon ? 'locked' : ''}`} onClick={() => !g.soon && setGame(g.id)}>
                    <span {...H(bracketsSvg)} />
                    <div className="keyart" {...H(KEYART[g.id])} />
                    <span {...H(vhsOverlay)} />
                    <div className="reccue"><i />REC</div>
                    <div className="kshade" />
                    {g.soon ? <span className="badge-soon"><span>Bientôt</span></span> : <span className="badge-live"><span><span className="dot" style={{ width: 6, height: 6 }} />Jouable</span></span>}
                    <div className="kbody"><div className="kcat">{g.cat}</div><div className="kname">{g.name}</div><div className="kdesc">{g.desc}</div></div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', border: '1px dashed var(--line3)', borderRadius: 4, background: 'rgba(255,255,255,.02)', opacity: .78 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="kcat" style={{ color: 'var(--muted2)', marginBottom: 6 }}>Arcade · hors-ligne · un jeu à part</div>
                  <div className="kname" style={{ fontSize: 22 }}>Mode Solo</div>
                  <div className="kdesc" style={{ maxWidth: 'none', marginTop: 6 }}>Campagne contre des boss, déblocage de rappeurs — ce n'est pas du multijoueur.</div>
                </div>
                <span className="badge-soon" style={{ position: 'static' }}><span>Bientôt</span></span>
              </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="axis">
                  <div className="axis-head"><span className="axis-chip"><span>Époque</span></span><span className="axis-note">Tune la décennie</span></div>
                  <div className="tuner">{ERAS.map((e) => (
                    <button key={e.id} className={`knob ${era === e.id ? 'sel' : ''}`} onClick={() => setEra(e.id)}><span {...H(dial(era === e.id))} /><span className="kl"><b>{e.big === '∞' ? 'TOUT' : e.big + 's'}</b><small>{e.sub}</small></span></button>
                  ))}</div>
                </div>
                <div className="axis">
                  <div className="axis-head"><span className="axis-chip"><span>Thématique · Ville · Sous-genre</span></span><span className="axis-note">Appuie sur un poussoir</span></div>
                  <div className="pads">{THEMES_MAIN.map((t) => (
                    <button key={t.id} className={`pad ${t.wide ? 'wide' : ''} ${theme === t.id ? 'sel' : ''}`} onClick={() => setTheme(t.id)}><span className="led" /><span className="pl"><b>{t.name}</b><small>{t.sub}</small></span></button>
                  ))}</div>
                  {themeExp && <div className="pads extra">{THEMES_EXTRA.map((t) => (
                    <button key={t.id} className={`pad ${theme === t.id ? 'sel' : ''}`} onClick={() => setTheme(t.id)}><span className="led" /><span className="pl"><b>{t.name}</b><small>{t.sub}</small></span></button>
                  ))}</div>}
                  <div className="more-row"><button className={`linkbtn ${themeExp ? 'open' : ''}`} onClick={() => setThemeExp(!themeExp)}>{themeExp ? 'Réduire' : 'Plus de thématiques'} <span {...H(chevron)} /></button></div>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="grid-diff">{DIFFS.map((d, i) => (
                <button key={d.key} className={`diff-tile pick ${diff === d.key ? 'sel on' : ''}`} onClick={() => setDiff(d.key)}>
                  <span {...H(bracketsSvg)} />
                  <div className="diff-illu" {...H(DIFF_ILLU[i])} />
                  <div className="diff-idx">Signal {d.signal}/4</div>
                  <div className="diff-name">{d.name}</div>
                  <div className="vu">{[0, 1, 2, 3].map((b) => <i key={b} className={b < d.signal ? (d.signal === 4 && b === 3 ? 'hot' : 'on') : ''} />)}</div>
                  <div className="diff-desc">{d.desc}</div>
                </button>
              ))}</div>
            )}

            {step === 3 && (
              <div className="grid-fmt">{FORMATS.map((f) => {
                const inf = f.rounds === 'inf';
                const disabled = !inf && (f.rounds as number) > poolSize;
                return (
                  <button key={String(f.rounds)} className={`fmt-tile pick ${inf ? 'inf warm' : ''} ${rounds === f.rounds ? 'sel on' : ''} ${disabled ? 'disabled' : ''}`} onClick={() => !disabled && setRounds(f.rounds)}>
                    <span {...H(bracketsSvg)} />
                    <div className="fmt-count">{inf ? '∞' : f.rounds}</div>
                    <div className="fmt-unit">{inf ? 'sans limite' : 'manches'}</div>
                    <div className="fmt-label">{f.label}</div>
                    <div className="fmt-desc">{f.desc}</div>
                  </button>
                );
              })}</div>
            )}

            {step === 4 && (
              <div className="settings-grid">
                <div className="setblock">
                  <div className="set-lbl"><span className="axis-chip"><span>Jauge de pouvoir</span></span></div>
                  <div className="opt-stack">{REBALANCE.map((r) => (
                    <button key={r.key} className={`opt ${rebalance === r.key ? 'sel' : ''}`} onClick={() => setRebalance(r.key)}><span className="ol"><b>{r.name}</b><small>{r.desc}</small></span></button>
                  ))}</div>
                </div>
                <div className="setblock">
                  <div className="set-lbl"><span className="axis-chip"><span>Orchestration</span></span></div>
                  <div className="opt-stack">{ORCHESTRATION.map((o) => (
                    <button key={o.key} className={`opt ${orch === o.key ? 'sel' : ''}`} onClick={() => setOrch(o.key)}><span className="ol"><b>{o.name}</b><small>{o.desc}</small></span></button>
                  ))}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="hud-side">
          <div className="mc-head"><div className="mc-title"><span className="lbl">Carte de match</span></div><span className="mc-brand">PUNCHLIN<span className="d">E</span></span></div>
          <div className="mc-rows">
            {rows.map((r, i) => (
              <button key={r.i} className={`mc-row ${i === step ? 'active' : ''}`} onClick={() => setStep(i)}>
                <span className="mc-badge"><span>{r.i}</span></span>
                <span className="mc-l"><span className="k">{r.k}</span><span className="v">{r.v}</span></span>
              </button>
            ))}
          </div>
          <div className="mc-foot">
            <div className={`nowplaying ${music.musicOn && music.nowPlaying >= 0 ? '' : 'paused'}`}>
              <div className="np-eq">{[0, 1, 2, 3, 4, 5, 6].map((i) => <i key={i} />)}</div>
              <div className="np-txt">
                <div className="npv">{music.nowPlaying >= 0 ? music.tracks[music.nowPlaying].title : 'Musique du menu'}</div>
                <div className="nps">{music.nowPlaying >= 0 ? music.tracks[music.nowPlaying].artist : 'aléatoire · morceaux entiers'}</div>
              </div>
              <button className="np-mute" onClick={music.onPrev} aria-label="Précédent"><svg width="13" height="13" viewBox="0 0 15 15" fill="currentColor"><path d="M4 3h1.5v9H4zM12 3v9l-6-4.5z" /></svg></button>
              <button className="np-mute" onClick={music.onNext} aria-label="Suivant"><svg width="13" height="13" viewBox="0 0 15 15" fill="currentColor"><path d="M9.5 3H11v9H9.5zM3 3v9l6-4.5z" /></svg></button>
              <button className="np-mute" onClick={music.onToggle} aria-label="Musique">
                {music.musicOn
                  ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 5.5h2.5L9 3v9L5.5 9.5H3z" fill="currentColor" /><path d="M11 5.5c1 1 1 3 0 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                  : <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 5.5h2.5L9 3v9L5.5 9.5H3z" fill="currentColor" /><path d="M10.5 5l3.5 3.5M14 5l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>}
              </button>
            </div>
            <button className="btn launch-full" onClick={launch}><span {...H(play)} /> LANCER LA PARTIE</button>
            <div className="mc-note">Défauts calés — ajuste ou lance quand tu veux</div>
          </div>
        </aside>
      </div>

      <div className="hud-bot">
        <button className="btn ghost" onClick={() => (step === 0 ? onBack() : setStep(step - 1))}><span {...H(arrowL)} /> Retour</button>
        <div className="hint"><kbd>← →</kbd> naviguer · <kbd>Entrée</kbd> valider</div>
        <div className="spacer" />
        {last
          ? <button className="btn warm" onClick={launch}><span {...H(play)} /> Lancer la partie</button>
          : <button className="btn warm" onClick={() => setStep(step + 1)}>Suivant <span {...H(arrowR)} /></button>}
      </div>
    </div>
  );
}
