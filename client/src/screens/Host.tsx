import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { socket } from '../socket';
import { avatarById, initials, DIFFICULTIES, MODES, REBALANCE, MENU_TRACKS, fmtAud, certif } from '../data';
import ConfigWizard from './ConfigWizard';

const C = 2 * Math.PI * 54;
const HKEY = 'pl_host';
const SILENT = 'data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAgICAgICAgICAgIA=';

function Med({ avatarId, size = 38 }: { avatarId?: string; size?: number }) {
  const a = avatarById(avatarId);
  return <span className="med" style={{ width: size, height: size, background: a?.color || 'linear-gradient(150deg,#7C5CFF,#432E8C)' }}>{initials(a?.name || '?')}</span>;
}

export default function Host() {
  const [phase, setPhase] = useState<'connecting' | 'lobby' | 'prep' | 'countdown' | 'playing' | 'reveal' | 'final'>('connecting');
  const [countdown, setCountdown] = useState(0);
  const [code, setCode] = useState('');
  const [poolSize, setPoolSize] = useState(0);
  const [players, setPlayers] = useState<any[]>([]);
  const [settings, setSettings] = useState({ difficulty: 'normal', mode: 'multi', rounds: 8, mj: false, rebalance: 'comeback' });
  const [configuring, setConfiguring] = useState(false);
  const [powerLog, setPowerLog] = useState('');
  const [round, setRound] = useState<any>({ index: 0, total: 0, endsAt: 0, durationMs: 25000, mode: 'multi', difficulty: '' });
  const [answered, setAnswered] = useState<string[]>([]);
  const [buzzWinner, setBuzzWinner] = useState<string | null>(null);
  const [reveal, setReveal] = useState<any>(null);
  const [finalScores, setFinalScores] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [joinBase, setJoinBase] = useState(window.location.origin.replace(/\/$/, ''));
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [prepEndsAt, setPrepEndsAt] = useState(0);
  const [prepReady, setPrepReady] = useState<{ count: number; total: number }>({ count: 0, total: 0 });
  const previewRef = useRef<any>({ url: '', clipMs: 30000, startAt: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clipTimer = useRef<any>(null);
  const menuAudioRef = useRef<HTMLAudioElement | null>(null);
  const [nowPlaying, setNowPlaying] = useState(-1);
  const [musicOn, setMusicOn] = useState(true);
  const musicOnRef = useRef(true);
  const startedRef = useRef(false);
  const curRef = useRef(-1);

  function applyState(state: any) {
    setPlayers(state.players || []);
    setSettings((s) => ({ ...s, difficulty: state.settings?.difficulty || s.difficulty, mode: state.settings?.mode || s.mode }));
    if (state.phase === 'playing' && state.round) {
      setRound(state.round); setBuzzWinner(state.buzz?.winnerName || null); setPhase('playing');
      playPreview(state.round.preview, state.round.startAt);
    } else if (state.phase === 'prep' && state.round) {
      setRound(state.round); setPrepEndsAt(state.round.endsAt || 0); setPrepReady({ count: 0, total: 0 }); setNow(Date.now()); setPhase('prep');
    } else if (state.phase === 'reveal' && state.reveal) {
      setReveal(state.reveal); setPlayers(state.reveal.scores); setPhase('reveal');
    } else if (state.phase === 'final' && state.final) {
      setFinalScores(state.final.scores); setPhase('final');
    } else setPhase('lobby');
  }

  useEffect(() => {
    const boot = () => {
      let saved: any = null;
      try { saved = JSON.parse(localStorage.getItem(HKEY) || 'null'); } catch {}
      if (saved?.code && saved?.hostToken) {
        socket.emit('host:reclaim', saved, (res: any) => {
          if (res?.ok) { setCode(res.code); setPoolSize(res.poolSize); applyState(res.state); }
          else { localStorage.removeItem(HKEY); create(); }
        });
      } else create();
    };
    const create = () => socket.emit('host:create', {}, (res: any) => {
      if (res?.ok) { setCode(res.code); setPoolSize(res.poolSize); setPhase('lobby'); localStorage.setItem(HKEY, JSON.stringify({ code: res.code, hostToken: res.hostToken })); }
    });
    if (socket.connected) boot();
    socket.on('connect', boot);
    socket.on('lobby', (d: any) => { setError(''); setPlayers(d.players); setRound((r: any) => ({ ...r, total: d.totalRounds })); if (d.phase === 'lobby') setPhase('lobby'); });
    socket.on('round:prep', (d: any) => { setError(''); setReveal(null); setAnswered([]); setBuzzWinner(null); setRound((r: any) => ({ ...r, index: d.index ?? r.index, total: d.total ?? r.total })); setPrepEndsAt(d.endsAt || 0); setPrepReady({ count: 0, total: 0 }); setNow(Date.now()); setPhase('prep'); });
    socket.on('prep:ready', (d: any) => setPrepReady({ count: d.count || 0, total: d.total || 0 }));
    socket.on('round:countdown', (d: any) => { setError(''); setReveal(null); setAnswered([]); setBuzzWinner(null); setRound((r: any) => ({ ...r, index: d.index ?? r.index, total: d.total ?? r.total })); setCountdown(d.seconds || 5); setPhase('countdown'); });
    socket.on('round:host', (d: any) => { setReveal(null); setAnswered([]); setBuzzWinner(null); setRound(d); setPhase('playing'); playPreview(d.preview, d.startAt); });
    socket.on('player:answered', (d: any) => setAnswered((a) => (a.includes(d.name) ? a : [...a, d.name])));
    socket.on('buzz:winner', (d: any) => setBuzzWinner(d.name));
    socket.on('buzz:open', () => setBuzzWinner(null));
    socket.on('round:reveal', (d: any) => { setReveal(d); setPlayers(d.scores); setPhase('reveal'); }); // le son continue de tourner sur la révélation
    socket.on('game:final', (d: any) => { audioRef.current?.pause(); setFinalScores(d.scores); setPhase('final'); });
    socket.on('power:used', (d: any) => { setPowerLog(`${d.name} a lancé ${d.power}`); setTimeout(() => setPowerLog(''), 4500); });
    socket.on('scores:update', (d: any) => setPlayers(d.scores));
    socket.on('room:closed', (d: any) => { setError(d.reason || 'Salon fermé.'); localStorage.removeItem(HKEY); });
    return () => ['connect', 'lobby', 'round:prep', 'prep:ready', 'round:countdown', 'round:host', 'player:answered', 'buzz:winner', 'buzz:open', 'round:reveal', 'game:final', 'power:used', 'scores:update', 'room:closed'].forEach((e) => socket.off(e as any));
  }, []);

  useEffect(() => { if (phase !== 'playing' && phase !== 'prep') return; const id = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(id); }, [phase]);
  useEffect(() => { if (phase !== 'countdown') return; const id = setInterval(() => setCountdown((c) => Math.max(1, c - 1)), 1000); return () => clearInterval(id); }, [phase]);
  useEffect(() => {
    fetch('/api/net').then((r) => r.json()).then(({ ip }) => {
      const loc = window.location; const local = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
      setJoinBase(local && ip ? `${loc.protocol}//${ip}:${loc.port || '5173'}` : loc.origin.replace(/\/$/, ''));
    }).catch(() => {});
  }, []);

  /* ---- musique du menu : aléatoire, morceaux entiers, historique préc/suiv ---- */
  const histRef = useRef<number[]>([]);
  const posRef = useRef(-1);
  const bassRef = useRef(0);        // niveau de basses (0..1) → "beat" pour le glow
  const barsRef = useRef<number[]>([0, 0, 0, 0, 0, 0, 0]); // bandes de l'égaliseur (0..1)
  const acRef = useRef<any>(null);  // AudioContext + analyser
  const dockEqRef = useRef<HTMLSpanElement | null>(null);  // barres EQ du dock (peintes en RAF)
  function pickTrack(exclude: number) {
    if (MENU_TRACKS.length <= 1) return 0;
    let n = exclude;
    while (n === exclude) n = Math.floor(Math.random() * MENU_TRACKS.length);
    return n;
  }
  function ensureAnalyser() {
    const a = menuAudioRef.current; if (!a || acRef.current) return;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
      const ctx = new AC(); const src = ctx.createMediaElementSource(a); const an = ctx.createAnalyser();
      an.fftSize = 256; src.connect(an); an.connect(ctx.destination);
      acRef.current = { ctx, an, data: new Uint8Array(an.frequencyBinCount) };
      const NB = 7, USABLE = 96; // on ignore le très haut du spectre (souvent muet)
      const loop = () => {
        const o = acRef.current; if (!o) return;
        o.an.getByteFrequencyData(o.data);
        // "beat" : énergie des basses (bins 1..7)
        let s = 0; for (let i = 1; i < 8; i++) s += o.data[i];
        bassRef.current = Math.min(1, s / (7 * 205));
        // bandes de l'égaliseur réparties sur le spectre utile (avec lissage)
        const bands = barsRef.current;
        for (let b = 0; b < NB; b++) {
          const start = Math.floor((b / NB) * USABLE), end = Math.floor(((b + 1) / NB) * USABLE);
          let sum = 0, cnt = 0; for (let i = start; i < end; i++) { sum += o.data[i]; cnt++; }
          const v = cnt ? sum / cnt / 255 : 0;
          bands[b] += (Math.min(1, v * 1.3) - bands[b]) * 0.5;
        }
        // peint les barres du dock si affichées
        const eq = dockEqRef.current;
        if (eq) { const k = eq.children, n = k.length; for (let i = 0; i < n; i++) (k[i] as HTMLElement).style.height = (12 + (bands[Math.floor((i / n) * NB)] || 0) * 88) + '%'; }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch (e) {}
  }
  function playMenuTrack(i: number, pushHist = true) {
    const a = menuAudioRef.current; if (!a) return;
    a.src = MENU_TRACKS[i].src; a.volume = 0.5;
    a.play().then(() => { ensureAnalyser(); acRef.current?.ctx?.resume?.(); curRef.current = i; setNowPlaying(i); if (pushHist) { histRef.current = histRef.current.slice(0, posRef.current + 1); histRef.current.push(i); posRef.current = histRef.current.length - 1; } }).catch(() => {});
  }
  function nextTrack() {
    if (posRef.current < histRef.current.length - 1) { posRef.current += 1; playMenuTrack(histRef.current[posRef.current], false); }
    else playMenuTrack(pickTrack(curRef.current), true);
  }
  function prevTrack() {
    if (posRef.current > 0) { posRef.current -= 1; playMenuTrack(histRef.current[posRef.current], false); }
  }
  function startMenu() {
    if (startedRef.current || !musicOnRef.current) return;
    startedRef.current = true;
    playMenuTrack(pickTrack(-1));
  }
  function toggleMusic() {
    const on = !musicOn; setMusicOn(on); musicOnRef.current = on;
    const a = menuAudioRef.current; if (!a) return;
    if (on) { if (!startedRef.current) startMenu(); else a.play().catch(() => {}); }
    else a.pause();
  }
  useEffect(() => {
    const h = () => startMenu();
    window.addEventListener('pointerdown', h, { once: true });
    window.addEventListener('keydown', h, { once: true });
    return () => { window.removeEventListener('pointerdown', h); window.removeEventListener('keydown', h); };
  }, []);
  useEffect(() => {
    const a = menuAudioRef.current; if (!a) return;
    if (phase !== 'lobby') a.pause();
    else if (startedRef.current && musicOnRef.current && a.paused) a.play().catch(() => {});
  }, [phase]);

  function playPreview(url: string, startAt = 0) {
    const a = audioRef.current; if (!a || !url) return;
    previewRef.current = { url, startAt };
    a.src = url; a.volume = 1;
    a.play().then(() => {
      try { if (startAt) a.currentTime = startAt / 1000; } catch {}
      setAudioBlocked(false); // le son joue à fond, on ne le coupe pas
    }).catch((e: any) => { console.warn('[audio] bloqué:', e?.name); setAudioBlocked(true); });
  }
  function start() {
    const a = audioRef.current;
    if (a) { a.src = SILENT; a.play().then(() => a.pause()).catch(() => {}); }
    socket.emit('host:start', { rounds: settings.rounds, difficulty: settings.difficulty, mode: settings.mode, mj: settings.mj, rebalance: settings.rebalance }, (res: any) => res?.error && setError(res.error));
  }
  function startWizard(s: { rounds: number; difficulty: string; mode: string; mj: boolean; rebalance: string; mjId?: string }) {
    const a = audioRef.current;
    if (a) { a.src = SILENT; a.play().then(() => a.pause()).catch(() => {}); }
    socket.emit('host:start', s, (res: any) => res?.error && setError(res.error));
  }

  const remaining = Math.max(0, round.endsAt - now);
  const seconds = Math.ceil(remaining / 1000);
  const frac = round.durationMs ? remaining / round.durationMs : 0;

  return (
    <div className="wrap">
      <div className="topbar">
        <h1 className="wm" style={{ fontSize: 24 }}>PUNCHLIN<span className="d">E</span></h1>
        <span className="row" style={{ gap: 10 }}>
          {phase !== 'connecting' && <span className="gpill"><span className="dot" />{phase === 'lobby' ? `Salon ${code}` : `Manche ${round.index + 1}/${round.total} · ${round.difficulty}`} · {players.length} j.</span>}
          {['countdown', 'playing', 'reveal'].includes(phase) && <button className="btn" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => socket.emit('host:restart')}>← Salon</button>}
        </span>
      </div>
      {error && <p className="err" style={{ textAlign: 'center' }}>{error}</p>}
      {phase === 'connecting' && <div className="center"><p className="muted">Connexion…</p></div>}

      {phase === 'lobby' && !configuring && (
        <div className="center" style={{ gap: 30 }}>
          <span className="eyebrow">Rejoins le salon</span>
          <div className="code">{code}</div>
          <div className="join-row">
            <div className="qr"><QRCodeSVG value={`${joinBase}/?c=${code}`} size={118} bgColor="#ffffff" fgColor="#0c0722" /></div>
            <div style={{ textAlign: 'left' }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Scanne le QR avec ton tel</div>
              <div className="url" style={{ fontSize: 16, textTransform: 'none', letterSpacing: 0 }}>{joinBase.replace(/^https?:\/\//, '')}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>ou tape l'adresse + le code <b style={{ color: 'var(--txt)' }}>{code}</b></div>
            </div>
          </div>

          {players.length > 0 && (
            <div className="players" style={{ maxWidth: 720 }}>
              {players.map((p) => (
                <div className="pcard" key={p.id} style={{ opacity: p.connected ? 1 : 0.5 }}>
                  <Med avatarId={p.avatar} />
                  <div><div className="pname">{p.name}</div><div className="muted" style={{ fontSize: 11 }}>{avatarById(p.avatar)?.name}</div></div>
                </div>
              ))}
            </div>
          )}

          <button className="btn warm big" style={{ maxWidth: 360 }} onClick={() => setConfiguring(true)} disabled={poolSize < 1}>Configurer la partie →</button>
          <a className="muted" href="/?dev" target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: 'none' }}>+ ajouter un joueur test</a>
        </div>
      )}

      {phase === 'lobby' && configuring && (
        <ConfigWizard
          poolSize={poolSize}
          roomCode={code}
          players={players.length}
          playerList={players}
          onStart={startWizard}
          onBack={() => setConfiguring(false)}
          music={{ nowPlaying, musicOn, onToggle: toggleMusic, onNext: nextTrack, onPrev: prevTrack, bassRef, barsRef, tracks: MENU_TRACKS }}
        />
      )}

      {phase === 'countdown' && (
        <div className="center">
          <span className="eyebrow">Prépare-toi…</span>
          <div className="big-num" style={{ color: 'var(--fluo)' }}>{countdown}</div>
          <span className="url">la musique arrive</span>
        </div>
      )}

      {phase === 'prep' && (
        <div className="center">
          <span className="eyebrow">Manche {round.index + 1} / {round.total}</span>
          <h2 className="title-xl">Activation des pouvoirs</h2>
          <div className="big-num" style={{ color: 'var(--fluo)' }}>{Math.max(0, Math.ceil((prepEndsAt - now) / 1000))}</div>
          <span className="url">{prepReady.count}/{prepReady.total} prêt{prepReady.total > 1 ? 's' : ''}</span>
          <p className="muted">Chaque joueur active son pouvoir — ou passe — avant que la musique démarre.</p>
        </div>
      )}

      {phase === 'playing' && (
        <div className="center">
          {audioBlocked && round.mode !== 'quiz' && <button className="btn warm big" style={{ maxWidth: 320 }} onClick={() => playPreview(previewRef.current.url, previewRef.current.startAt)}>Activer le son</button>}
          {round.mode === 'quiz' ? (
            <div style={{ width: '100%', maxWidth: 840, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
              <div className="row" style={{ gap: 18, alignItems: 'center', justifyContent: 'center' }}>
                <span className="gpill" style={{ color: 'var(--fluo)' }}>{round.quiz?.cat}</span>
                <div className="ring" style={{ width: 92, height: 92 }}>
                  <svg viewBox="0 0 120 120">
                    <defs><linearGradient id="tgq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a6ff00" /><stop offset="1" stopColor="#e4ff1a" /></linearGradient></defs>
                    <circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,.12)" strokeWidth="10" fill="none" />
                    <circle cx="60" cy="60" r="54" stroke="url(#tgq)" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
                  </svg>
                  <span className="n" style={{ fontSize: 36 }}>{seconds}</span>
                </div>
              </div>
              <h2 className="title-xl" style={{ maxWidth: 760 }}>{round.quiz?.q}</h2>
              <div className="qz-grid host">
                {round.quiz?.choices?.map((c: string, i: number) => (
                  <div className="qz-opt host" key={i}><b>{String.fromCharCode(65 + i)}</b> {c}</div>
                ))}
              </div>
              {answered.length > 0 && <div className="answered">{answered.map((n) => <span className="abadge" key={n}>{n}</span>)}</div>}
            </div>
          ) : (
            <>
              <div className="wrap-cols" style={{ width: '100%', maxWidth: 780 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                  <div className="disc"><span className="q">?</span></div>
                  <span className="eyebrow">{round.mode === 'buzzer' ? 'Mode buzzer' : 'Extrait en cours'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div className="ring">
                    <svg viewBox="0 0 120 120">
                      <defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a6ff00" /><stop offset="1" stopColor="#e4ff1a" /></linearGradient></defs>
                      <circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,.12)" strokeWidth="10" fill="none" />
                      <circle cx="60" cy="60" r="54" stroke="url(#tg)" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
                    </svg>
                    <span className="n">{seconds}</span>
                  </div>
                  <span className="url">secondes</span>
                </div>
              </div>
              {round.mode === 'buzzer' ? (
                <p className="feedback" style={{ color: buzzWinner ? 'var(--ember)' : 'var(--muted)' }}>{buzzWinner ? `${buzzWinner} a buzzé — à lui de répondre !` : 'Le premier qui buzze prend la main…'}</p>
              ) : (
                answered.length > 0 && <div className="answered">{answered.map((n) => <span className="abadge" key={n}>{n}</span>)}</div>
              )}
            </>
          )}
          {powerLog && <p className="feedback" style={{ color: 'var(--v1)' }}>{powerLog}</p>}
        </div>
      )}

      {phase === 'reveal' && reveal && (
        <div className="center" style={{ justifyContent: 'flex-start', paddingTop: 'clamp(16px,4vh,52px)', gap: 22 }}>
          <span className="eyebrow">{reveal.quiz ? 'La réponse' : "C'était…"}</span>
          {reveal.quiz ? (
            <div style={{ textAlign: 'center', maxWidth: 720 }}>
              <span className="gpill" style={{ color: 'var(--fluo)' }}>{reveal.quiz.cat}</span>
              <h2 className="title-xl" style={{ margin: '12px 0' }}>{reveal.quiz.q}</h2>
              <div className="gpill" style={{ fontSize: 'clamp(16px,2.4vw,22px)', padding: '12px 22px', color: 'var(--green)', borderColor: 'rgba(166,255,0,.5)' }}>{reveal.quiz.choices[reveal.quiz.answer]}</div>
            </div>
          ) : (
            <div className="row" style={{ gap: 26, flexWrap: 'wrap', justifyContent: 'center' }}>
              {reveal.track.cover && <img className="cover" src={reveal.track.cover} alt="" style={{ width: 'clamp(160px,26vw,240px)', height: 'clamp(160px,26vw,240px)' }} />}
              <div style={{ textAlign: 'left', maxWidth: 460 }}>
                <div className="eyebrow" style={{ color: 'var(--muted2)', marginBottom: 2 }}>Titre</div>
                <h2 className="title-xl" style={{ marginBottom: 12 }}>{reveal.track.title}</h2>
                <div className="eyebrow" style={{ color: 'var(--muted2)', marginBottom: 2 }}>Artiste</div>
                <p className="reveal-artist" style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 'clamp(20px,3vw,32px)', margin: 0, lineHeight: 1.05 }}>{reveal.track.artist}</p>
              </div>
            </div>
          )}
          <div className="board" style={{ maxWidth: 620 }}>
            {reveal.scores.filter((p: any) => !p.isMJ).map((p: any, i: number) => {
              const r = reveal.results.find((x: any) => x.id === p.id);
              const d = p.rankDelta || 0;
              return (
                <div className={`prow ${i === 0 ? 'lead' : ''}`} key={p.id} style={{ animation: `rowin .32s ease ${i * 0.05}s both` }}>
                  <span className="who"><span className="rk">{i + 1}</span><Med avatarId={p.avatar} size={26} />{p.name}</span>
                  <span className="row" style={{ gap: 12 }}>
                    {d !== 0 && (
                      <span style={{ color: d > 0 ? 'var(--green)' : 'var(--bad)', display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 800, fontSize: 12 }}>
                        {d > 0
                          ? <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><path d="M5 1l4 7H1z" /></svg>
                          : <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><path d="M5 9L1 3h8z" /></svg>}
                        {Math.abs(d)}
                      </span>
                    )}
                    <span className={`gain ${r && r.points ? '' : 'zero'}`}>{r && r.points ? `+${fmtAud(r.points)}` : '·'}</span>
                    <span className="pts">{fmtAud(p.score)}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <button className="btn warm" onClick={() => socket.emit('host:next')}>{round.index + 1 >= round.total ? 'Voir le podium' : 'Manche suivante'}</button>
        </div>
      )}

      {phase === 'final' && (
        <div className="center">
          <span className="eyebrow">Podium</span>
          <div style={{ color: 'var(--fluo)' }}><svg width="104" height="104" viewBox="0 0 24 24" fill="none"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" stroke="currentColor" strokeWidth="1.3" /><path d="M7 5H4v1.6A3.4 3.4 0 0 0 7.3 10M17 5h3v1.6A3.4 3.4 0 0 1 16.7 10" stroke="currentColor" strokeWidth="1.3" /><path d="M9.5 13v3.3h5V13M8 20.5h8M10.4 16.8h3.2v3.7h-3.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg></div>
          <h2 className="title-xl">{finalScores.filter((p: any) => !p.isMJ)[0]?.name} gagne</h2>
          <div className="gpill" style={{ color: 'var(--fluo)', borderColor: 'var(--fluo)', fontSize: 15, padding: '10px 18px' }}>{certif(finalScores.filter((p: any) => !p.isMJ)[0]?.score ?? 0, round.total).label}</div>
          <div className="board" style={{ maxWidth: 560 }}>
            {finalScores.filter((p: any) => !p.isMJ).map((p, i) => (
              <div className={`prow ${i === 0 ? 'lead' : ''}`} key={p.id}>
                <span className="who"><Med avatarId={p.avatar} size={26} />{p.name}</span>
                <span className="pts">{fmtAud(p.score)}</span>
              </div>
            ))}
          </div>
          <button className="btn" onClick={() => socket.emit('host:restart')}>Rejouer</button>
        </div>
      )}

      {phase === 'lobby' && !configuring && (
        <div className={`nowdock ${musicOn && nowPlaying >= 0 ? '' : 'paused'}`}>
          <span className="eq" ref={dockEqRef}><i /><i /><i /><i /></span>
          <span className="nt">
            <span className="v">{nowPlaying >= 0 ? MENU_TRACKS[nowPlaying].title : 'Musique du menu'}</span>
            <span className="s">{nowPlaying >= 0 ? MENU_TRACKS[nowPlaying].artist : (startedRef.current ? '' : 'clique pour lancer')}</span>
          </span>
          <button onClick={prevTrack} title="Précédent" aria-label="Précédent"><svg width="13" height="13" viewBox="0 0 15 15" fill="currentColor"><path d="M4 3h1.5v9H4zM12 3v9l-6-4.5z" /></svg></button>
          <button onClick={nextTrack} title="Suivant" aria-label="Suivant"><svg width="13" height="13" viewBox="0 0 15 15" fill="currentColor"><path d="M9.5 3H11v9H9.5zM3 3v9l6-4.5z" /></svg></button>
          <button onClick={toggleMusic} title={musicOn ? 'Couper' : 'Remettre'} aria-label="Musique">
            {musicOn
              ? <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M3 5.5h2.5L9 3v9L5.5 9.5H3z" fill="currentColor" /><path d="M11 5.5c1 1 1 3 0 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
              : <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M3 5.5h2.5L9 3v9L5.5 9.5H3z" fill="currentColor" /><path d="M10.5 5l3.5 3.5M14 5l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>}
          </button>
        </div>
      )}
      <audio ref={audioRef} preload="auto" />
      <audio ref={menuAudioRef} preload="auto" onEnded={() => nextTrack()} />
    </div>
  );
}
