// @ts-nocheck
/* Átmeneti modul: a régi egyfájlos oldal tiszta (DOM-független) segédfüggvényei.
   A React komponensek ezeket hívják; fokozatosan típusos modulokra bontjuk. */
export let D:any, RULES:any[], TOPICS:any[], CARDS:any[], META:any, BF:any, BAN_ACTIVE=false, TERMS:any[]=[], TRE:RegExp|null=null;
export const TODAY=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');})();
export const byName=new Map();
export let top3:number[]=[];
export function init(data:any){
  D=data;RULES=D.rules;TOPICS=D.topics;CARDS=D.cards;META=D.meta;BF=META.banfut;BAN_ACTIVE=!!(BF&&TODAY>=BF.from);
  CARDS.forEach(c=>{if(c.banf&&TODAY>=c.banf){c.ban=1;c.banNew=1;}});
  top3=RULES.map(r=>parseInt(r[0].slice(0,3),10));
  TERMS=(D.extra&&D.extra.terms)||[];
  TRE=TERMS.length?new RegExp('(?<![\\p{L}\\[])('+TERMS.map(x=>x.m).sort((a,b)=>b.length-a.length).join('|')+')(?![\\p{L}])','giu'):null;
  CARDS.forEach(c=>{c._n=norm(c.n);c._s=norm([c.n].concat(c.a,c.tg||[],c.st||[],[c.t]).join(' '));c._t=norm(c.txt||'');[c.n].concat(c.a).forEach(a=>{const k=norm(a);if(!byName.has(k))byName.set(k,c);});});
  CARDS.forEach(c=>{c._kw=c.tp.filter(p=>TOPICS[p[0]].g==='kw').map(p=>TOPICS[p[0]].title);});
  heads.length=0;RULES.forEach((r,i)=>{if(isHead(r))heads.push(i);});
}
export const banDate=()=>BAN_ACTIVE?BF.from:META.ban_updated;
export const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2018\u2019`]/g,"'").replace(/[^a-z0-9']+/g,' ').trim();
export const heads:number[]=[];
export let DECK:any[]=[];
export const setDeck=(d:any[])=>{DECK=d;};
export const IMGBASE='https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/';
export const isHead=r=>/^\d{3}$/.test(r[0])&&r[1].length<70&&!/[.:]$/.test(r[1]);
export function expand(ref){
  const out=[];
  let m=/^(\d{3})-(\d{3})$/.exec(ref);
  if(m){const a=+m[1],b=+m[2];for(let i=0;i<RULES.length;i++)if(top3[i]>=a&&top3[i]<=b)out.push(i);return out;}
  for(let i=0;i<RULES.length;i++){const id=RULES[i][0];if(id===ref||id.startsWith(ref+'.'))out.push(i);}
  return out;
}
export const expandAll=refs=>{const s=new Set();refs.forEach(r=>expand(r).forEach(i=>s.add(i)));return [...s].sort((a,b)=>a-b);};
export function ruleHTML(idxs:any,hl:any=null){
  if(!idxs.length)return '<p class="note">Nincs ilyen szabály.</p>';
  const base=Math.min(...idxs.map(i=>RULES[i][0].split('.').length));
  return idxs.map(i=>{
    const r=RULES[i],dp=Math.min(6,r[0].split('.').length-base);
    let tx=esc(r[1]);
    if(hl)tx=tx.replace(hl,m=>'<mark>'+m+'</mark>');
    const ex=(r[2]||[]).map(e=>'<div class="ex">'+(hl?esc(e).replace(hl,m=>'<mark>'+m+'</mark>'):esc(e))+'</div>').join('');
    return '<div class="rule dp'+dp+(isHead(r)?' h':'')+'" data-rid="'+r[0]+'"><a class="id" href="'+refHash(r[0])+'" title="Link erre a szabályra">'+r[0]+'.</a><div class="tx">'+tx+ex+'</div></div>';
  }).join('');
}
export const refLabel=refs=>refs.join(', ');
export const refHash=ref=>'#r-'+String(ref).trim().replace(/-/g,'--').replace(/\./g,'-');
export const hashRef=h=>h.slice(3).split('--').map(x=>x.replace(/-/g,'.')).join('-');
export const relLinks=rel=>rel&&rel.length?'<div class="rel">Kapcsolódó: '+rel.map(r=>'<a href="#szabalyok" data-ref="'+r+'">'+r+'</a>').join('')+'</div>':'';

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
export const typeLine=c=>[...(c.st||[]).filter(s=>s!=='Basic'&&s!=='Token'),c.t,(c.st||[]).includes('Token')?'Token':''].filter(Boolean).join(' ');
export const domDots=c=>(c.d||[]).map(d=>'<i class="dot d-'+d+'" title="'+d+'"></i>').join('');
export function whyOf(tp,m){
  if(tp.g==='kw')return 'kulcsszó a kártyán: <code>'+esc(m)+'</code>';
  if(tp.g==='type')return esc(tp.why);
  return 'a szövegben: <code>'+esc(m)+'</code>';
}
export const GROUPS=[['kw','Kulcsszavak'],['act','Game Actions a szövegben'],['oth','A szövegből következő további szabályok'],['type','Kártyatípus szabályai']];

export function topicBlock(tp,why,open){
  return '<details class="tp"'+(open?' open':'')+'><summary><span class="rn">'+refLabel(tp.refs)+'</span><span class="tt">'+esc(tp.title)+'</span><span class="why">'+why+'</span></summary><div class="rules" data-refs="'+tp.refs.join('|')+'"></div>'+relLinks(tp.rel)+'</details>';
}
export const FL=['szabály','levezetés','nyitott kérdés'];
export const FLT=['A Core Rules közvetlenül kimondja.','A szabályból és a kártyaszövegből levezetett következmény, nem hivatalos ruling.','A Core Rules nem dönti el egyértelműen, judge döntése kell.'];
export function termOf(w){const lw=w.toLowerCase();for(const x of TERMS){if(new RegExp('^(?:'+x.m+')$','iu').test(w))return x;}return null;}
export const NOHL=new Set(['unit','spell','gear','legend']);
export function glossify(html,seen){
  if(!TRE)return html;seen=seen||new Set();
  return html.replace(/(<[^>]+>)|([^<]+)/g,(m,tag,txt)=>tag?tag:txt.replace(TRE,w=>{const x=termOf(w);if(!x||NOHL.has(x.t)||seen.has(x.t))return w;seen.add(x.t);return '<span class="gl" tabindex="0" data-t="'+TERMS.indexOf(x)+'">'+w+'</span>';}));
}
export function notesHTML(c){
  if(!c.nt)return '<h3>Hogyan érinti ezt a lapot</h3><p class="note">Ehhez a laphoz még nincs kézzel írt, lap-specifikus magyarázat. Lent a rá vonatkozó szabályszakaszok teljes szövege olvasható.</p>';
  const seen=new Set();
  return '<h3>Hogyan érinti ezt a lapot<span class="n">'+c.nt.length+' pont, nem hivatalos ruling</span></h3><div class="ntwrap"><table class="nt">'+c.nt.map(n=>'<tr><td class="r">'+n[0].split(',').map(r=>'<a href="#szabalyok" data-ref="'+r.trim()+'">'+r.trim()+'</a>').join('')+'</td><td>'+glossify(esc(n[2]),seen)+'</td><td class="f"><span class="fl f'+n[1]+'" title="'+FLT[n[1]]+'">'+FL[n[1]]+'</span></td></tr>').join('')+'</table></div>';
}
export const GENERIC_TAGS=new Set(['Equipment']);
export function similar(c,n){
  const kw=new Set(c._kw),act=new Set(c.tp.filter(p=>TOPICS[p[0]].g==='act').map(p=>p[0])),tg=new Set((c.tg||[]).filter(x=>!GENERIC_TAGS.has(x)));
  const out=[];
  CARDS.forEach(o=>{if(o===c||o.n===c.n||o.ban===1)return;
    let s=0;const why=[];
    const sk=o._kw.filter(k=>kw.has(k));if(sk.length){s+=3*sk.length;why.push(...sk);}
    const sa=o.tp.filter(p=>TOPICS[p[0]].g==='act'&&act.has(p[0]));s+=sa.length;
    if(o.t===c.t)s+=2;
    const st=(o.tg||[]).filter(x=>tg.has(x));if(st.length){s+=2*st.length;why.push(...st);}
    if((o.d||[]).some(d=>(c.d||[]).includes(d)))s+=1;
    if(c.e!=null&&o.e!=null)s-=Math.min(3,Math.abs(c.e-o.e))*0.5;
    if(s>=5)out.push([s,o,why.slice(0,3)]);});
  out.sort((a,b)=>b[0]-a[0]);return out.slice(0,n);
}
export function similarHTML(c){
  const L=similar(c,8);if(!L.length)return '';
  return '<h3>Hasonló lapok<span class="n">közös kulcsszó, tag, típus és hatás alapján</span></h3><div class="simgrid">'+L.map(([s,o,w])=>'<button class="simc" data-sim="'+esc(o.n)+'"><b>'+domDots(o)+' '+esc(o.n)+'</b><span>'+esc(typeLine(o))+(o.e!=null?' · Energy '+o.e:'')+'</span>'+(w.length?'<span class="w">'+w.map(esc).join(', ')+'</span>':'')+'</button>').join('')+'</div>';
}
export function cardRulesHTML(c){
  let h=notesHTML(c)+similarHTML(c);
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
export const FORMAT=`Legend:
1 Champion neve, Legend címe

