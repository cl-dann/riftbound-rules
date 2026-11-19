import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Check, ChevronLeft, ChevronRight, Compass, Lightbulb, Swords } from 'lucide-react';
import { loadLearn } from '../data';
import { IMGBASE, esc, glossify, vsCard } from '../legacy/core';
import { Playmat, DEMO_BOARD, diffBoards } from '../components/Playmat';

type Block =
  | { type: 'p'; text: string }
  | { type: 'callout'; kind: 'tip' | 'warn' | 'rule' | 'strategy'; title?: string; text: string }
  | { type: 'steps'; title?: string; items: { title: string; text: string }[] }
  | { type: 'cards'; names: string[]; caption?: string }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'playmat'; caption?: string };
type Quiz = { q: string; options: string[]; correct: number; why: string };
type Chapter = { id: string; level: 'kezdo' | 'halado'; title: string; lead?: string; rules?: string; blocks: Block[]; quiz?: Quiz[] };
type Board = any;
type Step = { say: string; board?: Board; choice?: { q: string; opts: { t: string; ok?: boolean; why: string }[] } };
type Scenario = { id: string; title: string; level: string; intro: string; rules?: string; steps: Step[] };
type Learn = { chapters: Chapter[]; scenarios: Scenario[] };

const LEVELS: [string, string, string][] = [
  ['kezdo', 'Kezdő', 'Cél, kör, fizetés, combat, chain.'],
  ['halado', 'Haladó', 'Tempo, decképítés, showdown.'],
];
const KEY = 'rb-learn-v1';
type Progress = { done: Record<string, 1>; quiz: Record<string, number[]>; scn: Record<string, 1> };
const loadP = (): Progress => {
  try { return { done: {}, quiz: {}, scn: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { done: {}, quiz: {}, scn: {} }; }
};
const saveP = (p: Progress) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* privát mód */ } };

/** [[Kártya]] kártyalink, {{123.4}} szabálylink, plusz fogalom-tooltip. */
export function inline(text: string, seen?: Set<string>) {
  let h = esc(text)
    .replace(/\[\[([^\]]+)\]\]/g, (_, n) => '<span class="cl" data-card="' + n + '">' + n + '</span>')
    .replace(/\{\{([\d.a-z\-, ]+)\}\}/gi, (_, r) => String(r).split(/\s*,\s*/).map((x: string) => '<a class="rref" href="#szabalyok" data-ref="' + x + '">' + x + '</a>').join(' '));
  try { h = glossify(h, seen || new Set()); } catch { /* glossify nélkül is olvasható */ }
  return h;
}
const H = ({ t, seen, as = 'span' }: { t: string; seen?: Set<string>; as?: 'span' | 'p' | 'div' }) => {
  const El = as as any;
  return <El dangerouslySetInnerHTML={{ __html: inline(t, seen) }} />;
};
const openCard = (n: string) => window.dispatchEvent(new CustomEvent('rb:open-card', { detail: n }));

function Callout({ b, seen }: { b: Extract<Block, { type: 'callout' }>; seen: Set<string> }) {
  const Icon = b.kind === 'warn' ? AlertTriangle : b.kind === 'strategy' ? Compass : b.kind === 'rule' ? BookOpen : Lightbulb;
  const def = { tip: 'Tipp', warn: 'Figyelem', rule: 'Szabály', strategy: 'Stratégia, nem szabály' }[b.kind] || 'Megjegyzés';
  return (
    <div className={'callout ' + b.kind}>
      <Icon size={18} aria-hidden />
      <b className="t">{b.title || def}</b>
      <H as="p" t={b.text} seen={seen} />
    </div>
  );
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  const seen = useMemo(() => new Set<string>(), [blocks]);
  return (
    <div className="lesson">
      {blocks.map((b, i) => {
        if (b.type === 'p') return <H key={i} as="p" t={b.text} seen={seen} />;
        if (b.type === 'callout') return <Callout key={i} b={b} seen={seen} />;
        if (b.type === 'steps') return (
          <div key={i}>{b.title && <h3>{b.title}</h3>}
            <ol className="lsteps">{b.items.map((s, j) => <li key={j}><b>{s.title}</b><H t={s.text} seen={seen} /></li>)}</ol>
          </div>);
        if (b.type === 'cards') return (
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
        if (b.type === 'playmat') return (<div key={i}><Playmat b={DEMO_BOARD} />{b.caption && <H as="p" t={b.caption} seen={seen} />}</div>);
        if (b.type === 'table') return (
          <table key={i} className="ltable"><thead><tr>{b.head.map((h, j) => <th key={j}>{h}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}><H t={c} seen={seen} /></td>)}</tr>)}</tbody></table>);
        return null;
      })}
    </div>
  );
}

