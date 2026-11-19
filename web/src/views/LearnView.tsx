import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, BookOpen, Check, ChevronLeft, ChevronRight, Clock, Compass, ExternalLink, Info, Lightbulb, Play, RotateCcw, X } from 'lucide-react';
import { loadLearn } from '../data';
import { IMGBASE, esc, glossify, vsCard } from '../legacy/core';
import { Playmat, DEMO_BOARD, diffBoards } from '../components/Playmat';

type Cell = [number, string];
type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'callout'; kind: 'tip' | 'note' | 'warn' | 'rule' | 'strategy'; title?: string; text: string }
  | { type: 'steps'; title?: string; items: { title: string; text: string; badge?: string }[] }
  | { type: 'flow'; items: string[] }
  | { type: 'stats'; items: { value: string; label: string; note?: string; bar?: number }[] }
  | { type: 'cards'; names: string[]; caption?: string }
  | { type: 'table'; title?: string; head: string[]; rows: string[][] }
  | { type: 'choice'; title?: string; note?: string; a: { title: string; text: string }; b: { title: string; text: string } }
  | { type: 'explorer'; caption?: string }
  | { type: 'playmat'; caption?: string }
  | { type: 'tryit'; card: string; runes: string[] }
  | { type: 'timing'; title?: string; turns: string[]; states: { name: string; desc: string }[]; kinds: string[]; cells: Cell[][][] }
  | { type: 'chainstep'; title?: string; steps: { title: string; text: string; chain: string[]; pri?: string | null; done?: string }[] }
  | { type: 'links'; items: { href: string; title: string; text?: string }[] };
type Chapter = { id: string; section: 'hogyan' | 'lecke'; level?: string; title: string; sub?: string; rules?: string; old?: string[]; blocks: Block[] };
type Board = any;
type Step = { say: string; board?: Board; choice?: { q: string; opts: { t: string; ok?: boolean; why: string }[] } };
type Scenario = { id: string; title: string; level: string; intro: string; rules?: string; steps: Step[] };
type Learn = { chapters: Chapter[]; scenarios: Scenario[] };

const LEVELS: [string, string, string][] = [
  ['kezdo', 'Kezdő', 'Az első játékok tipikus félreértései.'],
  ['halado', 'Haladó', 'Tempo, csere, Rune Deck és decképítés.'],
  ['profi', 'Profi', 'Priority, Focus, Hidden és triggerek.'],
];
const lvName = (lv?: string) => LEVELS.find((l) => l[0] === lv)?.[1] || '';

/** [[Kártya]] kártyalink, {{123.4}} szabálylink, plusz fogalom-tooltip. */
export function inline(text: string, seen?: Set<string>) {
  let h = esc(text)
    .replace(/\[\[([^\]]+)\]\]/g, (_, n) => '<span class="cl" data-card="' + n + '">' + n + '</span>')
    .replace(/\{\{([\d.a-z\-, ]+)\}\}/gi, (_, r) => String(r).split(/\s*,\s*/).map((x: string) => '<a class="rref" href="#szabalyok" data-ref="' + x + '">' + x + '</a>').join(' '));
  try { h = glossify(h, seen || new Set()); } catch { /* glossify nélkül is olvasható */ }
  return h;
}
const H = ({ t, seen, as = 'span', className }: { t: string; seen?: Set<string>; as?: 'span' | 'p' | 'div' | 'b'; className?: string }) => {
  const El = as as any;
  return <El className={className} dangerouslySetInnerHTML={{ __html: inline(t, seen) }} />;
};
const openCard = (n: string) => window.dispatchEvent(new CustomEvent('rb:open-card', { detail: n }));
const imgOf = (n: string) => { const c: any = vsCard(n); return c && c.img ? IMGBASE + c.img : ''; };

