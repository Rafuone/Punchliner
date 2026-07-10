// SHOWROOM v4 — banc d'essai de TOUTES les interfaces (vrais composants Host/Player pilotés par un
// mock-socket, dans un iframe dimensionné pour que les vw/vh soient fidèles).
//  ?embed=<sceneId>  → rend UNIQUEMENT le composant de la scène (ce que l'iframe charge).
//  (sans param)      → le chrome : nav des scènes + scène(s) + panneau de retours PAR PAGE (à droite).
// - Le panneau de retours est un composant ISOLÉ (FeedbackPanel) : taper N'IMPACTE PLUS le rendu de la
//   scène à gauche (plus de reload d'anim à chaque frappe).
// - Ciblage de zone (🎯) : on clique un élément dans la scène → sa référence s'ajoute au retour.
// - Vue croisée : 2 iframes qui partagent leurs actions via postMessage (réaction tél → apparaît TV).
import { useState, useEffect, useRef, useLayoutEffect, memo } from 'react';
import Host from './Host';
import Player from './Player';
import { installMock, setScene } from '../showroom/mock';
import { SCENES } from '../showroom/scenes';

const params = new URLSearchParams(location.search);
const EMBED = params.get('embed');

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

const PAIR: Record<string, string> = {
  'tv-lobby': 'ph-form', 'tv-prep': 'ph-prep', 'tv-playing': 'ph-playing', 'tv-reveal': 'ph-reveal',
  'tv-podium': 'ph-final', 'tv-buzz-wait': 'ph-buzz', 'tv-buzz-win': 'ph-buzz', 'tv-quiz': 'ph-quiz', 'tv-survivor': 'ph-playing',
  'ph-form': 'tv-lobby', 'ph-prep': 'tv-prep', 'ph-playing': 'tv-playing', 'ph-reveal': 'tv-reveal',
  'ph-buzz': 'tv-buzz-win', 'ph-quiz': 'tv-quiz', 'ph-final': 'tv-podium', 'ph-waiting': 'tv-playing',
};

export default function Showroom() {
  if (EMBED) {
    const scene = SCENES.find((s) => s.id === EMBED) || SCENES[0];
    const bv = params.get('buzzvar');
    return <div className={'app' + (bv ? ' bzv-' + bv : '')}>{scene.comp === 'host' ? <Host /> : <Player />}</div>;
  }
  return <Chrome />;
}

const PH_OW = 412, PH_OH = 868;
const fbKey = (id: string) => 'pl_sr_fb_' + id;

// ─── Panneau de retours ISOLÉ : son propre state → taper ne re-rend PAS la scène ───
const FeedbackPanel = memo(function FeedbackPanel({ sceneId, label }: { sceneId: string; label: string }) {
  const [text, setText] = useState(() => { try { return localStorage.getItem(fbKey(sceneId)) || ''; } catch { return ''; } });
  const [toast, setToast] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  function update(v: string) {
    setText(v);
    try { if (v) localStorage.setItem(fbKey(sceneId), v); else localStorage.removeItem(fbKey(sceneId)); } catch {}
    window.dispatchEvent(new CustomEvent('sr-fb-change'));
  }
  // le ciblage de zone (🎯) ajoute une référence au retour de la page courante
  useEffect(() => {
    const onTarget = (e: any) => {
      const ref = e.detail as string; if (!ref) return;
      setText((t) => { const nt = (t ? t.replace(/\s*$/, '') + '\n' : '') + ref; try { localStorage.setItem(fbKey(sceneId), nt); } catch {} return nt; });
      window.dispatchEvent(new CustomEvent('sr-fb-change'));
      const ta = taRef.current; if (ta) { ta.focus(); ta.scrollTop = ta.scrollHeight; }
    };
    window.addEventListener('sr-target', onTarget);
    return () => window.removeEventListener('sr-target', onTarget);
  }, [sceneId]);

  async function post() {
    const t = text.trim(); if (!t) return;
    try {
      const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: sceneId, label, text: t }) });
      if (!r.ok) throw new Error();
      setToast('Enregistré dans RETOURS-SHOWROOM.md ✓'); update('');
    } catch {
      const md = `\n### ${label}  \`[${sceneId}]\`\n${t}\n`;
      try { localStorage.setItem('pl_showroom_fb', (localStorage.getItem('pl_showroom_fb') || '# Retours showroom\n') + md); } catch {}
      setToast('Serveur absent → gardé en local (↓)'); update('');
    }
    setTimeout(() => setToast(''), 4000);
  }
  function download() {
    const md = localStorage.getItem('pl_showroom_fb') || '# Retours showroom\n(aucun retour local)';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    a.download = 'RETOURS-SHOWROOM.md'; a.click();
  }

  return (
    <>
      <div className="sr-fbhead">Retour sur <b>{label}</b></div>
      <textarea ref={taRef} value={text} onChange={(e) => update(e.target.value)} placeholder={'Mise en page, tailles, lisibilité, animations…\nChaque page a son propre bloc (gardé au changement d’écran).\nAstuce : clique 🎯 puis un élément pour cibler une zone précise.'} />
      <div className="sr-fbrow">
        <button className="sr-post" onClick={post} disabled={!text.trim()}>Poster →</button>
        <button className="sr-dl" onClick={download} title="Télécharger les retours gardés en local">↓ .md</button>
      </div>
      {toast && <div className="sr-toast">{toast}</div>}
    </>
  );
});