function ScenarioView({ s, p, setP, all }: { s: Scenario; p: Progress; setP: (p: Progress) => void; all: Scenario[] }) {
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<Record<number, number>>({});
  useEffect(() => { setI(0); setPick({}); }, [s.id]);
  const st = s.steps[i];
  let board: Board | undefined; for (let k = i; k >= 0 && !board; k--) board = s.steps[k].board;
  let prevBoard: Board | undefined; for (let k = i - 1; k >= 0 && !prevBoard; k--) prevBoard = s.steps[k].board;
  const changes = st.board ? diffBoards(prevBoard, st.board) : [];
  const blocked = !!st.choice && pick[i] == null;
  const last = i === s.steps.length - 1;
  const idx = all.indexOf(s); const nextS = all[idx + 1];
  const next = () => { if (blocked) return; if (last) { setP({ ...p, scn: { ...p.scn, [s.id]: 1 } }); location.hash = nextS ? '#tanulas/sz/' + nextS.id : '#tanulas'; } else setI(i + 1); };
  const back = () => i > 0 && setI(i - 1);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.target as HTMLElement).closest('input,textarea')) return; if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') back(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  const ok = st.choice?.opts.find((o) => o.ok);
  return (
    <div className="scn">
      <div className="scn-head">
        <a href="#tanulas" className="crumb">← Practice</a>
        <div><div className="crumb">Szituáció {idx + 1} / {all.length} · {s.level === 'halado' ? 'Haladó' : 'Kezdő'}</div><h2>{s.title}</h2><H as="p" t={s.intro} /></div>
      </div>
      <div className="scn-grid">
        <div className="scn-boardcol">{board && <Playmat key={s.id} b={board} prev={prevBoard} turn={(board as any).turn || 'me'} />}</div>
        <aside className="scn-narr">
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
            <button className="btn hex" disabled={blocked} onClick={next}>{last ? (nextS ? <>Következő szituáció <ChevronRight size={16} /></> : <><Check size={16} /> Befejezés</>) : <>Tovább <ChevronRight size={16} /></>}</button>
          </div>
          <p className="note">Tipp: kattints egy unitra a részletekért, a címkékre (Attacker, Buff, ...) mutatva magyarázatot kapsz. Billentyűzet: ← →</p>
        </aside>
      </div>
    </div>
  );
}

