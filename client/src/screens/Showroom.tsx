// SHOWROOM — banc d'essai des écrans (design FINAL, vraies polices/couleurs/composants).
// Nav en haut → on passe d'une étape à l'autre. Le reste = la vraie page (pas de cadre).
import { useState, type ReactNode } from 'react';
import GrungeBg from '../GrungeBg';
import { avatarById, initials, fmtAud } from '../data';
import '../battle.css';

function Av({ id, size = 120 }: { id?: string; size?: number }) {
  const a = avatarById(id || '');
  return (
    <span className="med" style={{ width: size, height: size, fontSize: Math.round(size * 0.37), background: a?.color || 'linear-gradient(150deg,#7C5CFF,#432E8C)' }}>
      {a?.img ? <img src={`/avatars/${a.id}.png`} alt="" onError={(e: any) => (e.currentTarget.style.display = 'none')} /> : initials(a?.name || id || '?')}
    </span>
  );
}
const rn = (id: string) => avatarById(id)?.name || id; // nom du RAPPEUR (l'avatar)

/* joueur = un PSEUDO (blaze) + un RAPPEUR choisi (avatar) */
const A = { pseudo: 'Rafuo', rapper: 'sch', score: 142000 };
const B = { pseudo: 'MoMo', rapper: 'booba', score: 138000 };
const BETTORS_A = ['iam', 'jul'];
const BETTORS_B = ['ninho', 'gazo', 'damso'];

/* ====================================================================== */
/*  CLASH — TV                                                            */
/* ====================================================================== */
function BtSide({ p, side, big = true }: { p: typeof A; side: 'a' | 'b'; big?: boolean }) {
  return (
    <div className={`bt-side ${side}`}>
      <div className="bt-av"><Av id={p.rapper} size={big ? 168 : 72} /></div>
      <div className="bt-name">{p.pseudo}</div>
      <div className="bt-rap">{rn(p.rapper)}</div>
      {big && <div className="bt-score">{fmtAud(p.score)} aud.</div>}
    </div>
  );
}
function ClashIntro() {
  return (
    <div className="bt">
      <div className="bt-top col"><span className="bt-badge">⚔ CLASH</span><span className="bt-flavor">Duel au sommet</span></div>
      <div className="bt-vs">
        <BtSide p={A} side="a" />
        <div className="bt-vsword">VS</div>
        <BtSide p={B} side="b" />
      </div>
      <div className="bt-sub">Manche <b>bonus</b> — les deux du haut s'affrontent en face à face.</div>
    </div>
  );
}
function ClashBets() {
  return (
    <div className="bt bt-compact">
      <div className="bt-top col"><span className="bt-badge">⚔ CLASH</span><span className="bt-flavor">Duel au sommet</span></div>
      <div className="bt-vs mini">
        <BtSide p={A} side="a" big={false} />
        <div className="bt-vsword sm">VS</div>
        <BtSide p={B} side="b" big={false} />
      </div>
      <div className="bt-betzone">
        <div className="bt-betring">
          <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,.1)" strokeWidth="9" fill="none" /><circle cx="60" cy="60" r="54" stroke="var(--fluo)" strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={339} strokeDashoffset={339 * 0.35} /></svg>
          <span className="n">6</span>
        </div>
        <div className="bt-bethead">Les paris sont ouverts</div>
        <div className="bt-betsub">Sur votre téléphone : misez sur le vainqueur — +{fmtAud(4000)} si vous visez juste.</div>
        <div className="bt-bettally">
          <div className="bt-tallycol a"><div className="bt-tallylab">{A.pseudo}</div><div className="bt-tallyavs">{BETTORS_A.map((id) => <span key={id}><Av id={id} size={44} /></span>)}</div></div>
          <div className="bt-tallycol b"><div className="bt-tallylab">{B.pseudo}</div><div className="bt-tallyavs">{BETTORS_B.map((id) => <span key={id}><Av id={id} size={44} /></span>)}</div></div>
        </div>
      </div>
    </div>
  );
}
function ClashRule() {
  return (
    <div className="bt">
      <div className="bt-top col"><span className="bt-badge">⚔ CLASH</span></div>
      <div className="bt-rule">
        <div className="bt-rulehead">Prêts ?</div>
        <div className="bt-ruletext">Le <b>1ᵉʳ des deux</b> qui reconnaît le son gagne le clash.</div>
        <div className="bt-rulefaces"><Av id={A.rapper} size={72} /><span>VS</span><Av id={B.rapper} size={72} /></div>
      </div>
    </div>
  );
}
function ClashDuel() {
  return (
    <div className="bt bt-compact">
      <div className="bt-top col"><span className="bt-badge live">● EN DUEL</span><span className="bt-flavor faint">{A.pseudo} vs {B.pseudo}</span></div>
      <div className="playstage">
        <div className="vinyl"><div className="grooves spin" aria-hidden="true" /><span className="q">?</span></div>
        <div className="ring big">
          <svg viewBox="0 0 120 120"><defs><linearGradient id="tgb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a6ff00" /><stop offset="1" stopColor="#e4ff1a" /></linearGradient></defs><circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,.10)" strokeWidth="9" fill="none" /><circle cx="60" cy="60" r="54" stroke="url(#tgb)" strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={339} strokeDashoffset={339 * 0.3} /></svg>
          <span className="n">15</span>
        </div>
      </div>
      <div className="eq7" aria-hidden="true">{Array.from({ length: 11 }).map((_, i) => <i key={i} />)}</div>
      <span className="playmeta">Le 1ᵉʳ qui trouve gagne le clash</span>
    </div>
  );
}
function ClashReveal() {
  return (
    <div className="bt">
      <div className="bt-top col"><span className="bt-badge">Clash — résultat</span></div>
      <div className="bt-res2">
        <div className="bt-res2p win">
          <div className="bt-res2crown">👑</div>
          <div className="bt-av"><Av id={A.rapper} size={150} /></div>
          <div className="bt-res2name">{A.pseudo}</div>
          <div className="bt-res2tag win">A trouvé · +{fmtAud(20000)}</div>
        </div>
        <div className="bt-res2p lose">
          <div className="bt-av"><Av id={B.rapper} size={116} /></div>
          <div className="bt-res2name">{B.pseudo}</div>
          <div className="bt-res2tag lose">👎 Loser</div>
        </div>
      </div>
      <div className="bt-revcard">
        <div style={{ width: 62, height: 62, borderRadius: 4, background: 'var(--surf3)', display: 'grid', placeItems: 'center', fontFamily: 'var(--disp)', color: 'var(--muted)' }}>♪</div>
        <div style={{ textAlign: 'left' }}><div className="eyebrow" style={{ color: 'var(--muted2)' }}>C'était</div><div style={{ fontFamily: 'var(--disp)', fontWeight: 700, fontSize: 20 }}>Otto — SCH</div></div>
      </div>
      <div className="bt-betresult">Bien parié : <b>IAM</b> · <b>Jul</b> → +{fmtAud(4000)}</div>
    </div>
  );
}

