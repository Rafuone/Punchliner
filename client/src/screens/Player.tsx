import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import { AVATARS, avatarById, initials, CATEGORY_ORDER, fmtAud, certif } from '../data';

const SKEY = 'pl_session';
const loadSession = () => { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch { return null; } };
const saveSession = (s: any) => localStorage.setItem(SKEY, JSON.stringify(s));
const EPITHETS: Record<string, string> = { jul: 'La Machine', pnl: 'Les Frères', booba: 'Le Duc', damso: 'Le Vice', sch: 'Le S', ninho: 'Le Boss', nekfeu: 'Le Feu', orelsan: 'Le Normal', iam: 'Les Sages', solaar: 'Le Prince', gazo: 'La Drill', vald: "L'Alien", oxmo: 'Le Poète', fabe: 'Le Sage', kery: 'Le Combattant', medine: "L'Insoumis", youssoupha: 'La Plume', gims: 'Meugui', lafouine: 'Laouni', kaaris: 'Riska', rohff: 'Le Padre', alphawann: 'Le Technicien', laylow: 'Le Visionnaire', jewelusain: 'Le Rapide', plk: 'Le Polak' };
const hideOnErr = (e: any) => { e.currentTarget.style.display = 'none'; };

export default function Player() {
  const [step, setStep] = useState<'form' | 'char'>('form'); // avant d'avoir rejoint
  const [joined, setJoined] = useState(false);
  const [code, setCode] = useState((new URLSearchParams(location.search).get('c') || '').toUpperCase());
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState<string>('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const [phase, setPhase] = useState<'lobby' | 'prep' | 'countdown' | 'playing' | 'reveal' | 'final'>('lobby');
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
  const [mjTrack, setMjTrack] = useState<any>(null); // réponse visible par le MJ pendant la manche
  const [quizPick, setQuizPick] = useState<number | null>(null); // choix QCM sélectionné (mode quiz)
  const [prepEndsAt, setPrepEndsAt] = useState(0);   // fin de la fenêtre d'activation des pouvoirs
  const [prepDone, setPrepDone] = useState(false);   // ce joueur a activé ou passé
  const meId = useRef<string>('');

  function applyState(state: any) {
    setPlayers(state.players || []);
    if (state.phase === 'playing' && state.round) {
      setRound(state.round); setGuess(''); setFeedback(null); setReveal(null); setHint(null); setPhase('playing');
      if (state.round.mode === 'buzzer') applyBuzz(state.buzz);
    } else if (state.phase === 'prep' && state.round) {
      setRound(state.round); setPrepEndsAt(state.round.endsAt || 0); setPrepDone(false); setNow(Date.now()); setPhase('prep');
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
    if (new URLSearchParams(location.search).has('dev')) return; // en mode test, on ne restaure pas la session
    const s = loadSession();
    if (s?.code && s?.playerId) {
      socket.emit('player:join', { code: s.code, name: s.name, avatar: s.avatar, playerId: s.playerId }, (res: any) => {
        if (res?.ok) { meId.current = res.playerId; setCode(s.code); setName(s.name); setAvatarId(s.avatar); setJoined(true); applyState(res.state); }
        else localStorage.removeItem(SKEY);
      });
    }
  }, []);

  // Accès test rapide : /?dev rejoint direct le salon ouvert le plus récent avec un perso aléatoire
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.has('dev')) return;
    fetch('/api/dev/room').then((r) => r.json()).then(({ code: c }) => {
      if (!c) return setError("Aucun salon ouvert — lance l'hôte d'abord.");
      const a = AVATARS[Math.floor(Math.random() * AVATARS.length)];
      const nm = params.get('name') || 'Test-' + Math.random().toString(36).slice(2, 5).toUpperCase();
      socket.emit('player:join', { code: c, name: nm, avatar: a.id }, (res: any) => {
        if (res?.error) return setError(res.error);
        meId.current = res.playerId; setCode(c); setName(nm); setAvatarId(a.id); setJoined(true); applyState(res.state);
      });
    }).catch(() => setError('Salon injoignable.'));
  }, []);

  useEffect(() => {
    socket.on('lobby', (d: any) => { setPlayers(d.players); if (d.phase === 'lobby') setPhase('lobby'); });
    socket.on('round:prep', (d: any) => { setRound((r: any) => ({ ...r, index: d.index, total: d.total, mode: d.mode, difficulty: d.difficulty })); setPrepEndsAt(d.endsAt || 0); setPrepDone(false); setReveal(null); setFeedback(null); setHint(null); setGuess(''); setMjTrack(null); setQuizPick(null); setPowerMsg(''); setNow(Date.now()); setPhase('prep'); });
    socket.on('round:countdown', (d: any) => { setReveal(null); setFeedback(null); setHint(null); setGuess(''); setMjTrack(null); setQuizPick(null); setCountdown(d.seconds || 5); setPhase('countdown'); });
    socket.on('round:go', (d: any) => { setRound(d); setGuess(''); setFeedback(null); setReveal(null); setMjTrack(null); setQuizPick(null); setPhase('playing'); if (d.mode === 'buzzer') { setBuzz('idle'); setBuzzMsg(''); } });
    socket.on('mj:track', (d: any) => setMjTrack(d));
    socket.on('round:reveal', (d: any) => { setReveal(d); setPlayers(d.scores); setPhase('reveal'); });
    socket.on('game:final', (d: any) => { setPlayers(d.scores); setPhase('final'); });
    socket.on('scores:update', (d: any) => setPlayers(d.scores));
    socket.on('buzz:winner', (d: any) => { if (d.id === meId.current) setBuzz('mine'); else { setBuzz('locked'); setBuzzMsg(`${d.name} a buzzé`); } });
    socket.on('buzz:open', (d: any) => { if ((d.lockedOut || []).includes(meId.current)) { setBuzz('locked'); setBuzzMsg('Raté — attends la prochaine'); } else setBuzz('idle'); });
    socket.on('room:closed', (d: any) => { setError(d.reason || 'Salon fermé.'); setJoined(false); localStorage.removeItem(SKEY); });
    return () => ['lobby', 'round:prep', 'round:countdown', 'round:go', 'mj:track', 'round:reveal', 'game:final', 'scores:update', 'buzz:winner', 'buzz:open', 'room:closed'].forEach((e) => socket.off(e as any));
  }, []);

  useEffect(() => { if (phase !== 'playing' && phase !== 'prep') return; const id = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(id); }, [phase]);
  useEffect(() => { if (phase !== 'countdown') return; const id = setInterval(() => setCountdown((c) => Math.max(1, c - 1)), 1000); return () => clearInterval(id); }, [phase]);
  // jauge de pouvoir : synchro depuis le serveur
  useEffect(() => { const m = players.find((p) => p.id === meId.current); if (m) { if (typeof m.charge === 'number') setCharge(m.charge); if (typeof m.charges === 'number') setCharges(m.charges); } }, [players]);
  // observe le salon pour voir en direct les persos déjà pris (grisés)
  useEffect(() => {
    if (step !== 'char' || !code.trim()) return;
    socket.emit('player:watch', { code: code.trim() }, (res: any) => { if (res?.players) setPlayers(res.players); });
  }, [step, code]);
  // pré-sélectionne un perso LIBRE (et se décale si le sien vient d'être pris)
  useEffect(() => {
    if (step !== 'char') return;
    const taken = new Set(players.filter((p) => p.connected && p.id !== meId.current).map((p) => p.avatar));
    if (!avatarId || taken.has(avatarId)) { const free = AVATARS.find((a) => !taken.has(a.id)); if (free) setAvatarId(free.id); }
  }, [step, avatarId, players]);

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
  function submitQuiz(i: number) {
    if (quizPick !== null || phase !== 'playing') return;
    setQuizPick(i);
    socket.emit('quiz:answer', { choice: i }, (res: any) => {
      if (res?.error) { setQuizPick(null); return; }
      setFeedback({ correct: res.correct, points: res.points, answer: res.answer });
    });
  }
  function submitBuzzerAnswer(e?: any) { e?.preventDefault(); if (!guess.trim()) return; socket.emit('buzzer:answer', { text: guess.trim() }, (res: any) => { if (res?.correct) setFeedback({ points: res.points, titleHit: true, artistHit: true }); else if (res?.ok) { setFeedback({ points: 0 }); setGuess(''); } }); }
  function usePower() {
    socket.emit('player:power', {}, (res: any) => {
      if (res?.error) return setPowerMsg(res.error);
      if (typeof res?.charges === 'number') setCharges(res.charges);
      if (typeof res?.charge === 'number') setCharge(res.charge);
      if (res?.type === 'hint' && res.detail?.hint) { setHint(res.detail.hint); setPowerMsg('Indices révélés — titre & artiste'); }
      else if (res?.type === 'steal') setPowerMsg(res.detail ? `Volé ${fmtAud(res.detail.amount)} auditeurs à ${res.detail.stoleFrom}` : 'Personne à voler…');
      else if (res?.type === 'comeback') setPowerMsg(res.detail ? `Remontada ! +${fmtAud(res.detail.gain)} auditeurs` : 'Remontée…');
      else if (res?.type === 'sabotage') setPowerMsg(res.detail ? `${res.detail.mutedName} muselé cette manche !` : 'Sabotage lancé');
      else if (res?.type === 'safety') setPowerMsg('Filet posé — plancher garanti cette manche');
      else if (res?.type === 'freeze') setPowerMsg('Hors du temps — score au max même à la dernière seconde');
      else if (res?.type === 'nofault') setPowerMsg('Zéro faute — écris peinard, l\'orthographe passe');
      else if (res?.type === 'jam') setPowerMsg(res.detail ? `Brouillage ! Les autres attendent ${Math.round((res.detail.ms || 4000) / 1000)} s` : 'Brouillage lancé');
      else if (res?.type === 'ace') setPowerMsg('Sans-faute + ×2 armé — trouve cette manche !');
      else if (res?.type === 'refuel') setPowerMsg('Surrégime — la charge revient si tu trouves');
      else if (res?.type === 'veteran') setPowerMsg('Increvable — 3 manches sans rien perdre');
      else if (res?.type === 'firstblood') setPowerMsg('Prime au 1er qui trouve — fonce !');
      else if (res?.type === 'momentum') setPowerMsg(`En feu ! +${fmtAud(res.detail?.amount || 0)} armé`);
      else if (res?.type === 'decay') setPowerMsg(`Armé : +${fmtAud(res.detail?.amount || 0)} auditeurs`);
      else setPowerMsg(`${res?.power || 'Pouvoir'} armé pour cette manche !`);
      setPrepDone(true);
    });
  }
  function passPower() { socket.emit('player:ready', {}); setPrepDone(true); }

  function mjAward(pid: string, points = 10000) { socket.emit('mj:award', { playerId: pid, points }); }
  function mjReveal() { socket.emit('mj:reveal'); }
  function mjNext() { socket.emit('mj:next'); }

  const remaining = Math.max(0, round.endsAt - now);
  const frac = round.durationMs ? remaining / round.durationMs : 0;
  const jamMs = round.jam && round.jam.by !== meId.current ? Math.max(0, (round.endsAt - round.durationMs + round.jam.ms) - now) : 0; // brouillé par un adversaire ?
  const me = players.find((p) => p.id === meId.current);
  const myRank = players.findIndex((p) => p.id === meId.current) + 1;
  const myResult = reveal?.results?.find((r: any) => r.id === meId.current);
  const av = avatarById(avatarId);
  const takenIds = new Set(players.filter((p) => p.connected && p.id !== meId.current).map((p) => p.avatar)); // persos déjà pris

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
    const nmU = sel.name.toUpperCase();
    // taille du nom adaptée à sa longueur → ne déborde jamais sur les stats
    const nameFs = nmU.length > 11 ? 'clamp(17px,5vw,24px)' : nmU.length > 8 ? 'clamp(20px,6vw,29px)' : 'clamp(24px,7.5vw,35px)';
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
            {sel.img && <img className="cs-pimg" src={`/avatars/${sel.id}.png`} alt="" onError={hideOnErr} />}
            <div className="cs-pvig" />
            {!sel.img && <span className="cs-slot">Portrait — image à venir</span>}
            <div className="cs-catchip"><span>{sel.cat}</span></div>
            <div className="cs-stats-ov">
              {([['Flow', sel.stats.flow], ['Punch', sel.stats.punch], ['Tech', sel.stats.tech], ['Aura', sel.stats.aura]] as [string, number][]).map(([lab, v]) => (
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
          {[...CATEGORY_ORDER, ...Array.from(new Set(AVATARS.map((a) => a.cat))).filter((c) => !CATEGORY_ORDER.includes(c))].map((cat) => {
            const members = AVATARS.filter((a) => a.cat === cat);
            if (!members.length) return null;
            return (
              <div className="cs-catgroup" key={cat}>
                <div className="cs-catlabel">{cat}</div>
                <div className="cs-catrow">
                  {members.map((a) => {
                    const lk = takenIds.has(a.id);
                    return (
                    <button type="button" key={a.id} className={`cs-cell ${avatarId === a.id ? 'sel' : ''} ${lk ? 'lock' : ''}`} disabled={lk} onClick={() => !lk && setAvatarId(a.id)}>
                      <div className="cs-thumb" style={{ ['--c' as any]: a.color, ...(a.crop?.z ? { ['--z' as any]: a.crop.z } : {}) }}>
                        <svg viewBox="0 0 200 240"><use href="#bust" /></svg>
                        {a.img && <img src={`/avatars/${a.id}.png`} alt="" onError={hideOnErr} />}
                        <div className="tg" />
                        {lk && <span className="cs-taken">PRIS</span>}
                      </div>
                      <span className="cs-cn">{a.name}</span>
                    </button>
                  ); })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="cs-bottombar">
          <button className="btn warm big" onClick={join} disabled={!avatarId || joining || takenIds.has(avatarId)}>{joining ? 'Connexion…' : takenIds.has(avatarId) ? 'Déjà pris — choisis un autre' : `Entrer avec ${sel.name}`}</button>
        </div>
      </div>
    );
  }

  /* ---- pupitre du Maître du jeu ---- */
  if (me?.isMJ) {
    const others = players.filter((p) => !p.isMJ).sort((a, b) => b.score - a.score);
    const answer = phase === 'reveal' ? reveal?.track : mjTrack;
    return (
      <div className="wrap">
        <div className="topbar">
          <span className="row" style={{ gap: 9 }}>
            <span className="med" style={{ width: 30, height: 30, background: 'var(--surf3)', color: 'var(--fluo)', fontSize: 12 }}>MJ</span>
            <span className="pname" style={{ fontFamily: 'var(--disp)', fontSize: 17 }}>Maître du jeu</span>
          </span>
          {phase !== 'lobby' && phase !== 'final' && <span className="gpill"><span className="dot" />Manche {round.index + 1}/{round.total}</span>}
        </div>
        {error && <p className="err" style={{ textAlign: 'center' }}>{error}</p>}

        {phase === 'lobby' && (
          <div className="center"><span className="dot" style={{ width: 12, height: 12 }} /><h2 className="title-xl">Tu animes la partie</h2><p className="muted">Lance-la depuis la télé. Ici, toi seul verras la réponse — et tu distribues les points à la voix.</p></div>
        )}
        {phase === 'countdown' && (
          <div className="center"><span className="eyebrow">Prépare-toi…</span><div className="big-num" style={{ color: 'var(--fluo)' }}>{countdown}</div><span className="url">la musique arrive</span></div>
        )}

        {(phase === 'playing' || phase === 'reveal') && (
          <div className="center" style={{ gap: 16, justifyContent: 'flex-start', paddingTop: 8 }}>
            {/* la réponse — visible uniquement par le MJ */}
            <div className="glass pad" style={{ width: '100%', maxWidth: 460, textAlign: 'left' }}>
              <div className="eyebrow" style={{ color: 'var(--green)' }}>{phase === 'playing' ? 'La réponse · toi seul la vois' : "C'était"}</div>
              {answer ? (
                <><h2 className="title-xl" style={{ fontSize: 'clamp(22px,6vw,32px)', margin: '6px 0 2px' }}>{answer.title}</h2>
                <p className="reveal-artist" style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 20, margin: 0 }}>{answer.artist}</p></>
              ) : <p className="muted" style={{ margin: '8px 0 0' }}>…</p>}
            </div>

            <div style={{ width: '100%', maxWidth: 460 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Qui a trouvé ? Donne les points</div>
              <div className="board">
                {others.length === 0 ? <p className="muted" style={{ margin: 0 }}>En attente des joueurs…</p> : others.map((p) => {
                  const pav = avatarById(p.avatar);
                  return (
                    <div className="prow" key={p.id}>
                      <span className="who"><span className="med" style={{ width: 26, height: 26, background: pav?.color || '#5639bf' }}>{initials(pav?.name || p.name)}</span>{p.name}<span className="muted" style={{ fontSize: 12 }}>· {fmtAud(p.score)}</span></span>
                      <span className="row" style={{ gap: 6 }}>
                        <button className="btn" style={{ padding: '8px 12px', fontSize: 13 }} onClick={() => mjAward(p.id, 5000)}>+5 000</button>
                        <button className="btn warm" style={{ padding: '8px 12px', fontSize: 13 }} onClick={() => mjAward(p.id, 10000)}>+10 000</button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {phase === 'playing'
              ? <button className="btn warm big" style={{ maxWidth: 360 }} onClick={mjReveal}>Couper le son &amp; révéler →</button>
              : <button className="btn warm big" style={{ maxWidth: 360 }} onClick={mjNext}>{round.index + 1 >= round.total ? 'Terminer' : 'Manche suivante →'}</button>}
          </div>
        )}
        {phase === 'final' && (
          <div className="center"><span className="eyebrow">Terminé</span><div style={{ color: 'var(--fluo)' }}><svg width="96" height="96" viewBox="0 0 24 24" fill="none"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" stroke="currentColor" strokeWidth="1.3" /><path d="M7 5H4v1.6A3.4 3.4 0 0 0 7.3 10M17 5h3v1.6A3.4 3.4 0 0 1 16.7 10" stroke="currentColor" strokeWidth="1.3" /><path d="M9.5 13v3.3h5V13M8 20.5h8M10.4 16.8h3.2v3.7h-3.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg></div><h2 className="title-xl">{others[0]?.name} gagne</h2><div className="gpill" style={{ marginTop: 6, color: 'var(--fluo)', borderColor: 'var(--fluo)' }}>{certif(others[0]?.score ?? 0, round.total).label}</div></div>
        )}
      </div>
    );
  }

  /* ---- en jeu ---- */
  return (
    <div className="wrap">
      <div className="topbar">
        <span className="row" style={{ gap: 9 }}>{av && <span className="med" style={{ width: 34, height: 34, background: av.color }}>{initials(av.name)}</span>}<span className="pname" style={{ fontFamily: 'var(--disp)', fontSize: 17 }}>{name}</span></span>
        {me && <span className="gpill" style={{ color: 'var(--ember)' }}>{fmtAud(me.score)} aud.</span>}
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

      {phase === 'prep' && (
        <div className="center" style={{ gap: 14 }}>
          <span className="eyebrow">Manche {round.index + 1} / {round.total} · {round.difficulty}</span>
          <h2 className="title-xl">Pouvoirs</h2>
          <span className="url">à activer avant la musique</span>
          <div className="big-num" style={{ color: 'var(--fluo)' }}>{Math.max(0, Math.ceil((prepEndsAt - now) / 1000))}</div>
          {!prepDone ? (av && (
            <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="powerbar">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="eyebrow" style={{ fontSize: 10 }}>{av.power.name}{charges > 0 ? ` · ×${charges}` : ''}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.3, margin: '2px 0 5px' }}>{av.power.effect}</div>
                  <div className="gauge"><i style={{ width: `${Math.min(100, charge)}%` }} /></div>
                </div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <button className="btn" style={{ flex: 1 }} onClick={passPower}>Passer</button>
                <button className="btn warm" style={{ flex: 1 }} onClick={usePower} disabled={charges < 1}>{charges >= 1 ? 'Activer' : `Charge ${Math.round(charge)}%`}</button>
              </div>
              {powerMsg && <p className="feedback bad">{powerMsg}</p>}
            </div>
          )) : (
            <><p className="feedback good">{powerMsg || 'Prêt !'}</p><p className="muted">En attente des autres…</p></>
          )}
        </div>
      )}

      {phase === 'playing' && (
        <div className="center" style={{ gap: 14, justifyContent: 'flex-start', paddingTop: 'clamp(14px,5vh,40px)' }}>
          <span className="eyebrow">Manche {round.index + 1} / {round.total} · {round.difficulty}{round.mode === 'quiz' ? ' · Quiz' : round.mj ? ' · Maître du jeu' : round.mode === 'buzzer' ? ' · Buzzer' : ''}</span>
          {round.mode === 'quiz' ? (
            <>
              <span className="gpill" style={{ color: 'var(--fluo)' }}>{round.quiz?.cat}</span>
              <h2 className="title-xl" style={{ maxWidth: 520 }}>{round.quiz?.q}</h2>
              <div className="qz-grid">
                {round.quiz?.choices.map((c: string, i: number) => {
                  const answered = quizPick !== null;
                  const cls = 'qz-opt' + (answered && feedback?.answer === i ? ' right' : answered && quizPick === i ? ' wrong' : '');
                  return <button key={i} className={cls} disabled={answered} onClick={() => submitQuiz(i)}>{c}</button>;
                })}
              </div>
            </>
          ) : round.mj ? (
            <><h2 className="title-xl">Crie ta réponse !</h2><p className="muted" style={{ maxWidth: 380 }}>Le Maître du jeu écoute et distribue les points. Sois le plus rapide à balancer le bon titre / artiste à voix haute.</p></>
          ) : round.mode === 'buzzer' ? (
            buzz === 'mine' ? (<><h2 className="title-xl">À toi ! Réponds vite</h2><form onSubmit={submitBuzzerAnswer} style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}><input className="field" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Titre et/ou artiste…" autoFocus /><button className="btn warm big send" type="submit">Valider</button></form></>)
              : buzz === 'locked' ? (<><svg width="46" height="46" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--muted)' }}><rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.7" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" /></svg><p className="muted">{buzzMsg}</p></>)
                : jamMs > 0 ? (<><h2 className="title-xl">Brouillé…</h2><div className="big-num" style={{ color: 'var(--fluo)' }}>{Math.ceil(jamMs / 1000)}</div><p className="muted">Quelqu'un t'a ralenti — tu pourras buzzer dans un instant.</p></>)
                : (<><h2 className="title-xl">Reconnais le son</h2><button className="buzzer" onClick={doBuzz}>BUZZ</button></>)
          ) : jamMs > 0 ? (
            <><h2 className="title-xl">Brouillé…</h2><div className="big-num" style={{ color: 'var(--fluo)' }}>{Math.ceil(jamMs / 1000)}</div><p className="muted">Quelqu'un t'a ralenti — tu peux répondre dans un instant.</p></>
          ) : (
            <><h2 className="title-xl">À toi de jouer</h2><form onSubmit={submitAnswer} style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}><input className="field" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Titre et/ou artiste…" autoFocus /><div className="bar"><i style={{ width: `${frac * 100}%` }} /></div><button className="btn warm big send" type="submit">Valider</button></form></>
          )}
          {hint && <p className="feedback" style={{ color: 'var(--v1)' }}>Indice — Titre : <b>{hint.title}</b> · Artiste : <b>{hint.artist}</b></p>}
          {feedback && <p className={`feedback ${feedback.points ? 'good' : 'bad'}`}>{feedback.points ? `Bien vu ! +${fmtAud(feedback.points)}` : 'Pas ça…'}</p>}
          {powerMsg && <p className="feedback" style={{ color: 'var(--ember)' }}>{powerMsg}</p>}
        </div>
      )}

      {phase === 'reveal' && reveal && (
        <div className="center" style={{ gap: 14 }}><span className="eyebrow">Réponse</span>
          {reveal.quiz ? (
            <>
              <span className="gpill" style={{ color: 'var(--fluo)' }}>{reveal.quiz.cat}</span>
              <h2 className="title-xl" style={{ maxWidth: 520 }}>{reveal.quiz.q}</h2>
              <div className="gpill" style={{ fontSize: 16, padding: '12px 20px', color: 'var(--green)', borderColor: 'rgba(166,255,0,.5)' }}>{reveal.quiz.choices[reveal.quiz.answer]}</div>
            </>
          ) : (
            <>
              {reveal.track.cover && <img className="cover" src={reveal.track.cover} alt="" style={{ width: 120, height: 120 }} />}
              <h2 className="title-xl">{reveal.track.title}</h2><p className="reveal-artist" style={{ fontFamily: 'var(--disp)', fontSize: 22, margin: 0 }}>{reveal.track.artist}</p>
            </>
          )}
          <div className="gpill" style={{ fontSize: 16, padding: '12px 20px' }}>{myResult?.points ? `+${fmtAud(myResult.points)} auditeurs` : 'Zéro cette fois'}</div>
          <p className="muted">Ton total : <b style={{ color: 'var(--txt)' }}>{fmtAud(me?.score ?? 0)}</b> auditeurs · {myRank}<sup>{myRank === 1 ? 'er' : 'e'}</sup></p></div>
      )}

      {phase === 'final' && (
        <div className="center" style={{ gap: 14 }}><span className="eyebrow">Terminé</span><div className="big-num" style={myRank === 1 ? { color: 'var(--fluo)' } : undefined}>{myRank === 1 ? <svg width="96" height="96" viewBox="0 0 24 24" fill="none"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" stroke="currentColor" strokeWidth="1.3" /><path d="M7 5H4v1.6A3.4 3.4 0 0 0 7.3 10M17 5h3v1.6A3.4 3.4 0 0 1 16.7 10" stroke="currentColor" strokeWidth="1.3" /><path d="M9.5 13v3.3h5V13M8 20.5h8M10.4 16.8h3.2v3.7h-3.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg> : myRank}</div><h2 className="title-xl">{myRank === 1 ? 'Tu as gagné !' : `${myRank}ᵉ place`}</h2><p className="muted">{fmtAud(me?.score ?? 0)} auditeurs</p><div className="gpill" style={{ marginTop: 6, color: 'var(--fluo)', borderColor: 'var(--fluo)', fontSize: 14, padding: '10px 16px' }}>{certif(me?.score ?? 0, round.total).label}</div></div>
      )}
    </div>
  );
}