export function LearnView({ hash, base = 'tanulas' }: { hash: string; base?: 'tanulas' | 'hogyan' }) {
  const B = '#' + base;
  const [L0, setL] = useState<Learn | null>(null);
  let L = L0;
  const [p, setP0] = useState<Progress>(loadP);
  const setP = (np: Progress) => { setP0(np); saveP(np); };
  useEffect(() => { loadLearn().then(setL); }, []);
  const m = new RegExp('^' + B + '\\/(sz\\/)?([\\w-]+)').exec(hash);
  useEffect(() => { if (m) window.scrollTo({ top: 0 }); }, [hash]);
  if (!L) return <div className="panel pad"><p className="note">Betöltés…</p></div>;
  const chs = L.chapters.filter((c) => (base === 'hogyan' ? c.level === 'kezdo' : c.level !== 'kezdo'));
  if (base === 'hogyan') L = { ...L, scenarios: [] };
  if (!chs.length && !L.scenarios.length) return <div className="panel pad"><h2>{base === 'hogyan' ? 'How to Play' : 'Practice'}</h2><p className="lead">A fejezetek és az interaktív szituációk ellenőrzése folyamatban van, hamarosan itt lesznek. Addig a <a href="#kezikonyv">Fogalomtár</a> és a kártyánkénti magyarázatok használhatók.</p></div>;
  const ch = m && !m[1] ? chs.find((c) => c.id === m[2]) : undefined;
  const sc = m && m[1] ? L.scenarios.find((s) => s.id === m[2]) : undefined;
    const firstOpen = chs[0];

  const side = (
    <aside className="panel learn-side">
      {LEVELS.map(([lv, name]) => {
        const list = chs.filter((c) => c.level === lv);
        if (!list.length) return null;
        return (<div key={lv}><h4>{name} <small>{list.length}</small></h4>
          <ol>{list.map((c) => (
            <li key={c.id}>
              <a href={B + '/' + c.id} aria-current={ch?.id === c.id ? 'page' : undefined}>
                <span className="num">{chs.indexOf(c) + 1}</span>{c.title}</a></li>))}</ol></div>);
      })}
      {!!L.scenarios.length && (<><h4>Szituációk <small>{L.scenarios.length}</small></h4>
        <ol>{L.scenarios.map((s) => (
          <li key={s.id}>
            <a href={'#tanulas/sz/' + s.id} aria-current={sc?.id === s.id ? 'page' : undefined}>
              <span className="num"><Swords size={12} /></span>{s.title}</a></li>))}</ol></>)}
      <h4>Tovább</h4>
      <ol><li><a href="#kezikonyv"><span className="num"><BookOpen size={12} /></span>Fogalomtár</a></li>
        <li><a href="#chain"><span className="num"><Swords size={12} /></span>Chain elemző</a></li></ol>
    </aside>
  );

  let main;
  if (sc) main = <ScenarioView s={sc} p={p} setP={setP} all={L.scenarios} />;
  else if (ch) {
    const idx = chs.indexOf(ch); const prev = chs[idx - 1], next = chs[idx + 1];
    main = (
      <>
        <div className="crumb">{base === 'hogyan' ? 'How to Play' : 'Practice'} › {LEVELS.find((l) => l[0] === ch.level)?.[1]} › {idx + 1} / {chs.length}</div>
        <h2>{ch.title}</h2>
        {ch.lead && <p className="lead">{ch.lead}</p>}
        {ch.rules && <p className="note">Core Rules: <span dangerouslySetInnerHTML={{ __html: inline('{{' + ch.rules + '}}') }} /></p>}
        <div className="orn"><i /></div>
        <Blocks blocks={ch.blocks} />
        <div className="pager">
          {prev ? <a href={B + '/' + prev.id}><small><ChevronLeft size={11} /> Előző</small><b>{prev.title}</b></a> : <span />}
          {next ? <a className="next" href={B + '/' + next.id}><small>Következő <ChevronRight size={11} /></small><b>{next.title}</b></a>
            : L.scenarios[0] && <a className="next" href={'#tanulas/sz/' + L.scenarios[0].id}><small>Gyakorlás <ChevronRight size={11} /></small><b>Szituációk</b></a>}
        </div>
      </>
    );
  } else main = (
    <>
      <div className="hero" style={{ margin: '-26px calc(-1 * clamp(16px, 4vw, 42px)) 18px' }}>
        <div className="crumb">{base === 'hogyan' ? 'How to Play' : 'Practice'}</div>
        <h2>{base === 'hogyan' ? 'How to Play' : 'Practice'}</h2>
        <p>{base === 'hogyan' ? '10 fejezet a Core Rules alapján, tetszőleges sorrendben olvasható.' : 'Szituációk a pályán lépésenként, döntésekkel, plusz haladó leckék.'}</p>
        <a className="btn hex" href={B + '/' + (firstOpen?.id || '')}>Kezdés: {firstOpen?.title} <ChevronRight size={16} /></a>
      </div>
      <div className="levels">
        {LEVELS.map(([lv, name, d]) => { const list = chs.filter((c) => c.level === lv); return list.length ? (
          <a key={lv} className="level" href={B + '/' + list[0].id}><b>{name}</b><span>{d} {list.length} fejezet.</span></a>) : null; })}
        {!!L.scenarios.length && <a className="level" href={'#tanulas/sz/' + L.scenarios[0].id}><b>Szituációk</b><span>Board state-ek lépésenként, döntésekkel. {L.scenarios.length} gyakorlat.</span></a>}
        <a className="level" href="#kezikonyv"><b>Fogalomtár</b><span>Fogalmak, kulcsszavak, játékmenet, szabályváltozások.</span></a>
      </div>
      <p className="note" style={{ marginTop: 18 }}>AI által írt, nem hivatalos összefoglaló. A pontos szöveg mindig a hivatkozott szabályszámra kattintva olvasható, versenyen a judge és a Core Rules dönt.</p>
    </>
  );

  return (
    <div className={'learn' + (sc ? ' wide' : '')}>
      {!sc && side}
      <main className="panel learn-main">{main}</main>
    </div>
  );
}
