import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, Clock, Compass, Flame, Menu, Play, Zap } from 'lucide-react';
import { loadLearn } from '../../domain/data/load';
import { PracticeBoard } from './PracticeBoard';
import { Blocks, H, inline, readMin, type Block } from '../../shared/content/Blocks';
import type { Scn } from '../../domain/practice/practiceEngine';

type Chapter = { id: string; section: 'hogyan' | 'lecke'; level?: string; title: string; sub?: string; rules?: string; old?: string[]; blocks: Block[] };
type Learn = { chapters: Chapter[]; scenarios: Scn[] };

const LEVELS: [string, string, string][] = [
  ['kezdo', 'Kezdő', 'Az első játékok tipikus félreértései.'],
  ['halado', 'Haladó', 'Tempo, csere, Rune Deck és decképítés.'],
  ['profi', 'Profi', 'Priority, Focus, Hidden és triggerek.'],
];
const lvName = (lv?: string) => LEVELS.find((l) => l[0] === lv)?.[1] || '';


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
  useEffect(() => { loadLearn().then((x) => setL(x as Learn)); }, []);
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
    const ch = htp.find((c) => c.id === (route as { id?: string }).id) || htp[0];
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

  return <PracticeView L={L} lessons={lessons} route={route} />;
}

/* ---------------- Practice: szituációk és leckék ---------------- */
const LVICON: Record<string, typeof Compass> = { kezdo: Compass, halado: Zap, profi: Flame };

function PracticeSide({ kind, L, lessons, cur }: { kind: 'sz' | 'lk'; L: Learn; lessons: Chapter[]; cur?: string }) {
  const scs = L.scenarios;
  const pos = kind === 'sz' ? (cur ? (scs.findIndex((s) => s.id === cur) + 1) + ' / ' + scs.length : scs.length + ' szituáció')
    : (cur ? (lessons.findIndex((c) => c.id === cur) + 1) + ' / ' + lessons.length : lessons.length + ' lecke');
  const body = (
    <>
      <nav className="psub" aria-label="Practice">
        <a href="#tanulas" aria-current={kind === 'sz' ? 'page' : undefined}>Szituációk</a>
        <a href="#tanulas/lecke" aria-current={kind === 'lk' ? 'page' : undefined}>Leckék</a>
      </nav>
      {kind === 'sz' ? (
        <>
          <div className="psd-h"><small>PRACTICE</small><b>Szituációk</b><span>{scs.length} szituáció</span></div>
          <ol className="psd-list">{scs.map((s, i) => (
            <li key={s.id}><a href={'#tanulas/sz/' + s.id} aria-current={cur === s.id ? 'page' : undefined}><span className="num">{i + 1}</span>{s.title}</a></li>))}</ol>
        </>
      ) : (
        <>
          <div className="psd-h"><small>LECKÉK</small><b>Haladó leckék</b><span>{lessons.length} lecke</span></div>
          {LEVELS.map(([lv, name]) => {
            const list = lessons.filter((c) => c.level === lv); if (!list.length) return null;
            return (
              <div key={lv} className={'psd-lv lv-' + lv}>
                <h4>{name} <span className="cnt">{list.length}</span></h4>
                <ol className="psd-list">{list.map((c, i) => (
                  <li key={c.id}><a href={'#tanulas/lecke/' + c.id} aria-current={cur === c.id ? 'page' : undefined}><span className="num">{String(i + 1).padStart(2, '0')}</span>{c.title}</a></li>))}</ol>
              </div>);
          })}
        </>
      )}
    </>
  );
  return (
    <>
      <aside className="panel learn-side psd">{body}</aside>
      <details className="panel learn-side-m psd"><summary><Menu size={16} aria-hidden /> {kind === 'sz' ? 'Szituációk' : 'Leckék'}<span className="pos">{pos}</span></summary>{body}</details>
    </>
  );
}

function ScenarioIndex({ L }: { L: Learn }) {
  const scs = L.scenarios;
  return (
    <>
      <span className="pchip"><Play size={13} aria-hidden /> Practice</span>
      <h1 className="chtitle">Szituációk</h1>
      <p className="chsub">Valódi lapokkal felállított pályák. Te lépsz: lapra kattintva megnyílik az akció-menü, a döntésed után a szituáció megmutatja a kimenetet, rossz döntésnél az optimális sort is, szabályszámmal.</p>
      <div className="pcta">
        <a className="btn hex" href={'#tanulas/sz/' + (scs[0]?.id || '')}>Első szituáció <ArrowRight size={16} /></a>
        <span className="note">Kezdés: {scs[0]?.title}</span>
      </div>
      <h2 className="psec">Szituációk <small>{scs.length}</small></h2>
      <ol className="scnlist">{scs.map((s, i) => (
        <li key={s.id}><a href={'#tanulas/sz/' + s.id}><span className="num">{i + 1}</span><span><b>{s.title}</b><small className="topic">{s.topic}</small><H t={s.intro} /></span><ChevronRight size={16} aria-hidden /></a></li>))}</ol>
    </>
  );
}

