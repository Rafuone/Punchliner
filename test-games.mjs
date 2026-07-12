// Campagne de test d'intégration HEADLESS (socket.io-client) — joue de VRAIES parties contre le serveur
// (port 3001) sur toutes les combinaisons difficulté × longueur × mode, active TOUS les pouvoirs, répond
// (réponses correctes via /api/dev/answer pour exercer le scoring + les bonus), et vérifie que chaque
// partie va au bout (final), scores sains, aucune erreur serveur. Teste aussi reconnexion + late-join.
//   Lancer :  node test-games.mjs      (le serveur doit tourner)
import { io } from 'socket.io-client';
import fs from 'node:fs';
const out = (s = '') => fs.writeSync(1, s + '\n'); // écriture DIRECTE sur stdout (pas de buffer en arrière-plan)

const URL = process.env.TEST_URL || 'http://localhost:3001';
const answerApi = (code) => `${URL}/api/dev/answer?code=${encodeURIComponent(code)}`;

// avatars couvrant TOUS les types de pouvoir (surtout les nouveaux : tax/allin/draft/combo/sustain/steal faible)
const POOL = ['rohff','jolagreen23','bouss','ninho','jewelusain','kortex','ntm','sch','orelsan','fabe',
  'medine','oxmo','vald','laylow','pnl','damso','gims','alphawann','solaar','plk','gazo','youssoupha',
  'bilaldu92','alexdu76','okis','huntrill','junglejack','lafeve','kaaris','iam','booba','nekfeu'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function connect() { return io(URL, { transports: ['websocket'], forceNew: true, reconnection: false }); }
function onConnect(s) { return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('no connect')), 5000); s.once('connect', () => { clearTimeout(t); res(); }); }); }
function ack(s, ev, payload = {}, ms = 6000) {
  return new Promise((res) => { let done = false; const t = setTimeout(() => { if (!done) { done = true; res({ error: 'ack-timeout ' + ev }); } }, ms);
    s.emit(ev, payload, (r) => { if (!done) { done = true; clearTimeout(t); res(r || {}); } }); });
}
async function fetchAnswer(code) { try { const r = await fetch(answerApi(code)); return await r.json(); } catch { return {}; } }

// pouvoirs dont l'échec d'activation est NORMAL (rien à faire dans la situation) → pas une vraie erreur
const SOFT = /charge|traîne|remonter|voler|museler|clasher|taxer|déjà|Pas le moment|pas assez/i;

let AV_CURSOR = 0;
function nextAvatars(n) { const a = []; for (let i = 0; i < n; i++) a.push(POOL[(AV_CURSOR + i) % POOL.length]); AV_CURSOR = (AV_CURSOR + n) % POOL.length; return a; }

