// SHOWROOM — banc d'essai des écrans (design FINAL, vraies polices/couleurs/composants).
// Nav en haut → on passe d'une étape à l'autre. Le reste = la vraie page (pas de cadre).
import { useState, type ReactNode } from 'react';
import GrungeBg from '../GrungeBg';
import { avatarById, initials, fmtAud, CATEGORY_COLORS } from '../data';
import '../battle.css';

// couleur d'un rappeur = la couleur de SA CATÉGORIE (SCH/Rap game = cyan, Disiz/Conscient = ambre…)
const catColor = (id: string) => CATEGORY_COLORS[avatarById(id)?.cat || ''] || 'var(--fluo)';

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
const A = { pseudo: 'Rafuo', rapper: 'disiz', score: 142000 };
const B = { pseudo: 'MoMo', rapper: 'sch', score: 138000 };
/* parieurs = des joueurs (pseudo + avatar rappeur) qui ont misé sur un camp */
const BETTORS_A = [{ av: 'iam', name: 'Karim' }, { av: 'jul', name: 'Sofiane' }];
const BETTORS_B = [{ av: 'ninho', name: 'Léo' }, { av: 'gazo', name: 'Manon' }, { av: 'damso', name: 'Yanis' }];

/* ====================================================================== */
/*  CLASH — TV                                                            */
/* ====================================================================== */
function ClashHead({ sub, small }: { sub: string; small?: boolean }) {
  return (
    <div className="bt-head">
      <div className={`bt-clashword${small ? ' sm' : ''}`}>CLASH</div>
      <div className="bt-clashsub">{sub}</div>
    </div>
  );
}
/* Intro : grille 3 colonnes (1fr | VS | 1fr) → le VS est TOUJOURS pile au centre et aligné aux portraits.
   Bordure/glow/pseudo de chaque combattant = couleur de sa CATÉGORIE. */
