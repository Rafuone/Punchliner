import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { socket } from '../socket';
import { avatarById, initials, DIFFICULTIES, MODES, REBALANCE } from '../data';

const C = 2 * Math.PI * 54;
const HKEY = 'pl_host';
const SILENT = 'data:audio/wav;base64,UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRAAAACAgICAgICAgICAgICAgIA=';

function Med({ avatarId, size = 38 }: { avatarId?: string; size?: number }) {
  const a = avatarById(avatarId);
  return <span className="med" style={{ width: size, height: size, background: a?.color || 'linear-gradient(150deg,#7C5CFF,#432E8C)' }}>{initials(a?.name || '?')}</span>;
}

export default function Host() {
  const [phase, setPhase] = useState<'connecting' | 'lobby' | 'playing' | 'reveal' | 'final'>('connecting');
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
  const previewRef = useRef<any>({ url: '', clipMs: 30000, startAt: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clipTimer = useRef<any>(null);

  function applyState(state: any) {
    setPlayers(state.players || []);
    setSettings((s) => ({ ...s, difficulty: state.settings?.difficulty || s.difficulty, mode: state.settings?.mode || s.mode }));
    if (state.phase === 'playing' && state.round) {
      setRound(state.round); setBuzzWinner(state.buzz?.winnerName || null); setPhase('playing');
      playPreview(state.round.preview, state.round.startAt);
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
    socket.on('lobby', (d: any) => { setPlayers(d.players); setRound((r: any) => ({ ...r, total: d.totalRounds })); if (d.phase === 'lobby') setPhase('lobby'); });
    socket.on('round:host', (d: any) => { setReveal(null); setAnswered([]); setBuzzWinner(null); setRound(d); setPhase('playing'); playPreview(d.preview, d.startAt); });
    socket.on('player:answered', (d: any) => setAnswered((a) => (a.includes(d.name) ? a : [...a, d.name])));
    socket.on('buzz:winner', (d: any) => setBuzzWinner(d.name));
    socket.on('buzz:open', () => setBuzzWinner(null));
    socket.on('round:reveal', (d: any) => { setReveal(d); setPlayers(d.scores); setPhase('reveal'); }); // le son continue de tourner sur la révélation
    socket.on('game:final', (d: any) => { audioRef.current?.pause(); setFinalScores(d.scores); setPhase('final'); });
    socket.on('power:used', (d: any) => { setPowerLog(`🎭 ${d.name} a lancé ${d.power}`); setTimeout(() => setPowerLog(''), 4500); });
    socket.on('scores:update', (d: any) => setPlayers(d.scores));
    socket.on('room:closed', (d: any) => { setError(d.reason || 'Salon fermé.'); localStorage.removeItem(HKEY); });
    return () => ['connect', 'lobby', 'round:host', 'player:answered', 'buzz:winner', 'buzz:open', 'round:reveal', 'game:final', 'power:used', 'scores:update', 'room:closed'].forEach((e) => socket.off(e as any));
  }, []);

  useEffect(() => { if (phase !== 'playing') return; const id = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(id); }, [phase]);
  useEffect(() => {
    fetch('/api/net').then((r) => r.json()).then(({ ip }) => {
      const loc = window.location; const local = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
      setJoinBase(local && ip ? `${loc.protocol}//${ip}:${loc.port || '5173'}` : loc.origin.replace(/\/$/, ''));
    }).catch(() => {});
  }, []);

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

  const remaining = Math.max(0, round.endsAt - now);
  const seconds = Math.ceil(remaining / 1000);
  const frac = round.durationMs ? remaining / round.durationMs : 0;

  return (
    <div className="wrap">
      <div className="topbar">
        <h1 className="wm" style={{ fontSize: 24 }}>PUNCHLIN<span className="d">E</span></h1>
        {phase !== 'connecting' && <span className="gpill"><span className="dot" />{phase === 'lobby' ? `Salon ${code}` : `Manche ${round.index + 1}/${round.total} · ${round.difficulty}`} · {players.length} j.</span>}
      </div>
      {error && <p className="err" style={{ textAlign: 'center' }}>{error}</p>}
      {phase === 'connecting' && <div className="center"><p className="muted">Connexion…</p></div>}

      {phase === 'lobby' && (
        <div className="center">
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

          {!configuring ? (
            <>
              <button className="btn warm big" style={{ maxWidth: 360 }} onClick={() => setConfiguring(true)} disabled={players.length < 1 || poolSize < 1}>Configurer la partie →</button>
              <p className="muted" style={{ fontSize: 13 }}>{players.length} joueur{players.length > 1 ? 's' : ''} · {poolSize} morceaux prêts</p>
            </>
          ) : (
            <>
              <span className="eyebrow">Configuration de la partie</span>
              <div className="glass pad" style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>Orchestration</div>
                  <div className="seg">
                    <button className={`segbtn ${!settings.mj ? 'on' : ''}`} onClick={() => setSettings((s) => ({ ...s, mj: false }))}><b>Automatique</b><small>L'app arbitre toute seule</small></button>
                    <button className={`segbtn ${settings.mj ? 'on' : ''}`} onClick={() => setSettings((s) => ({ ...s, mj: true }))}><b>Maître du jeu</b><small>Un animateur (pupitre bientôt)</small></button>
                  </div>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>Jauge de pouvoir <span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>· comment elle se remplit</span></div>
                  <div className="seg">{REBALANCE.map((r) => (
                    <button key={r.key} className={`segbtn ${settings.rebalance === r.key ? 'on' : ''}`} onClick={() => setSettings((s) => ({ ...s, rebalance: r.key }))}><b>{r.label}</b><small>{r.desc}</small></button>
                  ))}</div>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>Difficulté <span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>· selon la popularité des sons</span></div>
                  <div className="seg">{DIFFICULTIES.map((d) => (
                    <button key={d.key} className={`segbtn ${settings.difficulty === d.key ? 'on' : ''}`} onClick={() => setSettings((s) => ({ ...s, difficulty: d.key }))}><b>{d.label}</b><small>{d.desc}</small></button>
                  ))}</div>
                </div>
                <div className="seg-row">
                  <div style={{ flex: 1 }}><div className="eyebrow" style={{ marginBottom: 8 }}>Mode</div><div className="seg">{MODES.map((m) => (
                    <button key={m.key} className={`segbtn ${settings.mode === m.key ? 'on' : ''}`} onClick={() => setSettings((s) => ({ ...s, mode: m.key }))}><b>{m.label}</b><small>{m.desc}</small></button>
                  ))}</div></div>
                  <div><div className="eyebrow" style={{ marginBottom: 8 }}>Manches</div><div className="seg">{[5, 8, 12].map((n) => (
                    <button key={n} className={`segbtn ${settings.rounds === n ? 'on' : ''}`} onClick={() => setSettings((s) => ({ ...s, rounds: n }))} disabled={n > poolSize}><b>{n}</b></button>
                  ))}</div></div>
                </div>
              </div>
              <div className="row" style={{ gap: 12 }}>
                <button className="btn" onClick={() => setConfiguring(false)}>← Retour</button>
                <button className="btn warm big" style={{ maxWidth: 300 }} onClick={start} disabled={players.length < 1 || poolSize < 1}>Démarrer la partie</button>
              </div>
            </>
          )}
        </div>
      )}

      {phase === 'playing' && (
        <div className="center">
          {audioBlocked && <button className="btn warm big" style={{ maxWidth: 320 }} onClick={() => playPreview(previewRef.current.url, previewRef.current.startAt)}>🔊 Activer le son</button>}
          <div className="wrap-cols" style={{ width: '100%', maxWidth: 780 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div className="disc"><span className="q">?</span></div>
              <span className="eyebrow">{round.mode === 'buzzer' ? 'Mode buzzer' : 'Extrait en cours'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div className="ring">
                <svg viewBox="0 0 120 120">
                  <defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7C5CFF" /><stop offset="1" stopColor="#E9703C" /></linearGradient></defs>
                  <circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,.12)" strokeWidth="10" fill="none" />
                  <circle cx="60" cy="60" r="54" stroke="url(#tg)" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
                </svg>
                <span className="n">{seconds}</span>
              </div>
              <span className="url">secondes</span>
            </div>
          </div>
          {round.mode === 'buzzer' ? (
            <p className="feedback" style={{ color: buzzWinner ? 'var(--ember)' : 'var(--muted)' }}>{buzzWinner ? `🔔 ${buzzWinner} a buzzé — à lui de répondre !` : 'Le premier qui buzze prend la main…'}</p>
          ) : (
            answered.length > 0 && <div className="answered">{answered.map((n) => <span className="abadge" key={n}>{n} ✓</span>)}</div>
          )}
          {powerLog && <p className="feedback" style={{ color: 'var(--v1)' }}>{powerLog}</p>}
        </div>
      )}

      {phase === 'reveal' && reveal && (
        <div className="center">
          <span className="eyebrow">C'était…</span>
          <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            {reveal.track.cover && <img className="cover" src={reveal.track.cover} alt="" />}
            <div style={{ textAlign: 'left' }}>
              <h2 className="title-xl">{reveal.track.title}</h2>
              <p className="reveal-artist title-xl" style={{ fontSize: 'clamp(20px,3vw,30px)', margin: 0 }}>{reveal.track.artist}</p>
            </div>
          </div>
          <div className="board" style={{ maxWidth: 560 }}>
            {reveal.scores.filter((p: any) => !p.isMJ).map((p: any, i: number) => {
              const r = reveal.results.find((x: any) => x.id === p.id);
              return (
                <div className={`prow ${i === 0 ? 'lead' : ''}`} key={p.id}>
                  <span className="who"><Med avatarId={p.avatar} size={26} />{p.name}</span>
                  <span className="row" style={{ gap: 14 }}><span className={`gain ${r && r.points ? '' : 'zero'}`}>{r && r.points ? `+${r.points}` : '—'}</span><span className="pts">{p.score}</span></span>
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
          <div className="big-num">🏆</div>
          <h2 className="title-xl">{finalScores.filter((p: any) => !p.isMJ)[0]?.name} gagne</h2>
          <div className="board" style={{ maxWidth: 560 }}>
            {finalScores.filter((p: any) => !p.isMJ).map((p, i) => (
              <div className={`prow ${i === 0 ? 'lead' : ''}`} key={p.id}>
                <span className="who"><Med avatarId={p.avatar} size={26} />{p.name}</span>
                <span className="pts">{p.score}</span>
              </div>
            ))}
          </div>
          <button className="btn" onClick={() => socket.emit('host:restart')}>Rejouer</button>
        </div>
      )}

      <audio ref={audioRef} preload="auto" />
    </div>
  );
}
