// SHOWROOM v3 — banc d'essai de TOUTES les interfaces (design FINAL exact : vrais composants Host/Player
// pilotés par un mock-socket, dans un iframe dimensionné pour que les vw/vh soient fidèles).
//  ?embed=<sceneId>  → rend UNIQUEMENT le composant de la scène (ce que l'iframe charge).
//  (sans param)      → le chrome : nav des scènes + scène(s) + panneau de retours PAR PAGE (à droite).
// Vue croisée : 2 iframes (TV + téléphone) qui partagent leurs actions via postMessage (une réaction
// envoyée du téléphone APPARAÎT sur la TV) → on peut tester le feedback d'un appareil vers l'autre.
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Host from './Host';
import Player from './Player';
import { installMock, setScene } from '../showroom/mock';
import { SCENES } from '../showroom/scenes';

const params = new URLSearchParams(location.search);
const EMBED = params.get('embed');

// ── MODE EMBED : installé au chargement du module (avant que le composant monte) ──
if (EMBED) {
  const scene = SCENES.find((s) => s.id === EMBED) || SCENES[0];
  installMock();
  const st = scene.make();
  setScene(() => st);
  try {
    if (scene.comp === 'host') localStorage.setItem('pl_host', JSON.stringify({ code: st.code || 'PUNCH', hostToken: 'showroom' }));
    else if (scene.session) localStorage.setItem('pl_session', JSON.stringify(scene.session));
    else localStorage.removeItem('pl_session');
  } catch {}
}

// Scène « en face » (même moment de jeu sur l'autre appareil) pour la vue croisée.
const PAIR: Record<string, string> = {
  'tv-lobby': 'ph-form', 'tv-prep': 'ph-prep', 'tv-playing': 'ph-playing', 'tv-reveal': 'ph-reveal',
  'tv-podium': 'ph-final', 'tv-buzz-wait': 'ph-buzz', 'tv-buzz-win': 'ph-buzz', 'tv-quiz': 'ph-quiz', 'tv-survivor': 'ph-playing',
  'ph-form': 'tv-lobby', 'ph-prep': 'tv-prep', 'ph-playing': 'tv-playing', 'ph-reveal': 'tv-reveal',
  'ph-buzz': 'tv-buzz-win', 'ph-quiz': 'tv-quiz', 'ph-final': 'tv-podium', 'ph-waiting': 'tv-playing',
};

export default function Showroom() {
  if (EMBED) {
    const scene = SCENES.find((s) => s.id === EMBED) || SCENES[0];
    const bv = params.get('buzzvar'); // showroom : variante visuelle du buzz (bzv-1..5) pour itérer
    return <div className={'app' + (bv ? ' bzv-' + bv : '')}>{scene.comp === 'host' ? <Host /> : <Player />}</div>;
  }
  return <Chrome />;
}

const PH_W = 390, PH_H = 844, PH_OW = 412, PH_OH = 868; // téléphone : intérieur + cadre

