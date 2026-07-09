import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import { AVATARS, avatarById, initials, CATEGORY_ORDER, CATEGORY_COLORS, isLegend, fmtAud, certif, awardIcon, AWARDS_INFO, EPITHETS, REACTIONS, END_REACTIONS, TRASH_TALK } from '../data';
import GrungeBg from '../GrungeBg';
import { sfx } from '../sfx';

// Jauge de pouvoir LISIBLE : pastilles pleines/vides (charges dispo /5) + fine barre de progression
// vers la charge suivante. Une charge = un pouvoir.
function Charges({ n, max = 5, charge }: { n: number; max?: number; charge?: number }) {
  return (
    <span className="charges" role="img" aria-label={`${n} charge${n > 1 ? 's' : ''} de pouvoir sur ${max}`}>
      <svg className="charges-ic" width="12" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2L4 14h6l-1 8 9-12h-6z" /></svg>
      {Array.from({ length: max }).map((_, i) => {
        if (i < n) return <i key={i} className="on" />; // charge PLEINE (pouvoir dispo)
        if (i === n && n < max && typeof charge === 'number') return <i key={i} className="fill" style={{ ['--cf' as any]: `${Math.max(6, Math.round(charge))}%` }} />; // charge EN COURS : le losange se remplit visiblement (min 6% pour qu'on VOIE que ça monte)
        return <i key={i} />; // vide
      })}
      {typeof charge === 'number' && n < max && <b className="charges-pct">{Math.round(charge)}%</b>}
    </span>
  );
}

const SKEY = 'pl_session';
const loadSession = () => { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch { return null; } };
const saveSession = (s: any) => localStorage.setItem(SKEY, JSON.stringify(s));
const hideOnErr = (e: any) => { e.currentTarget.style.display = 'none'; };
// médaillon rond du rappeur (photo si dispo, sinon initiales sur sa couleur)
function RMed({ id, size = 34 }: { id?: string; size?: number }) {
  const a = avatarById(id);
  return <span className="med" style={{ width: size, height: size, fontSize: Math.round(size * 0.37), background: a?.color || '#5639bf' }}>
    {a?.img ? <img src={`/avatars/${a.id}.png`} alt="" onError={hideOnErr} /> : initials(a?.name || id || '?')}
  </span>;
}
// met en gras les chiffres-clés d'un effet (montants, ×N, N %) → on repère vite le point fort du pouvoir
const FX_FIG = /([×x]\s?\d+(?:[.,]\d+)?|[+\-−]?\d[\d   ]*\d\s?%?|\d+\s?%)/g;
const boldFx = (text: string) => text.split(FX_FIG).map((seg, i) => (i % 2 === 1 ? <b key={i}>{seg}</b> : seg));
// Quiz Vrai/Faux : classe couleur (vert = Vrai, rouge = Faux) — même convention que le showroom.
const vfClass = (c: string) => (c === 'Vrai' ? ' vrai' : c === 'Faux' ? ' faux' : '');