async function playGame({ mode, difficulty, rounds, mj = false }, nPlayers = 5) {
  const avatars = nextAvatars(nPlayers);
  const rep = { label: `${mode}${mj ? '/MJ' : ''} · ${difficulty} · ${rounds}m`, revealCount: 0, powerErrors: [], errors: [], final: null, ok: false, activated: new Set() };
  const host = connect(); await onConnect(host).catch((e) => rep.errors.push('host ' + e.message));
  const created = await ack(host, 'host:create', {});
  const code = created.code;
  if (!code) { rep.errors.push('host:create KO ' + JSON.stringify(created)); host.close(); return rep; }

  const players = [];
  for (let i = 0; i < avatars.length; i++) {
    const s = connect(); await onConnect(s).catch(() => {});
    const res = await ack(s, 'player:join', { code, name: 'P' + i, avatar: avatars[i] });
    if (!res?.ok) rep.errors.push(`join ${avatars[i]} KO: ${res?.error}`);
    const P = { sock: s, id: res?.playerId, avatar: avatars[i], isMj: mj && i === 0 };
    players.push(P);

    // ---- fenêtre pouvoirs (modes à pouvoirs) : on ACTIVE (ou on passe si rien à faire) ----
    s.on('round:prep', async () => {
      const r = await ack(s, 'player:power', {});
      if (r?.ok) rep.activated.add(avatars[i]);
      else { if (r?.error && !SOFT.test(r.error)) rep.powerErrors.push(`${avatars[i]}: ${r.error}`); await ack(s, 'player:ready', {}); }
    });
    // ---- en jeu : on répond ----
    s.on('round:go', async () => {
      if (P.isMj) return; // le MJ n'a pas de saisie (il distribue à la voix)
      if (mode === 'quiz') { await ack(s, 'quiz:answer', { choice: Math.floor(Math.random() * 4) }); return; }
      if (mode === 'buzzer') {
        const bz = await ack(s, 'player:buzz', {});
        if (bz?.winner) { const a = await fetchAnswer(code); await ack(s, 'buzzer:answer', { text: (Math.random() < 0.75 && a.title) ? a.title : 'zzz' }); }
        return;
      }
      const a = await fetchAnswer(code); // multi : réponse correcte 70% du temps → exerce scoring + bonus
      const text = (Math.random() < 0.7 && a.title) ? (a.title + (Math.random() < 0.5 && a.artist ? ' ' + a.artist : '')) : 'zzz';
      await ack(s, 'player:answer', { text });
    });
  }

  // ---- pilotage de la révélation / manche suivante ----
  const mjDriver = players.find((p) => p.isMj);
  let finalData = null;
  const finalP = new Promise((resolve) => host.once('game:final', (d) => { finalData = d; resolve(d); }));

  if (mj && mjDriver) {
    // MJ : le pupitre distribue les points, révèle, puis passe
    mjDriver.sock.on('mj:track', async () => {
      await sleep(120);
      for (const p of players) if (!p.isMj) await ack(mjDriver.sock, 'mj:award', { playerId: p.id, points: Math.random() < 0.5 ? 10000 : 0 });
      await ack(mjDriver.sock, 'mj:reveal', {});
    });
    mjDriver.sock.on('round:reveal', async () => { rep.revealCount++; await sleep(120); await ack(mjDriver.sock, 'mj:next', {}); });
  } else {
    host.on('round:reveal', async () => { rep.revealCount++; await sleep(120); host.emit('host:next'); });
    host.on('battle:reveal', () => host.emit('host:next')); // clash auto (1/partie) : enchaîne après la révélation du duel (le clash n'émet PAS round:reveal → revealCount reste juste)
  }

  const start = await ack(host, 'host:start', { rounds, difficulty, mode, mj, mjId: mj ? mjDriver?.id : undefined, rebalance: 'comeback' }, 8000);
  if (start?.error) { rep.errors.push('host:start: ' + start.error); players.forEach((p) => p.sock.close()); host.close(); return rep; }

  await Promise.race([finalP, sleep(rounds * 5000 + 25000)]);

  if (!finalData) rep.errors.push('PAS de game:final (partie bloquée ?)');
  else {
    const sc = finalData.scores || [];
    rep.final = sc.map((p) => ({ n: p.name, av: p.avatar, s: p.score }));
    if (rep.revealCount !== rounds) rep.errors.push(`manches révélées ${rep.revealCount} ≠ ${rounds}`);
    if (sc.some((p) => p.score < 0)) rep.errors.push('SCORE NÉGATIF');
    if (mode !== 'buzzer' && !mj && !sc.some((p) => p.score > 0)) rep.errors.push('personne n a marqué');
  }
  rep.ok = rep.errors.length === 0;
  players.forEach((p) => p.sock.close()); host.close();
  return rep;
}