function ClashIntro() {
  return (
    <div className="bt bt-intro">
      <ClashHead sub="Duel au sommet" />
      <div className="bt-versus">
        <div className="bt-portrait a" style={{ ['--cc' as any]: catColor(A.rapper) }}><Av id={A.rapper} size={228} /></div>
        <div className="bt-vsbig">VS</div>
        <div className="bt-portrait b" style={{ ['--cc' as any]: catColor(B.rapper) }}><Av id={B.rapper} size={228} /></div>
        <div className="bt-caption a" style={{ ['--cc' as any]: catColor(A.rapper) }}><div className="bt-fightname">{rn(A.rapper)}</div><div className="bt-fightpseudo cc">{A.pseudo}</div></div>
        <div aria-hidden="true" />
        <div className="bt-caption b" style={{ ['--cc' as any]: catColor(B.rapper) }}><div className="bt-fightname">{rn(B.rapper)}</div><div className="bt-fightpseudo cc">{B.pseudo}</div></div>
      </div>
      <div className="bt-bonuspill"><b>Manche bonus</b><span>Face à face</span></div>
    </div>
  );
}
/* PARIS (TV) : les 2 camps sur les côtés, les parieurs listés sous leur camp. */
function BetCamp({ p, side, bettors }: { p: typeof A; side: 'a' | 'b'; bettors: typeof BETTORS_A }) {
  return (
    <div className={`bt-camp ${side}`}>
      <div className="bt-camphead">
        <Av id={p.rapper} size={112} />
        <div className="bt-campnames"><div className="bt-fightname sm">{rn(p.rapper)}</div><div className="bt-fightpseudo">{p.pseudo}</div></div>
      </div>
      <div className="bt-camplist">
        {bettors.map((b) => <div className="bt-bettor" key={b.av}><Av id={b.av} size={56} /><span className="nm">{b.name}</span></div>)}
      </div>
    </div>
  );
}
function ClashBets() {
  return (
    <div className="bt bt-bets">
      <ClashHead sub="Les paris sont ouverts" />
      <div className="bt-betgrid">
        <BetCamp p={A} side="a" bettors={BETTORS_A} />
        <div className="bt-betmid">
          <div className="bt-betring">
            <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,.1)" strokeWidth="9" fill="none" /><circle cx="60" cy="60" r="54" stroke="var(--fluo)" strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={339} strokeDashoffset={339 * 0.35} /></svg>
            <span className="n">6</span>
          </div>
          <div className="bt-betcta">Misez sur le vainqueur</div>
          <div className="bt-betreward">+{fmtAud(4000)} si vous visez juste</div>
        </div>
        <BetCamp p={B} side="b" bettors={BETTORS_B} />
      </div>
    </div>
  );
}
function ClashRule() {
  return (
    <div className="bt">
      <ClashHead sub="Prêts ?" />
      <div className="bt-rule">
        <div className="bt-ruletext">Le <b>1ᵉʳ des deux</b> qui reconnaît le son gagne le clash.</div>
        <div className="bt-rulefaces"><Av id={A.rapper} size={88} /><span>VS</span><Av id={B.rapper} size={88} /></div>
      </div>
    </div>
  );
}
/* DUEL (TV) : les 2 duellistes bien présents de part et d'autre du vinyle, décompte au milieu. */
function DuelSide({ p }: { p: typeof A }) {
  return (
    <div className="bt-duelside" style={{ ['--cc' as any]: catColor(p.rapper) }}>
      <Av id={p.rapper} size={116} />
      <div className="bt-duelpseudo">{p.pseudo}</div>
      <div className="bt-duelrap">{rn(p.rapper)}</div>
    </div>
  );
}
function ClashDuel() {
  return (
    <div className="bt bt-duel">
      <ClashHead sub="En duel" small />
      <div className="bt-duelstage">
        <DuelSide p={A} />
        <div className="bt-duelcore">
          <div className="vinyl"><div className="grooves spin" aria-hidden="true" /><span className="q">?</span></div>
          <div className="ring big">
            <svg viewBox="0 0 120 120"><defs><linearGradient id="tgb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a6ff00" /><stop offset="1" stopColor="#e4ff1a" /></linearGradient></defs><circle cx="60" cy="60" r="54" stroke="rgba(255,255,255,.10)" strokeWidth="9" fill="none" /><circle cx="60" cy="60" r="54" stroke="url(#tgb)" strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={339} strokeDashoffset={339 * 0.3} /></svg>
            <span className="n">15</span>
          </div>
        </div>
        <DuelSide p={B} />
      </div>
      <div className="eq7" aria-hidden="true">{Array.from({ length: 11 }).map((_, i) => <i key={i} />)}</div>
      <div className="bt-duelmeta">Le <b>1ᵉʳ des deux</b> qui reconnaît le son rafle le clash.</div>
    </div>
  );
}
/* RÉSULTAT (TV) : 2 colonnes SYMÉTRIQUES (même taille, alignées), parieurs gagnants (gain) / perdants (+0). */
function RevCamp({ p, win, bettors }: { p: typeof A; win: boolean; bettors: typeof BETTORS_A }) {
  return (
    <div className={`bt-revcamp ${win ? 'win' : 'lose'}`}>
      <div className="bt-revfighter">
        <div className="bt-crown">{win ? '👑' : ''}</div>
        <Av id={p.rapper} size={148} />
        <div className="bt-fightname">{p.pseudo}</div>
        <div className={`bt-revtag ${win ? 'win' : 'lose'}`}>{win ? `A trouvé · +${fmtAud(20000)}` : 'N’a pas trouvé'}</div>
      </div>
      <div className="bt-teamlab">{win ? 'Ont bien parié' : 'Se sont loupés'}</div>
      <div className="bt-revbettors">
        {bettors.map((b) => (
          <div className={`bt-bettor ${win ? 'win' : 'lose'}`} key={b.av}>
            <Av id={b.av} size={50} /><span className="nm">{b.name}</span>
            <span className={`gain ${win ? '' : 'zero'}`}>{win ? `+${fmtAud(4000)}` : '+0'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function ClashReveal() {
  return (
    <div className="bt bt-rev">
      {/* logique blind test : on révèle d'abord LE MORCEAU, puis le vainqueur + les teams */}
      <div className="bt-revealtrack big">
        <div className="bt-cover">♪</div>
        <div className="bt-covermeta"><div className="eyebrow">La réponse</div><div className="ttl">Otto — SCH</div></div>
      </div>
      <div className="bt-revgrid">
        <RevCamp p={A} win bettors={BETTORS_A} />
        <RevCamp p={B} win={false} bettors={BETTORS_B} />
      </div>
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
          <div className="ph-stake solo"><span className="v">+{fmtAud(4000)}</span><span className="l">si {pick === 'a' ? A.pseudo : B.pseudo} gagne</span></div>
          <button className="btn ghost" onClick={() => setPick(null)}>Changer de camp</button>
        </>
      ) : (
        <>
          <h2 className="ph-q">Qui gagne ?</h2>
          <div className="ph-betbtns">
            <button className="ph-betbtn a" onClick={() => setPick('a')}><Av id={A.rapper} size={80} /><span>{A.pseudo}</span></button>
            <button className="ph-betbtn b" onClick={() => setPick('b')}><Av id={B.rapper} size={80} /><span>{B.pseudo}</span></button>
          </div>
          <div className="ph-stakes">
            <div className="ph-stake good"><span className="v">+{fmtAud(4000)}</span><span className="l">bon pari</span></div>
            <div className="ph-stake safe"><span className="v">0</span><span className="l">tu ne risques rien</span></div>
          </div>
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
      <div className="ph-reward"><b>+{fmtAud(20000)}</b><span>au 1ᵉʳ qui trouve</span></div>
      <form style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={(e) => e.preventDefault()}>
        <input className="field" placeholder="Titre et/ou artiste…" autoFocus />
        <button className="btn warm big send" type="submit">Valider</button>
      </form>
    </div>
  );
}
function PhResult() {
  return (
    <div className="ph-center">
      <span className="sent-check" style={{ background: 'var(--green)' }}><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg></span>
      <h2 className="ph-q">Bien vu !</h2>
      <p className="lead">Tu avais parié sur <b style={{ color: 'var(--green)' }}>{A.pseudo}</b></p>
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
      <h2 className="title-xl" style={{ margin: 0, color: 'var(--fluo)' }}>À vos buzzers</h2>
      <p className="lead">Le premier qui reconnaît le son prend la main.</p>
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
        <h2 className="title-xl" style={{ margin: 0 }}>À <span style={{ color: 'var(--fluo)' }}>{A.pseudo}</span> de jouer</h2>
        <p className="lead">Il tape sa réponse sur son téléphone · <b>6 s</b></p>
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

// Vrai/Faux : classe couleur (vert = Vrai, rouge = Faux)
const vfClass = (c: string) => (c === 'Vrai' ? ' vrai' : c === 'Faux' ? ' faux' : '');

function QuizTvQCM() {
  return (
    <div className="center qz-tv">
      <span className="gpill" style={{ color: 'var(--fluo)' }}>{QCM.cat}</span>
      <h2 className="qtitle host">{QCM.q}</h2>
      <div className="qz-grid host">{QCM.choices.map((c, i) => <div className="qz-opt host" key={i}><b>{String.fromCharCode(65 + i)}</b> {c}</div>)}</div>
    </div>
  );
}
function QuizTvVF() {
  return (
    <div className="center qz-tv">
      <span className="gpill" style={{ color: 'var(--fluo)' }}>{VF.cat}</span>
      <h2 className="qtitle host">{VF.q}</h2>
      <div className="qz-grid host vf">{VF.choices.map((c, i) => <div className={'qz-opt host vf' + vfClass(c)} key={i}>{c}</div>)}</div>
    </div>
  );
}
function QuizTvReveal() {
  return (
    <div className="center qz-tv reveal">
      <span className="eyebrow">La réponse</span>
      <h2 className="qtitle host">{QCM.q}</h2>
      <div className="qz-answer">{QCM.choices[QCM.answer]}</div>
    </div>
  );
}
function QuizPh({ q }: { q: typeof QCM }) {
  const [pick, setPick] = useState<number | null>(null);
  const vf = q.choices.length === 2;
  return (
    <div className="ph-center">
      <span className="eyebrow">Manche 3 / 16 · Quiz · {q.cat}</span>
      <span className="gpill" style={{ color: 'var(--fluo)' }}>{q.cat}</span>
      <h2 className="qtitle qz-q">{q.q}</h2>
      <div className={'qz-grid' + (vf ? ' vf' : '')}>{q.choices.map((c, i) => <button key={i} className={'qz-opt' + (vf ? ' vf' + vfClass(c) : '') + (pick === i ? ' pick' : '')} disabled={pick !== null} onClick={() => setPick(i)}>{vf ? c : <><b>{String.fromCharCode(65 + i)}</b>{c}</>}</button>)}</div>
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
// CLASH et QUIZ sont désormais INTÉGRÉS dans le vrai projet (Host/Player) → retirés de la nav du showroom.
// Les composants restent définis plus haut comme référence de design. Le showroom ne montre plus que le buzzer.
const GROUPS = ['BUZZER'];

export default function Showroom() {
  const [scene, setScene] = useState('bz-ph-idle');
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
