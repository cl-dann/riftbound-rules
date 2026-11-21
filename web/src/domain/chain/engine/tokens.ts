/* Token létrehozás (a runChain() csoportja, S20) */
import type { EngineCtx } from './ctx';
import { esc } from '../../text/norm';
import { vsCard } from '../../data/store';
import { numOf } from '../parser';

export function installTokens(X: EngineCtx) {
  X.createTokens=(t:string,it:any,parts:string[],refs:string[],times:number)=>{const m=/\b(?:[Pp]lay|[Cc]reate)s? (a|an|one|two|three|four|five|six|\d+|that many)\s+(ready\s+)?(?:(\d+) \[S\]\s+)?([A-Z][\w'\-]*(?: [A-Z][\w'\-]*)*)(?:\s+(unit|gear))?\s+tokens?(\s+exhausted)?(?:\s+with\s+((?:\[[^\]]+\](?:,?\s*(?:and\s+)?)?)+))?([^.]*)/.exec(t);
    if(!m){parts.push('"'+esc(t)+'": token jön létre (440), az elemzés nem tudja pontosan, milyen.');return;}
    let n=m[1].toLowerCase()==='that many'?0:numOf(m[1]);n=n*(times==null?1:times);const name=m[4];const card=vsCard(name);const kind=m[5]?m[5].toLowerCase():card&&card.t==='Gear'?'gear':'unit';const kws=(m[7]||'').match(/\[([^\]]+)\]/g)||[];const tail=m[8]||'';
    const here=X.srcLoc(it);const loc=/\bto a (?:single )?battlefield\b/i.test(tail)?(it.dest||(it.s&&it.s.dest)||'bf0'):/\bthere\b/i.test(tail)?(it.notedLoc||(it.lk&&it.lk.loc)||here||'base'):/\bhere\b/i.test(tail)?(here||'base'):'base';
    const ids:string[]=[];for(let q=0;q<n;q++){const id='k'+(++X.TOKN);const extra=kws.filter((k:string)=>!(card&&(card.txt||'').includes(k))).join('\n');const c=card?(extra?Object.assign({},card,{txt:(card.txt||'')+'\n'+extra}):card):{n:name,t:kind==='unit'?'Unit':'Gear',m:m[3]?+m[3]:null,st:['Token'],tg:[],txt:extra};
      const er=kind==='unit'?X.enterReady(Object.assign({},c,{t:'Unit',st:['Token']}),it.pl,false,loc,undefined,id):{ready:false,why:''};if(q===0&&er.why&&!m[2]&&!m[6])parts.push('Ready lép be: '+esc(er.why)+'.');
      X.O[id]={id,name:name+' token',card:c,ctrl:it.pl,own:it.pl,loc,baseOf:it.pl,m:kind==='unit'?(m[3]?+m[3]:(c.m!=null?+c.m:null)):null,dmg:0,mods:[],kws:[],zone:'board',type:kind,ex:m[6]?true:m[2]?false:kind==='unit'?!er.ready:false,token:true};
      ids.push(id);X.EV.push({k:'token',pl:it.pl,id,name,loc});}
    if(it.notedLoc&&/\bthere\b/i.test(tail)){parts.push('A "there" a trigger feltételéből a triggereléskor feljegyzett location ('+esc(X.locLabel(it.notedLoc))+'), a forrás későbbi mozgása nem számít (359.3.f.3).');refs.push('359.3.f.3');}
    parts.push(n+' db '+esc(name)+' '+kind+' token jön létre ('+esc(X.locLabel(loc))+(m[2]?', ready':m[6]?', exhausted':kind==='unit'?(X.O[ids[0]]&&!X.O[ids[0]].ex?', ready (143.4.a)':', exhausted (143.4)'):'')+(kws.length?', '+kws.join(' '):'')+') (350.2, 440.2).');refs.push('350.2','440.2');
    if(n)X.story.push(n+' '+name+' token kerül ide: '+X.locLabel(loc)+'.');
    ids.forEach(id=>{if(X.O[id].type==='unit')X.playTrigs({c:X.O[id].card,j:-1,pl:it.pl,from:'other',objId:id}).forEach((tr:any)=>X.pushTrig(tr));});};
}
