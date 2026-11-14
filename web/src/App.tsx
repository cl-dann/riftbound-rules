import { useEffect, useState } from 'react';
import { loadData } from './data';
import { VIEWS, useHash, viewOf } from './router';
import { CARDS, META, BF, BAN_ACTIVE, RULES, esc, expandAll, refHash, ruleHTML } from './legacy/core';
import { CardModal } from './components/CardModal';
import { TipLayer } from './components/TipLayer';
import { CardsView } from './views/CardsView';
import { DeckView } from './views/DeckView';
import { RulesView } from './views/RulesView';
import { ChainView } from './views/ChainView';
import { KnowledgeView } from './views/KnowledgeView';
import { LearnView } from './views/LearnView';

/** Globális viselkedés a generált HTML blokkokhoz: lusta szabálykitöltés és szabálylinkek. */
function useGlobalHandlers() {
  useEffect(() => {
    const toggle = (e: Event) => {
      const d = e.target as HTMLDetailsElement;
      if (!d.open || !d.matches?.('details')) return;
      const box = d.querySelector(':scope > .rules') as HTMLElement | null;
      if (!box || box.dataset.done) return;
      if (box.dataset.ids) {
        const idx = box.dataset.ids.split('|').map((id) => RULES.findIndex((r: any) => r[0] === id)).filter((i) => i >= 0);
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
  return (
    <footer id="foot" dangerouslySetInnerHTML={{ __html:
      '<p><strong>Készítette: Daneehunter.</strong> Nem hivatalos, rajongói segédeszköz, nem kereskedelmi célú.<br>Kérdés vagy hibajelzés esetén Discordon: <strong>daneehunter</strong>, jelölj be bátran.</p>'
      + '<p>Az oldal kódja, a kártya és szabály megfeleltetés és a magyar magyarázatok AI segítségével készültek: Claude (Anthropic), Claude Fable 5.2 és Claude Opus 5.5 modell. Az AI által írt magyarázat tévedhet, a hivatalos szabályszöveg az irányadó.</p>'
      + '<p>Riftbound szabálykereső was created under Riot Games\' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.</p>'
      + '<p>A Riftbound, a League of Legends, a kártyanevek, a kártyaszövegek, a kártyaképek és a Core Rules szövege a Riot Games, Inc. tulajdona, minden jog a Riot Gamest illeti. Hivatalos oldal: <a href="https://playriftbound.com/">playriftbound.com</a>, hivatalos szabályok: <a href="https://playriftbound.com/en-us/rules-hub/">Rules Hub</a>, hivatalos kártyaadatbázis: <a href="https://playriftbound.com/en-us/card-gallery/">Card Gallery</a>.</p>'
      + '<p>Források: a szabályszöveg a Riftbound Core Rules (Last Updated ' + META.rules_updated + ') angol eredetije, változtatás nélkül. A ban lista (' + META.ban_updated + ') a Rules Hubról, a ' + BF.from + '-tól érvényes kiegészítés a <a href="' + BF.url + '">' + esc(BF.title) + '</a> cikkből, az errata a Rules Hubról és az onnan hivatkozott cikkekből származik: ' + META.articles.map((a: any) => '<a href="' + a.u + '">' + esc(a.t) + '</a>').join(', ') + '. A kártyaadat a hivatalos Card Galleryből készült közösségi pillanatkép (LouisCourrian/riftbound-cards, ' + META.cards_snapshot + '), a Radiance domainjavítás a nyomtatott lapok sorszámozása alapján, a kártyaképek a Riot hivatalos szerveréről töltődnek be.</p>'
      + '<p>A kártya és szabály közti megfeleltetés automatikus, a "Hogyan érinti ezt a lapot" magyarázat pedig a készítő levezetése a Core Rules szövegéből. Egyik sem hivatalos ruling: versenyen a judge és a Core Rules teljes szövege dönt.</p>'
      + '<p><a href="./riftbound-szabalykereso.html" download>Az oldal egyetlen, offline is működő HTML fájlként</a></p>' }} />
  );
}

function Shell() {
  const hash = useHash();
  const view = viewOf(hash);
  useGlobalHandlers();
  const [seen, setSeen] = useState(() => new Set([view]));
  useEffect(() => { setSeen((s) => (s.has(view) ? s : new Set(s).add(view))); }, [view]);
  const errata = CARDS.filter((c: any) => c.err != null).length;
  return (
    <div className="wrap">
      <header className="top">
        <h1><span className="brand-mark" aria-hidden>R</span>Riftbound szabálykereső</h1>
        <div className="src">
          <span>Core Rules <b>{META.rules_updated}</b></span>
          <span>Ban lista <b>{META.ban_updated}</b>{BF && (BAN_ACTIVE ? <> + <b>{BF.from}</b></> : <>, új: <b>{BF.from}</b></>)}</span>
          <span>Kártyaadat <b>{META.cards_snapshot}</b></span>
          <span>Errata <b>{errata} kártya</b></span>
          <a href="https://playriftbound.com/en-us/rules-hub/">Rules Hub</a>
        </div>
      </header>
      <nav className="tabs" aria-label="Nézetek">
        {VIEWS.map(([k, label]) => <a key={k} href={'#' + k} aria-current={view === k ? 'page' : undefined}>{label}</a>)}
      </nav>
      {/* A már megnyitott nézetek mountolva maradnak, így megőrzik az állapotukat. */}
      <section className={'view' + (view === 'kartyak' ? ' on' : '')}>{seen.has('kartyak') && <CardsView active={view === 'kartyak'} />}</section>
      <section className={'view' + (view === 'deck' ? ' on' : '')}>{seen.has('deck') && <DeckView />}</section>
      <section className={'view' + (view === 'szabalyok' ? ' on' : '')}>{seen.has('szabalyok') && <RulesView hash={hash} />}</section>
      <section className={'view' + (view === 'chain' ? ' on' : '')}>{seen.has('chain') && <ChainView />}</section>
      <section className={'view' + (view === 'tanulas' ? ' on' : '')}>{seen.has('tanulas') && <LearnView hash={hash} />}</section>
      <section className={'view' + (view === 'kezikonyv' ? ' on' : '')}>{seen.has('kezikonyv') && <KnowledgeView hash={hash} />}</section>
      <Footer />
      <datalist id="cardnames">{CARDS.filter((c: any) => c.t !== 'Legend' && c.t !== 'Battlefield').map((c: any) => <option key={c.n} value={c.n} />)}</datalist>
      <datalist id="legnames">{CARDS.filter((c: any) => c.t === 'Legend').map((c: any) => <option key={c.n} value={c.n} />)}</datalist>
      <datalist id="bfnames">{CARDS.filter((c: any) => c.t === 'Battlefield').map((c: any) => <option key={c.n} value={c.n} />)}</datalist>
      <CardModal />
      <TipLayer />
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { loadData().then(() => setReady(true)).catch((e) => setErr(String(e))); }, []);
  if (err) return <div className="wrap"><p className="warns">Az adatok betöltése nem sikerült: {err}</p></div>;
  if (!ready) return <div className="loading"><span className="brand-mark" aria-hidden>R</span><p>Kártyák és szabályok betöltése…</p></div>;
  return <Shell />;
}
