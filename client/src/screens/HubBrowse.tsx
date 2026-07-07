// Vue de consultation partagée AFFICHÉE SUR LA TV (Host/Hub) : le roster façon jeu de combat et le
// palmarès des trophées. On navigue ensemble sur l'écran (≠ téléphone, où chacun fait de son côté).
import { useState, useRef, useEffect } from 'react';
import { AVATARS, avatarById, initials, CATEGORY_ORDER, CATEGORY_COLORS, isLegend, EPITHETS, AWARDS_INFO, awardIcon } from '../data';

const hideOnErr = (e: any) => { e.currentTarget.style.display = 'none'; };

export default function HubBrowse({ mode, onClose }: { mode: 'roster' | 'trophies'; onClose: () => void }) {
  const [selId, setSelId] = useState(AVATARS[0].id);
  const stageRef = useRef<HTMLDivElement>(null);
  const sel = avatarById(selId) || AVATARS[0];

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  // glitch VHS (déchirures de tracking) — comme le character select du téléphone
  useEffect(() => {
    if (mode !== 'roster') return;
    const stage = stageRef.current; if (!stage) return;
    let timer: any;
    const fire = () => {
      const r = Math.random(), strong = r < 0.42, big = r < 0.16;
      const gx = (Math.random() * 2 - 1) * (big ? 30 : strong ? 15 : 6);
      const gh = big ? 12 + Math.random() * 22 : strong ? 5 + Math.random() * 12 : 2 + Math.random() * 7;
      stage.style.setProperty('--gy', (Math.random() * 82).toFixed(1) + '%');
      stage.style.setProperty('--gh', gh.toFixed(1) + '%');
      stage.style.setProperty('--gx', gx.toFixed(1) + 'px');
      stage.classList.add(strong ? 'glx-strong' : 'glx');
      window.setTimeout(() => stage.classList.remove('glx', 'glx-strong'), (strong ? 90 : 55) + Math.random() * (strong ? 230 : 90));
      timer = window.setTimeout(fire, 450 + Math.random() * 2300);
    };
    timer = window.setTimeout(fire, 500 + Math.random() * 1500);
    return () => { window.clearTimeout(timer); stage.classList.remove('glx', 'glx-strong'); };
  }, [mode, selId]);

  if (mode === 'trophies') {
    return (
      <div className="hub-overlay">
        <div className="wrap" style={{ position: 'relative', zIndex: 1 }}>
          <div className="topbar">
            <button className="btn" style={{ padding: '8px 14px', fontSize: 13 }} onClick={onClose}>← Hub</button>
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

  // ---- roster (écran de sélection façon jeu de combat) ----
  const nmU = sel.name.toUpperCase();
  const nameFs = nmU.length > 11 ? 'clamp(17px,5vw,24px)' : nmU.length > 8 ? 'clamp(20px,6vw,29px)' : 'clamp(24px,7.5vw,35px)';
  const cats = [...CATEGORY_ORDER, ...Array.from(new Set(AVATARS.map((a) => a.cat))).filter((c) => !CATEGORY_ORDER.includes(c))];
  return (
    <div className="hub-overlay">
      <div className={`cs${isLegend(sel.cat) ? ' irid' : ''}`} style={{ ['--cc' as any]: CATEGORY_COLORS[sel.cat] }}>
        <svg width="0" height="0" style={{ position: 'absolute' }}><defs>
          <g id="bust"><path d="M22,240 C22,168 58,146 100,146 C142,146 178,168 178,240 Z" fill="#0d0917" /><ellipse cx="100" cy="96" rx="40" ry="44" fill="#0d0917" /><path d="M60,70 Q100,22 140,70 Q140,44 100,42 Q60,44 60,70 Z" fill="#0d0917" /><path d="M138,80 C150,120 150,180 150,240 L178,240 C178,168 160,146 138,80 Z" fill="rgba(255,255,255,.10)" /></g>
          <filter id="vhs" x="-6%" y="-3%" width="112%" height="106%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.001 0.021" numOctaves={1} seed={5} result="w" />
            <feDisplacementMap in="SourceGraphic" in2="w" scale={2.2} xChannelSelector="R" yChannelSelector="G" result="d" />
            <feColorMatrix in="d" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cr" />
            <feOffset in="cr" dx={-2.8} dy={0.6} result="cro" />
            <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cg" />
            <feColorMatrix in="d" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cb" />
            <feOffset in="cb" dx={2.8} dy={-0.6} result="cbo" />
            <feBlend in="cro" in2="cg" mode="screen" result="crg" />
            <feBlend in="crg" in2="cbo" mode="screen" />
          </filter>
          <filter id="vhs-strong" x="-10%" y="-5%" width="120%" height="110%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.002 0.03" numOctaves={1} seed={9} result="w2" />
            <feDisplacementMap in="SourceGraphic" in2="w2" scale={4} xChannelSelector="R" yChannelSelector="G" result="d2" />
            <feColorMatrix in="d2" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cr2" />
            <feOffset in="cr2" dx={-7} dy={1.4} result="cro2" />
            <feColorMatrix in="d2" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cg2" />
            <feColorMatrix in="d2" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cb2" />
            <feOffset in="cb2" dx={7} dy={-1.4} result="cbo2" />
            <feBlend in="cro2" in2="cg2" mode="screen" result="crg2" />
            <feBlend in="crg2" in2="cbo2" mode="screen" />
          </filter>
        </defs></svg>

        <button className="cs-back" onClick={onClose} aria-label="Retour">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        <div className="cs-top">
          <div className="cs-stage" ref={stageRef} style={{ ['--c' as any]: sel.color }}>
            <div className="cs-pbg" />
            <div className="cs-wm">{initials(sel.name)[0]}</div>
            <svg className="cs-bust" viewBox="0 0 200 240"><use href="#bust" /></svg>
            {sel.img && <img className="cs-pimg" src={`/avatars/${sel.id}.png`} alt="" style={sel.crop?.y != null ? { objectPosition: `50% ${sel.crop.y}%` } : undefined} onError={hideOnErr} />}
            {sel.img && <img className="cs-tear" src={`/avatars/${sel.id}.png`} alt="" aria-hidden="true" style={sel.crop?.y != null ? { objectPosition: `50% ${sel.crop.y}%` } : undefined} onError={hideOnErr} />}
            <div className="cs-pvig" />
            <div className="cs-vhs" aria-hidden="true"><i className="lines" /><i className="tint" /><i className="noise" /><i className="band" /></div>
            {!sel.img && <span className="cs-slot">Portrait — image à venir</span>}
            <div className="cs-catchip"><span>{sel.cat}</span></div>
            <div className="cs-stats-ov">
              {(() => { const L = sel.statLabels || ['Flow', 'Punch', 'Tech', 'Aura']; return [[L[0], sel.stats.flow], [L[1], sel.stats.punch], [L[2], sel.stats.tech], [L[3], sel.stats.aura]] as [string, number][]; })().map(([lab, v]) => (
                <div className="cs-srow" key={lab}><span className="cs-slab">{lab}</span><span className="cs-sbar">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= v ? 'on' : ''} />)}</span></div>
              ))}
            </div>
            <div className="cs-nameplate">
              <div className="cs-name" style={{ fontSize: nameFs }}>{sel.name.toUpperCase()}</div>
              <div className="cs-epi">« {EPITHETS[sel.id] || sel.power.name} »</div>
            </div>
          </div>
          <div className="cs-infobar">
            <div className="cs-pow"><div className="k">Pouvoir signature</div><div className="nm">{sel.power.name}</div><div className="fx">{sel.power.effect}</div></div>
          </div>
        </div>

        <div className="cs-rosterwrap">
          {cats.map((cat) => {
            const members = AVATARS.filter((a) => a.cat === cat);
            if (!members.length) return null;
            return (
              <div className="cs-catgroup" key={cat}>
                <div className={`cs-catlabel${isLegend(cat) ? ' irid' : ''}`} style={{ ['--cc' as any]: CATEGORY_COLORS[cat] }}>{cat}</div>
                <div className="cs-catrow">
                  {members.map((a) => (
                    <button type="button" key={a.id} className={`cs-cell ${selId === a.id ? 'sel' : ''}`} onClick={() => setSelId(a.id)}>
                      <div className="cs-thumb" style={{ ['--c' as any]: a.color, ...(a.crop?.z ? { ['--z' as any]: a.crop.z } : {}) }}>
                        <svg viewBox="0 0 200 240"><use href="#bust" /></svg>
                        {a.img && <img src={`/avatars/${a.id}.png`} alt="" onError={hideOnErr} />}
                        <div className="tg" />
                      </div>
                      <span className="cs-cn">{a.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="cs-bottombar">
          <button className="btn big" onClick={onClose}>← Retour au hub</button>
        </div>
      </div>
    </div>
  );
}
