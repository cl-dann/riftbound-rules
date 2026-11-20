// @ts-nocheck
/* Deck nézet HTML: Energy görbe, legalitás, interakciós térkép. (a korábbi legacy/core.ts része, S15) */
import { DECK, checkDeck } from '../../domain/deck/legality';
import { esc } from '../../domain/text/norm';
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
