// @ts-nocheck
import {D,CARDS,esc,glossify} from './core';
export function renderTud(){
  const X=D.extra||{};
  let h='<div class="subnav">'+'<a class="chip" href="#tanulas">Tanulás: kezdő útmutató</a>'+'<a class="chip" href="#tud-olvas" data-scroll="tud-olvas">A magyarázatok olvasása</a>'+(X.terms?'<a class="chip" href="#tud-fog" data-scroll="tud-fog">Fogalmak</a>':'')+(X.glossary?'<a class="chip" href="#tud-kw" data-scroll="tud-kw">Kulcsszavak</a>':'')+(X.flow?'<a class="chip" href="#tud-flow" data-scroll="tud-flow">Játékmenet</a>':'')+(X.patchnotes?'<a class="chip" href="#tud-pn" data-scroll="tud-pn">Szabályváltozások</a>':'')+'</div>';
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
    h+='<h2 id="tud-flow" style="margin-top:28px">Játékmenet</h2><p class="note" style="margin:6px 0 12px">A kör, a chain, a kártyakijátszás és a combat lépései a Core Rules szerint. AI által írt összefoglaló, nem hivatalos.</p>';
    X.flow.forEach(b=>{h+='<h3>'+esc(b.title)+'<span class="n">'+esc(b.rules||'')+'</span></h3><ol class="flow">'+(b.steps||[]).map(s=>'<li><span><b>'+esc(s.name)+'</b>'+rl(s.rule)+'<br>'+esc(s.text)+'</span></li>').join('')+'</ol>';});
  }
  if(X.patchnotes){
    h+='<h2 id="tud-pn" style="margin-top:28px">Szabályváltozások</h2><p class="note" style="margin:6px 0 12px">A hivatalos patch notes cikkek rövid, saját szavas kivonata. A teljes szöveg a cikkekben olvasható.</p>';
    X.patchnotes.forEach(p=>{h+='<div class="pn"><h3 style="margin-bottom:2px"><a href="'+esc(p.url)+'">'+esc(p.title)+'</a><span class="n">'+esc(p.date||'')+(p.effective?', hatályos: '+esc(p.effective):'')+'</span></h3><ul>'+(p.changes||[]).map(c=>'<li>'+(c.rule?rl(c.rule)+' ':'')+esc(c.text)+'</li>').join('')+'</ul></div>';});
  }
  return h;
}
