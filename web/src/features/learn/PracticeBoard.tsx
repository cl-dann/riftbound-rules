/**
 * Practice pálya: a szituáció-motor (practiceEngine.ts) állapotának kirajzolása és a kattintások kezelése.
 * Minta: bevezető panel és Szituáció indítása; lapra kattintva akció-menü; mozgás után Mozgás megerősítése;
 * fázispanelek gombokkal; célpont-választó modal; damage kiosztás; OUTCOME panel jó vagy rossz kimenettel és Újrajátszás.
 * A Chain fül Playmat komponensét nem használja.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, CircleHelp, RotateCcw, Swords, X, Zap } from 'lucide-react';
import { IMGBASE, vsCard } from '../../legacy/core';
import { inline } from '../../shared/content/richText';
import {
  act, asgConfirm, asgPick, asgReset, asgView, autoNext, glowOf, init, menuFor, mightAt, panelBtn, speedOf, start, step, stateLabel, tgtCancel, tgtConfirm, tgtToggle, tstate,
  locate, groupOf, type ES, type PUnit, type Scn, type Side,
} from '../../domain/practice/practiceEngine';
import '../../styles/practice.css';

const imgOf = (n?: string | null) => { const c: any = n ? vsCard(n) : null; return c && c.img ? IMGBASE + c.img : ''; };
const openCard = (n: string) => window.dispatchEvent(new CustomEvent('rb:open-card', { detail: n }));
const T = ({ t, as = 'span', className }: { t: string; as?: 'span' | 'p' | 'div'; className?: string }) => {
  const El = as as any; return <El className={className} dangerouslySetInnerHTML={{ __html: inline(t) }} />;
};
const DOMC: Record<string, string> = { Fury: 'var(--fury)', Calm: 'var(--calm)', Mind: 'var(--mind)', Body: 'var(--body)', Chaos: 'var(--chaos)', Order: 'var(--order)' };
const TAGHU: Record<string, string> = { Attacker: 'Attacker', Defender: 'Defender', new: 'Új' };

type CardProps = { n?: string | null; ex?: boolean; back?: boolean; glow?: string; onClick?: () => void; label?: string; badge?: ReactNode; cls?: string; land?: boolean };
function Card({ n, ex, back, glow, onClick, label, badge, cls = '', land }: CardProps) {
  const src = back ? '' : imgOf(n);
  const inner = (<>
    {src ? <img src={src} alt={n || ''} loading="lazy" draggable={false} /> : <span className="pb-back" aria-hidden><span>R</span></span>}
    {badge}
  </>);
  const c = 'pb-card' + (ex ? ' ex' : '') + (land ? ' land' : '') + (glow ? ' g-' + glow : '') + (cls ? ' ' + cls : '');
  if (!onClick) return <span className={c} title={label || n || ''}>{inner}</span>;
  return <button type="button" className={c} onClick={onClick} aria-label={label || n || 'Lap'} title={label || n || ''}>{inner}</button>;
}

function UnitCard({ u, side, es, onCard }: { u: PUnit; side: Side; es: ES; onCard: (ref: string, side: Side) => void }) {
  const g = side === 'me' ? glowOf(es, u.n) : '';
  const base = +((vsCard(u.n) as any)?.m || 0);
  const tags = (u.tags || []).filter((t) => t !== 'new');
  return (
    <Card n={u.n} ex={u.ex} glow={g} onClick={() => onCard(u.n, side)}
      label={u.n + ', ' + u.m + ' Might' + (u.dmg ? ', ' + u.dmg + ' damage' : '') + (u.ex ? ', exhausted' : ', ready')}
      badge={<>
        {!u.gear && <b className={'pb-might' + (u.m > base ? ' up' : u.m < base ? ' down' : '')}>{u.m}</b>}
        {!!u.dmg && <b className={'pb-dmg' + (u.dmg >= u.m ? ' lethal' : '')}>{u.dmg}</b>}
        {tags.length > 0 && <span className="pb-tags">{tags.map((t) => <i key={t} className={'t-' + t.toLowerCase()}>{TAGHU[t] || t}</i>)}</span>}
      </>} />
  );
}

/** Rune-ok domainenként csoportosítva, darabszámmal; a csoportban az exhausted rune-ok elfordítva. */
function Runes({ es, side, onRune }: { es: ES; side: Side; onRune?: (i: number) => void }) {
  const rs = es.b[side].runes;
  const groups: Record<string, number[]> = {};
  rs.forEach((r, i) => { (groups[r.d] ||= []).push(i); });
  return (
    <div className={'pb-runes' + (es.scn.pool && side === 'me' ? ' spread' : '')}>
      {Object.entries(groups).map(([d, idx]) => (
        <div key={d} className="pb-rgroup" style={{ ['--dc' as any]: DOMC[d] || '#888' }}>
          <span className="pb-rcount" title={d + ': ' + idx.filter((i) => !rs[i].ex).length + ' ready'}>{idx.length}</span>
          <div className="pb-rstack">
            {idx.map((i) => {
              const g = side === 'me' ? glowOf(es, 'r:' + i) : '';
              return <Card key={i} n={d + ' Rune'} ex={rs[i].ex} glow={g} cls="rune" label={d + ' rune, ' + (rs[i].ex ? 'exhausted' : 'ready')} onClick={onRune && side === 'me' ? () => onRune(i) : undefined} />;
            })}
          </div>
        </div>
      ))}
      <span className="pb-rtotal">{rs.length}</span>
    </div>
  );
}

