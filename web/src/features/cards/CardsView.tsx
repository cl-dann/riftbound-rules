import { LayoutGrid, List, Search, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Printings } from '../../shared/ui/Printings';
import { CARDS, META, IMGBASE } from '../../domain/data/store';
import { cardHeadHTML, cardRulesHTML, domDots } from '../../render/html/card';
import { esc, norm } from '../../domain/text/norm';
import { typeLine } from '../../domain/data/cards';
import { Html } from '../../shared/ui/Html';
import { on, openCard } from '../../shared/lib/events';
import { readViewMode, writeViewMode, type CardsViewMode } from '../../shared/lib/storage';
import { loadDetails } from '../../domain/data/load';

const SETS = ['Origins', 'Proving Grounds', 'Spiritforged', 'Unleashed', 'Vendetta', 'Radiance'];
const DOMAINS = ['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order'];
type F = { q: string; type: string; dom: string; cost: string; might: string; set: string; kw: string; inText: boolean; onlyErr: boolean; showBan: boolean };
const EMPTY: F = { q: '', type: '', dom: '', cost: '', might: '', set: '', kw: '', inText: false, onlyErr: false, showBan: false };

/** Magyar keresőszavak angol megfelelői (a kártyaszövegben keresünk velük). */
const SYN: Record<string, string[]> = {
  sebzes: ['deal', 'damage'], sebez: ['deal', 'damage'], seb: ['damage'], olés: ['kill'], oles: ['kill'], megol: ['kill'], hal: ['die', 'dies', 'deathknell'],
  huz: ['draw'], huzas: ['draw'], kijatsz: ['play'], kijatszas: ['play'], mozog: ['move'], mozgas: ['move'], pont: ['point', 'score'],
  gyogyit: ['heal'], gyogyitas: ['heal'], stun: ['stun'], kabit: ['stun'], buff: ['buff'], elrejt: ['hidden', 'hide'], rejtett: ['hidden'],
  eldob: ['discard'], dobas: ['discard'], visszavesz: ['recall', 'return'], lap: ['card'], egyseg: ['unit'], targy: ['gear'], felszereles: ['equipment', 'equip'],
  varazslat: ['spell'], csatater: ['battlefield'], harc: ['combat', 'attack', 'defend'], tamad: ['attack', 'attacker'], vedekez: ['defend', 'defender'],
  token: ['token'], tisztit: ['cleanse'], banish: ['banish'], szamuz: ['banish'], ready: ['ready'], kimerit: ['exhaust'],
};
const lev1 = (a: string, b: string) => {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, e = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++e > 1) return false;
    if (a.length === b.length && a[i] === b[j + 1] && a[i + 1] === b[j]) { i += 2; j += 2; continue; }
    if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
  }
  return e + (a.length - i) + (b.length - j) <= 1;
};
const fuzzyName = (n: string, w: string) => w.length >= 4 && n.split(/[^a-z0-9']+/).some((t) => t.length >= 4 && lev1(t, w));

export function filterCards(f: F) {
  const q = norm(f.q), words = q ? q.split(' ').filter(Boolean) : [];
  const base = (c: any) => {
    if (c.ban === 1 && !f.showBan) return false;
    if (f.type && c.t !== f.type) return false;
    if (f.dom && !(f.dom === 'none' ? !(c.d && c.d.length) : (c.d || []).includes(f.dom))) return false;
    if (f.onlyErr && c.err == null) return false;
    if (f.cost !== '' && !(f.cost === '7' ? c.e != null && c.e >= 7 : c.e === +f.cost)) return false;
    if (f.might !== '' && !(f.might === '6' ? c.m != null && c.m >= 6 : c.m === +f.might)) return false;
    if (f.set && !c.sets.includes(f.set)) return false;
    if (f.kw && !c._kw.includes(f.kw)) return false;
    return true;
  };
  // A magyar szinonima szavanként egyszer oldódik fel (korábban laponként).
  const syns = words.map((w: string) => SYN[w] || Object.entries(SYN).find(([k]) => w.length >= 4 && (w.startsWith(k) || k.startsWith(w)))?.[1]);
  const hit = (c: any, w: string, i: number) => {
    if (c._s.includes(w) || (f.inText && c._t.includes(w))) return true;
    const syn = syns[i];
    return !!syn && syn.some((x: string) => c._s.includes(x) || c._t.includes(x));
  };
  let res = CARDS.filter((c: any) => base(c) && words.every((w: string, i: number) => hit(c, w, i)));
  // Elgépelés: ha nincs találat, egy betű eltéréssel a lapnevekben keresünk.
  if (!res.length && words.length) res = CARDS.filter((c: any) => base(c) && words.every((w: string, i: number) => hit(c, w, i) || fuzzyName(c._n, w)));
  if (q) res.sort((a: any, b: any) => (b._n.startsWith(q) - a._n.startsWith(q)) || (b._n.includes(q) - a._n.includes(q)) || a._n.localeCompare(b._n));
  return res;
}

function Badges({ c }: { c: any }) {
  return (
    <>
      {c.err != null && <span className="chip err mini">errata</span>}
      {c.ban ? <span className="chip ban mini">ban</span> : c.banf ? <span className="chip ban mini">ban {c.banf.slice(5)}</span> : null}
    </>
  );
}

export function CardsView({ active }: { active: boolean }) {
  const [f, setF] = useState<F>(EMPTY);
  const [mode, setMode] = useState<CardsViewMode>(readViewMode);
  const [zoom, setZoom] = useState<{ src: string; x: number; y: number; right: boolean; land: boolean } | null>(null);
  const hoverOn = (e: React.MouseEvent, c: any) => {
    if (!c.img || !window.matchMedia('(hover: hover) and (min-width: 900px)').matches) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const m = /-(\d+)x(\d+)\./.exec(c.img); const land = !!m && +m[1] > +m[2];
    const w = land ? 530 : 370, h = land ? 380 : 518;
    const right = r.right + w + 20 < window.innerWidth;
    setZoom({ src: IMGBASE + c.img, x: right ? r.right + 12 : r.left - 12, y: Math.max(10, Math.min(r.top + r.height / 2 - h / 2, window.innerHeight - h - 10)), right, land });
  };
  const [limit, setLimit] = useState(80);
  const moreRef = useRef<HTMLLIElement>(null);
  const [sel, setSel] = useState<any>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const qRef = useRef<HTMLInputElement>(null);
  // A keresőszó késleltetett értéke: gépelés közben a mező azonnal frissül, a szűrés utána fut.
  const q = useDeferredValue(f.q);
  const fKey = JSON.stringify({ ...f, q: '' });
  const res = useMemo(() => filterCards({ ...(JSON.parse(fKey) as F), q }), [fKey, q]);
  // Automatikus továbbtöltés görgetéskor: a "további" sor láthatóvá válásakor bővül a lista. Az observer csak akkor
  // épül újra, ha a sor megjelenhet vagy eltűnhet (találatok, limit, nézetmód), nem minden renderkor.
  useEffect(() => {
    const el = moreRef.current; if (!el) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setLimit((l) => l + (mode === 'grid' ? 120 : 200)); }, { rootMargin: '600px' });
    io.observe(el); return () => io.disconnect();
  }, [mode, limit, res]);
  const total = useMemo(() => CARDS.filter((c: any) => c.ban !== 1).length, []);
  const types = useMemo(() => [...new Set(CARDS.map((c: any) => c.t))].sort() as string[], []);
  const kws = useMemo(() => [...new Set(CARDS.flatMap((c: any) => c._kw))].sort() as string[], []);
  const dirty = JSON.stringify(f) !== JSON.stringify(EMPTY);
  const up = (p: Partial<F>) => { setF((o) => ({ ...o, ...p })); setLimit(mode === 'grid' ? 60 : 80); };
  useEffect(() => { writeViewMode(mode); }, [mode]);
  // A Kézikönyv kulcsszó gombja ide küld keresést.
  useEffect(() => {
    return on('rb:card-search', (q) => { up({ ...EMPTY, q, inText: true }); location.hash = '#kartyak'; });
  }, []);
  // Ctrl+K vagy / fókuszálja a keresőt.
  useEffect(() => {
    if (!active) return;
    const on = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); qRef.current?.focus(); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [active]);

  const pick = (c: any) => {
    if (mode === 'grid') { openCard(c.n); return; }
    loadDetails().then(() => {
      setSel(c);
      if (window.innerWidth < 860) detailRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  };
  const shown = res.slice(0, limit);
  const sel2 = (k: keyof F, label: string, opts: [string, string][]) => (
    <select value={f[k] as string} onChange={(e) => up({ [k]: e.target.value } as any)} aria-label={label}>
      <option value="">{label}</option>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );

  return (
    <div className={'cols' + (mode === 'grid' ? ' gridmode' : '')}>
      <div className="panel">
        <div className="pad filters">
          <div className="search">
            <Search size={16} aria-hidden />
            <input ref={qRef} type="search" value={f.q} onChange={(e) => up({ q: e.target.value })} placeholder="Kártyanév, tag vagy kulcsszó" autoComplete="off" aria-label="Kártya keresése" />
            <kbd>Ctrl K</kbd>
          </div>
          <div className="row">
            {sel2('type', 'Minden típus', types.map((t) => [t, t]))}
            {sel2('dom', 'Minden domain', [...DOMAINS.map((d) => [d, d] as [string, string]), ['none', 'Domain nélkül']])}
          </div>
          <div className="row">
            {sel2('cost', 'Minden Energy', Array.from({ length: 8 }, (_, i) => [String(i), 'Energy ' + (i === 7 ? '7+' : i)]))}
            {sel2('might', 'Minden Might', Array.from({ length: 7 }, (_, i) => [String(i), 'Might ' + (i === 6 ? '6+' : i)]))}
          </div>
          <div className="row">
            {sel2('set', 'Minden set', SETS.filter((s) => CARDS.some((c: any) => c.sets.includes(s))).map((s) => [s, s]))}
            {sel2('kw', 'Minden kulcsszó', kws.map((k) => [k, k]))}
          </div>
          <div className="row">
            <label className="chk"><input type="checkbox" checked={f.inText} onChange={(e) => up({ inText: e.target.checked })} /> keresés a kártyaszövegben is</label>
            <label className="chk"><input type="checkbox" checked={f.onlyErr} onChange={(e) => up({ onlyErr: e.target.checked })} /> csak errata</label>
            <label className="chk"><input type="checkbox" checked={f.showBan} onChange={(e) => up({ showBan: e.target.checked })} /> banned kártyák is</label>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="count">{res.length} találat, {total} nem banned egyedi kártya</div>
            <div className="seg" role="group" aria-label="Nézet">
              <button aria-pressed={mode === 'list'} onClick={() => { setMode('list'); setLimit(80); }}><List size={14} /> Lista</button>
              <button aria-pressed={mode === 'grid'} onClick={() => { setMode('grid'); setLimit(60); }}><LayoutGrid size={14} /> Rács</button>
            </div>
          </div>
          {dirty && <button className="linkbtn" onClick={() => up(EMPTY)}><X size={13} /> Szűrők törlése</button>}
        </div>
        <ul className="list" role="listbox" aria-label="Találatok">
          {!res.length && <li className="pad note">Nincs találat. A banned kártyák alapból rejtve vannak.</li>}
          {mode === 'grid'
            ? shown.map((c: any) => {
                const stats = [c.e != null ? 'Energy ' + c.e : '', c.m != null ? 'Might ' + c.m : ''].filter(Boolean).join(' · ');
                return (
                  <li key={c.n}>
                    <button className="tile" onClick={() => { setZoom(null); pick(c); }} onMouseEnter={(e) => hoverOn(e, c)} onMouseLeave={() => setZoom(null)}>
                      <span className={'im' + (c.img ? '' : ' noimg')}>
                        {c.img && <img loading="lazy" alt="" src={IMGBASE + c.img + '?w=300'} onError={(e) => { (e.currentTarget.parentNode as HTMLElement).classList.add('noimg'); e.currentTarget.remove(); }} />}
                        <span className="ph"><b>{c.n}</b><span dangerouslySetInnerHTML={{ __html: domDots(c) + ' ' + esc(typeLine(c)) }} /><span>{stats}</span></span>
                        <span className="bdg"><Badges c={c} /></span>
                      </span>
                      <span className="cap"><b>{c.n}</b><span>{typeLine(c)}{stats ? ' · ' + stats : ''}</span></span>
                    </button>
                  </li>
                );
              })
            : shown.map((c: any) => (
                <li key={c.n}>
                  <button role="option" aria-selected={sel === c} onClick={() => pick(c)}>
                    <span className="nm"><span dangerouslySetInnerHTML={{ __html: domDots(c) }} /> {c.n} <Badges c={c} /></span>
                    <span className="ty">{typeLine(c)}</span>
                  </button>
                </li>
              ))}
          {res.length > limit && (
            <li className={mode === 'grid' ? 'more-li' : ''} ref={moreRef}>
              <button className="more" onClick={() => setLimit(limit + (mode === 'grid' ? 120 : 200))}>További {res.length - limit} találat megjelenítése</button>
            </li>
          )}
        </ul>
      </div>
      <div className="panel pad detail" ref={detailRef} aria-live="polite"
        onClick={(e) => {
          const s = (e.target as HTMLElement).closest('button[data-sim]') as HTMLElement | null;
          if (s) { const c = CARDS.find((x: any) => x.n === s.dataset.sim); if (c) { setSel(c); detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } } // a részletek itt már betöltve
        }}>
        {sel
          ? <><Html key={sel.n} html={cardHeadHTML(sel, 'h2')} /><Printings key={'p' + sel.n} card={sel} /><Html key={'r' + sel.n} html={'<h3 class="rb-sep">Erre a kártyára érvényes szabályok</h3><p class="note">A szakaszok a Core Rules (' + META.rules_updated + ') eredeti angol szövegét mutatják. Kattintásra nyílnak.</p>' + cardRulesHTML(sel)} /></>
          : <div className="empty"><h2>Válassz egy lapot</h2><p className="note">Keress rá a kártya nevére, vagy kattints egy lapra a listában. Itt jelenik meg a lap szövege, az errata, a Röviden összefoglaló és a rá vonatkozó szabályok.</p></div>}
      </div>
      {zoom && <img className={'zoom-pop' + (zoom.land ? ' land' : '')} src={zoom.src} alt="" style={{ top: zoom.y, left: zoom.right ? zoom.x : undefined, right: zoom.right ? undefined : window.innerWidth - zoom.x }} />}
    </div>
  );
}