/** Olvasási idő: a blokkok szövegéből, kb. 170 szó percenként. */
function readMin(blocks: Block[]) {
  const words = JSON.stringify(blocks).replace(/\{\{[^}]*\}\}/g, '').replace(/"(type|kind|title|text|items|head|rows|names|caption|badge)":/g, ' ').split(/[\s"]+/).filter((w) => /\p{L}/u.test(w)).length;
  return Math.max(1, Math.round(words / 170));
}

function Callout({ b, seen }: { b: Extract<Block, { type: 'callout' }>; seen: Set<string> }) {
  const Icon = b.kind === 'warn' ? AlertTriangle : b.kind === 'strategy' ? Compass : b.kind === 'rule' ? BookOpen : b.kind === 'note' ? Info : Lightbulb;
  const def = { tip: 'Tipp', note: 'Megjegyzés', warn: 'Figyelem', rule: 'Szabály', strategy: 'Stratégia, nem szabály' }[b.kind] || 'Megjegyzés';
  const tag = { tip: 'Tip', note: 'Note', warn: 'Warning', rule: 'Key Rule', strategy: 'Stratégia' }[b.kind] || '';
  return (
    <div className={'callout ' + b.kind}>
      <Icon size={18} aria-hidden />
      <span className="ctag">{tag}</span>
      <b className="t">{b.title || def}</b>
      <H as="p" t={b.text} seen={seen} />
    </div>
  );
}

function Stats({ b, seen }: { b: Extract<Block, { type: 'stats' }>; seen: Set<string> }) {
  return (
    <div className="lstats">
      {b.items.map((s, i) => (
        <div key={i} className="lstat">
          <b className="v">{s.value}</b>
          <div><span className="l">{s.label}</span>{s.note && <H className="n" t={s.note} seen={seen} />}</div>
          {!!s.bar && <ol className="pbar" aria-label={s.bar + ' pont'}>{Array.from({ length: s.bar }, (_, k) => <li key={k} className={k === s.bar! - 1 ? 'win' : ''}>{k + 1}</li>)}</ol>}
        </div>
      ))}
    </div>
  );
}

function Explorer({ caption, seen }: { caption?: string; seen: Set<string> }) {
  return (
    <div className="lexplorer">
      <div className="lx-head"><Compass size={16} aria-hidden /> Koppints vagy vigyél egy zónára</div>
      <Playmat b={DEMO_BOARD} hover infoTop turn={null} />
      {caption && <H as="p" className="note" t={caption} seen={seen} />}
    </div>
  );
}

const DOMC: Record<string, string> = { Fury: '#ff5a4e', Calm: '#4fcf8a', Mind: '#5fa1ff', Body: '#f59a45', Chaos: '#b07ef2', Order: '#e9cb4d' };

/** Try It: egy valódi lap kifizetése rune-okkal (exhaust = Energy, recycle = Power). */
function TryIt({ card, runes }: { card: string; runes: string[] }) {
  const c: any = vsCard(card);
  const [ex, setEx] = useState<boolean[]>(() => runes.map(() => false));
  const [rec, setRec] = useState<boolean[]>(() => runes.map(() => false));
  const [fb, setFb] = useState<{ ok: boolean; lines: string[] } | null>(null);
  if (!c) return null;
  const needE = +c.e || 0, needP = +c.p || 0, doms: string[] = c.d || [];
  const energy = ex.filter(Boolean).length;
  const recD = runes.filter((_, i) => rec[i]);
  const goodP = recD.filter((d) => doms.includes(d)).length;
  const wrongP = recD.filter((d) => !doms.includes(d));
  const reset = () => { setEx(runes.map(() => false)); setRec(runes.map(() => false)); setFb(null); };
  const toggleEx = (i: number) => { if (rec[i]) return; const n = [...ex]; n[i] = !n[i]; setEx(n); setFb(null); };
  const toggleRec = (i: number) => { const n = [...rec]; n[i] = !n[i]; setRec(n); setFb(null); };
  const check = () => {
    const L: string[] = [];
    let ok = true;
    if (energy < needE) { ok = false; L.push('Kevés az Energy: ' + needE + ' kell, ' + energy + ' van. Exhaustolj még ' + (needE - energy) + ' rune-t {{164.2.a}}.'); }
    if (needP && goodP < needP) { ok = false; L.push('Hiányzik ' + (needP - goodP) + ' ' + doms.join(' vagy ') + ' Power: recycle-ölj egy ilyen domainű rune-t {{164.2.b.1}}.'); }
    if (wrongP.length && needP) { ok = false; L.push('A ' + wrongP.join(', ') + ' Power nem fizeti a ' + doms.join('/') + ' költséget {{163.2.a}}, és a rune feleslegesen hagyta el a boardot {{161.2.b}}.'); }
    if (!needP && recD.length) { ok = false; L.push('Ez a lap nem kér Powert. A recycle-ölt rune feleslegesen került a Rune Deck aljára {{161.2.b}}.'); }
    if (ok && goodP > needP) { ok = false; L.push('Több Powert termeltél, mint kell, a plusz rune feleslegesen hagyta el a boardot {{161.2.b}}.'); }
    if (ok && energy > needE) { ok = false; L.push('A lap ki van fizetve, de ' + (energy - needE) + ' Energy a poolban maradt. A Main Phase-ben még elköltheted, a kör végén elvész {{167}}.'); }
    if (ok) {
      const idle = runes.filter((_, k) => !ex[k] && !rec[k]).length;
      L.push('Kifizetve: ' + needE + ' Energy' + (needP ? ' és ' + needP + ' ' + doms.join('/') + ' Power' : '') + '.' + (idle ? ' ' + idle + ' rune ready maradt, ezzel az ellenfél körében is fizethetsz {{164.2.a}}.' : ''));
      if (needP && runes.some((_, i) => ex[i] && rec[i])) L.push('Ugyanaz a rune adott Energyt és Powert is: előbb exhaust, utána recycle {{164.2.b}}.');
      else if (needP) L.push('Egy exhaustolt rune is recycle-ölhető, így egy rune-ból Energy és Power is jöhet {{164.2.b}}.');
    }
    setFb({ ok, lines: L });
  };
  return (
    <div className="tryit">
      <div className="ti-head"><Play size={14} aria-hidden /> Try It: fizesd ki a lapot</div>
      <div className="ti-grid">
        <figure onClick={() => openCard(c.n)} title="Részletek">
          <img src={IMGBASE + c.img} alt={c.n} loading="lazy" />
          <figcaption><b>{c.n}</b><span>{needE} Energy{needP ? ' + ' + needP + ' ' + doms.join('/') + ' Power' : ''}</span></figcaption>
        </figure>
        <div className="ti-body">
          <div className="ti-meter" aria-label={'Energy ' + energy + ' / ' + needE}>
            <span className="ti-lbl">Energy <b>{energy}</b> / {needE}</span>
            <div className="ti-slots">{Array.from({ length: 12 }, (_, k) => <i key={k} className={(k < energy ? 'f ' : '') + (k < needE ? 'need' : '')} />)}</div>
          </div>
          {needP > 0 && (
            <div className="ti-meter">
              <span className="ti-lbl">Power <b>{goodP}</b> / {needP}</span>
              <div className="ti-pow">{Array.from({ length: needP }, (_, k) => <i key={k} className={k < goodP ? 'f' : ''} style={{ ['--dc' as any]: DOMC[doms[0]] || '#888' }}>{doms[0]}</i>)}
                {wrongP.map((d, k) => <i key={'w' + k} className="bad" style={{ ['--dc' as any]: DOMC[d] || '#888' }}>{d}</i>)}</div>
            </div>
          )}
          <div className="ti-runes">
            {runes.map((d, i) => (
              <div key={i} className={'ti-rune' + (ex[i] ? ' ex' : '') + (rec[i] ? ' rec' : '')}>
                <button type="button" onClick={() => toggleEx(i)} disabled={rec[i]} aria-pressed={ex[i]} title={ex[i] ? 'Exhausted (1 Energy)' : 'Exhaust: 1 Energy'}>
                  <img src={imgOf(d + ' Rune')} alt={d + ' Rune'} loading="lazy" />
                </button>
                <button type="button" className="ti-rec" onClick={() => toggleRec(i)} aria-pressed={rec[i]}>{rec[i] ? 'Vissza' : 'Recycle'}</button>
              </div>
            ))}
          </div>
          <div className="ti-ctl">
            <button type="button" className="btn hex" onClick={check}><Check size={15} /> Ellenőrzés</button>
            <button type="button" className="btn sec" onClick={reset}><RotateCcw size={15} /> Újra</button>
          </div>
          {fb && <div className={'ti-fb ' + (fb.ok ? 'ok' : 'bad')} aria-live="polite">{fb.ok ? <Check size={16} /> : <X size={16} />}<div>{fb.lines.map((l, k) => <H key={k} as="p" t={l} />)}</div></div>}
        </div>
      </div>
    </div>
  );
}

function Timing({ b, seen }: { b: Extract<Block, { type: 'timing' }>; seen: Set<string> }) {
  const [t, setT] = useState(0);
  const [s, setS] = useState(0);
  const row = b.cells[t][s];
  return (
    <div className="ltiming">
      {b.title && <div className="lx-head"><Clock size={16} aria-hidden /> {b.title}</div>}
      <div className="seg" role="tablist">{b.turns.map((x, i) => <button key={i} type="button" role="tab" aria-selected={t === i} onClick={() => setT(i)}>{x}</button>)}</div>
      <div className="seg st" role="tablist">{b.states.map((x, i) => <button key={i} type="button" role="tab" aria-selected={s === i} onClick={() => setS(i)}>{x.name}</button>)}</div>
      <H as="p" className="note" t={b.states[s].desc} seen={seen} />
      <div className="tm-res">{b.kinds.map((k, i) => (
        <div key={i} className={'tm-c ' + (row[i][0] ? 'y' : 'n')}>
          <b>{row[i][0] ? <Check size={15} /> : <X size={15} />} <H t={k} /></b>
          <H as="p" t={row[i][1]} />
        </div>))}</div>
    </div>
  );
}

function ChainStep({ b }: { b: Extract<Block, { type: 'chainstep' }> }) {
  const [i, setI] = useState(0);
  const st = b.steps[i];
  return (
    <div className="lchain">
      <div className="lx-head"><BookOpen size={16} aria-hidden /> {b.title || 'Chain példa'}<span className="pos">{i + 1} / {b.steps.length}</span></div>
      <div className="lc-grid">
        <div className="lc-stack" aria-label="Chain">
          <span className="lc-lbl">Chain</span>
          {st.chain.length ? st.chain.map((c, k) => <div key={k} className={'lc-item' + (k === 0 ? ' top' : '')}>{k === 0 && <small>Felül</small>}<H t={c} /></div>)
            : <div className="lc-empty">üres, a kör újra Open</div>}
          {st.done && <div className="lc-done">Feloldódott: <H t={st.done} /></div>}
          <div className="lc-pri">Priority: <b>{st.pri || 'senki, feloldás'}</b></div>
        </div>
        <div className="lc-text"><b>{st.title}</b><H as="p" t={st.text} /></div>
      </div>
      <div className="lc-ctl">
        <button type="button" className="btn sec" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft size={15} /> Előző</button>
        <button type="button" className="btn hex" disabled={i === b.steps.length - 1} onClick={() => setI(i + 1)}>Következő <ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  const seen = useMemo(() => new Set<string>(), [blocks]);
  return (
    <div className="lesson">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'p': return <H key={i} as="p" t={b.text} seen={seen} />;
          case 'h': return <h3 key={i} className="lh">{b.text}</h3>;
          case 'callout': return <Callout key={i} b={b} seen={seen} />;
          case 'stats': return <Stats key={i} b={b} seen={seen} />;
          case 'flow': return <div key={i} className="lflow">{b.items.map((x, j) => <span key={j}>{j > 0 && <i aria-hidden>→</i>}<b>{x}</b></span>)}</div>;
          case 'steps': {
            const lettered = b.items.some((s) => s.badge);
            return (
              <div key={i}>{b.title && <h3>{b.title}</h3>}
                {lettered
                  ? <div className="labcd">{b.items.map((s, j) => <div key={j} className={'lab' + (/^[A-D]$/.test(s.badge || '') ? '' : ' alt')}><span className="badge">{s.badge}</span><b>{s.title}</b><H as="p" t={s.text} seen={seen} /></div>)}</div>
                  : <ol className="lsteps">{b.items.map((s, j) => <li key={j}><b>{s.title}</b><H t={s.text} seen={seen} /></li>)}</ol>}
              </div>);
          }
          case 'cards': return (
            <div key={i}>
              <div className="lcards">
                {b.names.map((n) => { const c: any = vsCard(n); return c ? (
                  <figure key={n} onClick={() => openCard(c.n)} title="Részletek">
                    <img loading="lazy" src={IMGBASE + c.img} alt={c.n} />
                    <figcaption>{c.n}</figcaption>
                  </figure>) : null; })}
              </div>
              {b.caption && <H as="p" t={b.caption} seen={seen} />}
            </div>);
          case 'playmat': return (<div key={i}><Playmat b={DEMO_BOARD} />{b.caption && <H as="p" t={b.caption} seen={seen} />}</div>);
          case 'explorer': return <Explorer key={i} caption={b.caption} seen={seen} />;
          case 'table': return (
            <div key={i} className="ltable-w">{b.title && <h3>{b.title}</h3>}
              <table className="ltable"><thead><tr>{b.head.map((h, j) => <th key={j}>{h}</th>)}</tr></thead>
                <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => k === 0 && !b.head[0] ? <th key={k} scope="row">{c}</th> : <td key={k}><H t={c} seen={seen} /></td>)}</tr>)}</tbody></table></div>);
          case 'choice': return (
            <div key={i} className="lchoice">
              {b.title && <h3>{b.title}</h3>}
              <div className="lc-pair">
                <div className="lc-opt"><b>{b.a.title}</b><H as="p" t={b.a.text} seen={seen} /></div>
                <span className="lc-or">vagy</span>
                <div className="lc-opt"><b>{b.b.title}</b><H as="p" t={b.b.text} seen={seen} /></div>
              </div>
              {b.note && <p className="note">{b.note}</p>}
            </div>);
          case 'tryit': return <TryIt key={i} card={b.card} runes={b.runes} />;
          case 'timing': return <Timing key={i} b={b} seen={seen} />;
          case 'chainstep': return <ChainStep key={i} b={b} />;
          case 'links': return (
            <div key={i} className="llinks">{b.items.map((l, j) => {
              const ext = /^https?:/.test(l.href);
              return <a key={j} href={l.href} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}><b>{l.title}{ext && <ExternalLink size={13} aria-hidden />}</b>{l.text && <span>{l.text}</span>}</a>;
            })}</div>);
          default: return null;
        }
      })}
    </div>
  );
}