/* ====================================================================== */
/*  CLASH — TÉLÉPHONE                                                      */
/* ====================================================================== */
function PhBet() {
  const [pick, setPick] = useState<'a' | 'b' | null>(null);
  return (
    <div className="ph-center">
      <span className="eyebrow" style={{ color: 'var(--fluo)' }}>⚔ Clash — parie sur le vainqueur</span>
      {pick ? (
        <>
          <div className="ph-mid">Tu paries sur</div>
          <div className="ph-pickname" style={{ color: pick === 'a' ? 'var(--green)' : 'var(--fluo)' }}>{pick === 'a' ? A.pseudo : B.pseudo}</div>
          <div className="big-num" style={{ color: 'var(--fluo)' }}>6</div>
          <p className="muted">+{fmtAud(4000)} si tu vises juste</p>
          <button className="btn ghost" onClick={() => setPick(null)}>Changer</button>
        </>
      ) : (
        <>
          <h2 className="ph-q">Qui gagne ?</h2>
          <div className="ph-betbtns">
            <button className="ph-betbtn a" onClick={() => setPick('a')}><Av id={A.rapper} size={76} /><span>{A.pseudo}</span></button>
            <button className="ph-betbtn b" onClick={() => setPick('b')}><Av id={B.rapper} size={76} /><span>{B.pseudo}</span></button>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>Bon pari → +{fmtAud(4000)} · mauvais = rien perdu</p>
        </>
      )}
    </div>
  );
}
function PhDuel() {
  return (
    <div className="ph-center">
      <span className="eyebrow" style={{ color: 'var(--bad)' }}>⚔ C'est ton clash</span>
      <h2 className="ph-duelq">Trouve avant <span style={{ color: 'var(--fluo)' }}>{B.pseudo}</span> !</h2>
      <form style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={(e) => e.preventDefault()}>
        <input className="field" placeholder="Titre et/ou artiste…" autoFocus />
        <button className="btn warm big send" type="submit">Valider</button>
      </form>
      <p className="muted">Le 1ᵉʳ qui trouve rafle +{fmtAud(20000)}</p>
    </div>
  );
}
function PhResult() {
  return (
    <div className="ph-center">
      <span className="sent-check" style={{ background: 'var(--green)' }}><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg></span>
      <h2 className="ph-q">Bien vu !</h2>
      <p className="muted">Tu avais parié sur <b style={{ color: 'var(--green)' }}>{A.pseudo}</b></p>
      <div className="big-num" style={{ color: 'var(--green)' }}>+{fmtAud(4000)}</div>
    </div>
  );
}