function ScenarioPage({ s, all }: { s: Scn; all: Scn[] }) {
  const idx = all.indexOf(s); const nx = all[idx + 1];
  return (
    <div className="scn2">
      <div className="chhead"><div className="crumb"><span className="pchip sm">Szituáció</span> <span className="ptopic">{s.topic}</span></div><span className="pos">{idx + 1} / {all.length}</span></div>
      <h1 className="chtitle">{s.title}</h1>
      <H as="p" className="chsub" t={s.intro} />
      {s.rules && <p className="chmeta">Core Rules: <span dangerouslySetInnerHTML={{ __html: inline('{{' + s.rules + '}}') }} /></p>}
      <PracticeBoard scn={s} next={nx ? { href: '#tanulas/sz/' + nx.id, title: nx.title } : undefined} />
      <Pager prev={all[idx - 1] && { href: '#tanulas/sz/' + all[idx - 1].id, title: all[idx - 1].title }} next={nx && { href: '#tanulas/sz/' + nx.id, title: nx.title }} />
    </div>
  );
}

function LessonIndex({ lessons }: { lessons: Chapter[] }) {
  return (
    <>
      <span className="pchip teal"><BookOpen size={13} aria-hidden /> Leckék</span>
      <h1 className="chtitle">Haladó leckék</h1>
      <p className="chsub">Fogalmak és minták a szabályokon túl: tempo, decképítés, showdown és chain. Szintenként csoportosítva, a How to Play után.</p>
      <div className="lvstats">{LEVELS.map(([lv, name]) => { const n = lessons.filter((c) => c.level === lv).length; const I = LVICON[lv]; return (
        <div key={lv} className={'lvstat lv-' + lv}><span><I size={14} aria-hidden /> {name}</span><b>{n}</b><small>lecke</small></div>); })}</div>
      {LEVELS.map(([lv, name, d]) => {
        const list = lessons.filter((c) => c.level === lv); if (!list.length) return null; const I = LVICON[lv];
        return (
          <section key={lv} className={'lvgroup lv-' + lv}>
            <div className="lvg-h"><span className="dot" /> <b>{name}</b><span className="d">{d}</span><small>{list.length} lecke</small></div>
            {list.map((c) => (
              <a key={c.id} className="lkcard2" href={'#tanulas/lecke/' + c.id}>
                <span className="ic"><I size={16} aria-hidden /></span>
                <span className="bd"><b>{c.title} <em>{readMin(c.blocks)} perc</em></b>{c.sub && <H as="p" t={c.sub} />}<span className="go">Lecke megnyitása <ArrowRight size={13} /></span></span>
              </a>))}
          </section>);
      })}
    </>
  );
}

function LessonPage({ ch, lessons }: { ch: Chapter; lessons: Chapter[] }) {
  const same = lessons.filter((c) => c.level === ch.level); const k = same.indexOf(ch);
  const idx = lessons.indexOf(ch); const prev = lessons[idx - 1], next = lessons[idx + 1];
  return (
    <div className={'lk-page lv-' + ch.level}>
      <div className="lk-meta"><span className="lvbadge">{lvName(ch.level)}</span><span>LECKE {k + 1} / {same.length}</span><span className="r"><Clock size={12} aria-hidden /> kb. {readMin(ch.blocks)} perc olvasás</span></div>
      <div className="lk-line" aria-hidden />
      <h1 className="chtitle">{ch.title}</h1>
      {ch.sub && <H as="p" className="chsub" t={ch.sub} />}
      <p className="chmeta">Core Rules: <span dangerouslySetInnerHTML={{ __html: inline('{{' + (ch.rules || '') + '}}') }} /></p>
      <Blocks blocks={ch.blocks} />
      <Pager prev={prev && { href: '#tanulas/lecke/' + prev.id, title: prev.title }} next={next && { href: '#tanulas/lecke/' + next.id, title: next.title }} />
    </div>
  );
}

function PracticeView({ L, lessons, route }: { L: Learn; lessons: Chapter[]; route: Route }) {
  const scs = L.scenarios;
  if (route.k === 'lk' || route.k === 'lesson') {
    const ch = route.k === 'lesson' ? lessons.find((c) => c.id === route.id) : undefined;
    return (
      <div className="learn">
        <PracticeSide kind="lk" L={L} lessons={lessons} cur={ch?.id} />
        <main className="panel learn-main">{ch ? <LessonPage ch={ch} lessons={lessons} /> : <LessonIndex lessons={lessons} />}</main>
      </div>
    );
  }
  const s = route.k === 'scn' ? scs.find((x) => x.id === route.id) : undefined;
  return (
    <div className="learn">
      <PracticeSide kind="sz" L={L} lessons={lessons} cur={s?.id} />
      <main className="panel learn-main">{s ? <ScenarioPage key={s.id} s={s} all={scs} /> : <ScenarioIndex L={L} />}</main>
    </div>
  );
}
