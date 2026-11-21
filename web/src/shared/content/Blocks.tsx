/* Tanulási tartalom blokkjai (How to Play, Practice leckék, versenyformátum oldalak): a LearnView és a RulesView közös része. */
import { useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Check, ChevronLeft, ChevronRight, Clock, Compass, ExternalLink, Info, Lightbulb, Play, RotateCcw, X } from 'lucide-react';
import { IMGBASE, vsCard } from '../../domain/data/store';
import { Playmat, DEMO_BOARD } from '../board/Playmat';
import { inline } from './richText';
import { openCard } from '../lib/events';

export { inline };
type Cell = [number, string];
export type Block =
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

export const H = ({ t, seen, as = 'span', className }: { t: string; seen?: Set<string>; as?: 'span' | 'p' | 'div' | 'b'; className?: string }) => {
  const El = as as React.ElementType;
  return <El className={className} dangerouslySetInnerHTML={{ __html: inline(t, seen) }} />;
};
const imgOf = (n: string) => { const c = vsCard(n); return c && c.img ? IMGBASE + c.img : ''; };

/** Olvasási idő: a blokkok szövegéből, kb. 170 szó percenként. */
export function readMin(blocks: Block[]) {
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
  const c = vsCard(card);
  const [ex, setEx] = useState<boolean[]>(() => runes.map(() => false));
  const [rec, setRec] = useState<boolean[]>(() => runes.map(() => false));
  const [fb, setFb] = useState<{ ok: boolean; lines: string[] } | null>(null);
  if (!c) return null;
  const needE = +c.e! || 0, needP = +c.p! || 0, doms: string[] = c.d || [];
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
              <div className="ti-pow">{Array.from({ length: needP }, (_, k) => <i key={k} className={k < goodP ? 'f' : ''} style={{ '--dc': DOMC[doms[0]] || '#888' } as React.CSSProperties}>{doms[0]}</i>)}
                {wrongP.map((d, k) => <i key={'w' + k} className="bad" style={{ '--dc': DOMC[d] || '#888' } as React.CSSProperties}>{d}</i>)}</div>
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
                {b.names.map((n) => { const c = vsCard(n); return c ? (
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