Champion:
1 Champion neve, Unit címe

MainDeck:
3 Kártyanév
2 Másik kártyanév

Battlefields:
1 Battlefield neve
1 Battlefield neve
1 Battlefield neve

Rune Pool:
7 Fury Rune
5 Chaos Rune

Sideboard:
2 Kártyanév`;
export function lev(a,b){const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let p=[];for(let j=0;j<=n;j++)p[j]=j;for(let i=1;i<=m;i++){let q=[i];for(let j=1;j<=n;j++)q[j]=Math.min(p[j]+1,q[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=q;}return p[n];}
export function suggest(name){
  const k=norm(name);const sc=[];
  byName.forEach((c,key)=>{const d=key.includes(k)||k.includes(key)?1:lev(k,key);if(d<=Math.max(2,Math.floor(k.length*0.34)))sc.push([d,c]);});
  sc.sort((a,b)=>a[0]-b[0]);
  return [...new Set(sc.map(s=>s[1]))].slice(0,3);
}
export function parseDeck(text){
  const secs=[];let cur=null;
  text.split(/\r?\n/).forEach(raw=>{
    const line=raw.trim();if(!line)return;
    let m=/^([A-Za-z][A-Za-z \-]*?)\s*:\s*$/.exec(line);
    if(m){cur={name:m[1],rows:[]};secs.push(cur);return;}
    if(!cur){cur={name:'Lista',rows:[]};secs.push(cur);}
    m=/^(\d+)\s*[xX]?\s+(.+)$/.exec(line);
    const qty=m?+m[1]:1,name=(m?m[2]:line).trim();
    const c=byName.get(norm(name))||null;
    cur.rows.push({qty,name,card:c,sug:c?[]:suggest(name)});
  });
  return secs;
}
export const secOf=re=>DECK.filter(s=>re.test(s.name)).flatMap(s=>s.rows.filter(r=>r.card));
export function checkDeck(){
  const L=secOf(/legend/i),CH=secOf(/champion/i),M=secOf(/main/i),B=secOf(/battle/i),RN=secOf(/rune/i),SB=secOf(/side/i);
  const sum=a=>a.reduce((x,r)=>x+r.qty,0);const out=[];
  const add=(ok,rule,txt)=>out.push([ok,rule,txt]);
  const leg=L.length?L[0].card:null;
  add(sum(L)===1&&leg&&leg.t==='Legend','103.2','Pontosan 1 Champion Legend kell. A listában: '+sum(L)+'.');
  if(!leg||leg.t!=='Legend')return out;
  const id=leg.d||[];
  const ch=CH.length?CH[0].card:null;
  add(sum(CH)===1&&ch&&ch.t==='Unit'&&(ch.st||[]).includes('Champion'),'103.3.a','Pontosan 1 Chosen Champion kell, és Champion unitnak kell lennie.');
  if(ch&&leg.ch)add((ch.tg||[]).includes(leg.ch),'103.3.a.2','A Chosen Champion tagje egyezzen a legend Champion tagjével ('+leg.ch+').');
  const main=M.concat(CH);const n=sum(main);
  add(n>=40,'103.3','A Main Deck legalább 40 lap, a Chosen Championnel együtt. Most: '+n+'.');
  const wrong=main.filter(r=>!['Unit','Gear','Spell'].includes(r.card.t)||(r.card.st||[]).includes('Token'));
  add(!wrong.length,'103.3','A Main Deckben csak Unit, Gear és Spell lehet.'+(wrong.length?' Nem odavaló: '+wrong.map(r=>r.card.n).join(', ')+'.':''));
  const cnt={};main.forEach(r=>cnt[r.card.n]=(cnt[r.card.n]||0)+r.qty);
  const over=Object.keys(cnt).filter(k=>cnt[k]>3);
  add(!over.length,'103.3.b','Azonos nevű lapból legfeljebb 3 lehet, a Chosen Championt is beleszámolva.'+(over.length?' Túllépi: '+over.map(k=>k+' ('+cnt[k]+')').join(', ')+'.':''));
  const uq=[...new Set(main.map(r=>r.card))].filter(c=>/\[Unique\]/.test(c.txt||'')&&cnt[c.n]>1);
  if(main.some(r=>/\[Unique\]/.test(r.card.txt||'')))add(!uq.length,'825.3.a','[Unique] lapból csak 1 példány lehet.'+(uq.length?' Túllépi: '+uq.map(c=>c.n).join(', ')+'.':''));
  const offDom=a=>[...new Set(a.map(r=>r.card))].filter(c=>(c.d||[]).some(d=>!id.includes(d)));
  const od=offDom(main);
  add(!od.length,'103.2.b','Minden lap domainje a legend Domain Identity-jén ('+id.join(' + ')+') belül legyen.'+(od.length?' Kilóg: '+od.map(c=>c.n+' ('+c.d.join('+')+')').join(', ')+'.':''));
  const sig=main.filter(r=>(r.card.st||[]).includes('Signature'));const sn=sum(sig);
  add(sn<=3,'103.3.d.1','Összesen legfeljebb 3 Signature lap lehet. Most: '+sn+'.');
  if(sig.length&&leg.ch){const bad=sig.filter(r=>!(r.card.tg||[]).includes(leg.ch));add(!bad.length,'103.3.d.2','Minden Signature lap a legend Champion tagjét ('+leg.ch+') viselje.'+(bad.length?' Nem egyezik: '+bad.map(r=>r.card.n).join(', ')+'.':''));}
  const rn=sum(RN);
  add(rn===12&&RN.every(r=>r.card.t==='Rune'),'103.4.a','A Rune Deck pontosan 12 rune. Most: '+rn+'.');
  const ro=offDom(RN);
  add(!ro.length,'103.4.a.1','A rune-ok a legend Domain Identity-jén belül legyenek.'+(ro.length?' Kilóg: '+ro.map(c=>c.n).join(', ')+'.':''));
  const bn=sum(B);
  add(bn===3&&B.every(r=>r.card.t==='Battlefield'),'487.5','1v1 módban 3 Battlefield kell, ebből egy kerül véletlenszerűen játékba. Most: '+bn+'. Más módban a szám eltér (103.5.a).');
  add(B.every(r=>r.qty===1),'103.5.c','Azonos nevű Battlefieldből csak egy lehet.');
  const ban=main.concat(B,SB,L).filter(r=>r.card.ban===1);
  add(!ban.length,'103.3.e','Tiltott lap nem lehet a deckben (érvényes ban lista: '+banDate()+').'+(ban.length?' Tiltott: '+[...new Set(ban.map(r=>r.card.n))].join(', ')+'.':''));
  const fut=main.concat(B,SB,L).filter(r=>r.card.banf&&!r.card.ban);
  if(fut.length)out.push([null,'103.3.e','Figyelem: '+BF.from+'-tól tiltott lesz: '+[...new Set(fut.map(r=>r.card.n))].join(', ')+'. A deck addig legális, utána ezeket cserélni kell.']);
  if(SB.length){const all={};main.concat(SB).forEach(r=>all[r.card.n]=(all[r.card.n]||0)+r.qty);const o2=Object.keys(all).filter(k=>all[k]>3);
    out.push([null,'','Sideboard: '+sum(SB)+' lap. A sideboard méretét és a példányszám-limit számítását a Tournament Rules szabályozza, azt ez az oldal nem ellenőrzi.'+(o2.length?' Main Deck és Sideboard együtt 3-nál több: '+o2.map(k=>k+' ('+all[k]+')').join(', ')+'.':'')]);}
  return out;
}
export function curveHTML(){
  const M=DECK.filter(s=>/main|champion/i.test(s.name)).flatMap(s=>s.rows.filter(r=>r.card&&['Unit','Gear','Spell'].includes(r.card.t)));
  if(!M.length)return '';
  const b=[0,0,0,0,0,0,0,0],bt=[{},{},{},{},{},{},{},{}];let tot=0,sum=0;
  M.forEach(r=>{const e=r.card.e==null?0:Math.min(7,r.card.e);b[e]+=r.qty;bt[e][r.card.t]=(bt[e][r.card.t]||0)+r.qty;tot+=r.qty;sum+=(r.card.e||0)*r.qty;});
  const mx=Math.max(...b,1),H=120;
  const dom={};M.forEach(r=>(r.card.d||[]).forEach(d=>dom[d]=(dom[d]||0)+r.qty));
  const dl=Object.entries(dom).sort((a,b)=>b[1]-a[1]);const dmx=Math.max(1,...dl.map(x=>x[1]));
  const typ={};M.forEach(r=>typ[r.card.t]=(typ[r.card.t]||0)+r.qty);
  let h='<h3>Energy görbe<span class="n">Main Deck és Chosen Champion, '+tot+' lap, átlag Energy '+(sum/tot).toFixed(2).replace('.',',')+'</span></h3>';
  h+='<div class="curve" role="img" aria-label="Lapok száma Energy cost szerint">'+b.map((n,i)=>{const det=Object.entries(bt[i]).map(([k,v])=>k+' '+v).join(', ');return '<div class="cb" tabindex="0" data-tt="Energy '+(i===7?'7+':i)+': '+n+' lap'+(det?' ('+det+')':'')+'">'+(n===mx?'<span class="vl">'+n+'</span>':'')+'<div class="bar" style="height:'+(n?Math.max(3,Math.round(n/mx*H)):0)+'px"></div><span class="lb">'+(i===7?'7+':i)+'</span></div>';}).join('')+'</div>';
  h+='<div class="curvetbl"><details><summary class="note">Táblázatként</summary><table class="im"><tr><th>Energy</th>'+b.map((n,i)=>'<th>'+(i===7?'7+':i)+'</th>').join('')+'</tr><tr><td>Lap</td>'+b.map(n=>'<td>'+n+'</td>').join('')+'</tr></table></details></div>';
  h+='<div class="dist"><div><h4>Domain</h4>'+dl.map(([d,n])=>'<div class="hb"><span class="hl"><i class="dot d-'+d+'"></i>'+d+'</span><span class="ht"><span style="width:'+Math.round(n/dmx*100)+'%"></span></span><span class="hn">'+n+'</span></div>').join('')+'<p class="note">Többdomainű lap mindegyik domainjénél számít.</p></div>';
  const tl=Object.entries(typ).sort((a,b)=>b[1]-a[1]);const tmx=Math.max(1,...tl.map(x=>x[1]));
  h+='<div><h4>Típus</h4>'+tl.map(([d,n])=>'<div class="hb"><span class="hl">'+d+'</span><span class="ht"><span style="width:'+Math.round(n/tmx*100)+'%"></span></span><span class="hn">'+n+'</span></div>').join('')+'</div></div>';
  return h;
}
export function legalityHTML(){
  const c=checkDeck();if(!c.length)return '';
  const bad=c.filter(x=>x[0]===false).length;
  return '<h3>Deck legalitás (Core Rules 103)<span class="n">'+(bad?bad+' hiba':'nincs hiba')+'</span></h3><ul class="chk-list">'+c.map(x=>'<li><span class="st '+(x[0]===null?'inf':x[0]?'ok':'bad')+'">'+(x[0]===null?'INFO':x[0]?'OK':'HIBA')+'</span><span>'+(x[1]?'<a href="#szabalyok" data-ref="'+x[1]+'" style="font-family:var(--f-mono);font-size:12px">'+x[1]+'</a> ':'')+esc(x[2])+'</span></li>').join('')+'</ul>';
}
export const EVENTS=[
 ['Move','421',/\bmove (?:a|an|up to|me|it|that|two|any|them|another|all)\b|\[Ganking\]/i,/when (?:i|you|a friendly unit|an? (?:enemy )?unit)[^.]{0,40}\bmoves?\b/i],
 ['Discard','423',/\bdiscard (?:\d|a|your|that)/i,/when you discard|when i(?:'m| am) discarded/i],
 ['Draw','414',/\bdraws? \d|\bdraw (?:it|a|that)/i,/when you draw/i],
 ['Trash töltése és használata','441',/\[Burn|into your trash|\bdiscard \d/i,/in your trash|from your trash/i],
 ['Deck tetejének megnézése','437',/look at the top|reveal the top|\[Predict|\[Vision\]/i,/as you look at or reveal me|revealed from your deck/i],
 ['Kijátszás nem kézből','420',/from your trash|\[Flow\]|\[Hidden\]|from face ?down|banish[^.]*you may play/i,/from anywhere other than your hand/i],
 ['Token','179',/\btokens?\b/i,/when you play a[^.]{0,30}token|for each[^.]{0,30}token/i],
 ['Buff','427',/\[Buff\]|\bbuff (?:a|me|it|another|two|all)\b/i,/spend (?:my|a|its) buff|\bbuffed\b|has a buff|with a buff/i],
 ['Stun','424',/\[Stun\]|\bstun (?:a|an|it|all)\b/i,/\bstunned\b|when you stun/i],
 ['Exhaust','415',/\bexhaust (?:a|an|it|all|up to|two)\b/i,/when (?:i|a friendly unit) becomes? exhausted|exhausted (?:enemy |friendly )?unit/i],
 ['Ready','416',/\bready (?:a|an|it|me|your|up to|two|all)\b/i,/when i become ready|\breadied\b/i],
 ['Kill és halál','429',/\bkill (?:a|an|another|this|me|it|all)\b/i,/\[Deathknell\]|when (?:a|another) friendly unit dies|when i die/i],
 ['Equipment','818',/\[Equip\]|\[Quick-Draw\]/i,/\[Weaponmaster\]|\bequipped\b|\bEquipment\b/],
 ['Empower','442',/\bempower (?:me|it|a|this)\b|\[Empower\]/i,/\[Empowered\]|disempower/i],
 ['XP','728',/gains? \d* ?XP|\[Hunt/i,/\[Level|spend \d* ?XP|pay \d+ XP/i],
 ['Conquer','471.1',/(?!)/,/when (?:you|i) conquer/i],
 ['Hold','471.2',/(?!)/,/when (?:you|i)(?: conquer or)? hold/i],
 ['Spell kijátszása','420.4',null,/when you play a spell|spells you play|your spells/i],
 ['Gear kijátszása','420.4',null,/when (?:you|an opponent) plays? a gear|friendly gear/i]];
export function interactionHTML(){
  const cards=[];DECK.forEach(s=>s.rows.forEach(r=>{if(r.card&&!cards.includes(r.card))cards.push(r.card);}));
  const rows=[];
  EVENTS.forEach(e=>{
    const prod=cards.filter(c=>e[2]===null?(e[0].startsWith('Spell')?c.t==='Spell':c.t==='Gear'):e[2].test(c.txt||''));
    const cons=cards.filter(c=>e[3].test(c.txt||''));
    if(cons.length&&(prod.length||/^(Conquer|Hold)$/.test(e[0])))rows.push('<tr><td><a href="#szabalyok" data-ref="'+e[1]+'" style="font-family:var(--f-mono);font-size:12px;font-weight:400">'+e[1]+'</a> '+e[0]+'</td><td>'+(prod.length?prod.map(c=>esc(c.n)).join(', '):'<span class="rem">a battlefield megszerzése</span>')+'</td><td>'+cons.map(c=>esc(c.n)).join(', ')+'</td></tr>');
  });
  if(!rows.length)return '';
  return '<h3>Interakciós térkép<span class="n">automatikus, szövegminta alapján</span></h3><div class="ntwrap"><table class="im"><tr><th>Esemény</th><th>Ezek a lapok váltják ki</th><th>Ezek a lapok reagálnak rá</th></tr>'+rows.join('')+'</table></div><p class="note">A térkép azt mutatja, mely lapok szövege hoz létre és melyeké figyel egy eseményt. A pontos feltételeket a lapok saját magyarázata és a hivatkozott szabály adja.</p>';
}
export function b64e(s){return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function b64d(s){s=s.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';return decodeURIComponent(escape(atob(s)));}
export function pdfSafe(s){return String(s).replace(/\t/g,' ').replace(/[^\n\x20-\x7E\xA0-\u017F\u2010-\u2026\u2030\u20AC\u2122\u25B8]/g,'?');}
export const pdfCardText=t=>(t||'').replace(/\[S\]/g,'Might').replace(/\[>\]/g,' > ').replace(/\[>>\]/g,' >> ').replace(/\[[TE]\]/g,'[Exhaust]').replace(/\[([RGBOPY])\]/g,(m,k)=>'['+DOMS[k]+']');
export function buildPDF(withRel=false,withGen=false,fonts:any=null,J:any=null){
  
  const doc=new J({unit:'mm',format:'a4'});
  const F=fonts;[['n','normal'],['b','bold'],['i','italic']].forEach(([k,st])=>{doc.addFileToVFS('dv-'+k+'.ttf',F[k]);doc.addFont('dv-'+k+'.ttf','DV',st);});
  const PW=210,PH=297,ML=16,MR=16,MT=16,MB=16;let y=MT;
  const lh=sz=>sz*0.3528*1.28;
  function put(text,o){
    o=o||{};const sz=o.size||9.5,ind=o.indent||0;
    doc.setFont('DV',o.style||'normal');doc.setFontSize(sz);
    const c=o.color||[20,24,34];doc.setTextColor(c[0],c[1],c[2]);
    const lines=doc.splitTextToSize(pdfSafe(text),PW-ML-MR-ind);
    if(o.before)y+=o.before;
    if(o.keep&&y+lh(sz)*Math.min(lines.length+o.keep,6)>PH-MB){doc.addPage();y=MT;}
    lines.forEach(l=>{if(y+lh(sz)>PH-MB){doc.addPage();y=MT;}doc.text(l,ML+ind,y+sz*0.3528);y+=lh(sz);});
    if(o.after)y+=o.after;
  }
  const rule=()=>{doc.setDrawColor(150);doc.setLineWidth(0.2);doc.line(ML,y,PW-MR,y);y+=2;};
  
  const legend=(DECK.find(s=>/legend/i.test(s.name))||{rows:[]}).rows.map(r=>r.card?r.card.n:r.name).join(', ');
  put('Riftbound deck szabály-referencia',{size:20,style:'bold'});
  if(legend)put('Legend: '+legend,{size:12,style:'bold',color:[110,75,0]});
  put('Készült: '+new Date().toISOString().slice(0,10)+'. Források: Riftbound Core Rules (Last Updated '+META.rules_updated+'), Rules Hub ban lista ('+META.ban_updated+', plusz a '+BF.from+'-tól hatályos Radiance ban list), hivatalos errata cikkek, Card Gallery pillanatkép ('+META.cards_snapshot+').',{size:8.5,color:[90,98,115],before:1});
  put('AI segítségével készült: Claude (Anthropic), Claude Fable 5.2 és Claude Opus 5.5 modell.',{size:8.5,color:[90,98,115]});
  put('Nem hivatalos segédanyag, készítette: Daneehunter. A Riftbound a Riot Games tulajdona, a Riot Games nem támogatja és nem szponzorálja ezt az anyagot. Hivatalos oldal: https://playriftbound.com',{size:8.5,color:[90,98,115]});
  put('Jelölés a kártyaszövegben: [1] Energy, [A] bármely domain Power, [C] a kártya saját domainjének Power-e, [Exhaust] a kártya kimerítése, Might a harci érték. A szabályszöveg az eredeti angol Core Rules szöveg.',{size:8.5,color:[90,98,115],after:2});
  rule();
  put('Deck összetétel',{size:13,style:'bold',before:1});
  DECK.forEach(s=>{put(s.name+' ('+s.rows.reduce((a,r)=>a+r.qty,0)+')',{size:9.5,style:'bold',before:1.5});s.rows.forEach(r=>put(r.qty+'  '+(r.card?r.card.n:r.name+'  [ismeretlen kártyanév]')+(r.card&&r.card.err!=null?'  [errata]':'')+(r.card&&r.card.ban?'  [BANNED]':r.card&&r.card.banf?'  [BANNED '+r.card.banf+'-tól]':''),{size:9,indent:4}));});
  const lc=checkDeck();if(lc.length){put('Deck legalitás (Core Rules 103)',{size:13,style:'bold',before:3});lc.forEach(x=>put((x[0]===null?'INFO':x[0]?'OK':'HIBA')+'   '+(x[1]?x[1]+'  ':'')+x[2],{size:9,indent:2,color:x[0]===false?[160,50,15]:[20,24,34]}));}
  const seen=new Map();
  DECK.forEach(s=>s.rows.forEach(r=>{if(!r.card)return;if(!seen.has(r.card))seen.set(r.card,[]);seen.get(r.card).push(r.qty+'x '+s.name);}));
  const used=new Set(),usedRel=new Set();
  doc.addPage();y=MT;
  put('1. Kártyánként érvényes szabályok',{size:15,style:'bold',after:1});
  seen.forEach((where,c)=>{
    put(c.n,{size:12.5,style:'bold',before:3,keep:5});
    const st=[typeLine(c)];if(c.d&&c.d.length)st.push(c.d.join(' + '));if(c.e!=null)st.push('Energy '+c.e);if(c.p)st.push('Power '+c.p);if(c.m!=null)st.push('Might '+c.m);st.push(where.join(', '));
    put(st.join('   |   '),{size:8.5,color:[90,98,115]});
    if(c.ban)put(c.ban===1?'BANNED: tiltott a Constructed formátumban.':'BANNED a 2v2 Constructed formátumban.',{size:9,style:'bold',color:[160,50,15]});
    else if(c.banf)put('BANNED '+c.banf+'-tól (Radiance ban list, Standard és 2v2 Constructed).',{size:9,style:'bold',color:[160,50,15]});
    if(c.txt)put(pdfCardText(c.txt),{size:9.5,indent:3,before:1});
    if(c.eff)put('Effect Text (csatolva): '+pdfCardText(c.eff),{size:9.5,indent:3,before:0.5});
    if(c.sh)put('Röviden: '+c.sh,{size:9.5,indent:3,before:1,color:[110,75,0]});
    if(c.err!=null){put('Errata: a szöveg megváltozott, a fenti a hatályos. Forrás: '+META.articles[c.err].t+', '+META.articles[c.err].u,{size:8.5,style:'italic',color:[110,75,0],indent:3,before:0.5});
      if(c.old)put('Nyomtatott szöveg: '+pdfCardText(c.old).replace(/\n/g,' / '),{size:8.5,color:[90,98,115],indent:3});}
    if(c.nt){put('Hogyan érinti ezt a lapot (nem hivatalos ruling):',{size:9,style:'bold',before:1.2});
      c.nt.forEach(n=>{put(n[0]+'  '+n[2]+(n[1]?'  ['+FL[n[1]]+']':''),{size:9,indent:3});n[0].split(',').forEach(r=>expand(r.trim()).forEach(i=>used.add(i)));});}
    put('Érvényes szabályok:',{size:9,style:'bold',before:1.2});
    if(c.ex&&c.ex.length){put('Név szerint említi a szabályzat: '+c.ex.join(', '),{size:9,indent:3});c.ex.forEach(id=>{const i=RULES.findIndex(r=>r[0]===id);if(i>=0)used.add(i);});}
    c.tp.forEach(p=>{const tp=TOPICS[p[0]];
      const why=tp.g==='kw'?'kulcsszó: '+p[1]:tp.g==='type'?tp.why:'szövegben: "'+p[1]+'"';
      put(refLabel(tp.refs)+'  '+tp.title+'  ('+why+')'+(tp.rel&&tp.rel.length?'  kapcsolódó: '+tp.rel.join(', '):''),{size:9,indent:3});
      expandAll(tp.refs).forEach(i=>used.add(i));
      if(withRel&&tp.rel)expandAll(tp.rel).forEach(i=>usedRel.add(i));
    });
  });
  if(withGen)D.general.forEach(g=>expandAll(g.refs).forEach(i=>used.add(i)));
  usedRel.forEach(i=>used.add(i));
  doc.addPage();y=MT;
  put('2. A hivatkozott szabályok teljes szövege',{size:15,style:'bold'});
  put('Riftbound Core Rules, Last Updated '+META.rules_updated+'. Csak a deck kártyáira vonatkozó szakaszok, szabályszám szerinti sorrendben'+(withRel?', a kapcsolódó szakaszokkal':'')+(withGen?', az általános szabályokkal':'')+'.',{size:8.5,color:[90,98,115],after:2});
  [...used].sort((a,b)=>a-b).forEach(i=>{
    const r=RULES[i],dp=Math.min(5,r[0].split('.').length-1),h=isHead(r);
    put(r[0]+'.  '+r[1],{size:h?11:9,style:h?'bold':'normal',indent:dp*4,before:h?2.5:0.6,keep:h?3:0});
    (r[2]||[]).forEach(e=>put(e,{size:8.3,style:'italic',color:[90,98,115],indent:dp*4+5,before:0.3}));
  });
  const n=doc.internal.getNumberOfPages();
  for(let i=1;i<=n;i++){doc.setPage(i);doc.setFont('DV','normal');doc.setFontSize(8);doc.setTextColor(120);doc.text(pdfSafe('Riftbound deck szabály-referencia'+(legend?'  |  '+legend:'')),ML,PH-8);doc.text(i+' / '+n,PW-MR,PH-8,{align:'right'});}
  return {blob:doc.output('blob'),pages:n,name:'riftbound-deck-szabalyok'+(legend?'-'+norm(legend).replace(/[^a-z0-9]+/g,'-').slice(0,40):'')+'.pdf'};
}
export function headExtent(i){const k=heads.indexOf(i);const end=k+1<heads.length?heads[k+1]:RULES.length;const a=[];for(let j=i;j<end;j++)a.push(j);return a;}
export const vsCard=v=>!v||!String(v).trim()?null:byName.get(norm(v))||CARDS.find(c=>norm(c.n).startsWith(norm(v)));
export const kwRef=k=>{const t=TOPICS.find(x=>x.k==='kw:'+k);return t?t.refs[0]:'';};
export function vsPairs(A,B){
  const out=[];const ta=(A.txt||'')+' '+(A.eff||''),tb=(B.txt||'')+' '+(B.eff||'');const refsA=(A.nt||[]).flatMap(n=>n[0].split(',').map(x=>x.trim()));
  const targets=refsA.some(r=>/^355\.(7|9|10|11)/.test(r));
  const add=(ref,txt)=>out.push([ref,txt]);
  if(targets&&/can.t be chosen|cannot be chosen/i.test(tb))add('757',A.n+' választást kér, '+B.n+' szövege viszont bizonyos helyzetben kizárja, hogy kiválasszák. Ha a feltétel teljesül (például enemy spell választaná), '+B.n+' nem választható.');
  if(targets&&/\[Deflect/.test(tb))add(kwRef('Deflect')||'356.2.a',B.n+' Deflectje miatt, ha '+A.n+' őt választja, plusz költséget kell fizetni.');
  if(/counter (?:a|an|target|that|it)\b[^.]{0,30}spell|counter (?:a|an) spell/i.test(ta)&&B.t==='Spell')add('426',A.n+' counterelheti '+B.n+'-t, amíg az a chainen vár. A counterelt spell nem hat, és a kifizetett cost nem jár vissza.');
  if(/\bkill\b|\bdeal \d/i.test(ta)&&/\[Deathknell\]/.test(tb))add(kwRef('Deathknell')||'429',A.n+' megölheti '+B.n+'-t, ekkor '+B.n+' Deathknell képessége elindul.');
  if(/\bbanish/i.test(ta)&&/\[Deathknell\]/.test(tb))add('428',A.n+' banish hatása nem kill, ezért ha így kerül el '+B.n+', a Deathknell képessége nem indul.');
  if(/\bkill\b|\bdeal \d/i.test(ta)&&/(if (?:i|this|it) would die|would be killed)/i.test(tb))add('367',B.t==='Gear'&&B.eff?B.n+' Effect Textje replacement effectet ad a felszerelt unitnak: ha '+A.n+' megölné azt a unitot, helyette a '+B.n+' hatása fut le.':B.n+' replacement effectje helyettesítheti a halálát, ha '+A.n+' megölné.');
  if(/return[^.]{0,60}hand/i.test(ta)&&(B.st||[]).includes('Token'))add('186.1',A.n+' kézbe küldené '+B.n+'-t, de token kézbe kerülve megszűnik.');
  if(/return[^.]{0,60}hand/i.test(ta)&&B.t==='Unit')add('719.5',A.n+' kézbe küldheti '+B.n+'-t: ha rajta Equipment van, az leválik és a boardon marad.');
  if(A.t==='Gear'&&(A.tg||[]).includes('Equipment')&&B.t==='Unit')add('716',A.n+' Equipment, felcsatolható '+B.n+'-re: ekkor '+B.n+' megkapja a Might bonust és az Effect Textet.');
  if(/\bmove/i.test(ta)&&/can.t move|cannot move/i.test(tb))add('358.3.a',A.n+' mozgatást kér, de '+B.n+' tiltja: a lap kijátszható, a mozgás viszont negálódik.');
  if(/\[Stun\]|\bstun/i.test(ta)&&B.t==='Unit')add(kwRef('Stun')||'424',A.n+' stunolhatja '+B.n+'-t.');
  return out;
}