// SHOWROOM v2 — banc d'essai de TOUTES les interfaces (design FINAL exact : on rend les VRAIS
// composants Host/Player, pilotés par un mock-socket, dans un iframe dimensionné (TV 16:9 / téléphone
// 390px) pour que les vw/vh soient fidèles. + boîte de retours par page (→ /api/feedback → markdown).
//
//  ?embed=<sceneId>  → rend UNIQUEMENT le composant de la scène (ce que l'iframe charge).
//  (sans param)      → le chrome : navigation des scènes + iframe + boîte de retours.
import { useState } from 'react';
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

export default function Showroom() {
  if (EMBED) {
    const scene = SCENES.find((s) => s.id === EMBED) || SCENES[0];
    return <div className="app">{scene.comp === 'host' ? <Host /> : <Player />}</div>;
  }
  return <Chrome />;
}

function Chrome() {
  const [activeId, setActiveId] = useState(SCENES[0].id);
  const [nonce, setNonce] = useState(0);
  const [fb, setFb] = useState('');
  const [toast, setToast] = useState('');
  const scene = SCENES.find((s) => s.id === activeId) || SCENES[0];
  const isPhone = scene.group === 'phone';
  const src = `${location.pathname}?embed=${activeId}&n=${nonce}`;

  const tv = SCENES.filter((s) => s.group === 'tv');
  const phone = SCENES.filter((s) => s.group === 'phone');

  function pick(id: string) { setActiveId(id); setNonce((n) => n + 1); setToast(''); }

  async function post() {
    const text = fb.trim(); if (!text) return;
    const md = `\n### ${scene.label}  \`[${activeId}]\`\n${text}\n`;
    try {
      const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: activeId, label: scene.label, text }) });
      if (!r.ok) throw new Error();
      setToast('Retour enregistré dans RETOURS-SHOWROOM.md ✓'); setFb('');
    } catch {
      try { localStorage.setItem('pl_showroom_fb', (localStorage.getItem('pl_showroom_fb') || '# Retours showroom\n') + md); } catch {}
      setToast('Serveur absent → sauvegardé en local (Télécharger ↓)'); setFb('');
    }
    setTimeout(() => setToast(''), 4000);
  }
  function download() {
    const md = localStorage.getItem('pl_showroom_fb') || '# Retours showroom\n(aucun retour local)';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    a.download = 'RETOURS-SHOWROOM.md'; a.click();
  }

  return (
    <div className="sr">
      <style>{CSS}</style>
      <aside className="sr-nav">
        <div className="sr-brand">PUNCHLINR · <span>Showroom</span></div>
        <div className="sr-grp">📺 Écran / TV</div>
        {tv.map((s) => <button key={s.id} className={'sr-item' + (s.id === activeId ? ' on' : '')} onClick={() => pick(s.id)}>{s.label}</button>)}
        <div className="sr-grp">📱 Téléphone</div>
        {phone.map((s) => <button key={s.id} className={'sr-item' + (s.id === activeId ? ' on' : '')} onClick={() => pick(s.id)}>{s.label}</button>)}
        <div className="sr-foot">Les vraies pages, pilotées hors-ligne. Pour l'audio & l'enregistrement des retours, lance le serveur (<code>npm run dev</code>).</div>
      </aside>

      <main className="sr-stage">
        <div className="sr-top">
          <div className="sr-title">{scene.label} {scene.note && <span className="sr-note">— {scene.note}</span>}</div>
          <button className="sr-replay" onClick={() => setNonce((n) => n + 1)}>↻ Rejouer l'anim</button>
        </div>

        <div className={'sr-frame ' + (isPhone ? 'phone' : 'tv')}>
          {isPhone
            ? <div className="sr-phone"><iframe key={nonce} title="phone" src={src} width={390} height={844} frameBorder={0} /></div>
            : <div className="sr-tvwrap"><iframe key={nonce} title="tv" src={src} className="sr-tv" frameBorder={0} /></div>}
        </div>

        <div className="sr-fb">
          <textarea value={fb} onChange={(e) => setFb(e.target.value)} placeholder={`Ton retour sur « ${scene.label} » (mise en page, tailles, lisibilité, animations…). Ça part dans RETOURS-SHOWROOM.md, rangé par page.`} />
          <div className="sr-fbrow">
            <button className="sr-post" onClick={post} disabled={!fb.trim()}>Poster ce retour →</button>
            <button className="sr-dl" onClick={download} title="Télécharger les retours enregistrés en local">↓ .md</button>
            {toast && <span className="sr-toast">{toast}</span>}
          </div>
        </div>
      </main>
    </div>
  );
}