function Chrome() {
  const [activeId, setActiveId] = useState(SCENES[0].id);
  const [nonce, setNonce] = useState(0);
  const [combo, setCombo] = useState(false);
  const [buzzVar, setBuzzVar] = useState(4);
  const [target, setTarget] = useState(false);
  const [box, setBox] = useState({ w: 900, h: 600 });
  const [, force] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const tvRef = useRef<HTMLIFrameElement>(null);

  const scene = SCENES.find((s) => s.id === activeId) || SCENES[0];
  const isPhone = scene.group === 'phone';
  const tvId = isPhone ? PAIR[activeId] : activeId;
  const phId = isPhone ? activeId : PAIR[activeId];
  const src = (id: string) => `${location.pathname}?embed=${id}&n=${nonce}${id === 'ph-buzz' ? '&buzzvar=' + buzzVar : ''}`;
  const showBuzzIter = (isPhone ? activeId : (combo ? phId : '')) === 'ph-buzz';
  const hasFb = (id: string) => { try { return !!localStorage.getItem(fbKey(id)); } catch { return false; } };

  const tvScenes = SCENES.filter((s) => s.group === 'tv');
  const phScenes = SCENES.filter((s) => s.group === 'phone');

  useLayoutEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => { const h = () => force((n) => n + 1); window.addEventListener('sr-fb-change', h); return () => window.removeEventListener('sr-fb-change', h); }, []);

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

  // ── CIBLAGE DE ZONE : injecte un surlignage + capture le clic dans les iframes ──
  useEffect(() => {
    if (!target) return;
    const cleanups: Array<() => void> = [];
    const wire = () => {
      const bx = stageRef.current; if (!bx) return;
      bx.querySelectorAll('iframe').forEach((ifr: any) => {
        const doc = ifr.contentDocument; if (!doc || !doc.body || (doc as any).__srWired) return;
        (doc as any).__srWired = true;
        const hl = doc.createElement('div');
        hl.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #a6ff00;background:rgba(166,255,0,.14);border-radius:5px;display:none';
        doc.body.appendChild(hl);
        const onMove = (e: any) => { const el = doc.elementFromPoint(e.clientX, e.clientY); if (!el || el === hl) return; const r = el.getBoundingClientRect(); hl.style.display = 'block'; hl.style.left = r.left + 'px'; hl.style.top = r.top + 'px'; hl.style.width = r.width + 'px'; hl.style.height = r.height + 'px'; };
        const onClick = (e: any) => { e.preventDefault(); e.stopPropagation(); const el = doc.elementFromPoint(e.clientX, e.clientY); if (el) captureZone(el); };
        doc.addEventListener('mousemove', onMove, true);
        doc.addEventListener('click', onClick, true);
        cleanups.push(() => { try { doc.removeEventListener('mousemove', onMove, true); doc.removeEventListener('click', onClick, true); hl.remove(); (doc as any).__srWired = false; } catch {} });
      });
    };
    wire(); const t1 = setTimeout(wire, 400); const t2 = setTimeout(wire, 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); cleanups.forEach((c) => c()); };
  }, [target, nonce, activeId, combo]);

  function captureZone(el: any) {
    const tag = (el.tagName || 'div').toLowerCase();
    const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.trim().split(/\s+/)[0] : '';
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 32);
    const ref = `📍 Zone : ${txt ? '« ' + txt + ' »' : tag} (${tag}${cls})`;
    window.dispatchEvent(new CustomEvent('sr-target', { detail: ref }));
  }

  function pick(id: string) { setActiveId(id); setNonce((n) => n + 1); }

  const gap = 14, pad = 6;
  const availW = box.w - pad * 2, availH = box.h - pad * 2;
  let tv = { w: 0, h: 0 }, phScale = 1;
  if (combo) {
    phScale = Math.min(1, availH / PH_OH, (availW * 0.4) / PH_OW);
    tv.w = Math.min(Math.max(200, availW - PH_OW * phScale - gap), availH * 16 / 9); tv.h = tv.w * 9 / 16;
  } else if (isPhone) { phScale = Math.min(1, availH / PH_OH, availW / PH_OW); }
  else { tv.w = Math.min(availW, availH * 16 / 9); tv.h = tv.w * 9 / 16; }
  const phW = PH_OW * phScale, phH = PH_OH * phScale;

  const tvFrame = (
    <div className="sr-tvwrap" style={{ width: tv.w, height: tv.h }}>
      <iframe ref={tvRef} key={'tv' + nonce} title="tv" src={src(tvId)} className="sr-tv" />
    </div>
  );
  const phoneFrame = (
    <div className="sr-phone-slot" style={{ width: phW, height: phH }}>
      <div className="sr-phone" style={{ transform: `scale(${phScale})` }}>
        <iframe key={'ph' + nonce} title="phone" src={src(phId)} />
      </div>
    </div>
  );

  const navItem = (s: any) => (
    <button key={s.id} className={'sr-item' + (s.id === activeId ? ' on' : '')} onClick={() => pick(s.id)}>
      <span className="sr-itxt">{s.label}</span>{hasFb(s.id) && <span className="sr-dot" title="Retour en cours" />}
    </button>
  );

  return (
    <div className="sr">
      <style>{CSS}</style>
      <aside className="sr-nav">
        <div className="sr-brand">PUNCHLIN<span>R</span> · Showroom</div>
        <div className="sr-grp"><span>📺</span> Écran / TV</div>
        {tvScenes.map(navItem)}
        <div className="sr-grp"><span>📱</span> Téléphone</div>
        {phScenes.map(navItem)}
        <div className="sr-foot">Vraies pages, hors-ligne. Audio & enregistrement des retours : serveur lancé (<code>npm run dev</code>).</div>
      </aside>

      <main className="sr-stage">
        <div className="sr-top">
          <div className="sr-title">{scene.label}{scene.note && <span className="sr-note"> — {scene.note}</span>}</div>
          <div className="sr-actions">
            <button className={'sr-btn' + (target ? ' hot' : '')} onClick={() => setTarget((t) => !t)} title="Clique un élément de la scène pour l'ajouter au retour">🎯 {target ? 'Ciblage ON' : 'Cibler'}</button>
            {PAIR[activeId] && <button className={'sr-btn' + (combo ? ' on' : '')} onClick={() => setCombo((c) => !c)}>{combo ? '✕ Vue croisée' : (isPhone ? '＋ Voir la TV' : '＋ Voir le téléphone')}</button>}
            <button className="sr-btn" onClick={() => setNonce((n) => n + 1)}>↻ Rejouer l'anim</button>
          </div>
        </div>
        <div className={'sr-stagebox' + (target ? ' targeting' : '')} ref={stageRef}>
          {combo ? <div className="sr-combo">{tvFrame}{phoneFrame}</div> : (isPhone ? phoneFrame : tvFrame)}
        </div>
      </main>

      <aside className="sr-fb">
        {showBuzzIter && (
          <div className="sr-iter">
            <div className="sr-iterlabel">Itérations du buzz</div>
            <div className="sr-iterbtns">{[1, 2, 3, 4, 5].map((v) => <button key={v} className={'sr-iterbtn' + (buzzVar === v ? ' on' : '')} onClick={() => { setBuzzVar(v); setNonce((n) => n + 1); }}>{v}</button>)}</div>
          </div>
        )}
        <FeedbackPanel key={activeId} sceneId={activeId} label={scene.label} />
        <div className="sr-fbhint">🎯 <b>Cibler</b> : clique un élément pour l'épingler au retour. En <b>vue croisée</b>, une réaction du téléphone apparaît sur la TV.</div>
      </aside>
    </div>
  );
}