// ---- tests spéciaux : reconnexion + late-join ----
async function testReconnectAndLateJoin() {
  const out = { name: 'reconnexion + late-join', errors: [], ok: false };
  const host = connect(); await onConnect(host).catch(() => {});
  const { code } = await ack(host, 'host:create', {});
  // joueur A rejoint
  const a = connect(); await onConnect(a); const ja = await ack(a, 'player:join', { code, name: 'Alice', avatar: 'booba' });
  if (!ja?.ok) out.errors.push('join A KO');
  // démarre une partie (multi, 6 manches)
  host.on('round:reveal', () => setTimeout(() => host.emit('host:next'), 100));
  host.on('battle:reveal', () => setTimeout(() => host.emit('host:next'), 100)); // clash auto : enchaîne après le duel
  a.on('round:prep', () => a.emit('player:ready', {}));
  a.on('round:go', async () => { const ans = await fetchAnswer(code); a.emit('player:answer', { text: ans.title || 'x' }); });
  await ack(host, 'host:start', { rounds: 6, difficulty: 'normal', mode: 'multi', mj: false, rebalance: 'comeback' });
  await sleep(1500);
  // A "ferme le navigateur" (déconnexion) puis revient (reconnexion par playerId) EN PLEINE PARTIE
  a.close(); await sleep(600);
  const a2 = connect(); await onConnect(a2);
  const rj = await ack(a2, 'player:join', { code, name: 'Alice', avatar: 'booba', playerId: ja.playerId });
  if (!rj?.ok || !rj?.reconnected) out.errors.push('reconnexion mid-game KO: ' + JSON.stringify({ ok: rj?.ok, rec: rj?.reconnected, err: rj?.error }));
  a2.on('round:prep', () => a2.emit('player:ready', {}));
  a2.on('round:go', async () => { const ans = await fetchAnswer(code); a2.emit('player:answer', { text: ans.title || 'x' }); });
  // late-join NOUVEAU en cours de partie → ACCEPTÉ mais mis en SALLE D'ATTENTE (rejoint à la prochaine partie)
  const b = connect(); await onConnect(b);
  const jb = await ack(b, 'player:join', { code, name: 'Bob', avatar: 'iam' });
  if (!jb?.ok) out.errors.push('late-join NOUVEAU refusé (devrait être accepté en attente): ' + jb?.error);
  else if (!jb?.waiting) out.errors.push('late-join NOUVEAU accepté mais pas marqué « en attente »');
  const fin = await Promise.race([new Promise((r) => host.once('game:final', r)), sleep(40000)]);
  // le joueur en attente ne doit PAS entrer dans les scores de la partie déjà lancée
  if (fin && Array.isArray(fin.scores) && fin.scores.some((s) => s.id === jb.playerId)) out.errors.push('le joueur en attente ne doit pas apparaître dans les scores de la partie en cours');
  out.ok = out.errors.length === 0;
  a2.close(); b.close(); host.close();
  return out;
}

async function testLateJoinLobby() {
  const out = { name: 'late-join pendant le lobby', errors: [], ok: false };
  const host = connect(); await onConnect(host);
  const { code } = await ack(host, 'host:create', {});
  await sleep(300); // "quelques instants après la création"
  const p = connect(); await onConnect(p);
  const j = await ack(p, 'player:join', { code, name: 'Tardif', avatar: 'gazo' });
  if (!j?.ok) out.errors.push('join tardif en lobby KO: ' + j?.error);
  out.ok = out.errors.length === 0;
  p.close(); host.close();
  return out;
}

// ---- série multi-parties : cumul d'auditeurs + trophées de fin ----
async function testSeriesAndAwards() {
  const out = { name: 'série multi-parties + trophées', errors: [], ok: false };
  const host = connect(); await onConnect(host);
  const { code } = await ack(host, 'host:create', {});
  const avs = nextAvatars(2);
  const socks = [];
  for (let i = 0; i < 2; i++) {
    const s = connect(); await onConnect(s);
    await ack(s, 'player:join', { code, name: 'P' + i, avatar: avs[i] });
    s.on('round:prep', () => s.emit('player:ready', {}));
    // P0 répond juste (titre+artiste) → il gagne ; P1 répond à côté
    s.on('round:go', async () => { const a = await fetchAnswer(code); s.emit('player:answer', { text: (i === 0 && a.title) ? (a.title + (a.artist ? ' ' + a.artist : '')) : 'zzz' }); });
    socks.push(s);
  }
  host.on('round:reveal', () => setTimeout(() => host.emit('host:next'), 100));
  host.on('battle:reveal', () => setTimeout(() => host.emit('host:next'), 100)); // clash auto : enchaîne après le duel
  async function oneGame(rounds) {
    const p = new Promise((r) => host.once('game:final', r));
    const st = await ack(host, 'host:start', { rounds, difficulty: 'facile', mode: 'multi', mj: false, rebalance: 'comeback' }, 8000);
    if (st?.error) { out.errors.push('host:start: ' + st.error); return null; }
    return await Promise.race([p, sleep(rounds * 5000 + 20000)]);
  }
  const g1 = await oneGame(4);
  if (!g1) out.errors.push('partie 1 : pas de game:final');
  else {
    if (!Array.isArray(g1.awards)) out.errors.push('partie 1 : awards manquant');
    if (!g1.series || g1.series.gamesPlayed !== 1) out.errors.push('partie 1 : gamesPlayed ≠ 1 (' + g1.series?.gamesPlayed + ')');
  }
  await ack(host, 'host:restart', {}); await sleep(300);
  const g2 = await oneGame(4);
  if (!g2) out.errors.push('partie 2 : pas de game:final');
  else {
    if (!g2.series || g2.series.gamesPlayed !== 2) out.errors.push('partie 2 : gamesPlayed ≠ 2 (' + g2.series?.gamesPlayed + ')');
    const stds = g2.series?.standings || [];
    if (!stds.length || !stds.every((p) => p.totalRounds === 8)) out.errors.push('cumul de manches ≠ 8 : ' + JSON.stringify(stds.map((p) => p.totalRounds)));
    if (!(stds[0]?.total > 0)) out.errors.push('cumul d\'auditeurs nul');
    if (stds.reduce((n, p) => n + (p.gameWins || 0), 0) < 1) out.errors.push('aucune victoire de partie comptabilisée');
  }
  out.ok = out.errors.length === 0;
  host.off('round:reveal'); socks.forEach((s) => s.close()); host.close();
  return out;
}

