import {ECONOMY,startMining,settleMining} from '../mining/game-state.js';
import {THEMES} from '../mining/mineral-themes.js';
import {LAYOUTS} from '../mining/map-layouts.js';
import {TRAITS} from '../mining/mining-rules.js';

// A short, reviewable rest period for the first complete village loop.
export const REST_MS=30_000;
const count=(n,max)=>Number.isFinite(Number(n))?Math.min(max,Math.max(0,Math.floor(Number(n)))):0;
export function initializeVillage(s,now=Date.now()){
 const r=s.renewal,old=r.village;
 const v=r.village=old&&typeof old==='object'?old:{};
 v.version=1;
 v.restUntil=Number.isFinite(v.restUntil)?Math.min(Math.max(0,v.restUntil),now+REST_MS):0;
 v.lastReturnId=count(v.lastReturnId,r.runId);
 v.pack=count(v.pack??ECONOMY.ballCapacity,ECONOMY.ballCapacity);
 v.prepared=!!v.prepared;
 // An existing expedition always wins over a stale scene flag.
 v.scene=r.run&&r.run.phase!=='ended'?'mine':'village';
 if(r.run?.phase==='ended'){settleMining(s);arriveVillage(s,now);}
 return v;
}
export function restSeconds(s,now=Date.now()){
 return Math.max(0,Math.ceil((s.renewal.village.restUntil-now)/1000));
}
export function canDepart(s,now=Date.now()){
 const r=s.renewal;
 return r.village.scene==='village'&&restSeconds(s,now)===0&&(!r.run||r.run.phase==='ended');
}
export function prepareVillage(s,{seeds,themeId,layoutId,traits=[]}){
 const r=s.renewal;if(r.village.scene!=='village')return false;
 r.village.pack=count(seeds,ECONOMY.ballCapacity);
 if(THEMES.some(x=>x.id===themeId))r.themeId=themeId;
 if(LAYOUTS.some(x=>x.id===layoutId))r.layoutId=layoutId;
 const seen=new Set();r.traits=Array.from({length:4},(_,i)=>{
  const id=traits[i];if(!Object.hasOwn(TRAITS,id)||id==='none'||seen.has(id))return 'none';
  seen.add(id);return id;
 });
 r.village.prepared=true;return true;
}
export function departVillage(s,now=Date.now()){
 if(!canDepart(s,now)||!s.renewal.village.prepared)return false;
 const r=s.renewal;
 if(!startMining(s,{seeds:r.village.pack}))return false;
 r.village.scene='mine';r.village.prepared=false;return true;
}
export function arriveVillage(s,now=Date.now()){
 const r=s.renewal,v=r.village;
 if(!r.run||r.run.phase!=='ended')return false;
 settleMining(s);v.scene='village';
 if(v.lastReturnId===r.runId)return false;
 v.prepared=false;v.lastReturnId=r.runId;v.restUntil=now+REST_MS;
 return true;
}
