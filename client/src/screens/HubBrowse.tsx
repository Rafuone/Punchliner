// Vue de consultation AFFICHÉE SUR LA TV (Hub / assistant) : roster façon borne de jeu de combat et
// palmarès. Layout paysage : portrait fondu (tous les bords) + fiche du rappeur + stats/pouvoir ; en bas,
// tout le roster en grille (aligné à gauche, zéro scroll). Slots verrouillés cliquables → objectif à
// accomplir. Pas de P1/P2, pas de silhouette SVG fantôme.
import { useState, useRef, useEffect } from 'react';
import { AVATARS, avatarById, initials, CATEGORY_ORDER, CATEGORY_COLORS, isLegend, EPITHETS, AWARDS_INFO, awardIcon, LOCKED_SLOTS, bioOf, fmtAud } from '../data';
import { socket } from '../socket';
import GrungeBg from '../GrungeBg';
import { hasSpotifySession, spotifyLogin, searchPlaylists, spotifyPlayContext, spotifyTogglePlay, spotifyNext, onPlayerState } from '../spotify';

// Stations radio = requêtes de recherche (pas d'IDs codés en dur → jamais de playlist morte). Rap FR.
const RADIO_STATIONS = [
  { label: 'Rap Français', q: 'rap français' },
  { label: 'Classiques', q: 'classiques rap français' },
  { label: 'Drill FR', q: 'drill française' },
  { label: 'Nouveautés', q: 'nouveauté rap fr' },
  { label: 'Rap Chill', q: 'chill rap français' },
  { label: 'Marseille', q: 'rap marseille' },
  { label: '90s / 2000s', q: 'rap français 2000' },
  { label: 'Égotrip', q: 'egotrip rap fr' },
];

const hideOnErr = (e: any) => { e.currentTarget.style.display = 'none'; };
const cats = [...CATEGORY_ORDER, ...Array.from(new Set(AVATARS.map((a) => a.cat))).filter((c) => !CATEGORY_ORDER.includes(c))];
const ROSTER = [...cats.flatMap((cat) => AVATARS.filter((a) => a.cat === cat && !a.locked)), ...AVATARS.filter((a) => a.locked)]; // par catégorie, puis les déblocables (révélés, à part) à la fin