const CSS = `
.sr{position:fixed;inset:0;display:flex;background:#0a0b0d;color:#eef0ee;font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.sr-nav{flex:0 0 214px;background:#101114;border-right:1px solid #202329;overflow-y:auto;padding:14px 10px;display:flex;flex-direction:column;gap:2px}
.sr-brand{font-weight:800;letter-spacing:.02em;margin:2px 6px 12px;font-size:14px;color:#cfd3cc}
.sr-brand span{color:#a6ff00}
.sr-grp{margin:15px 6px 6px;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7c828b;display:flex;align-items:center;gap:6px}
.sr-item{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;background:transparent;border:0;color:#c9cdc6;border-radius:8px;padding:9px 11px 9px 12px;font-size:12.5px;cursor:pointer;transition:background .1s}
.sr-item:before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:0;background:#a6ff00;border-radius:0 3px 3px 0;transition:height .12s}
.sr-item:hover{background:#171a1e}
.sr-item.on{background:#191d10;color:#eafcc9;font-weight:700}
.sr-item.on:before{height:60%}
.sr-itxt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sr-dot{flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:#ffb02e;box-shadow:0 0 6px rgba(255,176,46,.6)}
.sr-foot{margin-top:auto;padding:12px 6px 2px;font-size:10.5px;color:#6f757e;line-height:1.5}
.sr-foot code{color:#a6ff00}
.sr-stage{flex:1;min-width:0;display:flex;flex-direction:column;padding:12px 14px;gap:10px}
.sr-top{display:flex;align-items:center;gap:12px;justify-content:space-between;flex:0 0 auto}
.sr-title{font-size:15px;font-weight:700}
.sr-note{color:#9aa0a6;font-weight:400;font-size:12.5px}
.sr-actions{display:flex;gap:8px;flex:0 0 auto}
.sr-btn{background:#181b1f;border:1px solid #2a2e35;color:#d2d6cf;border-radius:8px;padding:7px 12px;font-size:12.5px;cursor:pointer;white-space:nowrap}
.sr-btn:hover{border-color:#a6ff00;color:#a6ff00}
.sr-btn.on{background:#191d10;border-color:#4a5a00;color:#d9ffb0}
.sr-btn.hot{background:#a6ff00;border-color:#a6ff00;color:#0a0b0d;font-weight:700}
.sr-stagebox{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
.sr-stagebox.targeting{cursor:crosshair;box-shadow:inset 0 0 0 2px rgba(166,255,0,.4);border-radius:12px}
.sr-combo{display:flex;align-items:center;justify-content:center;gap:14px;width:100%;height:100%}
.sr-tvwrap{background:#000;border:1px solid #202329;border-radius:10px;overflow:hidden;box-shadow:0 14px 50px rgba(0,0,0,.5);flex:0 0 auto}
.sr-tv{width:100%;height:100%;border:0;background:#0f0f10;display:block}
.sr-phone-slot{flex:0 0 auto;position:relative}
.sr-phone{width:412px;height:868px;padding:11px;background:#1c1e22;border-radius:46px;border:1px solid #2c3038;box-shadow:0 14px 50px rgba(0,0,0,.5);position:relative;transform-origin:top left}
.sr-phone:before{content:"";position:absolute;top:22px;left:50%;transform:translateX(-50%);width:120px;height:22px;background:#1c1e22;border-radius:0 0 16px 16px;z-index:2}
.sr-phone iframe{width:390px;height:844px;border:0;border-radius:36px;background:#0e0f11;display:block}
.sr-fb{flex:0 0 344px;background:#101114;border-left:1px solid #202329;padding:14px 13px;display:flex;flex-direction:column;gap:9px}
.sr-fbhead{font-size:13px;color:#9aa0a6}
.sr-fbhead b{color:#eef0ee}
.sr-fb textarea{flex:1;min-height:200px;resize:none;background:#0c0d0f;border:1px solid #2a2e35;border-radius:9px;color:#eef0ee;padding:11px 12px;font:13.5px/1.5 inherit;white-space:pre-wrap}
.sr-fb textarea:focus{outline:none;border-color:#4a5a00}
.sr-fbrow{display:flex;align-items:center;gap:9px}
.sr-post{flex:1;background:#a6ff00;color:#0a0b0d;border:0;border-radius:8px;padding:10px 16px;font-weight:800;font-size:13.5px;cursor:pointer}
.sr-post:disabled{opacity:.4;cursor:default}
.sr-dl{background:#181b1f;border:1px solid #2a2e35;color:#d2d6cf;border-radius:8px;padding:10px 12px;font-size:12.5px;cursor:pointer}
.sr-toast{color:#a6ff00;font-size:12.5px}
.sr-fbhint{margin-top:auto;font-size:11px;color:#6f757e;border-top:1px solid #202329;padding-top:9px;line-height:1.5}
.sr-iter{background:#0c0d0f;border:1px solid #2a2e35;border-radius:9px;padding:9px 10px}
.sr-iterlabel{font-size:10.5px;color:#9aa0a6;margin-bottom:7px;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
.sr-iterbtns{display:flex;gap:6px}
.sr-iterbtn{flex:1;background:#181b1f;border:1px solid #2a2e35;color:#d2d6cf;border-radius:7px;padding:9px 0;font-size:14px;font-weight:800;cursor:pointer}
.sr-iterbtn:hover{border-color:#a6ff00}
.sr-iterbtn.on{background:#a6ff00;color:#0a0b0d;border-color:#a6ff00}
`;
