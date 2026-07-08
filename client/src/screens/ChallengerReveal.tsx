// Arrivée épique d'un rappeur débloqué (« Nouveau Challenger »), affichée sur la TV APRÈS les trophées.
// Séquence : sirène de police (mp3 Smash "Challenger Approaching") + alerte rouge → charge blanche qui
// accélère → BOOM 808 en C# → le rappeur débarque (fiche roster, glitch VHS) + sa musique. La fiche
// réutilise la structure .tvros-* de HubBrowse. Portée par le composant : Web Audio (repli synthé si les
// mp3 sont bloqués), le déclenchement se fait sur CLIC (bouton « Découvrir ») → l'audio n'est pas bridé.
import { useEffect, useRef, useState } from 'react';
import { avatarById, initials, bioOf, EPITHETS, CATEGORY_COLORS, unlockObjective } from '../data';

const UNLOCK_TRACKS: Record<string, string> = { disiz: '/music/disiz-toussa-toussa.mp3' };

/* ---- Web Audio (charge + BOOM 808 + repli sirène) ---- */
function nb(c: AudioContext, dur: number) { const n = Math.floor(c.sampleRate * dur); const b = c.createBuffer(1, n, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; }
function riser(c: AudioContext, t: number, d: number) { const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(620, t + d); f.type = 'lowpass'; f.frequency.setValueAtTime(280, t); f.frequency.exponentialRampToValueAtTime(5200, t + d); g.gain.setValueAtTime(.001, t); g.gain.exponentialRampToValueAtTime(.3, t + d); g.gain.linearRampToValueAtTime(0, t + d + .06); o.connect(f).connect(g).connect(c.destination); o.start(t); o.stop(t + d + .1); }
function snareRoll(c: AudioContext, t: number, d: number) { let x = 0, step = .2; while (x < d) { const tt = t + x; const s = c.createBufferSource(); s.buffer = nb(c, .05); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g = c.createGain(); g.gain.setValueAtTime(.05 + .16 * (x / d), tt); g.gain.exponentialRampToValueAtTime(.001, tt + .05); s.connect(f).connect(g).connect(c.destination); s.start(tt); s.stop(tt + .06); x += step; step = Math.max(.05, step * .9); } }
function impact(c: AudioContext, t: number) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(174, t); o.frequency.exponentialRampToValueAtTime(69.3, t + .05); o.frequency.exponentialRampToValueAtTime(34.65, t + .85); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + .006); g.gain.setValueAtTime(1, t + .06); g.gain.exponentialRampToValueAtTime(.001, t + 1.1); const ws = c.createWaveShaper(); const cv = new Float32Array(129); for (let i = 0; i < 129; i++) { const x = i / 64 - 1; cv[i] = Math.tanh(x * 2); } ws.curve = cv; ws.oversample = '2x'; o.connect(ws).connect(g).connect(c.destination); o.start(t); o.stop(t + 1.15); const n = c.createBufferSource(); n.buffer = nb(c, .04); const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1400; const ng = c.createGain(); ng.gain.setValueAtTime(.55, t); ng.gain.exponentialRampToValueAtTime(.001, t + .05); n.connect(f).connect(ng).connect(c.destination); n.start(t); n.stop(t + .06); }
function siren(c: AudioContext, t: number, dur: number) { const g = c.createGain(); g.connect(c.destination); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.075, t + .12); g.gain.setValueAtTime(.075, t + Math.max(.2, dur - .25)); g.gain.linearRampToValueAtTime(0, t + dur); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200; f.Q.value = .6; f.connect(g); const o = c.createOscillator(); o.type = 'sawtooth'; o.connect(f); const o2 = c.createOscillator(); o2.type = 'square'; const g2 = c.createGain(); g2.gain.value = .32; o2.connect(g2).connect(f); const HI = 855, LO = 605, P = .5; let hi = true; for (let x = 0; x < dur; x += P) { const fr = hi ? HI : LO; o.frequency.setValueAtTime(fr, t + x); o2.frequency.setValueAtTime(fr * 1.5, t + x); hi = !hi; } o.start(t); o.stop(t + dur + .05); o2.start(t); o2.stop(t + dur + .05); }

