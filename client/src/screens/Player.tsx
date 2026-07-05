import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import { AVATARS, avatarById, initials } from '../data';

const SKEY = 'pl_session';
const loadSession = () => { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch { return null; } };
const saveSession = (s: any) => localStorage.setItem(SKEY, JSON.stringify(s));
const EPITHETS: Record<string, string> = { jul: 'La Machine', pnl: 'Les Frères', booba: 'Le Duc', damso: 'Le Vice', sch: 'Le S', ninho: 'Le Boss', nekfeu: 'Le Feu', orelsan: 'Le Normal', iam: 'Les Sages', solaar: 'Le Prince', gazo: 'La Drill', vald: "L'Alien" };
const hideOnErr = (e: any) => { e.currentTarget.style.display = 'none'; };

export default function Player() {
  const [step, setStep] = useState<'form' | 'char'>('form'); // avant d'avoir rejoint
  const [joined, setJoined] = useState(false);
  const [code, setCode] = useState((new URLSearchParams(location.search).get('c') || '').toUpperCase());
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState<string>('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const [phase, setPhase] = useState<'lobby' | 'countdown' | 'playing' | 'reveal' | 'final'>('lobby');
  const [countdown, setCountdown] = useState(0);
  const [round, setRound] = useState<any>({ index: 0, total: 0, endsAt: 0, durationMs: 25000, mode: 'multi', difficulty: '' });
  const [guess, setGuess] = useState('');
  const [feedback, setFeedback] = useState<any>(null);
  const [reveal, setReveal] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());
  const [buzz, setBuzz] = useState<'idle' | 'mine' | 'locked'>('idle');
  const [buzzMsg, setBuzzMsg] = useState('');
  const [powerMsg, setPowerMsg] = useState('');
  const [hint, setHint] = useState<any>(null);
  const [charge, setCharge] = useState(0);
  const [charges, setCharges] = useState(1);
  const [mjUsed, setMjUsed] = useState({ double: false, plus: false });
  const meId = useRef<string>('');

  function applyState(state: any) {
    setPlayers(state.players || []);
    if (state.phase === 'playing' && state.round) {
      setRound(state.round); setGuess(''); setFeedback(null); setReveal(null); setHint(null); setPhase('playing');
      if (state.round.mode === 'buzzer') applyBuzz(state.buzz);
    } else if (state.phase === 'reveal' && state.reveal) { setReveal(state.reveal); setPlayers(state.reveal.scores); setPhase('reveal'); }
    else if (state.phase === 'final' && state.final) { setPlayers(state.final.scores); setPhase('final'); }
    else setPhase('lobby');
  }
  function applyBuzz(b: any) {
    if (!b) return setBuzz('idle');
    if (b.winnerId === meId.current) setBuzz('mine');
    else if (b.winnerId) { setBuzz('locked'); setBuzzMsg(`${b.winnerName} a buzzé`); }
    else if ((b.lockedOut || []).includes(meId.current)) { setBuzz('locked'); setBuzzMsg('Raté — attends la prochaine'); }
    else setBuzz('idle');
  }

  useEffect(() => {
    const s = loadSession();
    if (s?.code && s?.playerId) {
      socket.emit('player:join', { code: s.code, name: s.name, avatar: s.avatar, playerId: s.playerId }, (res: any) => {
        if (res?.ok) { meId.current = res.playerId; setCode(s.code); setName(s.name); setAvatarId(s.avatar); setJoined(true); applyState(res.state); }
        else localStorage.removeItem(SKEY);
      });
    }
  }, []);

  useEffect(() => {
    socket.on('lobby', (d: any) => { setPlayers(d.players); if (d.phase === 'lobby') setPhase('lobby'); });
    socket.on('round:countdown', (d: any) => { setReveal(null); setFeedback(null); setHint(null); setGuess(''); setCountdown(d.seconds || 5); setPhase('countdown'); });
    socket.on('round:go', (d: any) => { setRound(d); setGuess(''); setFeedback(null); setReveal(null); setHint(null); setMjUsed({ double: false, plus: false }); setPhase('playing'); if (d.mode === 'buzzer') { setBuzz('idle'); setBuzzMsg(''); } });
    socket.on('round:reveal', (d: any) => { setReveal(d); setPlayers(d.scores); setPhase('reveal'); });
    socket.on('game:final', (d: any) => { setPlayers(d.scores); setPhase('final'); });
    socket.on('scores:update', (d: any) => setPlayers(d.scores));
    socket.on('buzz:winner', (d: any) => { if (d.id === meId.current) setBuzz('mine'); else { setBuzz('locked'); setBuzzMsg(`${d.name} a buzzé`); } });
    socket.on('buzz:open', (d: any) => { if ((d.lockedOut || []).includes(meId.current)) { setBuzz('locked'); setBuzzMsg('Raté — attends la prochaine'); } else setBuzz('idle'); });
    socket.on('room:closed', (d: any) => { setError(d.reason || 'Salon fermé.'); setJoined(false); localStorage.removeItem(SKEY); });
    return () => ['lobby', 'round:countdown', 'round:go', 'round:reveal', 'game:final', 'scores:update', 'buzz:winner', 'buzz:open', 'room:closed'].forEach((e) => socket.off(e as any));
  }, []);

  useEffect(() => { if (phase !== 'playing') return; const id = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(id); }, [phase]);
  useEffect(() => { if (phase !== 'countdown') return; const id = setInterval(() => setCountdown((c) => Math.max(1, c - 1)), 1000); return () => clearInterval(id); }, [phase]);
  // jauge de pouvoir : synchro depuis le serveur
  useEffect(() => { const m = players.find((p) => p.id === meId.current); if (m) { if (typeof m.charge === 'number') setCharge(m.charge); if (typeof m.charges === 'number') setCharges(m.charges); } }, [players]);
  // pré-sélectionne le 1er perso en arrivant sur le character select
  useEffect(() => { if (step === 'char' && !avatarId) setAvatarId(AVATARS[0].id); }, [step, avatarId]);

  function join() {
    setJoining(true); setError('');
    const s = loadSession();
    socket.emit('player:join', { code: code.trim(), name: name.trim(), avatar: avatarId, playerId: s?.playerId }, (res: any) => {
      setJoining(false);
      if (res?.error) return setError(res.error);
      meId.current = res.playerId;
      saveSession({ code: code.trim().toUpperCase(), name: name.trim(), avatar: avatarId, playerId: res.playerId });
      setJoined(true); applyState(res.state);
    });
  }
  function submitAnswer(e?: any) { e?.preventDefault(); if (!guess.trim() || phase !== 'playing') return; socket.emit('player:answer', { text: guess.trim() }, (res: any) => { if (res?.ok) setFeedback({ points: res.points, titleHit: res.titleHit, artistHit: res.artistHit }); }); }
  function doBuzz() { socket.emit('player:buzz', {}, (res: any) => { if (res?.winner) setBuzz('mine'); }); }
  function submitBuzzerAnswer(e?: any) { e?.preventDefault(); if (!guess.trim()) return; socket.emit('buzzer:answer', { text: guess.trim() }, (res: any) => { if (res?.correct) setFeedback({ points: res.points, titleHit: true, artistHit: true }); else if (res?.ok) { setFeedback({ points: 0 }); setGuess(''); } }); }
  function usePower() {
    socket.emit('player:power', {}, (res: any) => {
      if (res?.error) return setPowerMsg(res.error);
      if (typeof res?.charges === 'number') setCharges(res.charges);
      if (typeof res?.charge === 'number') setCharge(res.charge);
      if (res?.type === 'hint' && res.detail?.hint) { setHint(res.detail.hint); setPowerMsg('Indices révélés'); }
      else if (res?.type === 'steal') setPowerMsg(res.detail ? `Volé ${res.detail.amount} pts à ${res.detail.stoleFrom}` : 'Personne à voler…');
      else if (res?.type === 'double') setPowerMsg('×2 armé — trouve maintenant !');
      else if (res?.type === 'bonus') setPowerMsg('+100 armé — trouve maintenant !');
      else setPowerMsg('Pouvoir lancé');
    });
  }

  function mjPower(type: 'double' | 'plus') { socket.emit('mj:power', { type }, (r: any) => { if (r?.ok) setMjUsed((s) => ({ ...s, [type]: true })); }); }
  function mjAward(pid: string) { socket.emit('mj:award', { playerId: pid }); }
  function mjNext() { socket.emit('mj:next'); }

  const remaining = Math.max(0, round.endsAt - now);
  const frac = round.durationMs ? remaining / round.durationMs : 0;
  const me = players.find((p) => p.id === meId.current);
  const myRank = players.findIndex((p) => p.id === meId.current) + 1;
  const myResult = reveal?.results?.find((r: any) => r.id === meId.current);
  const av = avatarById(avatarId);

  /* ---- 1) formulaire : code + pseudo ---- */
  if (!joined && step === 'form') {
    return (
      <div className="wrap"><div className="center">
        <h1 className="wm" style={{ fontSize: 44 }}>PUNCHLIN<span className="d">E</span></h1>
        <p className="muted" style={{ marginTop: -8 }}>Le blind test rap FR</p>
        {error && <p className="err">{error}</p>}
        <form className="glass pad" style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={(e) => { e.preventDefault(); if (code.trim() && name.trim()) setStep('char'); }}>
          <div><label className="eyebrow">Code du salon</label>
            <input className="field" style={{ textAlign: 'center', letterSpacing: '.3em', textTransform: 'uppercase', fontFamily: 'var(--disp)', fontSize: 24, marginTop: 6 }} value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="K7XQ" autoCapitalize="characters" /></div>
          <div><label className="eyebrow">Ton blaze</label>
            <input className="field" style={{ marginTop: 6 }} value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="Sacha" /></div>
          <button className="btn warm big" type="submit" disabled={!code.trim() || !name.trim()}>Choisir mon rappeur →</button>
        </form>
      </div></div>
    );
  }

  /* ---- 2) sélection du perso (avec pouvoir) ---- */
  if (!joined && step === 'char') {
    const sel = av || AVATARS[0];
    return (
      <div className="cs">
        <svg width="0" height="0" style={{ position: 'absolute' }}><defs>
          <g id="bust"><path d="M22,240 C22,168 58,146 100,146 C142,146 178,168 178,240 Z" fill="#0d0917" /><ellipse cx="100" cy="96" rx="40" ry="44" fill="#0d0917" /><path d="M60,70 Q100,22 140,70 Q140,44 100,42 Q60,44 60,70 Z" fill="#0d0917" /><path d="M138,80 C150,120 150,180 150,240 L178,240 C178,168 160,146 138,80 Z" fill="rgba(255,255,255,.10)" /></g>
        </defs></svg>

        <div className="cs-hud"><span className="back" onClick={() => setStep('form')}>← retour</span><span className="lbl">Choisis ton combattant</span><span /></div>
        {error && <p className="err" style={{ textAlign: 'center', margin: '0 14px' }}>{error}</p>}

        <div className="cs-top">
          <div className="cs-stage" style={{ ['--c' as any]: sel.color }}>
            <div className="cs-pbg" />
            <div className="cs-wm">{initials(sel.name)[0]}</div>
            <svg className="cs-bust" viewBox="0 0 200 240"><use href="#bust" /></svg>
            <img className="cs-pimg" src={`/avatars/${sel.id}.png`} alt="" onError={hideOnErr} />
            <div className="cs-pvig" />
            <span className="cs-slot">Portrait — image à venir</span>
            <div className="cs-ribbon"><span className="p1">1P</span><span className="nm">{sel.name.toUpperCase()}</span><span className="ep">« {EPITHETS[sel.id] || sel.power.name} »</span></div>
            <div className="cs-catchip"><span>{sel.cat}</span></div>
          </div>
          <div className="cs-infobar">
            <div className="cs-pow"><div className="k">Pouvoir signature</div><div className="nm">{sel.power.name}</div><div className="fx">{sel.power.effect}</div></div>
            <div className="cs-stats">
              {([['Flow', sel.stats.flow], ['Punch', sel.stats.punch], ['Tech', sel.stats.tech]] as [string, number][]).map(([lab, v]) => (
                <div className="cs-srow" key={lab}><span className="cs-slab">{lab}</span><span className="cs-sbar">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= v ? 'on' : ''} />)}</span></div>
              ))}
            </div>
            <div className="cs-mug" style={{ ['--c' as any]: sel.color }}><svg viewBox="0 0 200 240"><use href="#bust" /></svg><img src={`/avatars/${sel.id}-face.png`} alt="" onError={hideOnErr} /></div>
          </div>
        </div>

        <div className="cs-rosterwrap"><div className="cs-roster">
          {AVATARS.map((a) => (
            <button type="button" key={a.id} className={`cs-cell ${avatarId === a.id ? 'sel' : ''}`} onClick={() => setAvatarId(a.id)}>
              <div className="cs-thumb" style={{ ['--c' as any]: a.color }}>
                <svg viewBox="0 0 200 240"><use href="#bust" /></svg>
                <img src={`/avatars/${a.id}-face.png`} alt="" onError={hideOnErr} />
                <div className="tg" />
                {avatarId === a.id && <span style={{ position: 'absolute', top: 2, right: 4, fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 9, color: 'var(--ember)', zIndex: 4 }}>1P</span>}
              </div>
              <span className="cs-cn">{a.name}</span>
            </button>
          ))}
        </div></div>

        <div className="cs-bottombar">
          <button className="btn warm big" onClick={join} disabled={!avatarId || joining}>{joining ? 'Connexion…' : `Entrer avec ${sel.name}`}</button>
        </div>
      </div>
    );
  }

  /* ---- pupitre du Maître du jeu ---- */
  if (me?.isMJ) {
    const others = players.filter((p) => !p.isMJ);
    return (
      <div className="wrap">
        <div className="topbar">
          <span className="row" style={{ gap: 9 }}><span className="pname" style={{ fontFamily: 'var(--disp)', fontSize: 17 }}>Maître du jeu</span></span>
          {phase !== 'lobby' && <span className="gpill">Manche {round.index + 1}/{round.total}</span>}
        </div>
        {error && <p className="err" style={{ textAlign: 'center' }}>{error}</p>}
        {phase === 'lobby' && (
          <div className="center"><span className="dot" style={{ width: 12, height: 12 }} /><h2 className="title-xl">Tu animes la partie</h2><p className="muted">Lance-la depuis la télé. Ici tu auras tes commandes.</p></div>
        )}
        {(phase === 'playing' || phase === 'reveal') && (
          <div className="center" style={{ gap: 16, justifyContent: 'flex-start', paddingTop: 10 }}>
            {phase === 'playing' ? <span className="eyebrow">Le son tourne · {round.difficulty}</span> : (
              <><span className="eyebrow">Révélation</span><h2 className="title-xl" style={{ fontSize: 'clamp(20px,5vw,30px)', margin: 0 }}>{reveal?.track.title}</h2><p className="reveal-artist" style={{ fontFamily: 'var(--disp)', fontSize: 19, margin: 0 }}>{reveal?.track.artist}</p></>
            )}
            <div style={{ width: '100%', maxWidth: 460 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Tes pouvoirs de MJ</div>
              <div className="row" style={{ gap: 10 }}>
                <button className="btn warm" style={{ flex: 1 }} onClick={() => mjPower('double')} disabled={mjUsed.double}>×2 la manche</button>
                <button className="btn warm" style={{ flex: 1 }} onClick={() => mjPower('plus')} disabled={mjUsed.plus}>+100 au prochain</button>
              </div>
            </div>
            <div style={{ width: '100%', maxWidth: 460 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Valider à la voix → +100</div>
              <div className="board">
                {others.length === 0 ? <p className="muted" style={{ margin: 0 }}>En attente des joueurs…</p> : others.map((p) => {
                  const pav = avatarById(p.avatar);
                  return (
                    <div className="prow" key={p.id}>
                      <span className="who"><span className="med" style={{ width: 26, height: 26, background: pav?.color || '#5639bf' }}>{initials(pav?.name || p.name)}</span>{p.name}<span className="muted" style={{ fontSize: 12 }}>· {p.score}</span></span>
                      <button className="btn" style={{ padding: '8px 14px' }} onClick={() => mjAward(p.id)}>+100</button>
                    </div>
                  );
                })}
              </div>
            </div>
            {phase === 'reveal' && <button className="btn warm big" style={{ maxWidth: 360 }} onClick={mjNext}>{round.index + 1 >= round.total ? 'Terminer' : 'Manche suivante →'}</button>}
          </div>
        )}
        {phase === 'final' && (
          <div className="center"><span className="eyebrow">Terminé</span><div style={{ color: 'var(--fluo)' }}><svg width="96" height="96" viewBox="0 0 24 24" fill="none"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" stroke="currentColor" strokeWidth="1.3" /><path d="M7 5H4v1.6A3.4 3.4 0 0 0 7.3 10M17 5h3v1.6A3.4 3.4 0 0 1 16.7 10" stroke="currentColor" strokeWidth="1.3" /><path d="M9.5 13v3.3h5V13M8 20.5h8M10.4 16.8h3.2v3.7h-3.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg></div><h2 className="title-xl">{others.sort((a, b) => b.score - a.score)[0]?.name} gagne</h2></div>
        )}
      </div>
    );
  }

  /* ---- en jeu ---- */
  return (
    <div className="wrap">
      <div className="topbar">
        <span className="row" style={{ gap: 9 }}>{av && <span className="med" style={{ width: 34, height: 34, background: av.color }}>{initials(av.name)}</span>}<span className="pname" style={{ fontFamily: 'var(--disp)', fontSize: 17 }}>{name}</span></span>
        {me && <span className="gpill" style={{ color: 'var(--ember)' }}>{me.score} pts</span>}
      </div>
      {error && <p className="err" style={{ textAlign: 'center' }}>{error}</p>}

      {phase === 'lobby' && (
        <div className="center"><span className="dot" style={{ width: 12, height: 12 }} /><h2 className="title-xl">Tu es dans la place</h2>
          <p className="muted">Ton perso : <b style={{ color: 'var(--txt)' }}>{av?.name}</b> · pouvoir <b style={{ color: 'var(--ember)' }}>{av?.power.name}</b></p>
          <p className="muted">En attente… l'hôte va lancer la partie.</p></div>
      )}

      {phase === 'countdown' && (
        <div className="center">
          <span className="eyebrow">Prépare-toi…</span>
          <div className="big-num" style={{ color: 'var(--fluo)' }}>{countdown}</div>
        </div>
      )}

      {phase === 'playing' && (
        <div className="center" style={{ gap: 14, justifyContent: 'flex-start', paddingTop: 'clamp(14px,5vh,40px)' }}>
          <span className="eyebrow">Manche {round.index + 1} / {round.total} · {round.difficulty}{round.mode === 'buzzer' ? ' · Buzzer' : ''}</span>
          {round.mode === 'buzzer' ? (
            buzz === 'mine' ? (<><h2 className="title-xl">À toi ! Réponds vite</h2><form onSubmit={submitBuzzerAnswer} style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}><input className="field" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Titre et/ou artiste…" autoFocus /><button className="btn warm big send" type="submit">Valider</button></form></>)
              : buzz === 'locked' ? (<><svg width="46" height="46" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--muted)' }}><rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.7" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" /></svg><p className="muted">{buzzMsg}</p></>)
                : (<><h2 className="title-xl">Reconnais le son</h2><button className="buzzer" onClick={doBuzz}>BUZZ</button></>)
          ) : (
            <><h2 className="title-xl">À toi de jouer</h2><form onSubmit={submitAnswer} style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}><input className="field" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Titre et/ou artiste…" autoFocus /><div className="bar"><i style={{ width: `${frac * 100}%` }} /></div><button className="btn warm big send" type="submit">Valider</button></form></>
          )}
          {hint && <p className="feedback" style={{ color: 'var(--v1)' }}>Indice — Titre : <b>{hint.title}</b> · Artiste : <b>{hint.artist}</b></p>}
          {feedback && <p className={`feedback ${feedback.points ? 'good' : 'bad'}`}>{feedback.points ? `Bien vu ! +${feedback.points}` : 'Pas ça…'}</p>}
          {av && (
            <div className="powerbar">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="eyebrow" style={{ fontSize: 10 }}>{av.power.name}{charges > 0 ? ` · ×${charges}` : ''}</div>
                <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.3, margin: '2px 0 5px' }}>{av.power.effect}</div>
                <div className="gauge"><i style={{ width: `${Math.min(100, charge)}%` }} /></div>
              </div>
              <button className="btn warm" onClick={usePower} disabled={charges < 1}>{charges >= 1 ? `Lancer (${charges})` : `${Math.round(charge)}%`}</button>
            </div>
          )}
          {powerMsg && <p className="feedback" style={{ color: 'var(--ember)' }}>{powerMsg}</p>}
        </div>
      )}

      {phase === 'reveal' && reveal && (
        <div className="center" style={{ gap: 14 }}><span className="eyebrow">Réponse</span>
          {reveal.track.cover && <img className="cover" src={reveal.track.cover} alt="" style={{ width: 120, height: 120 }} />}
          <h2 className="title-xl">{reveal.track.title}</h2><p className="reveal-artist" style={{ fontFamily: 'var(--disp)', fontSize: 22, margin: 0 }}>{reveal.track.artist}</p>
          <div className="gpill" style={{ fontSize: 16, padding: '12px 20px' }}>{myResult?.points ? `+${myResult.points} points` : 'Zéro cette fois'}</div>
          <p className="muted">Ton total : <b style={{ color: 'var(--txt)' }}>{me?.score ?? 0}</b> · {myRank}<sup>{myRank === 1 ? 'er' : 'e'}</sup></p></div>
      )}

      {phase === 'final' && (
        <div className="center" style={{ gap: 14 }}><span className="eyebrow">Terminé</span><div className="big-num" style={myRank === 1 ? { color: 'var(--fluo)' } : undefined}>{myRank === 1 ? <svg width="96" height="96" viewBox="0 0 24 24" fill="none"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" stroke="currentColor" strokeWidth="1.3" /><path d="M7 5H4v1.6A3.4 3.4 0 0 0 7.3 10M17 5h3v1.6A3.4 3.4 0 0 1 16.7 10" stroke="currentColor" strokeWidth="1.3" /><path d="M9.5 13v3.3h5V13M8 20.5h8M10.4 16.8h3.2v3.7h-3.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg> : myRank}</div><h2 className="title-xl">{myRank === 1 ? 'Tu as gagné !' : `${myRank}ᵉ place`}</h2><p className="muted">{me?.score ?? 0} points</p></div>
      )}
    </div>
  );
}