export default function HubBrowse({ mode, onClose, onRadioPlay }: { mode: 'roster' | 'trophies' | 'leaderboard' | 'radio'; onClose: () => void; onRadioPlay?: () => void }) {
  const [selId, setSelId] = useState(AVATARS[0].id);
  const figRef = useRef<HTMLDivElement>(null);
  const sel = avatarById(selId) || AVATARS[0];
  const lockedSel = LOCKED_SLOTS.find((s) => s.id === selId) || null;
  const bio = bioOf(selId);
  const [board, setBoard] = useState<any[]>([]); // classement mondial Cypher (chargé quand mode = leaderboard)
  const [radioResults, setRadioResults] = useState<any[]>([]); // playlists trouvées (station ou recherche)
  const [radioQuery, setRadioQuery] = useState('');
  const [radioLoading, setRadioLoading] = useState(false);
  const [radioActiveUri, setRadioActiveUri] = useState<string>(''); // playlist en cours (surlignée)
  const [radioInfo, setRadioInfo] = useState<string>(''); // code d'info quand la recherche est vide (diagnostic)
  const [nowPlaying, setNowPlaying] = useState<any>(null); // {paused,name,artist,image}
  const [spReady, setSpReady] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);
  useEffect(() => {
    if (mode !== 'leaderboard') return;
    socket.emit('leaderboard:get', { n: 30 }, (r: any) => { if (r?.ok) setBoard(r.top || []); });
  }, [mode]);
  // Radio : abonnement au now-playing + 1re station chargée à l'ouverture
  useEffect(() => {
    if (mode !== 'radio') return;
    const rdy = hasSpotifySession(); setSpReady(rdy); // session (token) suffit pour AFFICHER + chercher ; le device n'est requis que pour JOUER
    const off = onPlayerState((s) => setNowPlaying(s));
    if (rdy) runStation(RADIO_STATIONS[0]); // charge la 1re station tout de suite (la recherche marche avec le token)
    return off;
  }, [mode]);
  async function runSearch(q: string) {
    if (!q.trim()) return;
    setRadioLoading(true); setRadioQuery(q); setRadioInfo('');
    const res = await searchPlaylists(q, 40);
    setRadioResults(res.items); setRadioInfo(res.info); setRadioLoading(false);
  }
  const radioMsg = (i: string) => (({ 'no-token': 'Spotify déconnecté — reconnecte-toi.', 'http-401': 'Session Spotify expirée — reconnecte-toi.', 'http-403': 'Accès refusé par Spotify (403).', 'all-null': 'Spotify n’a renvoyé que des playlists non lisibles pour cette recherche (bug connu). Essaie une autre station.', 'empty': 'Aucune playlist trouvée.', 'network': 'Spotify injoignable (réseau).' } as any)[i] || (i.startsWith('http-') ? `Erreur Spotify (${i.slice(5)}).` : 'Choisis une station ci-dessus.'));
  function runStation(st: { label: string; q: string }) { runSearch(st.q); }
  async function playPlaylist(p: { uri: string }) {
    const ok = await spotifyPlayContext(p.uri);
    if (ok) { setRadioActiveUri(p.uri); onRadioPlay?.(); } // coupe l'instru du menu (évite le double son)
  }
  // avatar rond réutilisable (même markup/classe .med que l'écran de jeu) — GROS car affiché sur TV
  const avNode = (id?: string) => { const a = avatarById(id || ''); return <span className="med" style={{ width: 54, height: 54, fontSize: 20, background: a?.color || 'linear-gradient(150deg,#7C5CFF,#432E8C)' }}>{a?.img ? <img src={`/avatars/${a.id}.png`} alt="" onError={hideOnErr} /> : initials(a?.name || id || '?')}</span>; };

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

  if (mode === 'leaderboard') {
    return (
      <div className="hub-overlay">
        <GrungeBg />
        <div className="wrap" style={{ position: 'relative', zIndex: 1 }}>
          <div className="topbar">
            <button className="btn" style={{ padding: '8px 14px', fontSize: 13 }} onClick={onClose}>← Retour au hub</button>
            <h1 className="wm" style={{ fontSize: 22 }}>CLASSEMENT <span className="d">MONDIAL</span></h1>
            <span className="gpill">Cypher</span>
          </div>
          <p className="muted" style={{ textAlign: 'center', margin: '2px 0 30px', fontSize: 13 }}>Le contre-la-montre — meilleurs scores, tous salons confondus.</p>
          {board.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', marginTop: 70, fontSize: 'clamp(18px,2vw,24px)' }}>Aucun score pour l'instant.<br />Lance un <b style={{ color: 'var(--fluo)' }}>Cypher</b> pour ouvrir le classement.</p>
          ) : (
            <div className="board tvbig" style={{ maxWidth: 940, margin: '0 auto' }}>
              {board.map((t: any, i: number) => (
                <div className={`prow ${i === 0 ? 'lead' : ''}`} key={i} style={{ animation: `rowin .3s ease ${Math.min(i, 12) * 0.035}s both` }}>
                  <span className="who"><span className="rk">{i + 1}</span>{avNode(t.avatar)}{t.name}</span>
                  <span className="row" style={{ gap: 24, alignItems: 'baseline' }}>
                    <span className="gain zero" style={{ fontSize: 'clamp(16px,1.7vw,22px)' }}>{t.tracks} ✓</span>
                    <span className="pts">{fmtAud(t.score)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'radio') {
    return (
      <div className="hub-overlay">
        <GrungeBg />
        <div className="wrap" style={{ position: 'relative', zIndex: 1, paddingBottom: nowPlaying ? 108 : 24 }}>
          <div className="topbar">
            <button className="btn" style={{ padding: '8px 14px', fontSize: 13 }} onClick={onClose}>← Retour au hub</button>
            <h1 className="wm" style={{ fontSize: 22 }}>RADIO <span className="d">PUNCHLINR</span></h1>
            <span className="gpill">Spotify</span>
          </div>
          <p className="muted" style={{ textAlign: 'center', margin: '2px 0 20px', fontSize: 13 }}>De l'ambiance pour le salon — choisis une station ou cherche une playlist.</p>

          {!spReady ? (
            <div className="center" style={{ marginTop: 50, gap: 14 }}>
              <p className="muted" style={{ fontSize: 15 }}>La radio a besoin de <b style={{ color: 'var(--txt)' }}>Spotify (Premium)</b> connecté.</p>
              <button className="btn warm" onClick={() => spotifyLogin()}>Connecter Spotify</button>
            </div>
          ) : (
            <>
              <div className="radio-bar">
                {RADIO_STATIONS.map((st) => (
                  <button key={st.q} className={`radio-chip ${radioQuery === st.q ? 'on' : ''}`} onClick={() => runStation(st)}>{st.label}</button>
                ))}
                <form className="radio-search" onSubmit={(e) => { e.preventDefault(); runSearch(radioQuery); }}>
                  <input className="field" placeholder="Rechercher une playlist…" value={radioQuery} onChange={(e) => setRadioQuery(e.target.value)} />
                </form>
              </div>
              {radioLoading ? (
                <p className="muted" style={{ textAlign: 'center', marginTop: 36 }}>Recherche…</p>
              ) : radioResults.length === 0 ? (
                <div className="center" style={{ marginTop: 40, gap: 14 }}>
                  <p className="muted" style={{ textAlign: 'center', maxWidth: 460, fontSize: 15 }}>{radioMsg(radioInfo)}</p>
                  {(radioInfo === 'no-token' || radioInfo === 'http-401') && <button className="btn warm" onClick={() => spotifyLogin()}>Reconnecter Spotify</button>}
                </div>
              ) : (
                <div className="radio-grid">
                  {radioResults.map((p: any) => (
                    <button key={p.uri} className={`radio-card ${radioActiveUri === p.uri ? 'on' : ''}`} onClick={() => playPlaylist(p)} title={p.name}>
                      <div className="radio-cover">{p.image ? <img src={p.image} alt="" /> : <span>♪</span>}<span className="radio-play">▶</span></div>
                      <div className="radio-name">{p.name}</div>
                      <div className="radio-owner">{p.owner}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {nowPlaying && (
          <div className="radio-player">
            <div className="rp-track">
              {nowPlaying.image && <img src={nowPlaying.image} alt="" />}
              <div className="rp-meta"><div className="rp-name">{nowPlaying.name}</div><div className="rp-artist">{nowPlaying.artist}</div></div>
            </div>
            <div className="rp-controls">
              <button className="rp-btn" onClick={() => spotifyTogglePlay()} aria-label={nowPlaying.paused ? 'Lecture' : 'Pause'}>{nowPlaying.paused ? '▶' : '❚❚'}</button>
              <button className="rp-btn" onClick={() => spotifyNext()} aria-label="Suivant">⏭</button>
            </div>
          </div>
        )}
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
      <button className="tvros-back" onClick={onClose}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
        RETOUR
      </button>

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
          <button key={a.id} className={`tvcell ${isLegend(a.cat) ? 'irid' : ''} ${selId === a.id ? 'sel' : ''}`} style={{ ['--cc' as any]: CATEGORY_COLORS[a.cat], ['--c' as any]: a.color }}
            onMouseEnter={() => setSelId(a.id)} onClick={() => setSelId(a.id)} title={a.name}>
            {a.img ? <img src={`/avatars/${a.id}.png`} alt={a.name} onError={hideOnErr} /> : <span className="ini">{initials(a.name)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
