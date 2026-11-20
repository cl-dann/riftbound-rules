// @ts-nocheck
/* A chain elemzés HTML riportja (a #cb-out tartalma): a lefutás sorrendje, a történet, a végállapot, a függő hatások,
   a battlefieldek hatása, a lapok kölcsönhatásai és a részletes szabálysorok. A domain runChain() adataiból készül
   (S20: korábban az analyze() 3. kimenete). */
import { runChain, lineH, WHO, type ChainResult } from '../../domain/chain/chainCore';
import { isPermC } from '../../domain/chain/actions';
import { vsPairs } from '../../domain/chain/pairs';
import { vsCard } from '../../domain/data/store';
import { esc } from '../../domain/text/norm';
import { glossify } from './glossary';

const EMPTY='<h2>Chain elemzés</h2><p class="note">Nem találok felismert kártyát vagy abilityt. Válassz a listából.</p>';

/** A riport HTML-je egy runChain() eredményből. */
export function chainReportHTML(out: ChainResult): string {
  if(out.empty)return EMPTY;
  const {S,O,BF,CS,done,story,notes,rows,rr,locLabel,mightOf}=(out as any).report;
  const stat:any={ok:['stok','lefutott'],partial:['stok','részben futott le'],fizzle:['stbad','hatás nélkül'],countered:['stbad','counterelve'],removed:['stbad','lekerült']};
  let h='<h2>Chain elemzés</h2><p class="note">Lépésenkénti levezetés a lapok szövegéből és a Core Rules szabályaiból. A "levezetés" címkéjű sorok az oldal következtetései, a judge felülbírálhatja őket.</p>';
  h+='<h3 class="cbsec">A chain lefutása</h3><p class="note" style="margin:0 0 6px">Ebben a sorrendben futottak le a tételek: mindig a legutóbb felrakott először, a közben keletkező triggerek pedig rögtön a tetejére kerülnek.</p><ol class="stack">'+done.map((d:any,i:number)=>{const r=stat[d.res]||['','?'];return '<li><span class="sn">'+(i+1)+'.</span><span class="sc">'+esc(d.name)+'</span><span class="note">'+(d.pl==='A'?'te':'ellenfél')+'</span><span class="'+r[0]+'">'+r[1]+'</span></li>';}).join('')+'</ol>';
  const off=S.filter((s:any)=>s.illegal||(s.k==='card'&&isPermC(s.c)&&!s.trig)||(s.k==='ab'&&s.ab&&s.ab.add));
  if(off.length)h+='<p class="note" style="margin:4px 0 0">Nem került a chainre: '+off.map((s:any)=>esc(s.c.n)+(s.illegal?(s.k==='tg'?' (trigger, lekerült)':' (nem szabályos)'):s.k==='ab'?' (erőforrást ad, azonnal lefut)':' (azonnal a boardra került, nincs play triggere)')).join(', ')+'.</p>';
  h+='<h3 class="cbsec">Sorban ez történik</h3><ol class="flow">'+story.map(x=>'<li><span>'+glossify(esc(x))+'</span></li>').join('')+'</ol>';
  const res:string[]=[];Object.keys(O).forEach(id=>{const ob=O[id];if(ob.type==='legend'||ob.type==='trigsrc'||ob.type==='ability')return;
    if(ob.type==='spell'){if(ob.zone==='none'||ob.zone==='pending')return;res.push(esc(ob.name)+': '+(ob.zone==='countered'?'counterelve, a trashben':ob.zone==='hand'?'counterelve, a lap szövege szerint a tulajdonosa kezében (426.1)':'lefutott, a trashben'));return;}
    if(ob.zone==='none'||ob.zone==='pending')return;
    const mt=mightOf(id);const z=({board:esc(locLabel(ob.loc))+(ob.loc==='base'&&ob.baseOf&&ob.baseOf!==ob.ctrl?' ('+(ob.baseOf==='A'?'a te':'az ellenfél')+' base-ében)':'')+(ob.type==='unit'&&mt!=null?', '+mt+' Might':'')+(ob.dmg?', '+ob.dmg+' damage':'')+(ob.st?', stunned':'')+(ob.ex?', exhausted':'')+(ob.on&&O[ob.on]?', rajta: '+esc(O[ob.on].name):''),hand:'a tulajdonosa kezében',trash:'a tulajdonosa trashében',banish:'banishelve'} as any)[ob.zone]||ob.zone;
    res.push((ob.ctrl==='A'?'Te: ':ob.ctrl==='B'?'Ellenfél: ':'')+esc(ob.name)+(ob.zone==='board'&&ob.own&&ob.ctrl!==ob.own?' (átvett kontroll, tulajdonos: '+WHO[ob.own]+')':'')+': '+z);});
  h+='<h3 class="cbsec">Végállapot</h3><ul class="res">'+res.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
  if(out.delayed.length)h+='<h3 class="cbsec">Függő delayed hatások</h3><table class="nt">'+out.delayed.map((d:any)=>lineH('391.2, 392, 359.3.e.16',esc(d.src)+': "'+esc(d.t)+'"'+(d.on.length?' ('+esc(d.on.join(', '))+')':'')+'. A megadott időpontban triggerel és akkor kerül a chainre; a mostani chain lefutásán kívül esik. Ha az időtartam már véget ért, amikor létrejönne (például az Ending Phase-ben kijátszva), nem jön létre (359.3.e.16).',0)).join('')+'</table>';
  if(notes.length)h+='<h3 class="cbsec">Battlefieldek állandó hatása</h3><table class="nt">'+notes.join('')+'</table>';
  const cards:any[]=[];S.forEach((s:any)=>{if(s.c&&s.c.n&&!cards.includes(s.c))cards.push(s.c);});CS.bd.forEach((b:any)=>{const c=vsCard(b.n);if(c&&!cards.includes(c))cards.push(c);});
  let pr='';for(let a=0;a<cards.length;a++)for(let b=a+1;b<cards.length;b++){const A=cards[a],B=cards[b];
    const p=vsPairs(A,B).concat(vsPairs(B,A));
    const rA=new Map(),rB=new Map();(A.nt||[]).forEach((n:any)=>n[0].split(',').forEach((r:string)=>rA.set(r.trim(),n[2])));(B.nt||[]).forEach((n:any)=>n[0].split(',').forEach((r:string)=>rB.set(r.trim(),n[2])));
    const common=[...rA.keys()].filter(r=>rB.has(r)&&!/^(155|813|806|355\.7|355\.10|337)/.test(r));
    if(!p.length&&!common.length)continue;
    pr+='<details class="tp"><summary><span class="tt">'+esc(A.n)+' és '+esc(B.n)+'</span><span class="why">'+p.length+' kölcsönhatás, '+common.length+' közös szabály</span></summary><div class="rules"><table class="nt">'+p.map((x:any)=>lineH(x[0],glossify(esc(x[1])),1)).join('')+common.map(r=>lineH(r,'<b>'+esc(A.n)+':</b> '+glossify(esc(rA.get(r)))+'<br><b>'+esc(B.n)+':</b> '+glossify(esc(rB.get(r))),null)).join('')+'</table></div></details>';}
  if(pr)h+='<h3 class="cbsec">Kölcsönhatások a lapok között</h3><p class="note" style="margin:0 0 6px">Általános összevetés, a konkrét helyzettől függetlenül: milyen kölcsönhatás lehetséges két lap között, és mely szabályokra hivatkozik mindkettő magyarázata.</p>'+pr;
  h+='<h3 class="cbsec">Részletesen: a chain felépítése</h3><table class="nt">'+rows+'</table>';
  h+='<h3 class="cbsec">Részletesen: lefutás (340.1)</h3>'+(rr?'<table class="nt">'+rr+'</table>':'<p class="note">Nem került semmi a chainre.</p>');
  h+='<p class="note" style="margin-top:14px">Követett hatások: counter, kézbe küldés, kill (replacementtel: Zhonya\'s Hourglass, Guardian Angel), banish, move és base-be mozgatás, helycsere, recall, damage (Bonus Damage), stun, buff, Might módosítás, keyword adása, ready, exhaust, kontrollváltás ("until I leave the board" és delayed visszaadás), Equipment csatolás és leválás, draw, channel, discard, "all/each" hatások, additional cost kill, Deathknell, "When I move" és "leaves the board" triggerek, "When you play" triggerek, Vilemaw\'s Lair típusú mozgástiltás, cleanup (lethal damage, gear recall). Ami ezen kívül esik, azt az elemzés megnevezi, de nem számolja ki.</p>';
  const names=[...new Set(Object.values(O).map((ob:any)=>ob.card&&ob.card.n).filter(Boolean).concat(['bf0','bf1'].map(l=>BF[l].c&&BF[l].c.n).filter(Boolean)))].sort((a:any,b:any)=>b.length-a.length);
  if(names.length){const re=new RegExp('('+names.map((n:any)=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','g');
    h=h.replace(/(<[^>]+>)|([^<]+)/g,(_m:string,tag:string,txt:string)=>tag?tag:txt.replace(re,(w:string)=>'<button type="button" class="cl" data-card="'+esc(w)+'">'+w+'</button>'));}
  return h;
}

/** A teljes elemzés riporttal: a runChain() eredménye, a html mezőben a riporttal (a builder és a tesztek ezt hívják). */
export function analyze(CS: any): ChainResult {
  const out=runChain(CS);
  out.html=chainReportHTML(out);
  return out;
}
