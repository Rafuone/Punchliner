// Vue de consultation AFFICHÉE SUR LA TV (Hub / assistant) : roster façon borne de jeu de combat et
// palmarès. Layout paysage : portrait fondu (tous les bords) + fiche du rappeur + stats/pouvoir ; en bas,
// tout le roster en grille (aligné à gauche, zéro scroll). Slots verrouillés cliquables → objectif à
// accomplir. Pas de P1/P2, pas de silhouette SVG fantôme.
import { useState, useRef, useEffect } from 'react';
import { AVATARS, avatarById, initials, CATEGORY_ORDER, CATEGORY_COLORS, isLegend, EPITHETS, AWARDS_INFO, awardIcon, LOCKED_SLOTS, bioOf } from '../data';

const hideOnErr = (e: any) => { e.currentTarget.style.display = 'none'; };
const cats = [...CATEGORY_ORDER, ...Array.from(new Set(AVATARS.map((a) => a.cat))).filter((c) => !CATEGORY_ORDER.includes(c))];
const ROSTER = cats.flatMap((cat) => AVATARS.filter((a) => a.cat === cat)); // à plat, rangé par catégorie

export default function HubBrowse({ mode, onClose }: { mode: 'roster' | 'trophies'; onClose: () => void }) {
  const [selId, setSelId] = useState(AVATARS[0].id);
  const figRef = useRef<HTMLDivElement>(null);
  const sel = avatarById(selId) || AVATARS[0];
  const lockedSel = LOCKED_SLOTS.find((s) => s.id === selId) || null;
  const bio = bioOf(selId);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  // glitch VHS (déchirures de tracking) sur le portrait
  useEffect(() => {
    if (mode !== 'roster' || lockedSel) return;
    const fig = figRef.current; if (!fig) return;
    let timer: any;
    const fire = () => {
      const r = Math.random(), strong = r < 0.4, big = r < 0.15;
      const gx = (Math.random() * 2 - 1) * (big ? 26 : strong ? 15 : 6);
      const gh = big ? 12 + Math.random() * 22 : strong ? 5 + Math.random() * 12 : 2 + Math.random() * 7;
      fig.style.setProperty('--gy', (Math.random() * 82).toFixed(1) + '%');
      fig.style.setProperty('--gh', gh.toFixed(1) + '%');
      fig.style.setProperty('--gx', gx.toFixed(1) + 'px');
      fig.classList.add(strong ? 'glx-strong' : 'glx');
      window.setTimeout(() => fig.classList.remove('glx', 'glx-strong'), (strong ? 100 : 55) + Math.random() * (strong ? 240 : 100));
      timer = window.setTimeout(fire, 480 + Math.random() * 2400);
    };
    timer = window.setTimeout(fire, 500 + Math.random() * 1500);
    return () => { window.clearTimeout(timer); fig.classList.remove('glx', 'glx-strong'); };
  }, [mode, selId, lockedSel]);

  // filtres VHS (aberration chromatique) réutilisés par le portrait + les déchirures. (Plus de silhouette #bust.)
  const defs = (
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

  // ---- roster ----
  const nmU = sel.name.toUpperCase();
  const nameFs = nmU.length > 12 ? 'clamp(34px,4.4vw,58px)' : nmU.length > 8 ? 'clamp(42px,5.2vw,72px)' : 'clamp(50px,6vw,84px)';
  const SL = sel.statLabels || ['Flow', 'Punch', 'Tech', 'Aura'];
  const statRows: [string, number][] = [[SL[0], sel.stats.flow], [SL[1], sel.stats.punch], [SL[2], sel.stats.tech], [SL[3], sel.stats.aura]];
  const idx = lockedSel ? LOCKED_SLOTS.indexOf(lockedSel) + 1 : 0;

  return (
    <div className={`hub-overlay tvros${isLegend(sel.cat) && !lockedSel ? ' irid' : ''}`} style={{ ['--c' as any]: lockedSel ? '#20222a' : sel.color, ['--cc' as any]: lockedSel ? '#7d8590' : CATEGORY_COLORS[sel.cat] }}>
      {defs}
      <div className="tvros-head">
        <button className="btn" style={{ padding: '8px 16px', fontSize: 13 }} onClick={onClose}>← Retour au hub</button>
        <h1 className="wm" style={{ fontSize: 22, margin: 0 }}>LE&nbsp;<span style={{ color: 'var(--fluo)' }}>ROSTER</span></h1>
        <span className="gpill">{ROSTER.length} rappeurs · {LOCKED_SLOTS.length} à débloquer</span>
      </div>

      <div className="tvros-hero">
        {/* portrait (fondu tous bords) */}
        <div className="tvros-fig" ref={figRef}>
          <div className="tvros-figglow" />
          {lockedSel ? (
            <div className="tvros-lockq">?</div>
          ) : sel.img ? (
            <>
              <img className="tvros-portrait" src={`/avatars/${sel.id}.png`} alt="" onError={hideOnErr} />
              <img className="tvros-portrait tear" src={`/avatars/${sel.id}.png`} alt="" aria-hidden="true" onError={hideOnErr} />
            </>
          ) : (
            <div className="tvros-lockq">{initials(sel.name)}</div>
          )}
        </div>

        {/* colonne infos : nom, fiche, stats/pouvoir (ou objectif si verrouillé) */}
        <div className="tvros-side">
          <div className="tvros-nameblock">
            <div className="tvros-catchip"><span>{lockedSel ? 'Verrouillé' : sel.cat}</span></div>
            <div className="tvros-name" style={{ fontSize: lockedSel ? 'clamp(46px,5.6vw,84px)' : nameFs }}>{lockedSel ? '???' : nmU}</div>
            <div className="tvros-epi">{lockedSel ? `Challenger mystère n°${idx}` : `« ${EPITHETS[sel.id] || sel.power.name} »`}</div>
          </div>

          {lockedSel ? (
            <div className="tvros-obj">
              <div className="tvros-blabel">Objectif à accomplir</div>
              <div className="tvros-objtxt">{lockedSel.objective}</div>
              <div className="tvros-objnote">Réussis-le en partie pour révéler ce rappeur.</div>
            </div>
          ) : (
            <>
              {bio && (
                <div className="tvros-bio">
                  {bio.tags && <div className="tvros-tags">{bio.tags.map((t) => <span key={t}>{t}</span>)}</div>}
                  <div className="tvros-bionote">{bio.note}</div>
                </div>
              )}
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
                  <div className="tvros-pname">{sel.power.name}</div>
                  <div className="tvros-pfx">{sel.power.effect}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* GRILLE : tout le roster, aligné à gauche, tuiles biseautées */}
      <div className="tvros-grid">
        {ROSTER.map((a) => (
          <button key={a.id} className={`tvcell ${selId === a.id ? 'sel' : ''}`} style={{ ['--cc' as any]: CATEGORY_COLORS[a.cat], ['--c' as any]: a.color }}
            onMouseEnter={() => setSelId(a.id)} onClick={() => setSelId(a.id)} title={a.name}>
            {a.img ? <img src={`/avatars/${a.id}.png`} alt={a.name} onError={hideOnErr} /> : <span className="ini">{initials(a.name)}</span>}
            <span className="tvcell-nm">{a.name}</span>
          </button>
        ))}
        {LOCKED_SLOTS.map((s) => (
          <button key={s.id} className={`tvcell lock ${selId === s.id ? 'sel' : ''}`} style={{ ['--cc' as any]: '#7d8590' }}
            onMouseEnter={() => setSelId(s.id)} onClick={() => setSelId(s.id)} title="À débloquer">
            <span className="q">?</span>
          </button>
        ))}
      </div>
    </div>
  );
}