function ChainRow({ es, mini }: { es: ES; mini?: boolean }) {
  const ch = es.b.chain;
  if (!ch.length) return null;
  return (
    <div className={'pb-chain' + (mini ? ' mini' : '')} aria-label="Chain">
      <div className="pb-chain-h"><Zap size={13} aria-hidden /> <b>CHAIN</b> {!mini && <span>a jobb szélső oldódik fel először</span>}<em>{ch.length} elem</em></div>
      <div className="pb-chain-items">
        {ch.map((c, i) => (
          <div key={i} className={'pb-ci ' + c.owner}>
            <span className="pb-ci-k">{i === ch.length - 1 ? 'következő' : '#' + (ch.length - i)}</span>
            <Card n={c.card} onClick={() => openCard(c.card)} />
            {!mini && <span className="pb-ci-n">{c.card}</span>}
            {!mini && c.note && <span className="pb-ci-note">{c.note}</span>}
            <span className={'pb-ci-o ' + c.owner}>{c.owner === 'me' ? 'Te' : 'Ellenfél'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Clash({ es, bf }: { es: ES; bf: number }) {
  const f = es.b.bfs[bf]; if (!f) return null;
  const col = (us: PUnit[], side: Side) => (
    <div className={'pb-clash-col ' + side}>
      <span className="pb-clash-l">{side === 'me' ? 'Saját unitok' : 'Ellenfél unitjai'} <b>{mightAt(es.b, bf, side)}</b></span>
      <div className="pb-clash-cards">{us.map((u) => (
        <figure key={u.n}>
          <Card n={u.n} onClick={() => openCard(u.n)} badge={<b className="pb-might">{u.m}</b>} />
          <figcaption>{u.n}{!!u.dmg && <em className={u.dmg >= u.m ? 'lethal' : 'ok'}>{u.dmg} damage, {u.dmg >= u.m ? 'lethal' : 'túléli'}</em>}</figcaption>
        </figure>))}
        {!us.length && <span className="note">nincs unit</span>}</div>
    </div>
  );
  return <div className="pb-clash">{col(f.opp, 'opp')}<span className="pb-vs"><Swords size={18} aria-hidden /></span>{col(f.me, 'me')}</div>;
}

type Menu = NonNullable<ReturnType<typeof menuFor>>;

export function PracticeBoard({ scn, next }: { scn: Scn; next?: { href: string; title: string } }) {
  const [es, setEs] = useState<ES>(() => init(scn));
  const [menu, setMenu] = useState<Menu | null>(null);
  const [tip, setTip] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hideOut, setHideOut] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => { setEs(init(scn)); setMenu(null); setTip(false); setToast(null); setHideOut(false); }, [scn]);
  const s = step(es);
  // üzenetek: a motor üzenete és a szabad lépés belépő szövege
  useEffect(() => { if (es.msg) setToast(es.msg); }, [es.nonce, es.msg]);
  useEffect(() => { if (es.started && s?.t === 'free' && (s as any).toast) setToast((s as any).toast); }, [es.i, es.started]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 7000); return () => clearTimeout(t); }, [toast]);
  // az ellenfél lépése: rövid várakozás után automatikusan tovább
  useEffect(() => { if (es.started && s?.t === 'auto' && !es.out) { const t = setTimeout(() => setEs((x) => autoNext(x)), 1500); return () => clearTimeout(t); } }, [es.i, es.started, es.out]);
  useEffect(() => { if (es.out) setHideOut(false); }, [es.out]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (menu) setMenu(null); else if (tip) setTip(false); else if (es.tgt) setEs(tgtCancel(es)); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  const restart = () => { setEs(start(init(scn))); setMenu(null); setToast(null); };
  const run = (f: (x: ES) => ES) => { setMenu(null); setEs((x) => f(x)); };

  const fs = s?.t === 'free' ? s : null;
  const st = es.started ? tstate(es) : 'open';
  const onCard = (ref: string, side: Side) => {
    if (!es.started || es.out || side !== 'me') { const l = locate(es.b, ref); const n = l?.u?.n || (ref.startsWith('h:') ? ref.slice(2) : ref); openCard(n); return; }
    if (fs?.mode === 'awaken') { if (glowOf(es, ref) === 'awaken') run((x) => act(x, 'ready:' + ref)); return; }
    const m = menuFor(es, ref);
    if (m) { setMenu(m); return; }
    const l = locate(es.b, ref); openCard(l?.u?.n || (ref.startsWith('h:') ? ref.slice(2) : ref));
  };
  const onRune = (i: number) => {
    if (!es.started || es.out) return;
    if (fs?.mode === 'awaken') { if (es.b.me.runes[i].ex) run((x) => act(x, 'ready:r:' + i)); return; }
    const m = menuFor(es, 'r:' + i); if (m) setMenu(m);
  };
  const bb = fs?.bbtn && !es.out ? fs.bbtn : null;
  const bbtn = (at: string) => bb && bb.at === at ? <button type="button" className="pb-bbtn" onClick={() => run((x) => act(x, 'bbtn'))}>{bb.l} <ChevronRight size={14} /></button> : null;
  const pendBf = es.pend.length ? +es.pend[0].split(':')[2].replace('bf', '').replace('base', '-1') : null;
  const b = es.b;
  const oppTurn = b.turn === 'opp';
  const overlay = !es.started || (!!s && (s.t === 'panel' || s.t === 'assign') && !es.out) || !!es.tgt || (!!es.out && !hideOut);
  const showEnd = es.started && !es.out && !es.pend.length && !!fs && fs.mode !== 'awaken' && !fs.bbtn && st === 'open' && b.turn === 'me';

  // ---------------- overlay tartalom ----------------
  let ov: ReactNode = null;
  if (!es.started) {
    ov = (
      <div className="pb-panel" role="dialog" aria-label="Bevezető">
        <span className="pb-tag">HELYZET</span>
        <T as="p" t={scn.brief} />
        <button type="button" className="pb-btn primary" onClick={() => setEs(start(es))}>Szituáció indítása</button>
      </div>);
  } else if (es.out && !hideOut) {
    const o = es.out; const ok = o.kind === 'good';
    ov = (
      <div className={'pb-panel out ' + (ok ? 'good' : 'bad')} role="dialog" aria-label="Kimenet">
        <span className="pb-tag">OUTCOME</span>
        <button type="button" className="pb-x" aria-label="Bezárás" onClick={() => setHideOut(true)}><X size={18} /></button>
        <h3 className="pb-out-t">{o.title}</h3>
        <T as="p" t={o.text} />
        {!ok && o.opt && <div className="pb-opt"><b>Optimális sor:</b> <T t={o.opt} /></div>}
        <div className="pb-btns row">
          <button type="button" className="pb-btn" onClick={restart}><RotateCcw size={15} /> Újrajátszás</button>
          {ok && next && <a className="pb-btn primary" href={next.href}>Következő szituáció <ChevronRight size={15} /></a>}
        </div>
      </div>);
  } else if (es.tgt) {
    const t = es.tgt.spec; const sel = es.tgt.sel;
    const groups: Record<string, string[]> = {};
    t.opts.forEach((r) => { (groups[groupOf(b, r) || 'Egyéb'] ||= []).push(r); });
    const canCancel = t.cancel !== false && s?.t !== 'target';
    ov = (
      <div className="pb-panel tgt" role="dialog" aria-label="Célpont választás">
        <span className="pb-tag">TARGET</span>
        <h3>{t.title || 'Célpont kiválasztása'}</h3>
        <T as="p" t={t.text} className="sub" />
        <p className="pb-count">{sel.length} / {t.max} kiválasztva</p>
        {Object.entries(groups).map(([g, refs]) => (
          <div key={g} className="pb-tgroup"><span className="pb-tgl">{g}</span>
            {refs.map((r) => {
              const l = locate(b, r); const u = l?.u; const ill = t.illegal?.[r]; const on = sel.includes(r);
              return (
                <div key={r} className="pb-topt-w">
                  <button type="button" className={'pb-topt' + (on ? ' on' : '') + (ill ? ' ill' : '')} aria-pressed={on} onClick={() => setEs(tgtToggle(es, r))}>
                    <Card n={u?.n || r} />
                    <span className="pb-topt-n"><b>{u?.n || r}</b>{u && <small>{u.m} Might</small>}{l?.zone === 'chain' && <small>spell a chainen</small>}</span>
                    {on && <em>Kiválasztva</em>}
                  </button>
                  {ill && <T as="p" className="pb-why" t={ill} />}
                </div>);
            })}
          </div>))}
        <div className="pb-btns row">
          {canCancel && <button type="button" className="pb-btn" onClick={() => setEs(tgtCancel(es))}>Mégse</button>}
          <button type="button" className="pb-btn primary" disabled={sel.length < (t.min ?? 1)} onClick={() => setEs(tgtConfirm(es))}>Megerősítés{sel.length ? ' (' + sel.length + ')' : ''}</button>
        </div>
      </div>);
  } else if (s?.t === 'assign') {
    const v = asgView(es);
    ov = (
      <div className="pb-panel asg" role="dialog" aria-label="Damage kiosztás">
        <span className="pb-tag">{s.tag || 'DAMAGE'}</span>
        <T as="p" t={s.text} />
        <div className="pb-asg-left"><span>Kiosztható Might</span><b>{v.left}</b> / {v.amount}</div>
        {v.rows.map((r) => (
          <div key={r.n} className="pb-topt-w">
            <button type="button" className={'pb-topt asg' + (r.picked ? (r.got >= r.lethal ? ' lethal' : ' spill') : '')} disabled={!!r.dis && !r.picked} onClick={() => setEs(asgPick(es, r.n))}>
              <Card n={r.n} /><span className="pb-topt-n"><b>{r.n}</b><small>{r.m} Might, lethal: {r.lethal}</small></span>
              {r.picked && <em>{r.got} damage{r.got >= r.lethal ? ', lethal' : ''}</em>}
            </button>
            {!!r.dis && !r.picked && v.left > 0 && <T as="p" className="pb-why" t={r.dis} />}
          </div>))}
        <div className="pb-btns row">
          <button type="button" className="pb-btn" onClick={() => setEs(asgReset(es))}>Visszaállítás</button>
          <button type="button" className="pb-btn primary" disabled={!v.done} onClick={() => setEs(asgConfirm(es))}>Kiosztás megerősítése</button>
        </div>
      </div>);
  } else if (s?.t === 'panel') {
    ov = (
      <div className="pb-panel" role="dialog" aria-label={s.tag}>
        {s.chain && es.b.chain.length > 0 && <ChainRow es={es} mini />}
        <span className="pb-tag">{s.tag}</span>
        {(s.letter || s.title) && <div className="pb-ph">{s.letter && <span className="pb-letter">{s.letter}</span>}{s.title && <b>{s.title}</b>}</div>}
        {s.card && <Card n={s.card} cls="pb-pcard" onClick={() => openCard(s.card!)} />}
        <T as="p" t={s.text} />
        {s.clash != null && <Clash es={es} bf={s.clash} />}
        {s.cards && s.cards.map((c, i) => (
          <div key={i} className="pb-pc"><Card n={c.card} /><span><b>{c.card}</b> <i className="pb-speed">{speedOf(c.card) || 'normál'}</i></span>
            <button type="button" className="pb-btn" disabled={!!c.dis} onClick={() => setEs(panelBtn(es, i, 'card'))}>Kijátszás</button></div>))}
        <div className="pb-btns">
          {(s.btns || []).map((x, i) => (
            <div key={i}>
              <button type="button" className={'pb-btn ' + (x.kind || '')} disabled={!!x.dis} onClick={() => setEs(panelBtn(es, i))}>{x.l}</button>
              {x.dis && <T as="p" className="pb-why" t={x.dis} />}
            </div>))}
        </div>
      </div>);
  }
  if (tip && !ov) {
    ov = (
      <div className="pb-panel tip" role="dialog" aria-label="Tipp">
        <span className="pb-tag">TIPP</span>
        <button type="button" className="pb-x" aria-label="Bezárás" onClick={() => setTip(false)}><X size={18} /></button>
        <T as="p" t={(fs && fs.hint) || scn.hint || 'Kattints a zölden kiemelt lapokra: megjelennek a lehetőségeid. A szürke menüpont mellett olvasható, miért nem szabályos most.'} />
      </div>);
  }
  const menuOv = menu && !ov ? (
    <div className="pb-panel menu" role="dialog" aria-label={menu.title}>
      <div className="pb-mh"><b>{menu.title}</b>{menu.speed && <span className="pb-tag in">{menu.speed.toUpperCase()}</span>}
        <button type="button" className="pb-x" aria-label="Bezárás" onClick={() => setMenu(null)}><X size={18} /></button></div>
      {menu.cost && <div className="pb-cost"><span>Költség</span><b>{menu.cost}</b></div>}
      {menu.items.map((it) => (
        <div key={it.act + it.label}>
          <button type="button" className={'pb-btn ' + (it.tone || 'act')} disabled={!!it.dis} onClick={() => run((x) => act(x, it.act))}>{it.label}</button>
          {it.dis && <T as="p" className="pb-why" t={it.dis} />}
        </div>))}
      <button type="button" className="pb-link" onClick={() => { const n = menu.ref.startsWith('h:') ? menu.ref.slice(2) : menu.ref.startsWith('r:') ? menu.title.replace(/ \(.*\)$/, '') : menu.title; setMenu(null); openCard(n); }}>Lap részletei</button>
    </div>) : null;

  const pool = b.me.pool || { e: 0, p: {} };
  const poolP = Object.values(pool.p).reduce((a, x) => a + x, 0);
  const handN = Math.min(b.opp.handCount || 0, 8);
  const pts = (side: Side) => {
    if (side === 'me' && bb?.at === 'score') return <button type="button" className="pb-pts me g-awaken" onClick={() => run((x) => act(x, 'bbtn'))}><b>{b.me.score}</b> PTS <em>{bb.l}</em></button>;
    return <span className={'pb-pts ' + side}><b>{b[side].score}</b> PTS</span>;
  };

  return (
    <div className="pb-wrap" ref={wrap}>
      <div className={'pb' + (overlay ? ' dim' : '')} aria-hidden={overlay ? true : undefined}>
        <div className="pb-sideh opp"><span>ELLENFÉL</span>{oppTurn && <span className="pb-turn">KÖR</span>}
          {es.started && <button type="button" className="pb-help" aria-label="Tipp" onClick={() => { setMenu(null); setTip(true); }}><CircleHelp size={16} /></button>}</div>
        <div className="pb-row pb-otop">
          <div className="pb-zone hand"><span className="pb-zl">KÉZ · {b.opp.handCount || 0}</span>
            <div className="pb-cards">{Array.from({ length: handN }, (_, i) => <Card key={i} back cls="sm" label="Az ellenfél lapja" />)}</div></div>
          <div className="pb-zone runes"><span className="pb-zl">RUNE-OK</span><Runes es={es} side="opp" /></div>
        </div>
        <div className="pb-row pb-base opp">
          <div className="pb-lc">{b.opp.champion && <Card n={b.opp.champion} cls="champ" onClick={() => openCard(b.opp.champion!)} badge={<i className="pb-lbl c">CHAMPION</i>} />}
            {b.opp.legend && <Card n={b.opp.legend} cls="legend" onClick={() => openCard(b.opp.legend!)} badge={<i className="pb-lbl l">LEGEND</i>} />}</div>
          <div className="pb-units"><span className="pb-wm" aria-hidden>BASE</span>{b.opp.base.map((u) => <UnitCard key={u.n} u={u} side="opp" es={es} onCard={onCard} />)}</div>
        </div>
        <div className="pb-bfzone">
          <div className="pb-bfhead">{pts('opp')}<span className="pb-zl gold">{b.bfs.length > 1 ? 'BATTLEFIELDEK' : 'BATTLEFIELD'}</span><span /></div>
          {b.bfs.map((f, i) => (
            <div key={i} className="pb-bf" data-bfi={i}>
              <div className="pb-ubox opp"><span className="pb-ul">ELLENFÉL{f.opp.length > 0 && <b><Swords size={11} /> {mightAt(b, i, 'opp')}</b>}</span>
                <div className="pb-cards">{f.opp.map((u) => <UnitCard key={u.n} u={u} side="opp" es={es} onCard={onCard} />)}</div></div>
              <div className={'pb-bfc' + (f.ctrl ? ' c-' + f.ctrl : '')}>
                <Card n={f.name} land onClick={() => openCard(f.name)} />
                <span className="pb-bfn">{f.name}</span>
                <span className="pb-ctrl">{f.ctrl === 'me' ? 'Te kontrollálod' : f.ctrl === 'opp' ? 'Ellenfél kontrollálja' : 'Gazdátlan'}</span>
                {f.fd && <span className="pb-fd">{(() => { const g = f.fd === 'me' ? glowOf(es, 'fd:' + i) : ''; return (
                  <button type="button" className={'pb-card sm fdc' + (g ? ' g-' + g : '')} aria-label={'Facedown lap: ' + (f.fd === 'me' ? f.fdCard : 'ellenfél')}
                    onClick={() => { if (f.fd !== 'me') return; const m = menuFor(es, 'fd:' + i); if (m && es.started && !es.out) setMenu(m); else if (f.fdCard) openCard(f.fdCard); }}>
                    <span className="pb-back"><span>R</span></span></button>); })()}<small>facedown</small></span>}
              </div>
              <div className="pb-ubox me"><span className="pb-ul">TE{f.me.length > 0 && <b><Swords size={11} /> {mightAt(b, i, 'me')}</b>}</span>
                <div className="pb-cards">{f.me.map((u) => <UnitCard key={u.n} u={u} side="me" es={es} onCard={onCard} />)}</div></div>
              {pendBf === i && !es.out && !overlay && <button type="button" className="pb-confirm" onClick={() => run((x) => act(x, 'confirm'))}><Swords size={14} /> Mozgás megerősítése</button>}
            </div>))}
          {pendBf === -1 && !es.out && !overlay && <button type="button" className="pb-confirm" onClick={() => run((x) => act(x, 'confirm'))}>Mozgás megerősítése</button>}
          <div className="pb-bfhead foot"><span /><span />{pts('me')}</div>
        </div>
        <ChainRow es={es} />
        <div className="pb-row pb-base me">
          <div className="pb-units"><span className="pb-wm" aria-hidden>BASE</span>{b.me.base.map((u) => <UnitCard key={u.n} u={u} side="me" es={es} onCard={onCard} />)}</div>
          <div className="pb-lc">{b.me.legend && <Card n={b.me.legend} cls="legend" ex={b.me.legendEx} glow={glowOf(es, 'legend')} onClick={() => (fs?.mode === 'awaken' && b.me.legendEx ? run((x) => act(x, 'ready:legend')) : openCard(b.me.legend!))} badge={<i className="pb-lbl l">LEGEND</i>} />}
            {b.me.champion && <Card n={b.me.champion} cls="champ" onClick={() => openCard(b.me.champion!)} badge={<i className="pb-lbl c">CHAMPION</i>} />}</div>
        </div>
        {scn.pool && (
          <div className="pb-pool" aria-label="Rune Pool">
            <div className="pb-meter"><span>ENERGY</span><div>{Array.from({ length: 12 }, (_, k) => <i key={k} className={k < pool.e ? 'on e' : ''} />)}</div><b>{pool.e} / 12</b></div>
            <div className="pb-meter"><span>POWER</span><div>{Array.from({ length: 12 }, (_, k) => { const ds = Object.entries(pool.p).flatMap(([d, n]) => Array(n).fill(d)); return <i key={k} className={k < poolP ? 'on' : ''} style={k < poolP ? { background: DOMC[ds[k]] } : undefined} />; })}</div><b>{poolP} / 12</b></div>
          </div>)}
        <div className="pb-row pb-mbot">
          <div className="pb-zone runes"><Runes es={es} side="me" onRune={onRune} /><span className="pb-zl">RUNE-OK</span>{bbtn('runes')}</div>
          <div className="pb-zone hand"><div className="pb-cards">{(b.me.hand || []).map((n) => <Card key={n} n={n} glow={glowOf(es, 'h:' + n)} onClick={() => onCard('h:' + n, 'me')} label={n + ', kézben'} />)}
            {!(b.me.hand || []).length && <span className="note">üres</span>}</div><span className="pb-zl">KÉZ</span>{bbtn('hand')}</div>
        </div>
        <div className="pb-sideh me"><span>TE</span>{es.started && <span className="pb-state">{stateLabel(st)}</span>}{!oppTurn && <span className="pb-turn me">KÖR</span>}</div>
      </div>
      {(ov || menuOv) && <div className="pb-ov">{ov || menuOv}</div>}
      {toast && !ov && <div className="pb-toast" role="status"><T t={toast} /><button type="button" aria-label="Bezárás" onClick={() => setToast(null)}><X size={14} /></button></div>}
      {es.started && s?.t === 'auto' && !es.out && <div className="pb-toast opp" role="status"><span className="dot" /> {s.toast}</div>}
      <div className="pb-under">
        {es.out && hideOut && <button type="button" className="pb-btn" onClick={restart}><RotateCcw size={15} /> Újrajátszás</button>}
        {fs?.pass && !es.out && !es.tgt && <button type="button" className="pb-btn" onClick={() => run((x) => act(x, 'pass'))}>Passz</button>}
        {showEnd && <button type="button" className="pb-btn end" onClick={() => run((x) => act(x, 'end'))}>End Turn</button>}
      </div>
    </div>
  );
}
