import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadData, loadDetails } from '../domain/data/load';
import { VIEWS, useHash, viewOf } from './router';
import { CARDS, META, BF, BAN_ACTIVE, RULES } from '../domain/data/store';
import { esc } from '../domain/text/norm';
import { expandAll, refHash } from '../domain/rules/refs';
import { ruleHTML } from '../render/html/rules';
import { CardModal } from '../shared/ui/CardModal';
import { TipLayer } from '../shared/ui/TipLayer';
import { CardsView } from '../features/cards/CardsView';
import { loadPrices } from '../shared/lib/prices';

// A Kártyák nézet azonnal kell; a többi nézet kódja az első megnyitáskor töltődik be (külön chunk), a kártyák
// részleteivel együtt (cards-detail.json), mert ezek a nézetek a jegyzeteket, a Röviden szöveget és a nyomatokat is mutatják.
const withDetails = <T,>(p: Promise<T>) => Promise.all([p, loadDetails()]).then(([m]) => m);
const DeckView = lazy(() => withDetails(import('../features/deck/DeckView')).then((m) => ({ default: m.DeckView })));
const RulesView = lazy(() => withDetails(import('../features/rules/RulesView')).then((m) => ({ default: m.RulesView })));
const ChainView = lazy(() => withDetails(import('../features/chain/ChainView')).then((m) => ({ default: m.ChainView })));
const KnowledgeView = lazy(() => withDetails(import('../features/knowledge/KnowledgeView')).then((m) => ({ default: m.KnowledgeView })));
const LearnView = lazy(() => withDetails(import('../features/learn/LearnView')).then((m) => ({ default: m.LearnView })));
const Lazy = ({ children }: { children: ReactNode }) => <Suspense fallback={<p className="note">Betöltés…</p>}>{children}</Suspense>;