function Chrome() {
  const [activeId, setActiveId] = useState(SCENES[0].id);
  const [nonce, setNonce] = useState(0);
  const [combo, setCombo] = useState(false);
  const [buzzVar, setBuzzVar] = useState(1);
  const [toast, setToast] = useState('');
  const [box, setBox] = useState({ w: 900, h: 600 });
  const [fbMap, setFbMap] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    try { for (const s of SCENES) { const v = localStorage.getItem('pl_sr_fb_' + s.id); if (v) m[s.id] = v; } } catch {}
    return m;
  });
  const stageRef = useRef<HTMLDivElement>(null);
  const tvRef = useRef<HTMLIFrameElement>(null);

  const scene = SCENES.find((s) => s.id === activeId) || SCENES[0];
  const isPhone = scene.group === 'phone';
  const tvId = isPhone ? PAIR[activeId] : activeId;
  const phId = isPhone ? activeId : PAIR[activeId];
  const src = (id: string) => `${location.pathname}?embed=${id}&n=${nonce}${id === 'ph-buzz' && buzzVar ? '&buzzvar=' + buzzVar : ''}`;
  const fb = fbMap[activeId] || '';
  const showBuzzIter = (isPhone ? activeId : (combo ? phId : '')) === 'ph-buzz'; // le buzz téléphone est affiché → picker d'itérations

  const tvScenes = SCENES.filter((s) => s.group === 'tv');
  const phScenes = SCENES.filter((s) => s.group === 'phone');

  // dimensions de la zone scène (pour remplir au mieux)
  useLayoutEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // vue croisée : relaie l'action d'un appareil vers l'autre iframe (TV)
  useEffect(() => {
    function onMsg(e: any) {
      const d = e && e.data; if (!d || d.__sr !== 'relay') return;
      const win = tvRef.current && tvRef.current.contentWindow; if (!win) return;
      const me = { name: 'Rafuo', avatar: 'disiz' };
      if (d.event === 'player:reaction') win.postMessage({ __sr: 'deliver', event: 'reaction', payload: { id: Number(d.payload && d.payload.id) || 0, ...me, end: !!(d.payload && d.payload.end) } }, '*');
      else if (d.event === 'player:buzz') win.postMessage({ __sr: 'deliver', event: 'buzz:winner', payload: { id: 'me', ...me, endsAt: Date.now() + 15000, answerMs: 15000, serverNow: Date.now() } }, '*');
      else if (d.event === 'player:power') win.postMessage({ __sr: 'deliver', event: 'power:used', payload: { ...me, power: 'Vol', effect: '−12 000 auditeurs à MoMo' } }, '*');
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  function pick(id: string) { setActiveId(id); setNonce((n) => n + 1); setToast(''); }
  function setFb(v: string) {
    setFbMap((m) => ({ ...m, [activeId]: v }));
    try { if (v) localStorage.setItem('pl_sr_fb_' + activeId, v); else localStorage.removeItem('pl_sr_fb_' + activeId); } catch {}
  }
  async function post() {
    const text = fb.trim(); if (!text) return;
    try {
      const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: activeId, label: scene.label, text }) });
      if (!r.ok) throw new Error();
      setToast('Enregistré dans RETOURS-SHOWROOM.md ✓'); setFb('');
    } catch {
      const md = `\n### ${scene.label}  \`[${activeId}]\`\n${text}\n`;
      try { localStorage.setItem('pl_showroom_fb', (localStorage.getItem('pl_showroom_fb') || '# Retours showroom\n') + md); } catch {}
      setToast('Serveur absent → gardé en local (↓)'); setFb('');
    }
    setTimeout(() => setToast(''), 4000);
  }
  function download() {
    const md = localStorage.getItem('pl_showroom_fb') || '# Retours showroom\n(aucun retour local)';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    a.download = 'RETOURS-SHOWROOM.md'; a.click();
  }

  // ── calcul des tailles pour REMPLIR la zone ──
  const gap = 14, pad = 6;
  const availW = box.w - pad * 2, availH = box.h - pad * 2;
  let tv = { w: 0, h: 0 }, phScale = 1;
  if (combo) {
    phScale = Math.min(1, availH / PH_OH, (availW * 0.4) / PH_OW);
    const phW = PH_OW * phScale;
    const tvBoxW = Math.max(200, availW - phW - gap);
    tv.w = Math.min(tvBoxW, availH * 16 / 9); tv.h = tv.w * 9 / 16;
  } else if (isPhone) {
    phScale = Math.min(1, availH / PH_OH, availW / PH_OW);
  } else {
    tv.w = Math.min(availW, availH * 16 / 9); tv.h = tv.w * 9 / 16;
  }
  const phW = PH_OW * phScale, phH = PH_OH * phScale;

  const TVFrame = () => (
    <div className="sr-tvwrap" style={{ width: tv.w, height: tv.h }}>
      <iframe ref={tvRef} key={'tv' + nonce} title="tv" src={src(tvId)} className="sr-tv" frameBorder={0} />
    </div>
  );
  const PhoneFrame = () => (
    <div className="sr-phone-slot" style={{ width: phW, height: phH }}>
      <div className="sr-phone" style={{ transform: `scale(${phScale})` }}>
        <iframe key={'ph' + nonce} title="phone" src={src(phId)} frameBorder={0} />
      </div>
    </div>
  );

  return (
    <div className="sr">
      <style>{CSS}</style>
      <aside className="sr-nav">
        <div className="sr-brand">PUNCHLINR · <span>Showroom</span></div>
        <div className="sr-grp">📺 Écran / TV</div>
        {tvScenes.map((s) => <button key={s.id} className={'sr-item' + (s.id === activeId ? ' on' : '')} onClick={() => pick(s.id)}>{s.label}</button>)}
        <div className="sr-grp">📱 Téléphone</div>
        {phScenes.map((s) => <button key={s.id} className={'sr-item' + (s.id === activeId ? ' on' : '')} onClick={() => pick(s.id)}>{s.label}</button>)}
        <div className="sr-foot">Vraies pages, hors-ligne. Audio & enregistrement des retours : lance le serveur (<code>npm run dev</code>).</div>
      </aside>

      <main className="sr-stage">
        <div className="sr-top">
          <div className="sr-title">{scene.label}{scene.note && <span className="sr-note"> — {scene.note}</span>}</div>
          <div className="sr-actions">
            {PAIR[activeId] && <button className={'sr-btn' + (combo ? ' on' : '')} onClick={() => setCombo((c) => !c)}>{combo ? '✕ Vue croisée' : (isPhone ? '＋ Voir la TV' : '＋ Voir le téléphone')}</button>}
            <button className="sr-btn" onClick={() => setNonce((n) => n + 1)}>↻ Rejouer l'anim</button>
          </div>
        </div>

        <div className="sr-stagebox" ref={stageRef}>
          {combo
            ? <div className="sr-combo">{isPhone ? <><TVFrame /><PhoneFrame /></> : <><TVFrame /><PhoneFrame /></>}</div>
            : (isPhone ? <PhoneFrame /> : <TVFrame />)}
        </div>
      </main>

      <aside className="sr-fb">
        {showBuzzIter && (
          <div className="sr-iter">
            <div className="sr-iterlabel">Itérations du buzz (choisis)</div>
            <div className="sr-iterbtns">{[1, 2, 3, 4, 5].map((v) => <button key={v} className={'sr-iterbtn' + (buzzVar === v ? ' on' : '')} onClick={() => { setBuzzVar(v); setNonce((n) => n + 1); }}>{v}</button>)}</div>
          </div>
        )}
        <div className="sr-fbhead">Retour sur <b>{scene.label}</b></div>
        <textarea value={fb} onChange={(e) => setFb(e.target.value)} placeholder={`Mise en page, tailles, lisibilité, animations… Chaque page a son propre bloc, gardé même si tu changes d'écran. → RETOURS-SHOWROOM.md`} />
        <div className="sr-fbrow">
          <button className="sr-post" onClick={post} disabled={!fb.trim()}>Poster →</button>
          <button className="sr-dl" onClick={download} title="Télécharger les retours gardés en local">↓ .md</button>
        </div>
        {toast && <div className="sr-toast">{toast}</div>}
        <div className="sr-fbhint">Astuce : en <b>vue croisée</b>, une réaction / un buzz / un pouvoir envoyé depuis le téléphone apparaît sur la TV.</div>
      </aside>
    </div>
  );
}

