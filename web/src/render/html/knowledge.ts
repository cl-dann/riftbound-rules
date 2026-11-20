// @ts-nocheck
import {D,CARDS,META,esc,glossify} from '../../legacy/core';
/* Szószintű diff (LCS) az errata előtte/utána nézethez. */
function wdiff(a,b){
  const A=String(a).split(/(\s+)/),B=String(b).split(/(\s+)/),n=A.length,m=B.length;
  const L=Array.from({length:n+1},()=>new Int32Array(m+1));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=A[i]===B[j]?L[i+1][j+1]+1:Math.max(L[i+1][j],L[i][j+1]);
  let i=0,j=0,o='',nw='';
  while(i<n&&j<m){if(A[i]===B[j]){o+=esc(A[i]);nw+=esc(B[j]);i++;j++;}else if(L[i+1][j]>=L[i][j+1]){o+='<del>'+esc(A[i])+'</del>';i++;}else{nw+='<ins>'+esc(B[j])+'</ins>';j++;}}
  while(i<n)o+='<del>'+esc(A[i++])+'</del>';while(j<m)nw+='<ins>'+esc(B[j++])+'</ins>';
  return [o.replace(/<\/del><del>/g,''),nw.replace(/<\/ins><ins>/g,'')];
}
export function renderTud(){
  const X=D.extra||{};
  let h='<div class="subnav">'+'<a class="chip" href="#hogyan">How to Play</a>'+'<a class="chip" href="#tud-olvas" data-scroll="tud-olvas">A magyarázatok olvasása</a>'+(X.terms?'<a class="chip" href="#tud-fog" data-scroll="tud-fog">Fogalmak</a>':'')+(X.glossary?'<a class="chip" href="#tud-kw" data-scroll="tud-kw">Kulcsszavak</a>':'')+(X.flow?'<a class="chip" href="#tud-flow" data-scroll="tud-flow">Játékmenet</a>':'')+(X.patchnotes?'<a class="chip" href="#tud-pn" data-scroll="tud-pn">Szabályváltozások</a>':'')+'<a class="chip" href="#tud-err" data-scroll="tud-err">Errata</a>'+'</div>';
  const rl=r=>'<a href="#szabalyok" data-ref="'+esc(r)+'">'+esc(r)+'</a>';
  if(false&&X.guide){
    h+='<h2 id="tud-guide" style="margin-top:14px">Kezdő útmutató</h2><p class="note" style="margin:6px 0 12px">Az első játék lépésről lépésre, a Core Rules alapján. AI által írt összefoglaló, nem hivatalos.</p>';
    X.guide.forEach((g,i)=>{h+='<div class="guide"><h3>'+(i+1)+'. '+esc(String(g.title).replace(/^\s*\d+\.\s*/,''))+(g.rules?'<span class="n">'+rl(g.rules)+'</span>':'')+'</h3>'+(g.paras||[]).map(p=>'<p>'+glossify(esc(p))+'</p>').join('')+(g.steps&&g.steps.length?'<ol class="flow">'+g.steps.map(s=>'<li><span>'+esc(s[1])+rl(s[0])+'</span></li>').join('')+'</ol>':'')+'</div>';});
  }
  h+='<h2 id="tud-olvas" style="margin-top:28px">A magyarázatok olvasása</h2><div class="guide">'
   +'<p>Minden kártya "Hogyan érinti ezt a lapot" listájában a pontok mellett egy címke áll. Ez mutatja, mennyire biztos az adott állítás.</p>'
   +'<ul class="olv"><li><span class="fl f0">szabály</span>A hivatkozott Core Rules szakasz szó szerint kimondja, vagy példaként leírja. Erre nyugodtan lehet építeni.</li>'
   +'<li><span class="fl f1">levezetés</span>A szabály és a kártya szövege együtt adja ki, de a szabályzat szó szerint nem írja le. Valószínűleg így működik, de ez az oldal következtetése, nem hivatalos döntés.</li>'
   +'<li><span class="fl f2">nyitott kérdés</span>A Core Rules nem ad egyértelmű választ. Tipikus okok: két szabály mást mond ugyanarra a helyzetre, a kártya olyan fogalmat használ, amit a szabályzat nem definiál (például "excess damage"), vagy nem derül ki, hogy egy esemény számít-e (például hogy az exhausted belépés "become exhausted"-nek számít-e). '+CARDS.reduce((a,c)=>a+(c.nt||[]).filter(n=>n[1]===2).length,0)+' ilyen pont van az oldalon.</li></ul>'
   +'<p>A "judge döntése kell" azt jelenti, hogy ilyenkor a versenybíró (judge) mondja meg, hogyan működik a helyzet. Hivatalos versenyen az ő döntése érvényes az adott meccsre, ezért ha egy nyitott kérdéses lap a deckedben van, érdemes a verseny előtt megkérdezni. Otthoni játéknál a játékosok előre megegyeznek, és figyelik, hogy a Riot kiad-e pontosítást (Rules Hub, errata, FAQ).</p></div>';
  if(X.terms){h+='<h2 id="tud-fog" style="margin-top:14px">Fogalmak</h2><p class="note" style="margin:6px 0 12px">A magyarázatokban használt szakszavak egyszerűen. A kártyák magyarázataiban a pontozottan aláhúzott szóra mutatva vagy koppintva is megjelennek.</p><ul class="terms">'+[...X.terms].sort((a,b)=>a.t.localeCompare(b.t)).map(x=>'<li><b>'+esc(x.t)+'</b>'+rl(x.r)+'<br>'+esc(x.d)+'</li>').join('')+'</ul>';}
  if(X.glossary){
    h+='<h2 id="tud-kw" style="margin-top:28px">Kulcsszavak</h2><p class="note" style="margin:6px 0 12px">A Core Rules 805-832 kulcsszavai röviden. A pontos szöveg a szabályszámra kattintva olvasható. AI által írt összefoglaló, nem hivatalos.</p><div class="kwgrid">';
    X.glossary.forEach(g=>{const re=new RegExp('\\['+g.kw.replace(/[-]/g,'\\-')+'(?: \\d+)?\\]');const n=CARDS.filter(c=>c.ban!==1&&re.test(c.txt||'')).length;
      h+='<div class="kwc"><h4><span class="kw">'+esc(g.kw)+'</span>'+rl(g.rule)+'</h4><div class="k">'+esc(g.kind||'')+(g.on?' · '+esc(g.on):'')+'</div><p>'+esc(g.short||'')+'</p><ul>'+(g.points||[]).map(p=>'<li>'+rl(p[0])+'<span>'+esc(p[1])+'</span></li>').join('')+'</ul>'+(g.stack?'<p class="note">Több példány: '+esc(g.stack)+'</p>':'')+'<button data-kwq="['+esc(g.kw)+'">'+n+' lap ezzel a kulcsszóval</button></div>';});
    h+='</div>';
  }
  if(X.flow){
    h+='<h2 id="tud-flow" style="margin-top:28px">Játékmenet</h2><p class="note" style="margin:6px 0 12px">A kör, a chain, a kártyakijátszás és a combat lépései a Core Rules szerint. Kattints egy lépésre, vagy lépkedj a nyilakkal. AI által írt összefoglaló, nem hivatalos.</p>';
    X.flow.forEach((b,bi)=>{const st=b.steps||[];
      h+='<div class="fdia" data-fb="'+bi+'"><h3>'+esc(b.title)+'<span class="n">'+esc(b.rules||'')+'</span></h3><div class="ftrack" role="tablist">'
        +st.map((x,i)=>'<button role="tab" class="fnode'+(i?'':' on')+'" data-fs="'+bi+':'+i+'" aria-selected="'+(i?'false':'true')+'"><span class="fi">'+(i+1)+'</span><span class="fn">'+esc(x.name)+'</span></button>').join('')+'</div>'
        +st.map((x,i)=>'<div class="fpane"'+(i?' hidden':'')+' data-fp="'+bi+':'+i+'"><div class="fhead"><b>'+(/^\d+\./.test(x.name)?'':(i+1)+'. ')+esc(x.name)+'</b>'+rl(x.rule)+'</div><p>'+glossify(esc(x.text))+'</p><div class="fnav">'+(i?'<button class="btn sec sm" data-fs="'+bi+':'+(i-1)+'">Előző: '+esc(st[i-1].name)+'</button>':'')+(i<st.length-1?'<button class="btn sm" data-fs="'+bi+':'+(i+1)+'">Következő: '+esc(st[i+1].name)+'</button>':'')+'</div></div>').join('')
        +'</div>';});
  }
  {
    const E=CARDS.filter(c=>c.err!=null&&c.old&&c.old!==c.txt);const seen=new Set();const L=E.filter(c=>!seen.has(c.txt)&&seen.add(c.txt));
    if(L.length){
      const by={};L.forEach(c=>(by[c.err]=by[c.err]||[]).push(c));
      h+='<h2 id="tud-err" style="margin-top:28px">Errata: előtte és utána</h2><p class="note" style="margin:6px 0 12px">'+L.length+' lap nyomtatott és hatályos szövege egymás mellett. Pirossal a kikerült, zölddel a bekerült szavak. Versenyen mindig a hatályos szöveg érvényes.</p><input type="search" class="errq" placeholder="Szűrés kártyanévre" aria-label="Errata szűrés">';
      Object.keys(by).forEach(k=>{const a=META.articles[k]||{};
        h+='<div class="errgrp"><h3><a href="'+esc(a.u||'#')+'">'+esc(a.t||'Errata')+'</a><span class="n">'+by[k].length+' lap</span></h3>';
        by[k].sort((x,y)=>x.n.localeCompare(y.n)).forEach(c=>{const [o,nw]=wdiff(c.old,c.txt);
          h+='<div class="errc" data-n="'+esc(c.n.toLowerCase())+'"><button class="errn" data-card="'+esc(c.n)+'">'+esc(c.n)+'</button><div class="errcols"><div><span class="lbl">Nyomtatott</span><p>'+o.replace(/\n/g,'<br>')+'</p></div><div><span class="lbl">Hatályos</span><p>'+nw.replace(/\n/g,'<br>')+'</p></div></div></div>';});
        h+='</div>';});
    }
  }
  if(X.patchnotes){
    h+='<h2 id="tud-pn" style="margin-top:28px">Szabályváltozások</h2><p class="note" style="margin:6px 0 12px">A hivatalos patch notes cikkek rövid, saját szavas kivonata. A teljes szöveg a cikkekben olvasható.</p>';
    X.patchnotes.forEach(p=>{h+='<div class="pn"><h3 style="margin-bottom:2px"><a href="'+esc(p.url)+'">'+esc(p.title)+'</a><span class="n">'+esc(p.date||'')+(p.effective?', hatályos: '+esc(p.effective):'')+'</span></h3><ul>'+(p.changes||[]).map(c=>'<li>'+(c.rule?rl(c.rule)+' ':'')+esc(c.text)+'</li>').join('')+'</ul></div>';});
  }
  return h;
}
