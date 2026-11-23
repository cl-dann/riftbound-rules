/* Lépés forrása és értelmezése (srcCard, attachedEff, stepInfo). (a chainCore.ts 1-405. sorából, S19) */
import { vsCard } from '../data/store';
import { condOf } from './conditions';
import { abilitiesOf, costOf, modalSplit, phrasesTxt, triggersOf } from './parser';
import { COST_LINE, KW_HEAD, KW_ONLY, stripRem } from './text';
import type { ChainCS, ChainStep } from './state';
import type { CardLike, Cond, StepInfo } from './types';
/* ---------- Lépések ---------- */
export function srcCard(CS:ChainCS,src:string|undefined):CardLike|null|undefined{if(!src)return null;if(src[0]==='L')return vsCard(CS.lg[src.slice(1)]);
  if(src[0]==='b'){const b=CS.bd[+src.slice(1)];return b?vsCard(b.n):null;}
  if(src[0]==='s'){const s=CS.steps[+src.slice(1)];return s&&s.k==='card'?vsCard(s.n):null;}return null;}
/** A forrásra csatolt gearek Effect Textje (136.2.c): a trigger listába ez is bekerül. */
/** Svellsongur: a csatolt unit szövege az Equipment Effect Textje lesz (479.1.b), ezt a unit megkapja (435.1.d), így a triggerei kétszer szerepelnek. */
const COPY_TEXT=/copy that unit's text to this Equipment's effect text/i;
/** Shady Spectacles: "As this is attached to a unit, choose another friendly unit": a csatoláskor választott unit (2. hely, választható). */
export const COPY_EQUIP=/becomes a copy of that unit for as long as this is attached/i;
export function attachedEff(CS:ChainCS,src:string|undefined){if(!src||src[0]!=='b')return '';const i=+src.slice(1);return CS.bd.filter((g)=>g.on===i).map((g)=>{const c=vsCard(g.n);if(c&&COPY_TEXT.test(c.txt||'')){const u=vsCard(CS.bd[i].n);return u&&u.txt?u.txt:'';}return c&&c.eff?c.eff:'';}).filter(Boolean).join('\n');}
export function stepInfo(CS:ChainCS,s:ChainStep):StepInfo|null{
  if(s.k==='tr'){const c=vsCard(s.n)||{n:s.n||'?',t:'',txt:''};const eff=stripRem(s.eff||'');return {c,eff,list:phrasesTxt(eff),trig:false,isTr:true,may:/^you may\b/i.test(eff)};}
  if(s.k==='tg'){const c=srcCard(CS,s.src);if(!c)return null;const tr=triggersOf(c,attachedEff(CS,s.src))[s.ti||0];if(!tr)return {c,tr:null,eff:'',list:[],isTg:true};
    let eff=tr.eff;let killSelf=false;let modes:string[]=[];if(tr.modal&&tr.opts!.length){modes=tr.opts!;const md=Math.max(0,Math.min(s.mode||0,modes.length-1));eff=eff.replace(/(?:then,?\s*)?(?:you may )?choose one\b.*$/i,'').trim()+' '+modes[md];}const km=/^you may kill me to\s+/i.exec(eff);if(km){killSelf=true;eff=eff.slice(km[0].length);}
    return {c,tr,eff,list:phrasesTxt(eff),isTg:true,killSelf,may:/^you may\b/i.test(tr.eff),modes};}
  const c=vsCard(s.n);if(!c)return null;
  if(s.k==='ab'){const sc=srcCard(CS,s.src);const ab=abilitiesOf(sc)[s.ai||0];if(!ab)return {c,ab:null,eff:'',list:[],trig:false,isAb:true};
    return {c:sc!,ab,eff:ab.eff,list:ab.add?[]:ab.equip?[{type:'unit',rel:'friendly',max:null,bf:false,opt:false},...(COPY_EQUIP.test(sc!.txt||'')?[{type:'unit',rel:'friendly',max:null,bf:false,opt:true,another:true,copySrc:true}]:[])]:phrasesTxt(ab.eff),trig:false,isAb:true,may:/^you may\b/i.test(ab.eff)};}
  const cost=costOf(c);
  let pt=/(?:^|\n)\s*when you play (?:me|this)( from face down)?(?: or [^,.]*)?[,.]\s*([^\n]*)/i.exec(c.txt||'');const fdOnly=!!(pt&&pt[1]);if(pt)pt=[pt[0],pt[2]] as unknown as RegExpExecArray;
  let ptE=pt?stripRem(pt[1]):'';
  if(!pt&&/^\[Quick-Draw\]/m.test(c.txt||'')){ptE='Attach this to a unit you control.';pt=[ptE,ptE] as unknown as RegExpExecArray;}
  let cond:string|null=fdOnly?'facedown':null;const cm=/^if you paid the additional cost,\s*/i.exec(ptE);if(cm){cond='paid';ptE=ptE.slice(cm[0].length);ptE=ptE[0].toUpperCase()+ptE.slice(1);}
  /* "When you play me, if X, ...": az "if" a trigger feltételének része (383.2.a.1); ha a játékállapotból vagy a boardról kiértékelhető, a kijátszáskor dől el, triggerel-e */
  let tcond:Cond|null=null;if(!cm){const ic=/^if ([^,]+),\s*/i.exec(ptE);const cd=ic?condOf(ptE):null;if(ic&&cd&&(cd.how==='state'||cd.how==='board')){tcond=cd;ptE=ptE.slice(ic[0].length);ptE=ptE[0].toUpperCase()+ptE.slice(1);}}
  let modes:string[]=[];let e=ptE;
  if(c.t==='Spell'){const L=(c.txt||'').split('\n').map(stripRem).filter((l:string)=>l&&!KW_ONLY.test(l)&&!COST_LINE.test(l)&&!/^\[Repeat\]/.test(l)).map((l:string)=>l.replace(KW_HEAD,'').trim());const md=modalSplit(L,s.mode);modes=md.opts;e=stripRem(md.lines.join(' ')+(c.eff?' '+c.eff:''));
    /* [Repeat] (820): minden kifizetett ismétlési költség egy további végrehajtás, új választásokkal (820.1.d.1, 820.2, 820.2.a) */
    const rl=/^\[Repeat\]\s*(?:\u2014\s*)?([^(\n]*)/m.exec(c.txt||'');
    if(s.rep&&rl){const nCost=Math.max(1,rl[1].split('/').filter((x:string)=>x.trim()).length);const times=Math.min(nCost,s.rep===true?1:Math.max(0,+s.rep||0));
      const ms=[s.mode||0,s.mode2,s.mode3,s.mode4].map((m)=>m==null?(s.mode||0):+m).slice(0,times+1);
      const effs=[e].concat(ms.slice(1).map((m:number)=>modes.length?stripRem(modalSplit(L,m).lines.join(' ')):e));
      let repBad='';if(modes.length&&/choose one you haven't already chosen/i.test(c.txt||'')&&new Set(ms).size<ms.length)repBad='a lap minden végrehajtáshoz olyan módot kér, amelyet még nem választottak ("Choose one you haven\'t already chosen")';
      if(times)return {c,eff:effs.join(' '),list:effs.flatMap((x:string)=>phrasesTxt(x)),trig:!!pt,may:/^you may\b/i.test(e),cost,cond,modes,rep:times,repN:nCost,repModes:ms,repBad};}}
  return {c,eff:e,list:phrasesTxt(e),trig:!!pt,may:/^you may\b/i.test(e),cost,cond,modes,tcond,repN:(()=>{const rl=/^\[Repeat\]\s*(?:\u2014\s*)?([^(\n]*)/m.exec(c.txt||'');return rl?Math.max(1,rl[1].split('/').filter((x:string)=>x.trim()).length):0;})()};
}

/* ---------- Elemzés ---------- */