const CSS = `
.sr{position:fixed;inset:0;display:flex;background:#0b0c0e;color:#eef0ee;font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.sr-nav{flex:0 0 208px;background:#121317;border-right:1px solid #23262c;overflow-y:auto;padding:12px 10px;display:flex;flex-direction:column;gap:2px}
.sr-brand{font-weight:800;letter-spacing:.02em;margin-bottom:8px;font-size:14px}
.sr-brand span{color:#a6ff00}
.sr-grp{margin:12px 4px 4px;font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8a9099}
.sr-item{text-align:left;background:transparent;border:1px solid transparent;color:#d6d9d4;border-radius:7px;padding:8px 10px;font-size:12.5px;cursor:pointer}
.sr-item:hover{background:#1a1c21}
.sr-item.on{background:#20240c;border-color:#4a5a00;color:#d9ffb0;font-weight:700}
.sr-foot{margin-top:auto;padding:10px 6px 2px;font-size:10.5px;color:#7d838c}
.sr-foot code{color:#a6ff00}
.sr-stage{flex:1;min-width:0;display:flex;flex-direction:column;padding:12px 14px;gap:10px}
.sr-top{display:flex;align-items:center;gap:12px;justify-content:space-between;flex:0 0 auto}
.sr-title{font-size:15px;font-weight:700}
.sr-note{color:#9aa0a6;font-weight:400;font-size:12.5px}
.sr-actions{display:flex;gap:8px;flex:0 0 auto}
.sr-btn{background:#1a1c21;border:1px solid #2c3038;color:#d6d9d4;border-radius:8px;padding:7px 12px;font-size:12.5px;cursor:pointer;white-space:nowrap}
.sr-btn:hover{border-color:#a6ff00;color:#a6ff00}
.sr-btn.on{background:#20240c;border-color:#4a5a00;color:#d9ffb0}
.sr-stagebox{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
.sr-combo{display:flex;align-items:center;justify-content:center;gap:14px;width:100%;height:100%}
.sr-tvwrap{background:#000;border:1px solid #23262c;border-radius:10px;overflow:hidden;box-shadow:0 14px 50px rgba(0,0,0,.5);flex:0 0 auto}
.sr-tv{width:100%;height:100%;border:0;background:#0f0f10;display:block}
.sr-phone-slot{flex:0 0 auto;position:relative}
.sr-phone{width:412px;height:868px;padding:11px;background:#1c1e22;border-radius:46px;border:1px solid #2c3038;box-shadow:0 14px 50px rgba(0,0,0,.5);position:relative;transform-origin:top left}
.sr-phone:before{content:"";position:absolute;top:22px;left:50%;transform:translateX(-50%);width:120px;height:22px;background:#1c1e22;border-radius:0 0 16px 16px;z-index:2}
.sr-phone iframe{width:390px;height:844px;border:0;border-radius:36px;background:#0e0f11;display:block}
.sr-fb{flex:0 0 340px;background:#121317;border-left:1px solid #23262c;padding:14px 13px;display:flex;flex-direction:column;gap:9px}
.sr-fbhead{font-size:13px;color:#9aa0a6}
.sr-fbhead b{color:#eef0ee}
.sr-fb textarea{flex:1;min-height:180px;resize:none;background:#0e0f11;border:1px solid #2c3038;border-radius:9px;color:#eef0ee;padding:11px 12px;font:13.5px/1.5 inherit}
.sr-fb textarea:focus{outline:none;border-color:#4a5a00}
.sr-fbrow{display:flex;align-items:center;gap:9px}
.sr-post{flex:1;background:#a6ff00;color:#0b0c0e;border:0;border-radius:8px;padding:10px 16px;font-weight:800;font-size:13.5px;cursor:pointer}
.sr-post:disabled{opacity:.4;cursor:default}
.sr-dl{background:#1a1c21;border:1px solid #2c3038;color:#d6d9d4;border-radius:8px;padding:10px 12px;font-size:12.5px;cursor:pointer}
.sr-toast{color:#a6ff00;font-size:12.5px}
.sr-fbhint{margin-top:auto;font-size:11px;color:#7d838c;border-top:1px solid #23262c;padding-top:9px}
.sr-iter{background:#0e0f11;border:1px solid #2c3038;border-radius:9px;padding:9px 10px}
.sr-iterlabel{font-size:10.5px;color:#9aa0a6;margin-bottom:7px;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
.sr-iterbtns{display:flex;gap:6px}
.sr-iterbtn{flex:1;background:#1a1c21;border:1px solid #2c3038;color:#d6d9d4;border-radius:7px;padding:9px 0;font-size:14px;font-weight:800;cursor:pointer}
.sr-iterbtn:hover{border-color:#a6ff00}
.sr-iterbtn.on{background:#a6ff00;color:#0b0c0e;border-color:#a6ff00}
`;