/** Globális viselkedés a generált HTML blokkokhoz: lusta szabálykitöltés és szabálylinkek. */
function useGlobalHandlers() {
  useEffect(() => {
    const toggle = (e: Event) => {
      const d = e.target as HTMLDetailsElement;
      if (!d.open || !d.matches?.('details')) return;
      const box = d.querySelector(':scope > .rules') as HTMLElement | null;
      if (!box || box.dataset.done) return;
      if (box.dataset.ids) {
        const idx = box.dataset.ids.split('|').map((id) => RULES.findIndex((r) => r[0] === id)).filter((i) => i >= 0);
        const nm = box.dataset.hl || '';
        const hl = nm ? new RegExp(nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['\u2019]"), 'g') : null;
        box.innerHTML = ruleHTML(idx, hl);
      } else box.innerHTML = ruleHTML(expandAll(box.dataset.refs!.split('|')));
      box.dataset.done = '1';
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.('a[data-ref]') as HTMLElement | null;
      if (!a) return;
      e.preventDefault();
      document.querySelector<HTMLButtonElement>('.rb-modal button[aria-label="Bezárás"]')?.click();
      location.hash = refHash(a.dataset.ref!);
    };
    document.addEventListener('toggle', toggle, true);
    document.addEventListener('click', click);
    return () => { document.removeEventListener('toggle', toggle, true); document.removeEventListener('click', click); };
  }, []);
}

function Footer() {
  const col = (t: string, html: string) => <section><h4>{t}</h4><div dangerouslySetInnerHTML={{ __html: html }} /></section>;
  return (
    <footer id="foot">
      {col('Készítő', '<p><strong>Daneehunter</strong></p><p>Nem hivatalos, rajongói segédeszköz, nem kereskedelmi célú.</p><p>Kérdés vagy hibajelzés: Discordon <strong>daneehunter</strong>, jelölj be bátran.</p>')}
      {col('AI és pontosság', '<p>Az oldal kódja, a kártya és szabály megfeleltetés és a magyar magyarázatok AI segítségével készültek: Claude (Anthropic), Claude Fable 5.2 és Claude Opus 5.5 modell.</p><p>Az AI által írt magyarázat tévedhet. A megfeleltetés automatikus, a "Hogyan érinti ezt a lapot" a Core Rules szövegéből levezetve készült, egyik sem hivatalos ruling: versenyen a judge és a Core Rules dönt.</p>')}
      {col('Források', '<p>Szabályszöveg: Riftbound Core Rules (Last Updated ' + META.rules_updated + '), angol eredeti, változtatás nélkül.</p><p>Ban lista (' + META.ban_updated + ') a Rules Hubról, ' + BF.from + '-tól: <a href="' + BF.url + '">' + esc(BF.title) + '</a>.</p><p>Errata: ' + META.articles.map((a) => '<a href="' + a.u + '">' + esc(a.t) + '</a>').join(', ') + '.</p><p>Kártyaadat: hivatalos Card Gallery közösségi pillanatkép (LouisCourrian/riftbound-cards, ' + META.cards_snapshot + '), a Radiance javítások a nyomtatott lapok alapján. A kártyaképek a Riot hivatalos szerveréről töltődnek be.</p>')}
      {col('Jogi', '<p>Riftbound HU was created under Riot Games\' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.</p><p>A Riftbound, a League of Legends, a kártyanevek, kártyaszövegek, kártyaképek és a Core Rules szövege a Riot Games, Inc. tulajdona.</p><p><a href="https://playriftbound.com/">playriftbound.com</a> · <a href="https://playriftbound.com/en-us/rules-hub/">Rules Hub</a> · <a href="https://playriftbound.com/en-us/card-gallery/">Card Gallery</a></p>')}
    </footer>
  );
}

function Shell() {
  const hash = useHash();
  const view = viewOf(hash);
  useGlobalHandlers();
  const [seen, setSeen] = useState(() => new Set([view]));
  useEffect(() => { setSeen((s) => (s.has(view) ? s : new Set(s).add(view))); }, [view]);
  const errata = useMemo(() => CARDS.filter((c) => c.err != null).length, []);
  // A lapnév-listák (1101 option) egyszer készülnek, nem minden hash-váltáskor.
  const datalists = useMemo(() => (
    <>
      <datalist id="cardnames">{CARDS.filter((c) => c.t !== 'Legend' && c.t !== 'Battlefield').map((c) => <option key={c.n} value={c.n} />)}</datalist>
      <datalist id="legnames">{CARDS.filter((c) => c.t === 'Legend').map((c) => <option key={c.n} value={c.n} />)}</datalist>
      <datalist id="bfnames">{CARDS.filter((c) => c.t === 'Battlefield').map((c) => <option key={c.n} value={c.n} />)}</datalist>
    </>
  ), []);
  const [pricesAt, setPricesAt] = useState('');
  useEffect(() => { loadPrices().then((j) => j?.updated && setPricesAt(String(j.updated).slice(0, 10))); }, []);
  return (
    <div className="wrap">
      <header className="top">
        <h1><span className="brand-mark" aria-hidden>R</span>Riftbound HU</h1>
        <div className="src">
          <span>Core Rules <b>{META.rules_updated}</b></span>
          <span>Ban lista <b>{META.ban_updated}</b>{BF && (BAN_ACTIVE ? <> + <b>{BF.from}</b></> : <>, új: <b>{BF.from}</b></>)}</span>
          <span>Kártyaadat <b>{META.cards_snapshot}</b></span>
          <span>Errata <b>{errata} kártya</b></span>
          {(() => { const age = pricesAt ? Math.floor((Date.now() - Date.parse(pricesAt)) / 864e5) : null; const due = age == null || age > 7;
            return <a href="#deck" className={due ? 'stale' : undefined} title={'Cardmarket 1 és 7 napos átlagár, heti frissítés' + (age != null ? ', ' + age + ' napja frissült' : '')}>Cardmarket ár <b>{pricesAt || 'nincs adat'}</b>{due && pricesAt ? ', frissítés esedékes' : ''}</a>; })()}
          <a href="https://playriftbound.com/en-us/rules-hub/">Rules Hub</a>
        </div>
      </header>
      <nav className="tabs" aria-label="Nézetek">
        {VIEWS.map(([k, label]) => <a key={k} href={'#' + k} aria-current={view === k ? 'page' : undefined}>{label}</a>)}
      </nav>
      {/* A már megnyitott nézetek mountolva maradnak, így megőrzik az állapotukat. */}
      <section className={'view' + (view === 'kartyak' ? ' on' : '')}>{seen.has('kartyak') && <CardsView active={view === 'kartyak'} />}</section>
      <section className={'view' + (view === 'deck' ? ' on' : '')}>{seen.has('deck') && <Lazy><DeckView /></Lazy>}</section>
      <section className={'view' + (view === 'szabalyok' ? ' on' : '')}>{seen.has('szabalyok') && <Lazy><RulesView hash={hash} /></Lazy>}</section>
      <section className={'view' + (view === 'chain' ? ' on' : '')}>{seen.has('chain') && <Lazy><ChainView /></Lazy>}</section>
      <section className={'view' + (view === 'hogyan' ? ' on' : '')}>{seen.has('hogyan') && <Lazy><LearnView hash={hash} base="hogyan" /></Lazy>}</section>
      <section className={'view' + (view === 'tanulas' ? ' on' : '')}>{seen.has('tanulas') && <Lazy><LearnView hash={hash} base="tanulas" /></Lazy>}</section>
      <section className={'view' + (view === 'kezikonyv' ? ' on' : '')}>{seen.has('kezikonyv') && <Lazy><KnowledgeView hash={hash} /></Lazy>}</section>
      <Footer />
      {datalists}
      <CardModal />
      <TipLayer />
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { loadData().then(() => setReady(true)).catch((e) => setErr(String(e))); }, []);
  // A részletek a kezdő renderelés után a háttérben töltődnek (a Kártyák rács nem várja meg).
  useEffect(() => { if (ready) { const t = setTimeout(() => { loadDetails(); }, 300); return () => clearTimeout(t); } }, [ready]);
  if (err) return <div className="wrap"><p className="warns">Az adatok betöltése nem sikerült: {err}</p></div>;
  if (!ready) return <div className="loading"><span className="brand-mark" aria-hidden>R</span><p>Kártyák és szabályok betöltése…</p></div>;
  return <Shell />;
}
