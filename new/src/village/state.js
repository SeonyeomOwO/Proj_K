import {ECONOMY,startMining,settleMining} from '../mining/game-state.js';
import {THEMES} from '../mining/mineral-themes.js';
import {MAPS as LAYOUTS} from '../mining/map-layouts.js';
import {TRAITS} from '../mining/mining-rules.js';

// 마을 공통 피곤함(모바일 스테미너, 2026-11-03 확정): 탐사 1번 = 1칸, max칸이 다 차면 광산에 못 들어가고,
// 시간이 지나면 recoverMs마다 1칸씩 풀린다(앱을 꺼 둔 시간 포함). 숫자는 검토용 임시 값 — 회복 1분은 테스트용이고
// 실서비스 값은 밸런스 단계에서 정한다.
export const FATIGUE={max:5,perRun:1,recoverMs:60_000};
const count=(n,max)=>Number.isFinite(Number(n))?Math.min(max,Math.max(0,Math.floor(Number(n)))):0;
// 지금 피곤함 칸 수와 다음 1칸이 풀리기까지 남은 시간. 저장값(fatigue, fatigueSince)은 바꾸지 않는다.
export function fatigueState(s,now=Date.now()){
 const v=s.renewal.village;
 if(!(v.fatigue>0))return{count:0,max:FATIGUE.max,nextMs:0};
 const elapsed=Math.max(0,now-v.fatigueSince),left=Math.max(0,v.fatigue-Math.floor(elapsed/FATIGUE.recoverMs));
 return{count:left,max:FATIGUE.max,nextMs:left?FATIGUE.recoverMs-elapsed%FATIGUE.recoverMs:0};
}
export const fatigueCount=(s,now=Date.now())=>fatigueState(s,now).count;
// 흐른 시간만큼 풀린 칸을 저장값에 반영한다(다음 칸의 진행 시간은 그대로 이어진다).
function settleFatigue(v,s,now){
 const left=fatigueCount(s,now),recovered=v.fatigue-left;
 if(!left){v.fatigue=0;v.fatigueSince=now;}
 else{v.fatigue=left;v.fatigueSince+=recovered*FATIGUE.recoverMs;}
}
// 광고 보고 회복·회복 아이템 자리(지금은 테스트 버튼만 연결, 실제 광고·결제 없음)
export function recoverFatigue(s,amount=1,now=Date.now()){
 const v=s.renewal.village;settleFatigue(v,s,now);if(!v.fatigue)return false;
 v.fatigue=Math.max(0,v.fatigue-amount);if(!v.fatigue)v.fatigueSince=now;return true;
}
export function initializeVillage(s,now=Date.now()){
 const r=s.renewal,old=r.village;
 const v=r.village=old&&typeof old==='object'?old:{};
 v.version=1;
 // 예전 저장의 30초 휴식(restUntil)은 피곤함 칸으로 대체됐다.
 delete v.restUntil;
 v.fatigue=count(v.fatigue,FATIGUE.max);
 v.fatigueSince=Number.isFinite(v.fatigueSince)?Math.min(Math.max(0,v.fatigueSince),now):now;
 v.lastReturnId=count(v.lastReturnId,r.runId);
 v.pack=count(v.pack??ECONOMY.ballCapacity,ECONOMY.ballCapacity);
 v.prepared=!!v.prepared;
 // An existing expedition always wins over a stale scene flag.
 v.scene=r.run&&r.run.phase!=='ended'?'mine':'village';
 if(r.run?.phase==='ended'){settleMining(s);arriveVillage(s,now);}
 return v;
}
export function canDepart(s,now=Date.now()){
 const r=s.renewal;
 return r.village.scene==='village'&&fatigueCount(s,now)<FATIGUE.max&&(!r.run||r.run.phase==='ended');
}
// traits를 넘기지 않으면 지금 특성을 그대로 둔다(특성은 마을 광장의 허수아비에 햄찌를 던져 바꾼다).
export function prepareVillage(s,{seeds,themeId,layoutId,traits=s.renewal.traits}){
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
// 장비 광장(레퍼런스의 더미 던지기): 햄찌 i를 특성 허수아비에 던지면 그 특성을 낀다.
// 이미 그 특성을 낀 햄찌를 다시 던지면 뺀다. 다른 햄찌가 끼고 있던 특성이면 그 햄찌는 기본으로 돌아간다(특성은 한 마리씩).
export function equipVillageTrait(s,i,trait){
 const r=s.renewal;if(!Object.hasOwn(TRAITS,trait)||trait==='none'||!(i>=0&&i<4)||r.village.scene!=='village')return null;
 if(r.traits[i]===trait){r.traits[i]='none';return{i,trait:'none',removed:trait,from:null};}
 const from=r.traits.findIndex((t,k)=>k!==i&&t===trait);if(from>=0)r.traits[from]='none';
 r.traits[i]=trait;return{i,trait,removed:null,from:from>=0?from:null};
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
 // 귀환하는 순간 1칸이 쌓인다(중간에 그만둬도 1판). 비어 있던 상태라면 회복 시계는 지금부터 시작한다.
 settleFatigue(v,s,now);const was=v.fatigue;
 v.fatigue=Math.min(FATIGUE.max,v.fatigue+FATIGUE.perRun);if(!was)v.fatigueSince=now;
 v.prepared=false;v.lastReturnId=r.runId;
 return true;
}
