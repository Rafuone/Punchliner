// Vue de consultation AFFICHÉE SUR LA TV (Host/Hub, depuis l'assistant) : le roster façon borne de jeu
// de combat (Tekken/SF) et le palmarès des trophées. Layout PAYSAGE pensé grand écran — pas de notion
// P1/P2 : un seul perso « en avant » (portrait à gauche, stats + pouvoir à droite), roster en bas
// rangé par catégorie, avec des slots grisés « ? » à débloquer.
import { useState, useRef, useEffect } from 'react';
import { AVATARS, avatarById, initials, CATEGORY_ORDER, CATEGORY_COLORS, isLegend, EPITHETS, AWARDS_INFO, awardIcon } from '../data';

const hideOnErr = (e: any) => { e.currentTarget.style.display = 'none'; };
const locked = (_id: string) => false; // pas encore de système de déblocage — la mécanique de grisé est prête (voir slots « À débloquer »)

export default function HubBrowse({ mode, onClose }: { mode: 'roster' | 'trophies'; onClose: () => void }) {
  const [selId, setSelId] = useState(AVATARS[0].id);
  const heroRef = useRef<HTMLDivElement>(null);
  const sel = avatarById(selId) || AVATARS[0];

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  // glitch VHS (déchirures de tracking) sur le portrait en grand — comme le character select
  useEffect(() => {
    if (mode !== 'roster') return;
    const hero = heroRef.current; if (!hero) return;
    let timer: any;
    const fire = () => {
      const r = Math.random(), strong = r < 0.42, big = r < 0.16;
      const gx = (Math.random() * 2 - 1) * (big ? 34 : strong ? 18 : 7);
      const gh = big ? 12 + Math.random() * 24 : strong ? 5 + Math.random() * 13 : 2 + Math.random() * 7;
      hero.style.setProperty('--gy', (Math.random() * 82).toFixed(1) + '%');
      hero.style.setProperty('--gh', gh.toFixed(1) + '%');
      hero.style.setProperty('--gx', gx.toFixed(1) + 'px');
      hero.classList.add(strong ? 'glx-strong' : 'glx');
      window.setTimeout(() => hero.classList.remove('glx', 'glx-strong'), (strong ? 100 : 55) + Math.random() * (strong ? 240 : 100));
      timer = window.setTimeout(fire, 450 + Math.random() * 2300);
    };
    timer = window.setTimeout(fire, 500 + Math.random() * 1500);
    return () => { window.clearTimeout(timer); hero.classList.remove('glx', 'glx-strong'); };
  }, [mode, selId]);

  // filtres VHS (aberration chromatique) réutilisés par le portrait + les déchirures
  const defs = (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      <g id="bust"><path d="M22,240 C22,168 58,146 100,146 C142,146 178,168 178,240 Z" fill="#0d0917" /><ellipse cx="100" cy="96" rx="40" ry="44" fill="#0d0917" /><path d="M60,70 Q100,22 140,70 Q140,44 100,42 Q60,44 60,70 Z" fill="#0d0917" /><path d="M138,80 C150,120 150,180 150,240 L178,240 C178,168 160,146 138,80 Z" fill="rgba(255,255,255,.10)" /></g>
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
      <div className="hub-overlay">
        <div className="wrap" style={{ position: 'relative', zIndex: 1 }}>
          <div className="topbar">
            <button className="btn" style={{ padding: '8px 14px', fontSize: 13 }} onClick={onClose}>← Retour au hub</button>
            <h1 className="wm" style={{ fontSize: 22 }}>PALMARÈS</h1>
            <span className="gpill">{AWARDS_INFO.length} trophées</span>
          </div>
          <p className="muted" style={{ textAlign: 'center', margin: '2px 0 14px', fontSize: 13 }}>Décernés en fin de partie, selon ce qui s'est passé sur la table.</p>
          <div className="troph-grid" style={{ maxWidth: 1040 }}>
            {AWARDS_INFO.map((t) => (
              <div className={`troph ${t.salty ? 'salty' : ''}`} key={t.id}>
                <span className="troph-ic" dangerouslySetInnerHTML={{ __html: awardIcon(t.icon) }} />
                <div className="troph-title">{t.title}</div>
                <div className="troph-desc">{t.blurb}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---- roster : layout paysage façon borne de jeu de combat ----
  const nmU = sel.name.toUpperCase();
  const nameFs = nmU.length > 12 ? 'clamp(30px,4.2vw,58px)' : nmU.length > 8 ? 'clamp(38px,5.2vw,72px)' : 'clamp(44px,6.2vw,86px)';
  const cats = [...CATEGORY_ORDER, ...Array.from(new Set(AVATARS.map((a) => a.cat))).filter((c) => !CATEGORY_ORDER.includes(c))];
  const SL = sel.statLabels || ['Flow', 'Punch', 'Tech', 'Aura'];
  const statRows: [string, number][] = [[SL[0], sel.stats.flow], [SL[1], sel.stats.punch], [SL[2], sel.stats.tech], [SL[3], sel.stats.aura]];

  return (
    <div className="hub-overlay tvros">
      {defs}
      <div className="tvros-head">
        <button className="btn" style={{ padding: '8px 16px', fontSize: 13 }} onClick={onClose}>← Retour au hub</button>
        <h1 className="wm" style={{ fontSize: 22, margin: 0 }}>LE&nbsp;<span style={{ color: 'var(--fluo)' }}>ROSTER</span></h1>
        <span className="gpill">{AVATARS.length} rappeurs</span>
      </div>

      <div className={`tvros-stage${isLegend(sel.cat) ? ' irid' : ''}`} style={{ ['--c' as any]: sel.color, ['--cc' as any]: CATEGORY_COLORS[sel.cat] }}>
        <div className="tvros-hero" ref={heroRef}>
          <div className="tvros-heroglow" />
          <svg className="tvros-bust" viewBox="0 0 200 240"><use href="#bust" /></svg>
          {sel.img && <img className="tvros-portrait" src={`/avatars/${sel.id}.png`} alt="" style={sel.crop?.y != null ? { objectPosition: `50% ${sel.crop.y}%` } : undefined} onError={hideOnErr} />}
          {sel.img && <img className="tvros-portrait tear" src={`/avatars/${sel.id}.png`} alt="" aria-hidden="true" style={sel.crop?.y != null ? { objectPosition: `50% ${sel.crop.y}%` } : undefined} onError={hideOnErr} />}
          <div className="cs-vhs tvros-vhs" aria-hidden="true"><i className="lines" /><i className="tint" /><i className="noise" /><i className="band" /></div>
          <div className="tvros-nameplate">
            <div className="tvros-catchip"><span>{sel.cat}</span></div>
            <div className="tvros-name" style={{ fontSize: nameFs }}>{nmU}</div>
            <div className="tvros-epi">« {EPITHETS[sel.id] || sel.power.name} »</div>
          </div>
        </div>

        <div className="tvros-info">
          <div className="tvros-statblock">
            <div className="tvros-blabel">Statistiques</div>
            {statRows.map(([lab, v]) => (
              <div className="tvros-srow" key={lab}>
                <span className="tvros-slab">{lab}</span>
                <span className="tvros-sbar">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= v ? 'on' : ''} />)}</span>
              </div>
            ))}
          </div>
          <div className="tvros-power">
            <div className="tvros-blabel">Pouvoir signature</div>
            <div className="tvros-pname">{sel.power.name}</div>
            <div className="tvros-pfx">{sel.power.effect}</div>
          </div>
        </div>
      </div>

      <div className="tvros-roster">
        {cats.map((cat) => {
          const members = AVATARS.filter((a) => a.cat === cat);
          if (!members.length) return null;
          return (
            <div className="tvros-catgroup" key={cat}>
              <div className={`tvros-catlabel${isLegend(cat) ? ' irid' : ''}`} style={{ ['--cc' as any]: CATEGORY_COLORS[cat] }}>{cat}<span>{members.length}</span></div>
              <div className="tvros-cells">
                {members.map((a) => {
                  const lk = locked(a.id);
                  return (
                    <button key={a.id} className={`tvros-cell ${selId === a.id ? 'sel' : ''} ${lk ? 'lock' : ''}`} style={{ ['--c' as any]: a.color }}
                      onMouseEnter={() => !lk && setSelId(a.id)} onClick={() => !lk && setSelId(a.id)} title={lk ? 'À débloquer' : a.name}>
                      {lk ? <span className="q">?</span> : (a.img ? <img src={`/avatars/${a.id}.png`} alt={a.name} onError={hideOnErr} /> : <span className="ini">{initials(a.name)}</span>)}
                      <span className="tvros-cn">{lk ? '???' : a.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="tvros-catgroup">
          <div className="tvros-catlabel" style={{ ['--cc' as any]: '#7d8590' }}>À débloquer<span>?</span></div>
          <div className="tvros-cells">
            {[0, 1, 2, 3, 4, 5].map((i) => <div className="tvros-cell lock mystery" key={i} title="Secret — à débloquer"><span className="q">?</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
