/* Deck PDF (jsPDF), csak a PDF készítésekor töltődik. (a korábbi legacy/core.ts része, S15) */
import type { jsPDF } from 'jspdf';
import type { Card } from '../../domain/data/schema';
import { typeLine } from '../../domain/data/cards';
import { BF, D, META, RULES, TOPICS } from '../../domain/data/store';
import { DECK, checkDeck } from '../../domain/deck/legality';
import { prLabel } from '../../domain/deck/printing';
import { FL } from '../../domain/rules/flags';
import { isHead } from '../../domain/rules/head';
import { expand, expandAll, refLabel } from '../../domain/rules/refs';
import { norm } from '../../domain/text/norm';
import { DOMS } from '../../render/html/card';
export function pdfSafe(s: unknown){return String(s).replace(/\t/g,' ').replace(/[^\n\x20-\x7E\xA0-\u017F\u2010-\u2026\u2030\u20AC\u2122\u25B8]/g,'?');}
export const pdfCardText=(t: string|null|undefined)=>(t||'').replace(/\[S\]/g,'Might').replace(/\[>\]/g,' > ').replace(/\[>>\]/g,' >> ').replace(/\[[TE]\]/g,'[Exhaust]').replace(/\[([RGBOPY])\]/g,(_m,k: string)=>'['+DOMS[k]+']');
export function buildPDF(withRel=false,withGen=false,fonts: Record<string, string>|null=null,J: typeof jsPDF|null=null){
  
  const doc=new J!({unit:'mm',format:'a4'});
  const F=fonts!;[['n','normal'],['b','bold'],['i','italic']].forEach(([k,st])=>{doc.addFileToVFS('dv-'+k+'.ttf',F[k]);doc.addFont('dv-'+k+'.ttf','DV',st);});
  const PW=210,PH=297,ML=16,MR=16,MT=16,MB=16;let y=MT;
  const lh=(sz: number)=>sz*0.3528*1.28;
  type PutOpts={size?: number; indent?: number; style?: string; color?: number[]; before?: number; after?: number; keep?: number};
  function put(text: string,o?: PutOpts){
    o=o||{};const sz=o.size||9.5,ind=o.indent||0;
    doc.setFont('DV',o.style||'normal');doc.setFontSize(sz);
    const c=o.color||[20,24,34];doc.setTextColor(c[0],c[1],c[2]);
    const lines=doc.splitTextToSize(pdfSafe(text),PW-ML-MR-ind);
    if(o.before)y+=o.before;
    if(o.keep&&y+lh(sz)*Math.min(lines.length+o.keep,6)>PH-MB){doc.addPage();y=MT;}
    lines.forEach((l: string)=>{if(y+lh(sz)>PH-MB){doc.addPage();y=MT;}doc.text(l,ML+ind,y+sz*0.3528);y+=lh(sz);});
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
  DECK.forEach(s=>{put(s.name+' ('+s.rows.reduce((a,r)=>a+r.qty,0)+')',{size:9.5,style:'bold',before:1.5});s.rows.forEach(r=>put(r.qty+'  '+(r.card?r.card.n:r.name+'  [ismeretlen kártyanév]')+(r.card&&r.pr?'  ['+prLabel(r.card,r.pr)+(r.foil?', foil':'')+']':'')+(r.card&&r.card.err!=null?'  [errata]':'')+(r.card&&r.card.ban?'  [BANNED]':r.card&&r.card.banf?'  [BANNED '+r.card.banf+'-tól]':''),{size:9,indent:4}));});
  const lc=checkDeck();if(lc.length){put('Deck legalitás (Core Rules 103)',{size:13,style:'bold',before:3});lc.forEach(x=>put((x[0]===null?'INFO':x[0]?'OK':'HIBA')+'   '+(x[1]?x[1]+'  ':'')+x[2],{size:9,indent:2,color:x[0]===false?[160,50,15]:[20,24,34]}));}
  const seen=new Map<Card, string[]>();
  DECK.forEach(s=>s.rows.forEach(r=>{if(!r.card)return;if(!seen.has(r.card))seen.set(r.card,[]);seen.get(r.card)!.push(r.qty+'x '+s.name);}));
  const used=new Set<number>(),usedRel=new Set<number>();
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
  const n=(doc.internal as unknown as {getNumberOfPages(): number}).getNumberOfPages();
  for(let i=1;i<=n;i++){doc.setPage(i);doc.setFont('DV','normal');doc.setFontSize(8);doc.setTextColor(120);doc.text(pdfSafe('Riftbound deck szabály-referencia'+(legend?'  |  '+legend:'')),ML,PH-8);doc.text(i+' / '+n,PW-MR,PH-8,{align:'right'});}
  return {blob:doc.output('blob'),pages:n,name:'riftbound-deck-szabalyok'+(legend?'-'+norm(legend).replace(/[^a-z0-9]+/g,'-').slice(0,40):'')+'.pdf'};
}