export default function ChallengerReveal({ charId, onClose }: { charId: string; onClose: () => void }) {
  const av = avatarById(charId);
  const bio = bioOf(charId);
  const cc = CATEGORY_COLORS[av?.cat || ''] || '#ffcf3f';
  const [phase, setPhase] = useState<'alarm' | 'build' | 'reveal'>('alarm');
  const [showClose, setShowClose] = useState(false);
  const figRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const glxRef = useRef<number>(0);
  const alarmRef = useRef<HTMLAudioElement | null>(null);
  const dropRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!av) { onClose(); return; }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    const c: AudioContext | null = AC ? new AC() : null;
    try { c?.resume(); } catch {}
    const T = (ms: number, fn: () => void) => { timers.current.push(window.setTimeout(fn, ms)); };

    const a = new Audio('/music/challenger-approaching.mp3'); alarmRef.current = a; a.volume = .9;
    a.play().catch(() => { if (c) siren(c, c.currentTime + .02, 4.4); }); // repli sirène synthé si bloqué

    T(3600, () => { setPhase('build'); if (c) { riser(c, c.currentTime + .02, .9); snareRoll(c, c.currentTime + .02, .9); } });
    T(4500, () => { setPhase('reveal'); if (c) impact(c, c.currentTime + .02); startDrop(); fireGlitch(); });
    T(6100, () => setShowClose(true));

    function startDrop() {
      const track = UNLOCK_TRACKS[charId]; if (!track) return;
      const d = new Audio(track); dropRef.current = d; d.volume = 0;
      d.play().then(() => { let v = 0; const f = window.setInterval(() => { v = Math.min(.85, v + .1); d.volume = v; if (v >= .85) window.clearInterval(f); }, 50); }).catch(() => {});
    }
    function fireGlitch() {
      const fig = figRef.current; if (!fig) return;
      const r = Math.random(), strong = r < .5, big = r < .2;
      fig.style.setProperty('--gy', (Math.random() * 82).toFixed(1) + '%');
      fig.style.setProperty('--gh', (big ? 12 + Math.random() * 22 : strong ? 5 + Math.random() * 12 : 2 + Math.random() * 7).toFixed(1) + '%');
      fig.style.setProperty('--gx', ((Math.random() * 2 - 1) * (big ? 28 : strong ? 15 : 6)).toFixed(1) + 'px');
      fig.classList.add(strong ? 'glx-strong' : 'glx');
      window.setTimeout(() => fig.classList.remove('glx', 'glx-strong'), (strong ? 100 : 55) + Math.random() * (strong ? 240 : 100));
      glxRef.current = window.setTimeout(fireGlitch, 140 + Math.random() * 700);
    }
    return () => {
      timers.current.forEach((t) => clearTimeout(t)); clearTimeout(glxRef.current);
      try { alarmRef.current?.pause(); } catch {}
      try { dropRef.current?.pause(); } catch {}
      try { c?.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!av) return null;
  const nmU = av.name.toUpperCase();
  const SL = av.statLabels || ['Flow', 'Punch', 'Tech', 'Aura'];
  const statRows: [string, number][] = [[SL[0], av.stats.flow], [SL[1], av.stats.punch], [SL[2], av.stats.tech], [SL[3], av.stats.aura]];
  const hideOnErr = (e: any) => { e.currentTarget.style.display = 'none'; };

  return (
    <div className="uk on" data-phase={phase} style={{ ['--cc' as any]: cc, ['--c' as any]: av.color }}>
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

      <div className="dim" /><div className="grain" />
      <div className="alarm"><div className="scan" /><div className="vig" /><div className="warn">⚠ Signal brouillé ⚠</div></div>
      <div className="qm">INTRUSION<br />DANS LE CERCLE</div>
      <div className="boast">Un nouveau rappeur force l'entrée du cercle…</div>
      <div className="glow" /><div className="speed" /><div className="flash" /><div className="shock" /><div className="shock2" />

      <div className="stage-uk">
        <div className="rays" />
        <div className="challbanner">Nouveau Challenger</div>
        <div className="chall-why">Débloqué — {unlockObjective(charId)}</div>
        <div className="tvros-hero">
          <div className="tvros-fig" ref={figRef}>
            <div className="tvros-figglow" />
            {av.img ? (<>
              <img className="tvros-portrait" src={`/avatars/${av.id}.png`} alt="" onError={hideOnErr} />
              <img className="tvros-portrait tear" src={`/avatars/${av.id}.png`} alt="" aria-hidden="true" onError={hideOnErr} />
            </>) : <div className="tvros-lockq">{initials(av.name)}</div>}
          </div>
          <div className="tvros-side">
            <div className="tvros-nameblock">
              <div className="tvros-catchip"><span>{av.cat}</span></div>
              <div className="tvros-name">{nmU}</div>
              <div className="tvros-epi">« {EPITHETS[av.id] || av.power.name} »</div>
            </div>
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
                <div className="tvros-pname">{av.power.name}</div>
                <div className="tvros-pfx">{av.power.effect}</div>
              </div>
            </div>
          </div>
        </div>
        <button className={`btn close${showClose ? ' show' : ''}`} onClick={onClose}>Retour</button>
      </div>
    </div>
  );
}