/* ====================================================================== */
/*  BUZZER                                                                */
/* ====================================================================== */
function BuzzerOpen() {
  return (
    <div className="center" style={{ gap: 20 }}>
      <div className="playstage" style={{ margin: 0 }}>
        <div className="vinyl"><div className="grooves spin" aria-hidden="true" /><span className="q">?</span></div>
      </div>
      <div className="eq7" aria-hidden="true">{Array.from({ length: 11 }).map((_, i) => <i key={i} />)}</div>
      <span className="playmeta">Mode Buzzer · Connaisseur</span>
      <h2 className="title-xl" style={{ margin: 0, color: 'var(--fluo)' }}>Le premier qui buzze prend la main</h2>
      <p className="muted">Reconnais le son, dégaine avant les autres.</p>
    </div>
  );
}
function BuzzerBuzzed() {
  return (
    <div className="center">
      <div className="buzzstage">
        <div className="ring big buzzring">
          <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,.1)" strokeWidth="9" fill="none" /><circle cx="60" cy="60" r="54" stroke="#ffb02e" strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={339} strokeDashoffset={339 * 0.4} /></svg>
          <div className="buzzav"><Av id={A.rapper} size={128} /></div>
        </div>
        <h2 className="title-xl" style={{ margin: 0 }}>À <span style={{ color: 'var(--ember)' }}>{A.pseudo}</span> !</h2>
        <p className="buzzmeta" style={{ color: 'var(--muted)' }}>répond au micro · <b style={{ color: 'var(--fluo)' }}>6s</b></p>
      </div>
    </div>
  );
}
function BuzzerPhIdle() {
  return (
    <div className="ph-center">
      <h2 className="ph-q" style={{ marginBottom: 2 }}>Reconnais le son</h2>
      <button className="buzzer">BUZZ</button>
      <p className="muted">Le 1ᵉʳ qui buzze prend la main</p>
    </div>
  );
}
function BuzzerPhMine() {
  return (
    <div className="ph-center">
      <h2 className="ph-q" style={{ margin: 0 }}>À toi ! Réponds vite</h2>
      <div className="big-num" style={{ color: 'var(--fluo)' }}>6</div>
      <form style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={(e) => e.preventDefault()}>
        <input className="field" placeholder="Titre et/ou artiste…" autoFocus />
        <button className="btn warm big send" type="submit">Valider</button>
      </form>
    </div>
  );
}

/* ====================================================================== */
/*  QUIZ  (QCM 4 choix · Vrai/Faux = même grille · révélation · téléphone) */
/* ====================================================================== */
const QCM = { cat: 'Univers', q: "Quel rappeur a sorti l'album « Ipséité » ?", choices: ['Damso', 'Booba', 'SCH', 'Nekfeu'], answer: 0 };
const VF = { cat: 'Vrai/Faux', q: 'Vrai ou faux : PNL est composé de deux frères.', choices: ['Vrai', 'Faux'], answer: 0 };

function QuizTvQCM() {
  return (
    <div className="center" style={{ gap: 16, justifyContent: 'flex-start', paddingTop: 'clamp(16px,4vh,52px)' }}>
      <span className="gpill" style={{ color: 'var(--fluo)' }}>{QCM.cat}</span>
      <h2 className="title-xl" style={{ margin: '4px 0', maxWidth: 800 }}>{QCM.q}</h2>
      <div className="qz-grid host">{QCM.choices.map((c, i) => <div className="qz-opt host" key={i}><b>{String.fromCharCode(65 + i)}</b> {c}</div>)}</div>
    </div>
  );
}
function QuizTvVF() {
  return (
    <div className="center" style={{ gap: 16, justifyContent: 'flex-start', paddingTop: 'clamp(16px,4vh,52px)' }}>
      <span className="gpill" style={{ color: 'var(--fluo)' }}>{VF.cat}</span>
      <h2 className="title-xl" style={{ margin: '4px 0', maxWidth: 800 }}>{VF.q}</h2>
      <div className="qz-grid host">{VF.choices.map((c, i) => <div className="qz-opt host" key={i}><b>{String.fromCharCode(65 + i)}</b> {c}</div>)}</div>
    </div>
  );
}
function QuizTvReveal() {
  return (
    <div className="center" style={{ gap: 16, justifyContent: 'flex-start', paddingTop: 'clamp(16px,4vh,52px)' }}>
      <span className="eyebrow">La réponse</span>
      <span className="gpill" style={{ color: 'var(--fluo)' }}>{QCM.cat}</span>
      <h2 className="title-xl" style={{ margin: '10px 0', maxWidth: 720 }}>{QCM.q}</h2>
      <div className="gpill" style={{ fontSize: 'clamp(16px,2.4vw,22px)', padding: '12px 22px', color: 'var(--green)', borderColor: 'rgba(166,255,0,.5)' }}>{QCM.choices[QCM.answer]}</div>
    </div>
  );
}
function QuizPh({ q }: { q: typeof QCM }) {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <div className="ph-center">
      <span className="eyebrow">Manche 3 / 16 · Quiz · {q.cat}</span>
      <span className="gpill" style={{ color: 'var(--fluo)' }}>{q.cat}</span>
      <h2 className="title-xl" style={{ maxWidth: 520, margin: '4px 0' }}>{q.q}</h2>
      <div className="qz-grid">{q.choices.map((c, i) => <button key={i} className={'qz-opt' + (pick === i ? ' pick' : '')} disabled={pick !== null} onClick={() => setPick(i)}>{c}</button>)}</div>
      {pick !== null && <p className="muted">Réponse enregistrée — résultat à la révélation.</p>}
    </div>
  );
}

