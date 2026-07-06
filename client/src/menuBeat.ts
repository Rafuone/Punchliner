// Beat lo-fi boom-bap SYNTHÉTISÉ (Web Audio API) — 100 % libre de droit (généré à la volée, aucun
// fichier, aucun sample). Joué en fond BAS sur le lobby de l'hôte (l'écran avec le code), pour ne
// PAS spoiler le son de Bishok qui, lui, ouvre la vraie playlist du menu (ConfigWizard).
export function createMenuBeat() {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let timer: any = null;
  let nextTime = 0;
  let step = 0;
  const BPM = 84;
  const stepDur = 60 / BPM / 4; // double-croches
  // patterns boom-bap sur 16 pas
  const KICK  = [1,0,0,0, 0,0,0,1, 0,0,1,0, 0,0,0,0];
  const SNARE = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0];
  const HAT   = [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1];

  function ensure() {
    if (ctx) return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.4);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; // bruit blanc réutilisé (snare/hat)
  }
  function kick(t: number) {
    if (!ctx || !master) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.24);
  }
  function snare(t: number) {
    if (!ctx || !master || !noiseBuf) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t + 0.2);
    const o = ctx.createOscillator(), og = ctx.createGain(); // petit corps tonal
    o.type = 'triangle'; o.frequency.value = 180;
    og.gain.setValueAtTime(0.3, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.13);
  }
  function hat(t: number) {
    if (!ctx || !master || !noiseBuf) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(hp); hp.connect(g); g.connect(master); s.start(t); s.stop(t + 0.05);
  }
  function tick() {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.12) { // scheduler à lookahead
      if (KICK[step]) kick(nextTime);
      if (SNARE[step]) snare(nextTime);
      if (HAT[step]) hat(nextTime);
      nextTime += stepDur; step = (step + 1) % 16;
    }
  }
  return {
    start() {
      ensure(); if (!ctx || !master) return;
      ctx.resume?.();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.13, ctx.currentTime + 0.9); // volume BAS
      if (!timer) { nextTime = ctx.currentTime + 0.06; step = 0; timer = setInterval(tick, 25); }
    },
    stop() {
      if (ctx && master) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      }
      if (timer) { const tm = timer; timer = null; setTimeout(() => clearInterval(tm), 350); }
    },
  };
}
