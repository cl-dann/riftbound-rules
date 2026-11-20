// @ts-nocheck
/* Kártya részletek HTML (fej, szöveg, jegyzetek, Gyakori kérdések, kapcsolódó szabályok). (a korábbi legacy/core.ts része, S15) */
import { similar, typeLine } from '../../domain/data/cards';
import { BF, D, META, TOPICS } from '../../domain/data/store';
import { FL, FLT } from '../../domain/rules/flags';
import { esc } from '../../domain/text/norm';
import { glossify } from './glossary';
import { GROUPS, topicBlock, whyOf } from './rules';
export const DOMS={R:'Fury',G:'Calm',B:'Mind',O:'Body',P:'Chaos',Y:'Order'};
export const SYMT={A:['A','Power, bármely domain'],C:['C','Power, a kártya saját domainje'],S:['Might','Might'],T:['Exhaust','Exhaust (a kártya kimerítése költségként)'],E:['Exhaust','Exhaust (a kártya kimerítése költségként)']};
export function cardText(t){
  if(!t)return '<p class="rem">Nincs szabályszöveg.</p>';
  return t.split('\n').map(line=>{
    let h=esc(line);
    h=h.replace(/\(([^()]*)\)/g,'<span class="rem">($1)</span>');
    h=h.replace(/\[([^\]]+)\]/g,(m,k)=>{
      if(/^\d+$/.test(k))return '<span class="sym en" title="Energy '+k+'">'+k+'</span>';
      if(k==='&gt;')return '\u25B8';
      if(k==='&gt;&gt;')return '\u00BB';
      if(SYMT[k])return '<span class="sym" title="'+SYMT[k][1]+'">'+SYMT[k][0]+'</span>';
      if(DOMS[k])return '<span class="sym dm d-'+DOMS[k]+'" title="'+DOMS[k]+' domain">'+DOMS[k]+'</span>';
      return '<span class="kw">'+k+'</span>';
    });
    return '<p>'+h+'</p>';
  }).join('');
}
export const domDots=c=>(c.d||[]).map(d=>'<i class="dot d-'+d+'" title="'+d+'"></i>').join('');
const refLinks=r=>r.split(',').map(x=>x.trim()).filter(Boolean).map(x=>'<a href="#szabalyok" data-ref="'+x+'">'+x+'</a>').join('');
export function qaHTML(c){
  if(!c.qa||!c.qa.length)return '';
  const seen=new Set();
  return '<h3>Gyakori kérdések<span class="n">'+c.qa.length+' kérdés, nem hivatalos ruling</span></h3><dl class="qa">'+c.qa.map(x=>'<dt>'+esc(x[0])+'</dt><dd>'+glossify(esc(x[1]),seen)+(x[2]?'<span class="r">'+refLinks(x[2])+'</span>':'')+'</dd>').join('')+'</dl>';
}
export function notesHTML(c){
  if(!c.nt)return '<h3>Hogyan érinti ezt a lapot</h3><p class="note">Ehhez a laphoz még nincs kézzel írt, lap-specifikus magyarázat. Lent a rá vonatkozó szabályszakaszok teljes szövege olvasható.</p>';
  const seen=new Set();
  const body='<div class="ntwrap"><table class="nt">'+c.nt.map(n=>'<tr><td class="r">'+n[0].split(',').map(r=>'<a href="#szabalyok" data-ref="'+r.trim()+'">'+r.trim()+'</a>').join('')+'</td><td>'+glossify(esc(n[2]),seen)+'</td><td class="f"><span class="fl f'+n[1]+'" title="'+FLT[n[1]]+'">'+FL[n[1]]+'</span></td></tr>').join('')+'</table></div>';
  if(c.qa&&c.qa.length)return '<details class="tp ntd"><summary><span class="tt">Szabályi részletek</span><span class="why">'+c.nt.length+' pont szabályszámmal, judge szintű pontosítások</span></summary>'+body+'</details>';
  return '<h3>Hogyan érinti ezt a lapot<span class="n">'+c.nt.length+' pont, nem hivatalos ruling</span></h3>'+body;
}
export function similarHTML(c){
  const L=similar(c,8);if(!L.length)return '';
  return '<h3>Hasonló lapok<span class="n">közös kulcsszó, tag, típus és hatás alapján</span></h3><div class="simgrid">'+L.map(([s,o,w])=>'<button class="simc" data-sim="'+esc(o.n)+'"><b>'+domDots(o)+' '+esc(o.n)+'</b><span>'+esc(typeLine(o))+(o.e!=null?' · Energy '+o.e:'')+'</span>'+(w.length?'<span class="w">'+w.map(esc).join(', ')+'</span>':'')+'</button>').join('')+'</div>';
}
export function cardRulesHTML(c){
  let h=qaHTML(c)+notesHTML(c)+similarHTML(c);
  if(c.ex&&c.ex.length){
    h+='<h3>A szabályzat név szerint említi<span class="n">'+c.ex.length+' példa</span></h3>';
    h+='<details class="tp"><summary><span class="rn">'+c.ex.slice(0,3).join(', ')+(c.ex.length>3?', ...':'')+'</span><span class="tt">Példák ezzel a kártyával</span><span class="why">a Core Rules példaszövegében szerepel a kártya neve</span></summary><div class="rules" data-ids="'+c.ex.join('|')+'" data-hl="'+esc(c.a[0])+'"></div></details>';
  }
  GROUPS.forEach(([g,label])=>{
    const items=c.tp.filter(p=>TOPICS[p[0]].g===g);
    if(!items.length)return;
    h+='<h3>'+label+'<span class="n">'+items.length+'</span></h3>';
    items.forEach(p=>{h+=topicBlock(TOPICS[p[0]],whyOf(TOPICS[p[0]],p[1]),false);});
  });
  const gen=D.general.filter(g=>g.for==='all'||['Unit','Gear','Spell'].includes(c.t));
  h+='<h3>Minden kártyára érvényes általános szabályok<span class="n">'+gen.length+'</span></h3>';
  gen.forEach(g=>{h+=topicBlock({refs:g.refs,title:g.title,rel:[]},'általános',false);});
  return h;
}
export function cardHeadHTML(c,tag){
  const chips=[];
  chips.push('<span class="chip">'+domDots(c)+esc(typeLine(c))+'</span>');
  if(c.d&&c.d.length)chips.push('<span class="chip">'+esc(c.d.join(' + '))+'</span>');
  if(c.e!=null)chips.push('<span class="chip">Energy <b>'+c.e+'</b></span>');
  if(c.p)chips.push('<span class="chip">Power <b>'+c.p+'</b></span>');
  if(c.m!=null)chips.push('<span class="chip">Might <b>'+c.m+'</b></span>');
  if(c.tg&&c.tg.length)chips.push('<span class="chip">'+esc(c.tg.join(', '))+'</span>');
  chips.push('<span class="chip">'+esc(c.sets.join(', '))+'</span>');
  if(c.ban===1)chips.push('<span class="chip ban">BANNED (Constructed)</span>');
  if(c.ban===2)chips.push('<span class="chip ban">BANNED 2v2 Constructed</span>');
  if(c.banf&&!c.ban)chips.push('<span class="chip ban">BANNED '+c.banf+'-tól</span>');
  if(c.err!=null)chips.push('<span class="chip err">ERRATA</span>');
  const IMG='https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/';
  let h='<div class="cardtop"><div class="main"><div class="card-head"><'+tag+' style="margin:0">'+esc(c.n)+'</'+tag+'><a class="note" href="https://playriftbound.com/en-us/card-gallery/#card-gallery--'+c.code+'">hivatalos Card Gallery ('+c.code+')</a></div><div class="meta">'+chips.join('')+'</div>';
  if(c.banf&&!c.ban)h+='<div class="banbox">Ez a kártya '+c.banf+'-tól tiltott a Standard és a 2v2 Constructed formátumban. Forrás: <a href="'+BF.url+'">'+esc(BF.title)+'</a>. Addig még játszható.</div>';
  if(c.ban===1)h+='<div class="banbox">Ez a kártya '+(c.banNew?'a '+esc(BF.title)+' cikk szerint':'a Rules Hub szerint')+' tiltott a Constructed formátumban (érvényes: '+(c.banNew?c.banf:META.ban_updated)+'). A keresőben csak a "banned kártyák is" kapcsolóval jelenik meg.</div>';
  if(c.ban===2)h+='<div class="banbox">Ez a legend a Rules Hub szerint a 2v2 Constructed formátumban tiltott (lista frissítve: '+META.ban_updated+'). 1v1 Constructedben játszható.</div>';
  h+='<h3>'+(c.err!=null?'Jelenlegi szöveg (errata után)':'Kártyaszöveg')+'</h3><div class="ctext">'+cardText(c.txt)+'</div>';
  if(c.eff)h+='<h3>Effect Text<span class="n">a felszerelt unit kapja meg, csak csatolva aktív (136)</span></h3><div class="ctext eff">'+cardText(c.eff)+'</div><p class="note">Az Effect Text a hivatalos adatforrásból hiányzott, közösségi forrásból pótolva: <a href="'+esc(c.effsrc||'')+'">'+esc((c.effsrc||'').replace(/^https?:\/\/(www\.)?/,'').split('/')[0])+'</a>.</p>';
  if(c.sh)h+='<div class="short"><b>Röviden</b>'+glossify(esc(c.sh))+'<small>Egyszerűsített összefoglaló, nem hivatalos. A pontos szabályok lent.</small></div>';
  if(c.err!=null){
    const a=META.articles[c.err];
    h+='<div class="errbox">A kártya szövege megváltozott. Forrás: <a href="'+a.u+'">'+esc(a.t)+'</a>. A fenti szöveg a hatályos, a nyomtatott kártyán a régi szerepelhet.</div>';
    if(c.old)h+='<h3>Nyomtatott szöveg (errata előtt)</h3><div class="ctext old">'+cardText(c.old)+'</div>';
    else h+='<p class="note">A Card Gallery már a frissített szöveget mutatja, a régi szöveg az errata cikkben olvasható.</p>';
  }
  h+='</div>'+(c.img?'<img loading="lazy" src="'+IMG+c.img+'?w=420" alt="'+esc(c.n)+' kártyakép" onerror="this.remove()">':'')+'</div>';
  return h;
}