function ScenarioView({ s, all }: { s: Scenario; all: Scenario[] }) {
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<Record<number, number>>({});
  useEffect(() => { setI(0); setPick({}); setStarted(false); }, [s.id]);
  const st = s.steps[i];
  let board: Board | undefined; for (let k = i; k >= 0 && !board; k--) board = s.steps[k].board;
  let prevBoard: Board | undefined; for (let k = i - 1; k >= 0 && !prevBoard; k--) prevBoard = s.steps[k].board;
  const changes = st.board ? diffBoards(prevBoard, st.board) : [];
  const blocked = !!st.choice && pick[i] == null;
  const last = i === s.steps.length - 1;
  const idx = all.indexOf(s); const nextS = all[idx + 1];
  const next = () => { if (!started) { setStarted(true); return; } if (blocked) return; if (last) location.hash = nextS ? '#tanulas/sz/' + nextS.id : '#tanulas/sz'; else setI(i + 1); };
  const back = () => started && i > 0 && setI(i - 1);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.target as HTMLElement).closest('input,textarea')) return; if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') back(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  const ok = st.choice?.opts.find((o) => o.ok);
  return (
    <div className="scn">
      <div className="chhead">
        <div className="crumb"><a href="#tanulas">Practice</a> › <a href="#tanulas/sz">Szituációk</a> › {s.title}</div>
        <span className="pos">{idx + 1} / {all.length}</span>
      </div>
      <h1 className="chtitle">{s.title}</h1>
      <H as="p" className="chsub" t={s.intro} />
      <div className="scn-grid">
        <div className="scn-boardcol">{board && <Playmat key={s.id} b={board} prev={started ? prevBoard : undefined} turn={(board as any).turn || 'me'} />}</div>
        <aside className={'scn-narr' + (started ? '' : ' pre')}>
          {!started ? (
            <>
              <div className="scn-step"><span>{lvName(s.level) || 'Kezdő'} · {s.steps.length} lépés</span></div>
              <H as="div" t={s.intro} />
              {s.rules && <p className="note">Core Rules: <span dangerouslySetInnerHTML={{ __html: inline('{{' + s.rules + '}}') }} /></p>}
              <p className="note">A pálya a kiinduló állást mutatja. A döntéseknél válassz, utána jön a magyarázat.</p>
              <div className="scn-ctl"><span />
                <button className="btn hex" onClick={() => setStarted(true)}><Play size={16} /> Szituáció indítása</button></div>
            </>
          ) : (
            <>
              <div className="scn-step"><span>{i + 1}. lépés / {s.steps.length}</span>
                <div className="scn-dots" aria-hidden>{s.steps.map((_, k) => <i key={k} className={k === i ? 'on' : k < i ? 'seen' : ''} onClick={() => k <= i && setI(k)} />)}</div></div>
              <H as="div" t={st.say} />
              {!!changes.length && (
                <div className="scn-chg"><b>Mi változott?</b><ul>{changes.map((c, k) => <li key={k}>{c}</li>)}</ul></div>
              )}
              {st.choice && (
                <div className="scn-choice">
                  <H as="p" t={st.choice.q} />
                  <div className="qopts">{st.choice.opts.map((o, k) => {
                    const cls = pick[i] == null ? '' : o.ok ? 'ok' : k === pick[i] ? 'bad' : '';
                    return <button key={k} className={cls} disabled={pick[i] != null} onClick={() => setPick({ ...pick, [i]: k })}><H t={o.t} /></button>;
                  })}</div>
                  {pick[i] != null && <div className="qwhy"><H t={(st.choice.opts[pick[i]].ok ? 'Helyes. ' : 'Nem jó. ') + st.choice.opts[pick[i]].why} /></div>}
                  {pick[i] != null && !st.choice.opts[pick[i]].ok && ok && <div className="qwhy"><H t={'A jó válasz: ' + ok.t + '. ' + ok.why} /></div>}
                </div>
              )}
              <div className="scn-ctl">
                <button className="btn sec" disabled={i === 0} onClick={back}><ChevronLeft size={16} /> Vissza</button>
                <button className="btn hex" disabled={blocked} onClick={next}>{last ? (nextS ? <>Következő szituáció <ChevronRight size={16} /></> : <><Check size={16} /> Vissza a listához</>) : <>Tovább <ChevronRight size={16} /></>}</button>
              </div>
              <p className="note">Kattints egy unitra a részletekért, a címkékre (Attacker, Buff, ...) mutatva magyarázatot kapsz. Billentyűzet: ← →</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

type Route =
  | { k: 'ch'; id?: string }
  | { k: 'pidx' } | { k: 'sz' } | { k: 'scn'; id: string } | { k: 'lk' } | { k: 'lesson'; id: string };

function parse(hash: string, base: 'hogyan' | 'tanulas'): Route {
  const parts = hash.replace(/^#/, '').split('/');
  if (base === 'hogyan') return { k: 'ch', id: parts[0] === 'hogyan' ? parts[1] : undefined };
  if (parts[1] === 'sz') return parts[2] ? { k: 'scn', id: parts[2] } : { k: 'sz' };
  if (parts[1] === 'lecke') return parts[2] ? { k: 'lesson', id: parts[2] } : { k: 'lk' };
  if (parts[1]) return { k: 'lesson', id: parts[1] };
  return { k: 'pidx' };
}

function Pager({ prev, next }: { prev?: { href: string; title: string; label?: string }; next?: { href: string; title: string; label?: string } }) {
  return (
    <div className="pager">
      {prev ? <a href={prev.href}><small><ChevronLeft size={11} /> {prev.label || 'Előző'}</small><b>{prev.title}</b></a> : <span />}
      {next && <a className="next" href={next.href}><small>{next.label || 'Következő'} <ChevronRight size={11} /></small><b>{next.title}</b></a>}
    </div>
  );
}

function ChapterPage({ ch, list, crumb, hrefOf, after }: { ch: Chapter; list: Chapter[]; crumb: ReactNode; hrefOf: (c: Chapter) => string; after?: { href: string; title: string; label?: string } }) {
  const idx = list.indexOf(ch); const prev = list[idx - 1], next = list[idx + 1];
  return (
    <>
      <div className="chhead"><div className="crumb">{crumb}</div><span className="pos">{idx + 1} / {list.length}</span></div>
      <h1 className="chtitle">{ch.title}</h1>
      {ch.sub && <H as="p" className="chsub" t={ch.sub} />}
      <p className="chmeta">{ch.section === 'lecke' && <><Clock size={12} aria-hidden /> {readMin(ch.blocks)} perc · </>}Core Rules: <span dangerouslySetInnerHTML={{ __html: inline('{{' + (ch.rules || '') + '}}') }} /></p>
      <Blocks blocks={ch.blocks} />
      <Pager prev={prev && { href: hrefOf(prev), title: prev.title }} next={next ? { href: hrefOf(next), title: next.title } : after} />
    </>
  );
}

/** Oldalsáv: asztali nézetben fix lista, mobilon lenyitható. */
function Side({ title, groups, cur, pos }: { title: string; groups: { h?: string; items: { id: string; href: string; t: string; n: string }[] }[]; cur?: string; pos?: string }) {
  const body = groups.map((g, gi) => (
    <div key={gi}>{g.h && <h4>{g.h}</h4>}
      <ol>{g.items.map((it) => <li key={it.id}><a href={it.href} aria-current={cur === it.id ? 'page' : undefined}><span className="num">{it.n}</span>{it.t}</a></li>)}</ol>
    </div>));
  return (
    <>
      <aside className="panel learn-side"><h4 className="sh">{title}</h4>{body}</aside>
      <details className="panel learn-side-m"><summary>{title}{pos && <span className="pos">{pos}</span>}</summary>{body}</details>
    </>
  );
}

export function LearnView({ hash, base = 'tanulas' }: { hash: string; base?: 'tanulas' | 'hogyan' }) {
  const [L, setL] = useState<Learn | null>(null);
  useEffect(() => { loadLearn().then((x: any) => setL(x)); }, []);
  const route = parse(hash, base);
  const htp = L ? L.chapters.filter((c) => c.section === 'hogyan') : [];
  const lessons = L ? LEVELS.flatMap(([lv]) => L.chapters.filter((c) => c.section === 'lecke' && c.level === lv)) : [];
  // Régi linkek: #hogyan/<régi id>, #tanulas/<lecke id>
  useEffect(() => {
    if (!L) return;
    if (route.k === 'ch' && route.id && !htp.some((c) => c.id === route.id)) {
      const t = L.chapters.find((c) => c.old?.includes(route.id!));
      if (t) location.replace(t.section === 'hogyan' ? '#hogyan/' + t.id : '#tanulas/lecke/' + t.id);
    }
    if (route.k === 'lesson' && /^#tanulas\/(?!lecke\/)/.test(hash) && lessons.some((c) => c.id === route.id)) location.replace('#tanulas/lecke/' + route.id);
  }, [L, hash]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [hash]);
  if (!L) return <div className="panel pad"><p className="note">Betöltés…</p></div>;

  if (base === 'hogyan') {
    const ch = htp.find((c) => c.id === (route as any).id) || htp[0];
    if (!ch) return <div className="panel pad"><h2>How to Play</h2></div>;
    const side = <Side title="How to Play" cur={ch.id} pos={htp.indexOf(ch) + 1 + ' / ' + htp.length} groups={[{ items: htp.map((c, i) => ({ id: c.id, href: '#hogyan/' + c.id, t: c.title, n: String(i + 1) })) }]} />;
    return (
      <div className="learn">
        {side}
        <main className="panel learn-main">
          <ChapterPage ch={ch} list={htp} hrefOf={(c) => '#hogyan/' + c.id} crumb={<><a href="#hogyan">How to Play</a> › {ch.title}</>}
            after={L.scenarios[0] && { href: '#tanulas/sz', title: 'Szituációk', label: 'Practice' }} />
        </main>
      </div>
    );
  }

  const scs = L.scenarios;
  const cur = route.k === 'scn' || route.k === 'lesson' ? route.id : undefined;
  const side = <Side title="Practice" cur={cur} groups={[
    { h: 'Szituációk', items: scs.map((s, i) => ({ id: s.id, href: '#tanulas/sz/' + s.id, t: s.title, n: String(i + 1) })) },
    ...LEVELS.map(([lv, name]) => ({ h: name + ' leckék', items: lessons.filter((c) => c.level === lv).map((c) => ({ id: c.id, href: '#tanulas/lecke/' + c.id, t: c.title, n: String(lessons.indexOf(c) + 1) })) })).filter((g) => g.items.length),
  ]} />;

  const scnList = (
    <ol className="scnlist">{scs.map((s, i) => (
      <li key={s.id}><a href={'#tanulas/sz/' + s.id}><span className="num">{i + 1}</span><span><b>{s.title}</b><H t={s.intro} /></span><ChevronRight size={16} aria-hidden /></a></li>))}</ol>
  );
  const lessonGrid = (
    <div className="lgroups">{LEVELS.map(([lv, name, d]) => {
      const list = lessons.filter((c) => c.level === lv); if (!list.length) return null;
      return (
        <section key={lv} className="lgroup">
          <h3>{name} <small>{list.length} lecke · {d}</small></h3>
          <div className="lkcards">{list.map((c) => (
            <a key={c.id} className="lkcard" href={'#tanulas/lecke/' + c.id}>
              <span className="lk-meta"><Clock size={12} aria-hidden /> {readMin(c.blocks)} perc</span>
              <b>{c.title}</b>
              {c.sub && <H as="p" t={c.sub} />}
              <span className="lk-go">Lecke megnyitása <ChevronRight size={14} /></span>
            </a>))}</div>
        </section>);
    })}</div>
  );

  let main: ReactNode;
  if (route.k === 'scn') {
    const s = scs.find((x) => x.id === route.id);
    if (s) return <div className="learn wide"><main className="panel learn-main"><ScenarioView s={s} all={scs} /></main></div>;
    main = <><h1 className="chtitle">Nincs ilyen szituáció</h1>{scnList}</>;
  } else if (route.k === 'lesson') {
    const ch = lessons.find((c) => c.id === route.id);
    main = ch ? <ChapterPage ch={ch} list={lessons} hrefOf={(c) => '#tanulas/lecke/' + c.id}
      crumb={<><a href="#tanulas">Practice</a> › <a href="#tanulas/lecke">Haladó leckék</a> › {lvName(ch.level)} › {ch.title}</>} />
      : <><h1 className="chtitle">Nincs ilyen lecke</h1>{lessonGrid}</>;
  } else if (route.k === 'sz') {
    main = (<><div className="chhead"><div className="crumb"><a href="#tanulas">Practice</a> › Szituációk</div></div>
      <h1 className="chtitle">Szituációk</h1><p className="chsub">Board state-ek lépésenként, döntésekkel és magyarázattal.</p>{scnList}</>);
  } else if (route.k === 'lk') {
    main = (<><div className="chhead"><div className="crumb"><a href="#tanulas">Practice</a> › Haladó leckék</div></div>
      <h1 className="chtitle">Haladó leckék</h1><p className="chsub">Szintenként csoportosítva, a How to Play után.</p>{lessonGrid}</>);
  } else {
    main = (
      <>
        <div className="chhead"><div className="crumb">Practice</div></div>
        <h1 className="chtitle">Practice</h1>
        <p className="chsub">Szituációk a pályán lépésenként, és haladó leckék szintenként.</p>
        <div className="pcta">
          <a className="btn hex" href={'#tanulas/sz/' + (scs[0]?.id || '')}>Első szituáció <ChevronRight size={16} /></a>
          <a className="btn sec" href="#hogyan">How to Play</a>
        </div>
        <h2 className="psec">Szituációk <small>{scs.length}</small></h2>
        {scnList}
        <h2 className="psec">Haladó leckék <small>{lessons.length}</small></h2>
        {lessonGrid}
        <p className="note" style={{ marginTop: 18 }}>AI által írt, nem hivatalos összefoglaló. A pontos szöveg mindig a hivatkozott szabályszámra kattintva olvasható, versenyen a judge és a Core Rules dönt.</p>
      </>
    );
  }
  return (
    <div className="learn">
      {side}
      <main className="panel learn-main">{main}</main>
    </div>
  );
}