const CSS = `
.sr{position:fixed;inset:0;display:flex;background:#0b0c0e;color:#eef0ee;font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.sr-nav{flex:0 0 250px;background:#121317;border-right:1px solid #23262c;overflow-y:auto;padding:14px 12px;display:flex;flex-direction:column;gap:3px}
.sr-brand{font-weight:800;letter-spacing:.02em;margin-bottom:10px;font-size:15px}
.sr-brand span{color:#a6ff00}
.sr-grp{margin:14px 4px 5px;font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8a9099}
.sr-item{text-align:left;background:transparent;border:1px solid transparent;color:#d6d9d4;border-radius:8px;padding:9px 11px;font-size:13px;cursor:pointer}
.sr-item:hover{background:#1a1c21}
.sr-item.on{background:#20240c;border-color:#4a5a00;color:#d9ffb0;font-weight:700}
.sr-foot{margin-top:auto;padding:12px 6px 4px;font-size:11px;color:#7d838c}
.sr-foot code{color:#a6ff00}
.sr-stage{flex:1;min-width:0;display:flex;flex-direction:column;padding:16px 20px;gap:12px;overflow:auto}
.sr-top{display:flex;align-items:center;gap:14px;justify-content:space-between}
.sr-title{font-size:16px;font-weight:700}
.sr-note{color:#9aa0a6;font-weight:400;font-size:13px}
.sr-replay{background:#1a1c21;border:1px solid #2c3038;color:#d6d9d4;border-radius:8px;padding:7px 12px;font-size:12.5px;cursor:pointer}
.sr-replay:hover{border-color:#a6ff00;color:#a6ff00}
.sr-frame{flex:1;min-height:0;display:flex;align-items:flex-start;justify-content:center}
.sr-tvwrap{width:100%;max-width:1100px;aspect-ratio:16/9;background:#000;border:1px solid #23262c;border-radius:10px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.5)}
.sr-tv{width:100%;height:100%;border:0;background:#0f0f10}
.sr-phone{width:410px;padding:10px;background:#1c1e22;border-radius:46px;border:1px solid #2c3038;box-shadow:0 18px 60px rgba(0,0,0,.5);position:relative}
.sr-phone:before{content:"";position:absolute;top:20px;left:50%;transform:translateX(-50%);width:120px;height:22px;background:#1c1e22;border-radius:0 0 16px 16px;z-index:2}
.sr-phone iframe{width:390px;height:844px;border:0;border-radius:36px;background:#0e0f11;display:block}
.sr-fb{flex:0 0 auto;background:#121317;border:1px solid #23262c;border-radius:10px;padding:11px}
.sr-fb textarea{width:100%;min-height:64px;resize:vertical;background:#0e0f11;border:1px solid #2c3038;border-radius:8px;color:#eef0ee;padding:10px 12px;font:13px/1.45 inherit}
.sr-fbrow{display:flex;align-items:center;gap:10px;margin-top:9px}
.sr-post{background:#a6ff00;color:#0b0c0e;border:0;border-radius:8px;padding:9px 16px;font-weight:800;font-size:13px;cursor:pointer}
.sr-post:disabled{opacity:.4;cursor:default}
.sr-dl{background:#1a1c21;border:1px solid #2c3038;color:#d6d9d4;border-radius:8px;padding:9px 11px;font-size:12.5px;cursor:pointer}
.sr-toast{color:#a6ff00;font-size:12.5px}
@media(max-width:820px){ .sr-nav{flex-basis:180px} .sr-phone{width:330px} .sr-phone iframe{width:310px;height:670px} }
`;