/* ====================================================================== */
/*  SHOWROOM                                                              */
/* ====================================================================== */
type Scene = { id: string; group: string; label: string; kind: 'tv' | 'phone'; el: ReactNode };
const SCENES: Scene[] = [
  { id: 'c-intro', group: 'CLASH', label: 'Intro (TV)', kind: 'tv', el: <ClashIntro /> },
  { id: 'c-bets', group: 'CLASH', label: 'Paris (TV)', kind: 'tv', el: <ClashBets /> },
  { id: 'c-rule', group: 'CLASH', label: 'Règle (TV)', kind: 'tv', el: <ClashRule /> },
  { id: 'c-duel', group: 'CLASH', label: 'Duel (TV)', kind: 'tv', el: <ClashDuel /> },
  { id: 'c-reveal', group: 'CLASH', label: 'Résultat (TV)', kind: 'tv', el: <ClashReveal /> },
  { id: 'c-ph-bet', group: 'CLASH', label: 'Pari (Tél)', kind: 'phone', el: <PhBet /> },
  { id: 'c-ph-duel', group: 'CLASH', label: 'Duelliste (Tél)', kind: 'phone', el: <PhDuel /> },
  { id: 'c-ph-res', group: 'CLASH', label: 'Résultat (Tél)', kind: 'phone', el: <PhResult /> },
  { id: 'bz-open', group: 'BUZZER', label: 'Ouvert (TV)', kind: 'tv', el: <BuzzerOpen /> },
  { id: 'bz-buzzed', group: 'BUZZER', label: 'Buzzé (TV)', kind: 'tv', el: <BuzzerBuzzed /> },
  { id: 'bz-ph-idle', group: 'BUZZER', label: 'Bouton (Tél)', kind: 'phone', el: <BuzzerPhIdle /> },
  { id: 'bz-ph-mine', group: 'BUZZER', label: 'À toi (Tél)', kind: 'phone', el: <BuzzerPhMine /> },
  { id: 'qz-qcm', group: 'QUIZ', label: 'QCM (TV)', kind: 'tv', el: <QuizTvQCM /> },
  { id: 'qz-vf', group: 'QUIZ', label: 'Vrai/Faux (TV)', kind: 'tv', el: <QuizTvVF /> },
  { id: 'qz-rev', group: 'QUIZ', label: 'Réponse (TV)', kind: 'tv', el: <QuizTvReveal /> },
  { id: 'qz-ph-qcm', group: 'QUIZ', label: 'QCM (Tél)', kind: 'phone', el: <QuizPh q={QCM} /> },
  { id: 'qz-ph-vf', group: 'QUIZ', label: 'Vrai/Faux (Tél)', kind: 'phone', el: <QuizPh q={VF} /> },
];
const GROUPS = ['CLASH', 'BUZZER', 'QUIZ'];

export default function Showroom() {
  const [scene, setScene] = useState(SCENES[0].id);
  const cur = SCENES.find((s) => s.id === scene) || SCENES[0];
  return (
    <div className="showroom">
      <header className="sr-nav">
        <div className="sr-title">SHOWROOM <span>· {cur.kind === 'tv' ? '📺 écran TV' : '📱 téléphone'} · {cur.group} · {cur.label}</span></div>
        <nav className="sr-tabs">
          {GROUPS.map((g) => (
            <span className="sr-grp" key={g}>
              <span className="sr-grplab">{g}</span>
              {SCENES.filter((s) => s.group === g).map((s) => (
                <button key={s.id} className={`sr-tab${s.id === scene ? ' on' : ''}`} onClick={() => setScene(s.id)}>{s.label}</button>
              ))}
            </span>
          ))}
        </nav>
      </header>
      <div className={`sr-page ${cur.kind}`}>
        <GrungeBg />
        <div className="wrap"><div className="sr-scene">{cur.el}</div></div>
      </div>
    </div>
  );
}