async function main() {
  const results = [];
  const diffs = ['facile', 'normal', 'difficile']; // facile / moyen / difficile
  const lengths = [4, 10, 16]; // court / moyen / long
  out('=== Campagne de test PUNCHLINR — parties réelles contre le serveur ===\n');

  // 1) Blind test (multi) : facile/moyen/difficile × court/moyen/long
  for (const difficulty of diffs) for (const rounds of lengths) {
    const r = await playGame({ mode: 'multi', difficulty, rounds });
    results.push(r); log(r);
  }
  // 2) Puriste · Buzzer · Quiz · Maître du jeu
  for (const cfg of [
    { mode: 'multi', difficulty: 'puriste', rounds: 8 },   // la difficulté la + dure
    { mode: 'buzzer', difficulty: 'normal', rounds: 6 },
    { mode: 'buzzer', difficulty: 'difficile', rounds: 6 },
    { mode: 'quiz', difficulty: 'normal', rounds: 6 },
    { mode: 'quiz', difficulty: 'facile', rounds: 8 },
    { mode: 'multi', difficulty: 'normal', rounds: 6, mj: true },
  ]) { const r = await playGame(cfg); results.push(r); log(r); }

  // 3) reconnexion + late-join + série multi-parties/trophées
  const rc = await testReconnectAndLateJoin(); logSpecial(rc);
  const lj = await testLateJoinLobby(); logSpecial(lj);
  const sa = await testSeriesAndAwards(); logSpecial(sa);

  const allPowers = new Set(results.flatMap((r) => [...r.activated]));
  const failed = results.filter((r) => !r.ok).length + (rc.ok ? 0 : 1) + (lj.ok ? 0 : 1) + (sa.ok ? 0 : 1);
  out(`\n=== BILAN : ${results.length + 3} tests · ${failed} échec(s) ===`);
  out(`Pouvoirs activés au moins une fois : ${allPowers.size}/${POOL.length}`);
  const missing = POOL.filter((a) => !allPowers.has(a));
  if (missing.length) out(`(non activés — souvent "rien à faire" : ${missing.join(', ')})`);
  process.exit(failed ? 1 : 0);
}
function log(r) {
  const tag = r.ok ? 'OK ' : 'KO ';
  out(`[${tag}] ${r.label.padEnd(26)} · ${r.revealCount} manches` +
    (r.powerErrors.length ? ` · POWER-ERR: ${r.powerErrors.slice(0, 3).join(' | ')}` : '') +
    (r.errors.length ? `  >> ${r.errors.join(' ; ')}` : ''));
}
function logSpecial(r) { out(`[${r.ok ? 'OK ' : 'KO '}] ${r.name}` + (r.errors.length ? `  >> ${r.errors.join(' ; ')}` : '')); }

main().catch((e) => { out("CRASH harnais: " + (e && e.stack || e)); process.exit(2); });