export default function Player() {
  const [step, setStep] = useState<'form' | 'char' | 'roster' | 'trophies'>('form'); // avant d'avoir rejoint (+ pages hub : roster / palmarès)
  const [unlockedTrophies, setUnlockedTrophies] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('pl_trophies') || '[]'); } catch { return []; } });
  const [revealTrophies, setRevealTrophies] = useState(true); // aperçu : tout afficher (sinon non-débloqués grisés)
  const [unlockedChars] = useState<string[]>([]); // challengers déblocables DÉSACTIVÉS pour l'instant (rien affiché comme débloqué)
  const [newChars, setNewChars] = useState<string[]>([]); // débloqués À L'INSTANT (bannière de fin de partie)
  const [changing, setChanging] = useState(false); // change de rappeur entre deux parties (rouvre le character select)
  const [joined, setJoined] = useState(false);
  const [code, setCode] = useState((new URLSearchParams(location.search).get('c') || '').toUpperCase());
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState<string>('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const [phase, setPhase] = useState<'lobby' | 'prep' | 'countdown' | 'playing' | 'reveal' | 'final' | 'rushend' | 'battle-intro' | 'battle-bet' | 'battle-play' | 'battle-reveal'>('lobby');
  const [countdown, setCountdown] = useState(0);
  const [round, setRound] = useState<any>({ index: 0, total: 0, endsAt: 0, durationMs: 25000, mode: 'multi', difficulty: '' });
  const [guess, setGuess] = useState('');
  const [feedback, setFeedback] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false); // a validé cette manche → verrouille (1 seule tentative, résultat à la révélation)
  const [reveal, setReveal] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [battle, setBattle] = useState<any>(null);        // manche CLASH (1v1 + paris) : {a,b,flavor,endsAt,reveal}
  const [betPick, setBetPick] = useState<'a' | 'b' | null>(null); // camp sur lequel ce spectateur a parié
  const [rushEnd, setRushEnd] = useState<any>(null); // fin de run Survivor (mon rang mondial + top 10)
  const rushTrackRef = useRef(0);                    // n° de morceau courant → reset de l'input à chaque enchaînement
  const [now, setNow] = useState(Date.now());
  const [buzz, setBuzz] = useState<'idle' | 'mine' | 'locked'>('idle');
  const [buzzMsg, setBuzzMsg] = useState('');
  const [buzzEndsAt, setBuzzEndsAt] = useState(0); // échéance de réponse quand c'est à moi (décompte)
  const [powerMsg, setPowerMsg] = useState('');
  const [hint, setHint] = useState<any>(null);
  const [charge, setCharge] = useState(0);
  const [charges, setCharges] = useState(1);
  const [mjTrack, setMjTrack] = useState<any>(null); // réponse visible par le MJ pendant la manche
  const [quizPick, setQuizPick] = useState<number | null>(null); // choix QCM sélectionné (mode quiz)
  const [prepEndsAt, setPrepEndsAt] = useState(0);   // fin de la fenêtre d'activation des pouvoirs
  const [prepDone, setPrepDone] = useState(false);   // ce joueur a activé ou passé
  const [waiting, setWaiting] = useState(false);     // arrivé en pleine partie → salle d'attente
  const [awards, setAwards] = useState<any[]>([]);   // trophées de fin de partie
  const [series, setSeries] = useState<any>(null);   // cumul de la série (multi-parties)
  const [finalRounds, setFinalRounds] = useState(0);
  const meId = useRef<string>('');
  const stageRef = useRef<HTMLDivElement>(null);

  function applyState(state: any) {
    setPlayers(state.players || []);
    if (state.phase === 'playing' && state.round) {
      setRound(state.round); setGuess(''); setFeedback(null); setReveal(null); setHint(null); setPhase('playing');
      if (state.round.mode === 'buzzer') applyBuzz(state.buzz);
      if (state.round.mode === 'rush') rushTrackRef.current = state.round.trackNo || 0;
    } else if (state.phase === 'rushend') {
      setRushEnd(state.rushEnd); setPhase('rushend');
    } else if (state.phase === 'prep' && state.round) {
      setRound(state.round); setPrepEndsAt(state.round.endsAt || 0); setPrepDone(false); setNow(Date.now()); setPhase('prep');
    } else if (state.phase === 'reveal' && state.reveal) { setReveal(state.reveal); setPlayers(state.reveal.scores); setPhase('reveal'); }
    else if (state.phase === 'final' && state.final) { setPlayers(state.final.scores); setAwards(state.final.awards || []); setSeries(state.final.series || null); setFinalRounds(state.final.rounds || 0); setPhase('final'); }
    // reconnexion en pleine manche CLASH : a/b ne viennent que d'ici (battle:bets/go ne portent que les IDs) → sans ça, crash au rendu
    else if (typeof state.phase === 'string' && state.phase.startsWith('battle') && state.battle) { setBattle(state.battle); setNow(Date.now()); setPhase(state.phase); }
    else setPhase('lobby');
  }
  function applyBuzz(b: any) {
    if (!b) return setBuzz('idle');
    if (b.winnerId === meId.current) { setBuzz('mine'); setBuzzEndsAt(b.endsAt || 0); setNow(Date.now()); }
    else if (b.winnerId) { setBuzz('locked'); setBuzzMsg(`${b.winnerName} a buzzé`); }
    else if ((b.lockedOut || []).includes(meId.current)) { setBuzz('locked'); setBuzzMsg('Raté — au tour des autres'); }
    else setBuzz('idle');
  }

  useEffect(() => {
    if (new URLSearchParams(location.search).has('dev')) return; // en mode test, on ne restaure pas la session
    const s = loadSession();
    if (s?.code && s?.playerId) {
      socket.emit('player:join', { code: s.code, name: s.name, avatar: s.avatar, playerId: s.playerId }, (res: any) => {
        if (res?.ok) { meId.current = res.playerId; setCode(s.code); setName(s.name); setAvatarId(s.avatar); setWaiting(!!res.waiting); setJoined(true); applyState(res.state); }
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
        meId.current = res.playerId; setCode(c); setName(nm); setAvatarId(a.id); setWaiting(!!res.waiting); setJoined(true); applyState(res.state);
      });
    }).catch(() => setError('Salon injoignable.'));
  }, []);

  useEffect(() => {
    // Reconnexion (ex. serveur redémarré) : si on était déjà entré, on rejoint automatiquement le MÊME
    // salon avec sa session → pas besoin de retaper le code, la partie reprend.
    socket.on('connect', () => {
      if (!meId.current) return; // pas encore entré : le flux normal gère la 1re connexion
      const s = loadSession();
      if (s?.code && s?.playerId) socket.emit('player:join', { code: s.code, name: s.name, avatar: s.avatar, playerId: s.playerId }, (res: any) => {
        if (res?.ok) { meId.current = res.playerId; setWaiting(!!res.waiting); setError(''); applyState(res.state); }
      });
    });
    socket.on('lobby', (d: any) => { setPlayers(d.players); if (d.phase === 'lobby') { setWaiting(false); setPhase('lobby'); setNewChars([]); } });
    socket.on('round:prep', (d: any) => { setRound((r: any) => ({ ...r, index: d.index, total: d.total, mode: d.mode, difficulty: d.difficulty })); setPrepEndsAt(d.endsAt || 0); setPrepDone(false); setReveal(null); setFeedback(null); setSubmitted(false); setHint(null); setGuess(''); setMjTrack(null); setQuizPick(null); setPowerMsg(''); setNow(Date.now()); setPhase('prep'); });
    socket.on('round:countdown', (d: any) => { setReveal(null); setFeedback(null); setHint(null); setGuess(''); setMjTrack(null); setQuizPick(null); setCountdown(d.seconds || 5); setPhase('countdown'); });
    socket.on('round:go', (d: any) => { setRound(d); setGuess(''); setFeedback(null); setSubmitted(false); setReveal(null); setMjTrack(null); setQuizPick(null); setPhase('playing'); if (d.mode === 'buzzer') { setBuzz('idle'); setBuzzMsg(''); setBuzzEndsAt(0); } });
    // Mode Survivor : chaque nouveau morceau (trackNo change) → on remet l'input à zéro
    socket.on('rush:state', (d: any) => { setRound((r: any) => ({ ...r, ...d })); if (rushTrackRef.current !== d.trackNo) { rushTrackRef.current = d.trackNo; setGuess(''); setFeedback(null); } setPhase('playing'); });
    socket.on('rush:end', (d: any) => { setRushEnd(d); setPhase('rushend'); });
    socket.on('mj:track', (d: any) => setMjTrack(d));
    socket.on('round:reveal', (d: any) => { setReveal(d); setPlayers(d.scores); setPhase('reveal'); }); // son de reveal retiré (jugé désagréable) — à recâbler plus tard
    socket.on('game:final', (d: any) => {
      setPlayers(d.scores); setAwards(d.awards || []); setSeries(d.series || null); setFinalRounds(d.rounds || 0); setPhase('final');
      const mineAw = (d.awards || []).filter((a: any) => a.playerId === meId.current).map((a: any) => a.id);
      if (mineAw.length) setUnlockedTrophies((prev) => { const s = Array.from(new Set([...prev, ...mineAw])); try { localStorage.setItem('pl_trophies', JSON.stringify(s)); } catch {} return s; });
      // Déblocage des CHALLENGERS désactivé pour l'instant (Alexandre : conditions à refondre + affichage à repenser).
    });
    // Manche CLASH (1v1 + paris) — additif, contrat serveur fixe.
    socket.on('battle:intro', (d: any) => { setBattle({ a: d.a, b: d.b, flavor: d.flavor }); setBetPick(null); setGuess(''); setFeedback(null); setPhase('battle-intro'); });
    socket.on('battle:bets', (d: any) => { setBattle((b: any) => ({ ...b, endsAt: d.endsAt, betMs: d.betMs })); setNow(Date.now()); setPhase('battle-bet'); });
    socket.on('battle:go', (d: any) => { setBattle((b: any) => ({ ...b, endsAt: d.endsAt, durationMs: d.durationMs })); setNow(Date.now()); setGuess(''); setFeedback(null); setPhase('battle-play'); });
    socket.on('battle:reveal', (d: any) => { setBattle((b: any) => ({ ...b, reveal: d })); if (d.scores) setPlayers(d.scores); setPhase('battle-reveal'); });
    socket.on('scores:update', (d: any) => setPlayers(d.scores));
    socket.on('buzz:winner', (d: any) => { if (d.id === meId.current) { setBuzz('mine'); setBuzzEndsAt(d.endsAt || 0); setNow(Date.now()); } else { setBuzz('locked'); setBuzzMsg(`${d.name} a buzzé`); } });
    socket.on('buzz:open', (d: any) => { setBuzzEndsAt(0); if ((d.lockedOut || []).includes(meId.current)) { setBuzz('locked'); setBuzzMsg('Raté — au tour des autres'); } else setBuzz('idle'); });
    socket.on('room:closed', (d: any) => { setError(d.reason || 'Salon fermé.'); setJoined(false); localStorage.removeItem(SKEY); });
    return () => ['connect', 'lobby', 'round:prep', 'round:countdown', 'round:go', 'rush:state', 'rush:end', 'mj:track', 'round:reveal', 'game:final', 'scores:update', 'buzz:winner', 'buzz:open', 'room:closed', 'battle:intro', 'battle:bets', 'battle:go', 'battle:reveal'].forEach((e) => socket.off(e as any));
  }, []);

  useEffect(() => { if (phase !== 'playing' && phase !== 'prep' && phase !== 'battle-bet' && phase !== 'battle-play') return; const id = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(id); }, [phase]);
  useEffect(() => { if (phase !== 'countdown') return; const id = setInterval(() => setCountdown((c) => Math.max(1, c - 1)), 1000); return () => clearInterval(id); }, [phase]);
  // jauge de pouvoir : synchro depuis le serveur
  useEffect(() => { const m = players.find((p) => p.id === meId.current); if (m) { if (typeof m.charge === 'number') setCharge(m.charge); if (typeof m.charges === 'number') setCharges(m.charges); } }, [players]);
  // observe le salon pour voir en direct les persos déjà pris (grisés)
  useEffect(() => {
    if (step !== 'char' || !code.trim()) return;
    socket.emit('player:watch', { code: code.trim() }, (res: any) => { if (res?.players) { setPlayers(res.players); setError(''); } }); // salon vivant → efface un éventuel « hôte a quitté » périmé
  }, [step, code]);
  // pré-sélectionne un perso LIBRE (et se décale si le sien vient d'être pris)
  const charLocked = (id?: string) => { const a = avatarById(id); return !!a?.locked && !unlockedChars.includes(a.id); };
  useEffect(() => {
    if (step !== 'char') return;
    const taken = new Set(players.filter((p) => p.connected && p.id !== meId.current).map((p) => p.avatar));
    const pickable = (a: any) => !taken.has(a.id) && (!a.locked || unlockedChars.includes(a.id));
    if (!avatarId || taken.has(avatarId) || charLocked(avatarId)) { const free = AVATARS.find(pickable); if (free) setAvatarId(free.id); }
  }, [step, avatarId, players, unlockedChars]);
  // VHS : glitches de tracking ORGANIQUES (intervalles + tailles aléatoires) — pilotés en JS pour un
  // rendu non répétitif, sans re-render React (on écrit direct sur le DOM du stage).
  useEffect(() => {
    const showcaseVisible = (!joined && (step === 'char' || step === 'roster')) || (joined && changing);
    if (!showcaseVisible) return;
    const stage = stageRef.current; if (!stage) return;
    let timer: any;
    const fire = () => {
      const r = Math.random();
      const strong = r < 0.42;              // ~42 % de glitchs forts (aberration boostée)
      const big = r < 0.16;                 // ~16 % de TRÈS gros décalages
      const gx = (Math.random() * 2 - 1) * (big ? 30 : strong ? 15 : 6);
      const gh = big ? 12 + Math.random() * 22 : strong ? 5 + Math.random() * 12 : 2 + Math.random() * 7;
      stage.style.setProperty('--gy', (Math.random() * 82).toFixed(1) + '%');
      stage.style.setProperty('--gh', gh.toFixed(1) + '%');
      stage.style.setProperty('--gx', gx.toFixed(1) + 'px');
      stage.classList.add(strong ? 'glx-strong' : 'glx');
      window.setTimeout(() => stage.classList.remove('glx', 'glx-strong'), (strong ? 90 : 55) + Math.random() * (strong ? 230 : 90));
      timer = window.setTimeout(fire, 450 + Math.random() * 2300); // prochain glitch : 0,45–2,75 s
    };
    timer = window.setTimeout(fire, 500 + Math.random() * 1500);
    return () => { window.clearTimeout(timer); stage.classList.remove('glx', 'glx-strong'); };
  }, [step, joined, changing]);

  function join() {
    setJoining(true); setError('');
    const s = loadSession();
    socket.emit('player:join', { code: code.trim(), name: name.trim(), avatar: avatarId, playerId: s?.playerId }, (res: any) => {
      setJoining(false);
      if (res?.error) return setError(res.error);
      meId.current = res.playerId;
      saveSession({ code: code.trim().toUpperCase(), name: name.trim(), avatar: avatarId, playerId: res.playerId });
      setWaiting(!!res.waiting); setJoined(true); applyState(res.state); sfx('launch'); // même son que "Lancer la partie" (raccord)
    });
  }
  function changeChar() {
    socket.emit('player:changeChar', { avatar: avatarId }, (res: any) => {
      if (res?.error) return setError(res.error);
      saveSession({ code: code.trim().toUpperCase(), name: name.trim(), avatar: avatarId, playerId: meId.current });
      setError(''); setChanging(false);
    });
  }
  function submitAnswer(e?: any) {
    e?.preventDefault();
    if (!guess.trim() || phase !== 'playing' || submitted) return;
    setSubmitted(true); // VERROU IMMÉDIAT : le bouton se coupe dès le 1er clic (plus de double validation)
    socket.emit('player:answer', { text: guess.trim() }, (res: any) => { if (res?.error) setSubmitted(false); }); // ré-ouvre seulement si refusé (ex. brouillé). Résultat à la révélation.
  }
  // Mode Survivor : on répond en boucle (PAS de verrou), la bonne réponse fait avancer + rallonge le chrono
  function submitRush(e?: any) {
    e?.preventDefault();
    if (!guess.trim() || phase !== 'playing') return;
    socket.emit('rush:answer', { text: guess.trim() }, (res: any) => {
      if (res?.correct) { setFeedback({ points: res.points, added: res.addedMs, full: res.full }); setGuess(''); }
      else if (res && !res.error) setFeedback({ wrong: true });
    });
  }
  function rushPass() { socket.emit('rush:pass', {}, (res: any) => { if (res?.ok) setFeedback({ removed: res.removedMs }); }); }
  // Quitter le salon : on se retire côté serveur (libère le rappeur), on oublie la session, retour à l'accueil.
  function leaveRoom() {
    socket.emit('player:leave', {}, () => {});
    localStorage.removeItem(SKEY);
    meId.current = '';
    setJoined(false); setChanging(false); setAvatarId(''); setStep('form'); setError(''); setGuess('');
  }
  function doBuzz() { socket.emit('player:buzz', {}, (res: any) => { if (res?.winner) { setBuzz('mine'); setBuzzEndsAt(res.endsAt || 0); setNow(Date.now()); } }); }
  function submitQuiz(i: number) {
    if (quizPick !== null || phase !== 'playing') return;
    setQuizPick(i);
    // On enregistre le choix mais on NE révèle PAS si c'est bon (pas de vert/rouge, pas de points) — le
    // résultat tombe à la révélation, pour garder le suspense et l'attention.
    socket.emit('quiz:answer', { choice: i }, (res: any) => { if (res?.error) setQuizPick(null); });
  }
  function submitBuzzerAnswer(e?: any) { e?.preventDefault(); if (!guess.trim()) return; socket.emit('buzzer:answer', { text: guess.trim() }, (res: any) => { if (res?.correct) { setFeedback({ points: res.points, titleHit: true, artistHit: true }); } else if (res?.ok) { setFeedback({ points: 0 }); setGuess(''); } }); }
  // CLASH — spectateur : parier sur un camp (aucun risque). Optimiste, on annule si le serveur refuse.
  function placeBet(pick: 'a' | 'b') {
    setBetPick(pick);
    socket.emit('battle:bet', { pick }, (res: any) => { if (res?.error) setBetPick(null); else if (res?.pick) setBetPick(res.pick); });
  }
  // CLASH — duelliste : répond en boucle (pas de verrou), le 1er des deux qui trouve rafle le clash.
  function submitBattleAnswer(e?: any) {
    e?.preventDefault();
    if (!guess.trim()) return;
    socket.emit('battle:answer', { text: guess.trim() }, (res: any) => {
      if (res?.correct) setFeedback({ battleWin: true });
      else if (res && !res.error) { setFeedback({ battleWrong: true }); setGuess(''); }
    });
  }
  function usePower() {
    socket.emit('player:power', {}, (res: any) => {
      if (res?.error) return setPowerMsg(res.error);
      if (typeof res?.charges === 'number') setCharges(res.charges);
      if (typeof res?.charge === 'number') setCharge(res.charge);
      if (res?.type === 'hint' && res.detail?.hint) { setHint(res.detail.hint); setPowerMsg('Indices révélés — titre & artiste'); }
      else if (res?.type === 'steal') setPowerMsg(res.detail ? `Volé ${fmtAud(res.detail.amount)} auditeurs à ${res.detail.stoleFrom}` : 'Personne à voler…');
      else if (res?.type === 'comeback') setPowerMsg(res.detail ? `Remontada ! +${fmtAud(res.detail.gain)} auditeurs` : 'Remontée…');
      else if (res?.type === 'sabotage') setPowerMsg(res.detail ? `${res.detail.mutedName} muselé cette manche !` : 'Sabotage lancé');
      else if (res?.type === 'tax') setPowerMsg(res.detail?.amount ? `Dîme prélevée : +${fmtAud(res.detail.amount)} auditeurs sur ${res.detail.count} joueur${res.detail.count > 1 ? 's' : ''}` : 'Personne à taxer…');
      else if (res?.type === 'allin') setPowerMsg(res.detail ? `Tapis ! ${res.detail.spent} charge${res.detail.spent > 1 ? 's' : ''} claquée${res.detail.spent > 1 ? 's' : ''} → +${fmtAud(res.detail.gain)} auditeurs` : 'Tapis !');
      else if (res?.type === 'combo') setPowerMsg(res.detail?.streak ? `Enchaînement ×${res.detail.mult} armé (série de ${res.detail.streak}) !` : `Combo armé ×${res.detail?.mult || 1.3} — enchaîne pour +fort`);
      else if (res?.type === 'sustain') setPowerMsg(res.detail ? `+${fmtAud(res.detail.amount)} auditeurs garantis pendant ${res.detail.rounds} manches` : 'Revenu armé');
      else if (res?.type === 'draft') setPowerMsg('Aspiration — tu prends une part du meilleur score de la manche');
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
      setPrepDone(true); sfx('scratch');
    });
  }
  function passPower() { socket.emit('player:ready', {}); setPrepDone(true); }
  function sendReaction(id: number, end = false) { socket.emit('player:reaction', { id, end }); } // taunt affiché sur l'écran hôte (anti-spam serveur). end = jeu de réactions de fin de partie.

  function mjAward(pid: string, points = 10000) { socket.emit('mj:award', { playerId: pid, points }); }
  function mjReveal() { socket.emit('mj:reveal'); }
  function mjNext() { socket.emit('mj:next'); }

  const remaining = Math.max(0, round.endsAt - now);
  const frac = round.durationMs ? remaining / round.durationMs : 0;
  const jamMs = round.jam && round.jam.by !== meId.current ? Math.max(0, (round.endsAt - round.durationMs + round.jam.ms) - now) : 0; // brouillé par un adversaire ?
  const buzzLeft = buzzEndsAt ? Math.max(0, Math.ceil((buzzEndsAt - now) / 1000)) : 0; // secondes restantes pour répondre après avoir buzzé
  const me = players.find((p) => p.id === meId.current);
  const myRank = players.findIndex((p) => p.id === meId.current) + 1;
  const myResult = reveal?.results?.find((r: any) => r.id === meId.current);
  const myPts = myResult?.points || 0; // peut être NÉGATIF (pari perdu : SCH/Kaaris/Freeze…)
  const av = avatarById(avatarId);
  const takenIds = new Set(players.filter((p) => p.connected && p.id !== meId.current).map((p) => p.avatar)); // persos déjà pris

  /* ---- 1) formulaire : code + pseudo ---- */
  if (!joined && step === 'form') {
    return (
      <><GrungeBg />
      <div className="wrap" style={{ position: 'relative', zIndex: 1 }}><div className="center">
        <h1 className="wm" style={{ fontSize: 44 }}>PUNCHLIN<span className="d">R</span></h1>
        <p className="muted" style={{ marginTop: -8 }}>Le blind test rap FR</p>
        {error && <p className="err">{error}</p>}
        <form className="glass pad" style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={(e) => { e.preventDefault(); if (code.trim() && name.trim()) setStep('char'); }}>
          <div><label className="eyebrow">Code du salon</label>
            <input className="field" style={{ textAlign: 'center', letterSpacing: '.3em', textTransform: 'uppercase', fontFamily: 'var(--disp)', fontSize: 24, marginTop: 6 }} value={code} maxLength={4} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="K7XQ" autoCapitalize="characters" /></div>
          <div><label className="eyebrow">Ton blaze</label>
            <input className="field" style={{ marginTop: 6 }} value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="Sacha" /></div>
          <button className="btn warm big" type="submit" disabled={!code.trim() || !name.trim()}>Entre dans le cercle →</button>
        </form>
      </div></div></>
    );
  }

  /* ---- PALMARÈS : galerie de tous les trophées (débloqués en couleur, le reste grisé « à découvrir ») ---- */
  if (!joined && step === 'trophies') {
    const has = (id: string) => unlockedTrophies.includes(id);
    return (
      <><GrungeBg />
      <div className="wrap" style={{ position: 'relative', zIndex: 1 }}>
        <div className="topbar">
          <button className="btn" style={{ padding: '8px 14px', fontSize: 13 }} onClick={() => setStep('form')}>← Hub</button>
          <h1 className="wm" style={{ fontSize: 20 }}>PALMARÈS</h1>
          <button className="btn" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => setRevealTrophies((v) => !v)}>{revealTrophies ? 'Masquer' : 'Tout voir'}</button>
        </div>
        <p className="muted" style={{ textAlign: 'center', margin: '2px 0 12px', fontSize: 13 }}>
          {unlockedTrophies.length}/{AWARDS_INFO.length} débloqués · décernés en fin de partie
        </p>
        <div className="troph-grid">
          {AWARDS_INFO.map((t) => {
            const shown = revealTrophies || has(t.id);
            return (
              <div className={`troph ${has(t.id) ? 'got' : ''} ${shown ? '' : 'locked'} ${t.salty ? 'salty' : ''}`} key={t.id}>
                <span className="troph-ic">
                  {shown ? (<>
                    <img className="troph-img" src={`/trophies/${t.id}.png`} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    <span className="troph-svg" dangerouslySetInnerHTML={{ __html: awardIcon(t.icon) }} />
                  </>) : (
                    <span className="troph-svg" dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 9a3 3 0 1 1 4 2.8c-.8.4-1 .8-1 1.7"/><circle cx="12" cy="17.5" r="1" fill="currentColor" stroke="none"/></svg>' }} />
                  )}
                </span>
                <div className="troph-title">{shown ? t.title : '???'}</div>
                <div className="troph-desc">{shown ? t.blurb : 'À découvrir'}</div>
                {has(t.id) && <span className="troph-badge">débloqué</span>}
              </div>
            );
          })}
        </div>
      </div></>
    );
  }

  /* ---- 2) sélection du perso — join initial, page ROSTER (browse), ou CHANGEMENT entre deux parties ---- */
  if ((!joined && (step === 'char' || step === 'roster')) || (joined && changing)) {
    const browse = !joined && step === 'roster';
    const changeMode = joined && changing;
    const sel = av || AVATARS[0];
    const nmU = sel.name.toUpperCase();
    // taille du nom adaptée à sa longueur → ne déborde jamais sur les stats
    const nameFs = nmU.length > 11 ? 'clamp(17px,5vw,24px)' : nmU.length > 8 ? 'clamp(20px,6vw,29px)' : 'clamp(24px,7.5vw,35px)';
    return (
      <><GrungeBg />
      <div className={`cs${isLegend(sel.cat) ? ' irid' : ''}`} style={{ ['--cc' as any]: CATEGORY_COLORS[sel.cat], position: 'relative', zIndex: 1 }}>
        <svg width="0" height="0" style={{ position: 'absolute' }}><defs>
          <g id="bust"><path d="M22,240 C22,168 58,146 100,146 C142,146 178,168 178,240 Z" fill="#0d0917" /><ellipse cx="100" cy="96" rx="40" ry="44" fill="#0d0917" /><path d="M60,70 Q100,22 140,70 Q140,44 100,42 Q60,44 60,70 Z" fill="#0d0917" /><path d="M138,80 C150,120 150,180 150,240 L178,240 C178,168 160,146 138,80 Z" fill="rgba(255,255,255,.10)" /></g>
          {/* filtre VHS : wobble analogique (displacement) + séparation des canaux R/B (aberration
              chromatique) BIEN visible. #vhs-strong = version boostée, utilisée pendant les glitchs. */}
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

        <button className="cs-back" onClick={() => (changeMode ? setChanging(false) : setStep('form'))} aria-label="Retour">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {error && <p className="err cs-err">{error}</p>}

        <div className="cs-top">
          <div className="cs-stage" ref={stageRef} style={{ ['--c' as any]: sel.color }}>
            <div className="cs-pbg" />
            <div className="cs-skel" aria-hidden="true" />
            <div className="cs-wm">{initials(sel.name)[0]}</div>
            {sel.img && <img className="cs-pimg" src={`/avatars/${sel.id}.png`} alt="" style={sel.crop?.y != null ? { objectPosition: `50% ${sel.crop.y}%` } : undefined} onLoad={(e) => e.currentTarget.parentElement?.classList.add('imgok')} onError={hideOnErr} />}
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
            <div className="cs-pow"><div className="k">Pouvoir signature</div><div className="nm">{sel.power.name}</div><div className="fx">{boldFx(sel.power.effect)}</div></div>
          </div>
        </div>

        <div className="cs-rosterwrap">
          {[...CATEGORY_ORDER, ...Array.from(new Set(AVATARS.map((a) => a.cat))).filter((c) => !CATEGORY_ORDER.includes(c))].map((cat) => {
            const members = AVATARS.filter((a) => a.cat === cat && !a.locked); // les déblocables ne sont PAS collés aux catégories
            if (!members.length) return null;
            return (
              <div className="cs-catgroup" key={cat}>
                <div className={`cs-catlabel${isLegend(cat) ? ' irid' : ''}`} style={{ ['--cc' as any]: CATEGORY_COLORS[cat] }}>{cat}</div>
                <div className="cs-catrow">
                  {members.map((a) => {
                    const taken = takenIds.has(a.id);
                    return (
                    <button type="button" key={a.id} className={`cs-cell ${avatarId === a.id ? 'sel' : ''} ${taken ? 'lock' : ''}`} disabled={taken} onClick={() => !taken && setAvatarId(a.id)}>
                      <div className="cs-thumb" style={{ ['--c' as any]: a.color, ...(a.crop?.z ? { ['--z' as any]: a.crop.z } : {}) }}>
                        <div className="cs-tskel" aria-hidden="true" />
                        {a.img && <img src={`/avatars/${a.id}.png`} alt="" onLoad={(e) => e.currentTarget.parentElement?.classList.add('imgok')} onError={hideOnErr} />}
                        <div className="tg" />
                        {taken && <span className="cs-taken">PRIS</span>}
                      </div>
                      <span className="cs-cn">{a.name}</span>
                    </button>
                  ); })}
                </div>
              </div>
            );
          })}
          {/* section À PART : déblocables. Cachée au lancement de partie (join) ; visible en aperçu roster
              (révélés) ou pour les rappeurs déjà débloqués. AUCUN ??? dans le flux de sélection. */}
          {(() => {
            const shown = AVATARS.filter((a) => a.locked && (browse || unlockedChars.includes(a.id)));
            if (!shown.length) return null;
            return (
              <div className="cs-catgroup">
                <div className="cs-catlabel" style={{ ['--cc' as any]: '#8a8f99' }}>{browse ? 'À débloquer' : 'Débloqués'}</div>
                <div className="cs-catrow">
                  {shown.map((a) => {
                    const taken = takenIds.has(a.id);
                    return (
                      <button type="button" key={a.id} className={`cs-cell ${avatarId === a.id ? 'sel' : ''} ${taken ? 'lock' : ''}`} disabled={taken} onClick={() => !taken && setAvatarId(a.id)}>
                        <div className="cs-thumb" style={{ ['--c' as any]: a.color, ...(a.crop?.z ? { ['--z' as any]: a.crop.z } : {}) }}>
                          <div className="cs-tskel" aria-hidden="true" />
                          {a.img && <img src={`/avatars/${a.id}.png`} alt="" onLoad={(e) => e.currentTarget.parentElement?.classList.add('imgok')} onError={hideOnErr} />}
                          <div className="tg" />
                          {taken && <span className="cs-taken">PRIS</span>}
                        </div>
                        <span className="cs-cn">{a.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        <div className="cs-bottombar">
          {browse
            ? <button className="btn big" onClick={() => setStep('form')}>← Retour au hub</button>
            : changeMode
              ? <button className="btn warm big" style={{ width: '100%', maxWidth: 460 }} onClick={changeChar} disabled={!avatarId || takenIds.has(avatarId)}>{takenIds.has(avatarId) ? 'Déjà pris' : 'Valider ce rappeur'}</button>
              : <button className="btn warm big" onClick={join} disabled={!avatarId || joining || takenIds.has(avatarId)}>{joining ? 'Connexion…' : takenIds.has(avatarId) ? 'Déjà pris — choisis un autre' : `Entrer avec ${sel.name}`}</button>}
        </div>
      </div></>
    );
  }

  /* ---- salle d'attente : arrivé en pleine partie, rejoint à la prochaine ---- */
  if (joined && waiting) {
    return (
      <><GrungeBg />
      <div className="wrap" style={{ position: 'relative', zIndex: 1 }}>
        <div className="topbar">
          <span className="row" style={{ gap: 9 }}>{av && <RMed id={av.id} size={34} />}<span className="pname" style={{ fontFamily: 'var(--disp)', fontSize: 17 }}>{name}</span></span>
          <span className="gpill" style={{ color: 'var(--muted)' }}>En attente</span>
        </div>
        {error && <p className="err" style={{ textAlign: 'center' }}>{error}</p>}
        <div className="center" style={{ gap: 16 }}>
          <span className="sonar"><span className="dot" style={{ width: 12, height: 12 }} /></span>
          <h2 className="title-xl">Partie en cours</h2>
          <p className="muted" style={{ maxWidth: 380 }}>Tu es dans le cercle, {name}. Une partie tourne déjà — tu entres <b style={{ color: 'var(--txt)' }}>dès la prochaine</b>. Reste chaud.</p>
          {av && <p className="muted">Ton perso : <b style={{ color: 'var(--txt)' }}>{av.name}</b> · pouvoir <b style={{ color: 'var(--ember)' }}>{av.power.name}</b></p>}
          <span className="waitdots" aria-hidden="true"><i /><i /><i /></span>
        </div>
      </div></>
    );
  }

  /* ---- pupitre du Maître du jeu ---- */
  if (me?.isMJ) {
    const others = players.filter((p) => !p.isMJ).sort((a, b) => b.score - a.score);
    const answer = phase === 'reveal' ? reveal?.track : mjTrack;
    return (
      <><GrungeBg />
      <div className="wrap" style={{ position: 'relative', zIndex: 1 }}>
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
                  return (
                    <div className="prow" key={p.id}>
                      <span className="who"><RMed id={p.avatar} size={26} />{p.name}<span className="muted" style={{ fontSize: 12 }}>· {fmtAud(p.score)}</span></span>
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
      </div></>
    );
  }

  /* ---- en jeu ---- */
  const powerMode = round.mode !== 'quiz' && round.mode !== 'rush' && !round.mj; // charges visibles seulement quand les pouvoirs sont actifs
  return (
    <><GrungeBg />
    <div className="wrap" style={{ position: 'relative', zIndex: 1 }}>
      <div className="topbar">
        <span className="row" style={{ gap: 9, minWidth: 0, flex: 1 }}>{av && <RMed id={av.id} size={34} />}<span className="pname" style={{ fontFamily: 'var(--disp)', fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{name}</span></span>
        {/* auditeurs retirés du bandeau (blazes longs → ça débordait) ; les charges suffisent ici */}
        {phase === 'lobby' && code && <span className="gpill" style={{ flex: '0 0 auto' }}><span className="dot" />Salon&nbsp;<b style={{ fontFamily: 'var(--disp)', letterSpacing: '.14em', color: 'var(--txt)' }}>{code}</b></span>}
        {powerMode && phase !== 'lobby' && phase !== 'countdown' && <span style={{ flex: '0 0 auto' }}><Charges n={charges} charge={charge} /></span>}
      </div>
      {error && <p className="err" style={{ textAlign: 'center' }}>{error}</p>}

      {phase === 'lobby' && (
        <div className="center" style={{ gap: 16 }}><span className="sonar"><span className="dot" style={{ width: 12, height: 12 }} /></span><h2 className="title-xl">Tu es dans le cercle</h2>
          {av && (
            <div className="glass pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, maxWidth: 340, width: '100%' }}>
              {/* anneau = couleur de la CATÉGORIE du rappeur (iridescent pour les Légendes) */}
              <div className={`lobby-av${isLegend(av.cat) ? ' irid' : ''}`} style={{ ['--cc' as any]: CATEGORY_COLORS[av.cat] }}>
                {av.img
                  ? <img src={`/avatars/${av.id}.png`} alt="" onError={hideOnErr} style={av.crop?.y != null ? { objectPosition: `50% ${av.crop.y}%` } : undefined} />
                  : <RMed id={av.id} size={116} />}
              </div>
              <div style={{ fontFamily: 'var(--disp)', fontSize: 26, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1 }}>{av.name}</div>
              <div className="eyebrow" style={{ color: 'var(--ember)', fontSize: 14 }}>{av.power.name}</div>
              <div className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{av.power.effect}</div>
            </div>
          )}
          <p className="muted">En attente… l'hôte va lancer la partie<span className="waitdots inline" aria-hidden="true"><i /><i /><i /></span></p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <button className="btn" onClick={() => setChanging(true)}>Changer de rappeur</button>
            <button className="exit-link" onClick={leaveRoom}>Quitter le salon</button>
          </div></div>
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
                  <div className="row" style={{ justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <span className="eyebrow" style={{ fontSize: 12, color: 'var(--ember)' }}>{av.power.name}</span>
                    <Charges n={charges} charge={charge} />
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.42, margin: '7px 0 0' }}>{av.power.effect}</div>
                </div>
              </div>
              {charges < 1 && <p className="trashtalk">{TRASH_TALK[round.index % TRASH_TALK.length]}</p>}
              <div className="row" style={{ gap: 10 }}>
                <button className="btn" style={{ flex: 1 }} onClick={passPower}>{charges >= 1 ? 'Passer' : 'Prêt'}</button>
                <button className="btn warm" style={{ flex: 1 }} onClick={usePower} disabled={charges < 1}>{charges >= 1 ? `Activer (${charges})` : 'Aucune charge'}</button>
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
          {round.mode !== 'rush' && <span className="eyebrow">Manche {round.index + 1} / {round.total} · {round.difficulty}{round.mode === 'quiz' ? ' · Quiz' : round.mj ? ' · Maître du jeu' : round.mode === 'buzzer' ? ' · Buzzer' : ''}</span>}
          {round.mode === 'rush' ? (() => {
            const rs = Math.max(0, Math.ceil((round.endsAt - now) / 1000));
            const mine = (round.scores || []).find((p: any) => p.id === meId.current);
            const spectator = round.rushPlayerId && round.rushPlayerId !== meId.current; // Survivor = solo : je regarde
            const runner = (round.scores || []).find((p: any) => p.id === round.rushPlayerId);
            return (
              <>
                <span className="eyebrow">Survivor · {round.difficulty}</span>
                <div className="big-num" style={{ color: rs <= 8 ? '#ff5a1f' : 'var(--fluo)' }}>{rs}</div>
                {spectator ? (
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    <span className="muted" style={{ fontWeight: 700 }}>🎧 {round.rushPlayerName || runner?.name || 'Un joueur'} est au contre-la-montre</span>
                    <span className="muted" style={{ fontSize: 13 }}>Morceau {round.trackNo}{runner ? ` · ${fmtAud(runner.score)} aud. · ${runner.tracks} ✓` : ''}</span>
                    <span className="muted" style={{ fontSize: 12, opacity: .7 }}>Le Survivor est solo — tu regardes.</span>
                  </div>
                ) : (
                  <>
                    <span className="muted">Morceau {round.trackNo} · {mine ? `${fmtAud(mine.score)} aud. · ${mine.tracks} ✓` : '0 aud.'}</span>
                    <form onSubmit={submitRush} style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <input className="field" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Titre OU artiste — les 2 = + de temps" autoFocus />
                      <button className="btn warm big send" type="submit">Envoyer</button>
                      <button className="btn" type="button" onClick={rushPass}>Passer · −{Math.round((round.passMs || 8000) / 1000)} s</button>
                    </form>
                    {feedback && (feedback.added ? <p className="feedback good">{feedback.full ? 'Titre + artiste ! ' : 'Bien ! '}+{fmtAud(feedback.points || 0)} · +{Math.round(feedback.added / 1000)} s{feedback.full ? '' : ' — les 2 pour +'}</p> : feedback.removed ? <p className="feedback bad">Passé · −{Math.round(feedback.removed / 1000)} s</p> : feedback.wrong ? <p className="feedback bad">Pas ça… réessaie</p> : null)}
                  </>
                )}
              </>
            );
          })() : round.mode === 'quiz' ? (
            (() => {
              const vf = (round.quiz?.choices?.length || 0) === 2; // Vrai/Faux = 2 choix → grille + couleurs dédiées
              return (
                <>
                  <span className="gpill" style={{ color: 'var(--fluo)' }}>{round.quiz?.cat}</span>
                  <h2 className="qtitle qz-q">{round.quiz?.q}</h2>
                  <div className={'qz-grid' + (vf ? ' vf' : '')}>
                    {round.quiz?.choices.map((c: string, i: number) => {
                      const answered = quizPick !== null;
                      // choix retenu = neutre (pas de bon/mauvais avant la révélation) ; VF = vert/rouge, QCM = lettre A/B/C/D
                      const cls = 'qz-opt' + (vf ? ' vf' + vfClass(c) : '') + (quizPick === i ? ' pick' : '');
                      return <button key={i} className={cls} disabled={answered} onClick={() => submitQuiz(i)}>{vf ? c : <><b>{String.fromCharCode(65 + i)}</b>{c}</>}</button>;
                    })}
                  </div>
                  {quizPick !== null && <p className="muted">Réponse enregistrée — résultat à la révélation.</p>}
                </>
              );
            })()
          ) : round.mj ? (
            <><h2 className="title-xl">Crie ta réponse !</h2><p className="muted" style={{ maxWidth: 380 }}>Le Maître du jeu écoute et distribue les points. Sois le plus rapide à balancer le bon titre / artiste à voix haute.</p></>
          ) : round.mode === 'buzzer' ? (
            buzz === 'mine' ? (<>
                <h2 className="title-xl" style={{ margin: 0 }}>À toi ! Réponds vite</h2>
                {buzzEndsAt > 0 && <div className="big-num" style={{ color: buzzLeft <= 3 ? 'var(--ember)' : 'var(--fluo)', lineHeight: 1 }}>{buzzLeft}</div>}
                <form onSubmit={submitBuzzerAnswer} style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}><input className="field" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Titre et/ou artiste…" autoFocus /><button className="btn warm big send" type="submit">Valider</button></form>
              </>)
              : buzz === 'locked' ? (<><svg width="46" height="46" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--muted)' }}><rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.7" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" /></svg><p className="muted">{buzzMsg}</p></>)
                : jamMs > 0 ? (<><h2 className="title-xl">Brouillé…</h2><div className="big-num" style={{ color: 'var(--fluo)' }}>{Math.ceil(jamMs / 1000)}</div><p className="muted">Quelqu'un t'a ralenti — tu pourras buzzer dans un instant.</p></>)
                : (<><h2 className="title-xl" style={{ marginBottom: 4 }}>Reconnais le son</h2><button className="buzzer" onClick={doBuzz}>BUZZ</button><p className="muted" style={{ marginTop: 4 }}>Le 1ᵉʳ qui buzze prend la main</p></>)
          ) : jamMs > 0 ? (
            <><h2 className="title-xl">Brouillé…</h2><div className="big-num" style={{ color: 'var(--fluo)' }}>{Math.ceil(jamMs / 1000)}</div><p className="muted">Quelqu'un t'a ralenti — tu peux répondre dans un instant.</p></>
          ) : submitted ? (
            <div className="sent">
              <span className="sent-check">
                <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
              </span>
              <h2 className="title-xl">Réponse envoyée</h2>
              <p className="muted" style={{ maxWidth: 320 }}>Le résultat tombe à la révélation. Reste chaud — écoute bien la suite.</p>
            </div>
          ) : (
            <><h2 className="title-xl">À toi de jouer</h2><form onSubmit={submitAnswer} style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }}><input className="field" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Titre et/ou artiste…" autoFocus /><div className="bar"><i style={{ width: `${frac * 100}%` }} /></div><button className="btn warm big send" type="submit">Valider</button></form></>
          )}
          {hint && <p className="feedback" style={{ color: 'var(--v1)' }}>Indice — Titre : <b>{hint.title}</b> · Artiste : <b>{hint.artist}</b></p>}
          {feedback && round.mode !== 'rush' && <p className={`feedback ${feedback.points ? 'good' : 'bad'}`}>{feedback.points ? `Bien vu ! +${fmtAud(feedback.points)}` : 'Pas ça…'}</p>}
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
              {reveal.track.cover && <img className="cover" src={reveal.track.cover} alt="" style={{ width: 128, height: 128 }} />}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <h2 className="title-xl" style={{ margin: 0 }}>{reveal.track.title}</h2>
                <p className="reveal-artist" style={{ fontFamily: 'var(--disp)', fontSize: 22, margin: 0 }}>{reveal.track.artist}</p>
              </div>
            </>
          )}
          {myResult?.answer && <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>Ta réponse : <b style={{ color: 'var(--txt)' }}>« {myResult.answer} »</b></p>}
          <div className={`gainbadge ${myPts > 0 ? 'win' : myPts < 0 ? 'loss' : 'zero'}`}>
            {myPts > 0 ? <>+{fmtAud(myPts)} <span>auditeurs</span></> : myPts < 0 ? <>{fmtAud(myPts)} <span>auditeurs · pari perdu</span></> : 'Zéro auditeur'}
          </div>
          {/* réactions/taunts — s'affichent sur l'écran hôte ; le joueur reste actif entre les manches */}
          <div className="reactbar">{REACTIONS.map((r, i) => <button key={i} type="button" className="reactbtn" onClick={() => sendReaction(i)}><span className="re">{r.e}</span>{r.t}</button>)}</div>
          {av && <p className="muted" style={{ fontSize: 13, margin: '2px 0 0', maxWidth: 400, lineHeight: 1.45 }}>Ton pouvoir — <b style={{ color: 'var(--ember)' }}>{av.power.name}</b> : {av.power.effect}</p>}
          </div>
      )}

      {/* ---- CLASH (1v1 + paris) — 4 phases additives ---- */}
      {phase === 'battle-intro' && battle?.a && (() => {
        const amDuelist = meId.current === battle.a?.id || meId.current === battle.b?.id;
        return (
          <div className="ph-center">
            <span className="eyebrow" style={{ color: 'var(--fluo)' }}>⚔ Clash !</span>
            <div className="row" style={{ gap: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><RMed id={battle.a.avatar} size={72} /><b style={{ color: 'var(--green)' }}>{battle.a.name}</b></div>
              <span className="ph-pickname" style={{ color: 'var(--muted)' }}>VS</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}><RMed id={battle.b.avatar} size={72} /><b style={{ color: 'var(--fluo)' }}>{battle.b.name}</b></div>
            </div>
            {amDuelist
              ? <h2 className="ph-q" style={{ color: 'var(--bad)' }}>C'est TON clash !</h2>
              : <p className="lead">Prépare ton pari…</p>}
          </div>
        );
      })()}

      {phase === 'battle-bet' && battle?.a && (() => {
        const amDuelist = meId.current === battle.a?.id || meId.current === battle.b?.id;
        const secs = Math.max(0, Math.ceil(((battle.endsAt || 0) - now) / 1000));
        const bonus = battle.betBonus ?? 4000;
        if (amDuelist) {
          const opp = meId.current === battle.a.id ? battle.b : battle.a;
          return (
            <div className="ph-center">
              <span className="eyebrow" style={{ color: 'var(--bad)' }}>⚔ C'est ton clash</span>
              <h2 className="ph-q">Les autres parient…</h2>
              <div className="big-num" style={{ color: 'var(--fluo)' }}>{secs}</div>
              <p className="lead">Prépare-toi à reconnaître le son avant <b style={{ color: 'var(--fluo)' }}>{opp.name}</b>.</p>
            </div>
          );
        }
        const pickName = betPick === 'a' ? battle.a.name : battle.b.name;
        return (
          <div className="ph-center">
            <span className="eyebrow" style={{ color: 'var(--fluo)' }}>⚔ Clash — parie sur le vainqueur</span>
            {betPick ? (
              <>
                <div className="ph-mid">Tu paries sur</div>
                <div className="ph-pickname" style={{ color: betPick === 'a' ? 'var(--green)' : 'var(--fluo)' }}>{pickName}</div>
                <div className="big-num" style={{ color: 'var(--fluo)' }}>{secs}</div>
                <div className="ph-stake solo"><span className="v">+{fmtAud(bonus)}</span><span className="l">si {pickName} gagne</span></div>
                <button className="btn ghost" onClick={() => setBetPick(null)}>Changer de camp</button>
              </>
            ) : (
              <>
                <h2 className="ph-q">Qui gagne ?</h2>
                <div className="ph-betbtns">
                  <button className="ph-betbtn a" onClick={() => placeBet('a')}><RMed id={battle.a.avatar} size={80} /><span>{battle.a.name}</span></button>
                  <button className="ph-betbtn b" onClick={() => placeBet('b')}><RMed id={battle.b.avatar} size={80} /><span>{battle.b.name}</span></button>
                </div>
                <div className="ph-stakes">
                  <div className="ph-stake good"><span className="v">+{fmtAud(bonus)}</span><span className="l">bon pari</span></div>
                  <div className="ph-stake safe"><span className="v">0</span><span className="l">tu ne risques rien</span></div>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {phase === 'battle-play' && battle?.a && (() => {
        const amDuelist = meId.current === battle.a?.id || meId.current === battle.b?.id;
        if (!amDuelist) {
          return (
            <div className="ph-center">
              <span className="eyebrow" style={{ color: 'var(--fluo)' }}>⚔ Clash lancé</span>
              <h2 className="ph-q"><span style={{ color: 'var(--green)' }}>{battle.a.name}</span> vs <span style={{ color: 'var(--fluo)' }}>{battle.b.name}</span></h2>
              <p className="lead">Le <b>1ᵉʳ des deux</b> qui reconnaît le son rafle le clash.</p>
            </div>
          );
        }
        const opp = meId.current === battle.a.id ? battle.b : battle.a;
        return (
          <div className="ph-center">
            <span className="eyebrow" style={{ color: 'var(--bad)' }}>⚔ C'est ton clash</span>
            <h2 className="ph-duelq">Trouve avant <span style={{ color: 'var(--fluo)' }}>{opp.name}</span> !</h2>
            <div className="ph-reward"><b>+{fmtAud(battle.win ?? 20000)}</b><span>au 1ᵉʳ qui trouve</span></div>
            <form style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={submitBattleAnswer}>
              <input className="field" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Titre et/ou artiste…" autoFocus />
              <button className="btn warm big send" type="submit">Valider</button>
            </form>
            {feedback?.battleWin ? <p className="feedback good">Trouvé ! On attend la révélation…</p> : feedback?.battleWrong ? <p className="feedback bad">Pas ça… réessaie</p> : null}
          </div>
        );
      })()}

      {phase === 'battle-reveal' && battle?.reveal && (() => {
        const d = battle.reveal;
        const amDuelist = meId.current === battle.a?.id || meId.current === battle.b?.id;
        const track = d.track;
        const check = <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>;
        const cross = <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="var(--txt)" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>;
        if (amDuelist) {
          const won = !d.draw && d.winnerId === meId.current;
          return (
            <div className="ph-center">
              {won && <span className="sent-check" style={{ background: 'var(--green)' }}>{check}</span>}
              <h2 className="ph-q">{d.draw ? 'Égalité !' : won ? 'Clash remporté !' : 'Clash perdu'}</h2>
              {track && <p className="lead">C'était <b style={{ color: 'var(--txt)' }}>{track.title}</b> — {track.artist}</p>}
              <div className="big-num" style={{ color: won ? 'var(--green)' : 'var(--muted)' }}>{won ? `+${fmtAud(d.points || 0)}` : d.draw ? '±0' : '+0'}</div>
            </div>
          );
        }
        const myBet = (d.bets || []).find((x: any) => x.id === meId.current);
        const winnerName = d.winnerName || (d.winnerId === battle.a?.id ? battle.a.name : battle.b?.name);
        if (!myBet) {
          return (
            <div className="ph-center">
              <h2 className="ph-q">{d.draw ? 'Égalité !' : `${winnerName} gagne`}</h2>
              {track && <p className="lead">C'était <b style={{ color: 'var(--txt)' }}>{track.title}</b> — {track.artist}</p>}
              <p className="muted">Tu n'avais pas parié.</p>
            </div>
          );
        }
        const won = !!myBet.won;
        const pickName = betPick === 'a' ? battle.a.name : betPick === 'b' ? battle.b.name : winnerName;
        return (
          <div className="ph-center">
            <span className="sent-check" style={{ background: won ? 'var(--green)' : 'var(--surf3)' }}>{won ? check : cross}</span>
            <h2 className="ph-q">{won ? 'Bien vu !' : d.draw ? 'Égalité…' : 'Raté'}</h2>
            <p className="lead">Tu avais parié sur <b style={{ color: won ? 'var(--green)' : 'var(--fluo)' }}>{pickName}</b></p>
            {track && <p className="muted" style={{ fontSize: 13 }}>C'était <b style={{ color: 'var(--txt)' }}>{track.title}</b> — {track.artist}</p>}
            <div className="big-num" style={{ color: won ? 'var(--green)' : 'var(--muted)' }}>{won ? `+${fmtAud(d.betBonus || 0)}` : '+0'}</div>
          </div>
        );
      })()}

      {phase === 'rushend' && rushEnd && (() => {
        const res = rushEnd.results || [];
        const top = rushEnd.top || [];
        const mine = res.find((r: any) => r.id === meId.current);
        return (
        <div className="center" style={{ gap: 12, justifyContent: 'flex-start', paddingTop: 'clamp(14px,5vh,40px)' }}>
          <span className="eyebrow">Survivor — terminé</span>
          <div className="big-num" style={{ color: 'var(--fluo)' }}>{mine ? fmtAud(mine.score) : 0}</div>
          <h2 className="title-xl" style={{ margin: 0 }}>{mine ? `${mine.tracks} morceaux trouvés` : 'Fini'}</h2>
          {mine && <div className="gpill" style={{ color: 'var(--fluo)', borderColor: 'var(--fluo)', fontSize: 14, padding: '10px 16px' }}>Record #{mine.rank} au classement mondial</div>}
          <span className="eyebrow" style={{ marginTop: 8 }}>Top 10 mondial</span>
          <div className="board" style={{ width: '100%', maxWidth: 420 }}>
            {top.map((t: any, i: number) => (
              <div className={`prow ${i === 0 ? 'lead' : i === 1 ? 'p2' : i === 2 ? 'p3' : ''}`} key={i}>
                <span className="who" style={{ minWidth: 0 }}><span className="rk">{i + 1}</span>{t.avatar && <RMed id={t.avatar} size={26} />}<span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span></span>
                <span className="pts">{fmtAud(t.score)}</span>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>L'hôte peut relancer ou revenir au salon.</p>
        </div>
        );
      })()}

      {phase === 'final' && (() => {
        const myAwards = awards.filter((a: any) => a.playerId === meId.current);
        const multi = !!series && series.gamesPlayed >= 2;
        const st = series?.standings || [];
        const mine = st.find((s: any) => s.id === meId.current);
        const seriesRank = st.findIndex((s: any) => s.id === meId.current) + 1;
        return (
        <div className="center" style={{ gap: 14 }}>
          <span className="eyebrow">{multi ? `Partie ${series.gamesPlayed} — terminée` : 'Terminé'}</span>
          <div className="big-num" style={myRank === 1 ? { color: 'var(--fluo)' } : undefined}>{myRank === 1 ? <svg width="96" height="96" viewBox="0 0 24 24" fill="none"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" stroke="currentColor" strokeWidth="1.3" /><path d="M7 5H4v1.6A3.4 3.4 0 0 0 7.3 10M17 5h3v1.6A3.4 3.4 0 0 1 16.7 10" stroke="currentColor" strokeWidth="1.3" /><path d="M9.5 13v3.3h5V13M8 20.5h8M10.4 16.8h3.2v3.7h-3.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg> : myRank}</div>
          <h2 className="title-xl">{myRank === 1 ? 'Tu as gagné !' : `${myRank}ᵉ place`}</h2>
          <p className="muted">{fmtAud(me?.score ?? 0)} auditeurs</p>
          <div className="gpill" style={{ marginTop: 6, color: 'var(--fluo)', borderColor: 'var(--fluo)', fontSize: 14, padding: '10px 16px' }}>{certif(me?.score ?? 0, finalRounds || round.total).label}</div>

          {/* réagir sur la TV au moment du podium/trophées (jeu de réactions de fin, différent des taunts de manche) */}
          <div className="reactbar">{END_REACTIONS.map((r, i) => <button key={i} type="button" className="reactbtn" onClick={() => sendReaction(i, true)}><span className="re">{r.e}</span>{r.t}</button>)}</div>

          {myAwards.length > 0 && (
            <div className="awards" style={{ marginTop: 4 }}>
              {myAwards.map((a: any) => (
                <div className="award" key={a.id}>
                  <span className="aw-ic" dangerouslySetInnerHTML={{ __html: awardIcon(a.icon) }} />
                  <div className="aw-title">{a.title}</div>
                  <div className="aw-desc">{a.desc}</div>
                </div>
              ))}
            </div>
          )}

          {newChars.length > 0 && (
            <div className="glass pad" style={{ marginTop: 4, maxWidth: 380, borderColor: 'var(--fluo)', boxShadow: '0 0 24px -8px var(--fluo)' }}>
              <div className="eyebrow" style={{ color: 'var(--fluo)' }}>🔓 Nouveau{newChars.length > 1 ? 'x' : ''} challenger{newChars.length > 1 ? 's' : ''} débloqué{newChars.length > 1 ? 's' : ''} !</div>
              {newChars.map((id) => (
                <div key={id} className="row" style={{ gap: 8, marginTop: 6, justifyContent: 'center' }}>
                  <RMed id={id} size={30} /><b style={{ color: 'var(--txt)' }}>{avatarById(id)?.name}</b>
                </div>
              ))}
              <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>Dispo dès ton prochain choix de rappeur.</p>
            </div>
          )}

          {multi && mine && (
            <div className="series-wrap" style={{ maxWidth: 380 }}>
              <span className="eyebrow">Cumul de la série · {series.gamesPlayed} parties</span>
              <p className="muted"><b style={{ color: 'var(--txt)' }}>{fmtAud(mine.total)}</b> auditeurs au total · {seriesRank}<sup>{seriesRank === 1 ? 'er' : 'e'}</sup> sur {st.length}</p>
              <div className="gpill" style={{ color: 'var(--fluo)', borderColor: 'var(--fluo)' }}>{certif(mine.total, mine.totalRounds).short}{mine.gameWins > 0 ? ` · ${mine.gameWins} gagnée${mine.gameWins > 1 ? 's' : ''}` : ''}</div>
            </div>
          )}
          <p className="muted" style={{ fontSize: 12 }}>L'hôte peut relancer une partie — reste connecté.</p>
        </div>
        );
      })()}
    </div></>
  );
}
