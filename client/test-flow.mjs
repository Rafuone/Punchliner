import { io } from 'socket.io-client';
import { gradeAnswer } from '../server/match.js';

const URL = 'http://localhost:3001';
const conn = () => io(URL, { forceNew: true });
const emit = (s, ev, p = {}) => new Promise((r) => s.emit(ev, p, r));
const once = (s, ev) => new Promise((r) => s.once(ev, r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[test]', ...a);

(async () => {
  log('grade « au dd pnl » ->', JSON.stringify(gradeAnswer('au dd pnl', { title: 'Au DD', artist: 'PNL' })));

  // ---- MULTI : join → manche → réponse → RECONNEXION EN PLEINE MANCHE ----
  const host = conn(); await once(host, 'connect');
  const c = await emit(host, 'host:create'); log('salon', c.code, '· pool', c.poolSize);
  const p1 = conn(); await once(p1, 'connect');
  const j = await emit(p1, 'player:join', { code: c.code, name: 'Bot', avatar: 'jul' });
  const pid = j.playerId; log('join pid', pid.slice(0, 6));

  const go = once(p1, 'round:go');
  await emit(host, 'host:start', { mode: 'multi', difficulty: 'facile', rounds: 2 });
  const rg = await go; log('manche lancée · diff', rg.difficulty, '· le son joue en continu');
  const ans = await emit(p1, 'player:answer', { text: 'test' }); log('réponse ack ->', JSON.stringify(ans));

  // le joueur ferme sa fenêtre EN PLEINE MANCHE puis revient
  p1.close(); await sleep(300);
  const p1b = conn(); await once(p1b, 'connect');
  const rj = await emit(p1b, 'player:join', { code: c.code, name: 'Bot', avatar: 'jul', playerId: pid });
  log('RECONNEXION mid-manche →', rj.reconnected ? 'OK, reprise phase ' + rj.state?.phase : 'ÉCHEC');
  if (!(rj.reconnected && rj.state?.phase === 'playing' && rj.state?.round)) throw new Error('reconnexion mid-manche cassée');
  log('  → reprise avec chrono restant', Math.round((rj.state.round.endsAt - Date.now()) / 1000) + 's');
  host.close(); p1b.close();

  // ---- BUZZER + DIFFICULTÉ (rapide : mauvaise réponse → verrouillé → fin) ----
  const h2 = conn(); await once(h2, 'connect');
  const c2 = await emit(h2, 'host:create');
  const b1 = conn(); await once(b1, 'connect');
  await emit(b1, 'player:join', { code: c2.code, name: 'Buzz', avatar: 'sch' });
  const brg = once(b1, 'round:go');
  await emit(h2, 'host:start', { mode: 'buzzer', difficulty: 'puriste', rounds: 1 });
  const r = await brg; log('buzzer · mode', r.mode, '· diff', r.difficulty);
  const winP = once(b1, 'buzz:winner');
  const bz = await emit(b1, 'player:buzz'); log('buzz gagné ?', bz.winner === true);
  log('buzz:winner →', (await winP).name);
  const brev = once(b1, 'round:reveal');
  await emit(b1, 'buzzer:answer', { text: 'zzzz' });
  log('buzzer révélation:', (await brev).track.title);
  h2.close(); b1.close();

  // ---- POUVOIR (hint) : activation + 1x/partie ----
  const h3 = conn(); await once(h3, 'connect');
  const c3 = await emit(h3, 'host:create');
  const s3 = conn(); await once(s3, 'connect');
  await emit(s3, 'player:join', { code: c3.code, name: 'Solo', avatar: 'sch' }); // SCH = pouvoir "hint"
  const g3 = once(s3, 'round:go');
  await emit(h3, 'host:start', { mode: 'multi', difficulty: 'facile', rounds: 1 });
  await g3;
  const pw = await emit(s3, 'player:power');
  log('pouvoir', pw.power, '→ type', pw.type, '· indices', JSON.stringify(pw.detail?.hint));
  if (!(pw.ok && pw.detail?.hint)) throw new Error('pouvoir hint cassé');
  const pw2 = await emit(s3, 'player:power');
  log('2e activation →', pw2.error || 'PROBLÈME (devrait échouer)');
  if (!pw2.error) throw new Error('1x/partie non respecté');
  h3.close(); s3.close();

  // ---- MODE MAÎTRE DU JEU ----
  const hm = conn(); await once(hm, 'connect');
  const cm = await emit(hm, 'host:create');
  const mj = conn(); await once(mj, 'connect');
  const j1 = await emit(mj, 'player:join', { code: cm.code, name: 'MJ', avatar: 'booba' });
  const pl = conn(); await once(pl, 'connect');
  const j2 = await emit(pl, 'player:join', { code: cm.code, name: 'Joueur', avatar: 'jul' });
  const goM = once(pl, 'round:go');
  await emit(hm, 'host:start', { mode: 'multi', difficulty: 'facile', rounds: 2, mj: true });
  await goM;
  const mpw = await emit(mj, 'mj:power', { type: 'double' }); log('mj:power ×2 →', mpw.ok);
  const mnx = await emit(mj, 'mj:next'); log('mj:next hors reveal →', mnx.error || 'PROBLÈME');
  const msu = once(pl, 'scores:update');
  const maw = await emit(mj, 'mj:award', { playerId: j2.playerId }); log('mj:award +100 →', maw.ok);
  const mscores = (await msu).scores;
  const joueur = mscores.find((s) => s.id === j2.playerId);
  const mjFlag = mscores.find((s) => s.id === j1.playerId)?.isMJ;
  log('→ Joueur score après validation:', joueur?.score, '· MJ bien flaggé:', mjFlag);
  if (!(mpw.ok && mnx.error && maw.ok && joueur.score === 100 && mjFlag)) throw new Error('MJ cassé');
  hm.close(); mj.close(); pl.close();

  console.log('\n✅ V0.6 OK — reconnexion + buzzer + difficulté + pouvoirs + MAÎTRE DU JEU');
  process.exit(0);
})().catch((e) => { console.error('❌ FAIL', e.message); process.exit(1); });
setTimeout(() => { console.error('❌ TIMEOUT'); process.exit(1); }, 20000);
