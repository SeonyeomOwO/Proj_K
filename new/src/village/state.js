import {ECONOMY,startMining,settleMining,ballCapacity} from '../mining/game-state.js';
import {THEMES} from '../mining/mineral-themes.js';
import {MAPS as LAYOUTS} from '../mining/map-layouts.js';
import {TRAITS} from '../mining/mining-rules.js';
import {masteryBonus} from '../mastery-state.js';
import {CONFIG} from '../../data/config.js';

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
// 생산기(레퍼런스의 토템·닻): 햄찌들이 광산에 있던 시간(초)만큼 쌓이고, 마을에 돌아와 톡 누르거나 햄찌를 던져 맞혀 걷는다.
// 숫자는 검토용 임시 값(밸런스 단계에서 정함).
export const GENERATORS={
 totem:{name:'해바라기 토템',currency:'seeds',perSecond:.12,cap:80},
 mill:{name:'황금 풍차',currency:'golden',perSecond:1/240,cap:3},
};
// 한 번 탐사에서 셈하는 시간 상한(앱을 켜 둔 채 오래 둬도 무한히 쌓이지 않게)
export const GENERATOR_RUN_CAP=1800;
export function fillGenerators(s,seconds){
 const v=s.renewal.village,t=Math.min(GENERATOR_RUN_CAP,Math.max(0,Number(seconds)||0));
 for(const [id,g] of Object.entries(GENERATORS))v.stock[id]=Math.min(g.cap,(v.stock[id]??0)+g.perSecond*t);
}
// 쌓인 만큼(정수)을 지갑에 넣고 나머지 소수는 남긴다. 걷은 개수를 돌려준다.
export function collectGenerator(s,id){
 const g=GENERATORS[id],r=s.renewal,v=r.village;if(!g||v.scene!=='village')return 0;
 const key=g.currency==='golden'?'golden':'seeds',room=Math.max(0,CONFIG.walletCap-(r[key]??0)),n=Math.min(room,Math.floor(v.stock[id]??0));
 if(n<=0)return 0;r[key]=(r[key]??0)+n;v.stock[id]-=n;return n;
}
// 햄찌 이름표: 기본 이름이 붙어 있고, 마을 우물에 햄찌를 던져 넣으면 바꿀 수 있다.
export const NAME_POOL=['도토리','콩떡','모찌','호두','깨비','찹쌀','보리','밤톨','감자','꿀떡','솜이','통통','땅콩','쑥떡','호빵','누룽지','말랑','두부','호박','차돌'];
export const NAME_MAX=8;
const cleanName=name=>typeof name==='string'?[...name.replace(/\s+/g,' ').trim()].slice(0,NAME_MAX).join(''):'';
export const hamsterName=(s,i)=>s.renewal?.village?.names?.[i]||NAME_POOL[i]||`햄찌 ${i+1}`;
export function renameHamster(s,i,name){
 const v=s.renewal.village,n=cleanName(name);if(!n||!(i>=0&&i<6)||!Array.isArray(v.names))return null;
 v.names[i]=n;return n;
}
// 다른 햄찌와 겹치지 않고 지금 이름과도 다른 무작위 이름
export function randomName(s,i,rng=Math.random){
 const used=new Set(s.renewal.village.names),pool=NAME_POOL.filter(n=>!used.has(n));
 return pool.length?pool[Math.floor(rng()*pool.length)]:NAME_POOL[i];
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
 v.pack=count(v.pack??ballCapacity(s),ballCapacity(s));
 v.prepared=!!v.prepared;
 // 생산기에 쌓인 양(소수까지 보관)과 햄찌 이름표
 const stock=v.stock&&typeof v.stock==='object'?v.stock:{};v.stock={};
 for(const [id,g] of Object.entries(GENERATORS)){const n=Number(stock[id]);v.stock[id]=Number.isFinite(n)?Math.min(g.cap,Math.max(0,n)):0;}
 v.names=Array.from({length:6},(_,i)=>cleanName(v.names?.[i])||NAME_POOL[i]);
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
 r.village.pack=count(seeds,ballCapacity(s));
 if(THEMES.some(x=>x.id===themeId))r.themeId=themeId;
 if(LAYOUTS.some(x=>x.id===layoutId))r.layoutId=layoutId;
 const seen=new Set();r.traits=Array.from({length:Math.min(6,Math.max(4,traits.length))},(_,i)=>{
  const id=traits[i];if(!Object.hasOwn(TRAITS,id)||id==='none'||seen.has(id))return 'none';
  seen.add(id);return id;
 });
 r.village.prepared=true;return true;
}
// 장비 광장(레퍼런스의 더미 던지기): 햄찌 i를 특성 허수아비에 던지면 그 특성을 낀다.
// 이미 그 특성을 낀 햄찌를 다시 던지면 뺀다. 다른 햄찌가 끼고 있던 특성이면 그 햄찌는 기본으로 돌아간다(특성은 한 마리씩).
// 마을 햄찌 수(마스터리 '햄찌 증원'으로 4 → 최대 6)
export const villageCrew=s=>Math.min(6,4+(masteryBonus(s,'crew')||0));
// 마스터리로 여는 특성(충전 곡괭이 등)은 배운 뒤에만 낄 수 있다. '특성 칸'을 배우면 햄찌마다 둘째 칸(traits2)이 생긴다.
export const traitUnlocked=(s,trait)=>!TRAITS[trait]?.mastery||masteryBonus(s,TRAITS[trait].mastery)>0;
export function equipVillageTrait(s,i,trait){
 const r=s.renewal;if(!Object.hasOwn(TRAITS,trait)||trait==='none'||!(i>=0&&i<villageCrew(s))||r.village.scene!=='village'||!traitUnlocked(s,trait))return null;
 const second=r.traits2??=[];for(const list of [r.traits,second])for(let k=list.length;k<=i;k++)list[k]='none';
 // 이미 낀 특성이면 뺀다(첫째 칸이 비면 둘째 칸 것을 당겨 온다)
 if(r.traits[i]===trait){r.traits[i]=second[i]!=='none'?second[i]:'none';second[i]='none';return{i,trait:'none',removed:trait,from:null};}
 if(second[i]===trait){second[i]='none';return{i,trait:'none',removed:trait,from:null};}
 let from=null;for(const list of [r.traits,second]){const k=list.findIndex((t,j)=>j!==i&&t===trait);if(k>=0){list[k]='none';from=k;}}
 if(r.traits[i]==='none'||masteryBonus(s,'traitSlot')<1)r.traits[i]=trait;
 else if(second[i]==='none')second[i]=trait;
 else r.traits[i]=trait;   // 두 칸이 다 차 있으면 첫째 칸을 바꾼다
 return{i,trait,removed:null,from};
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
 // 광산에 있던 시간(층을 내려가도 이어지는 탐사 시계)만큼 생산기가 찬다
 fillGenerators(s,r.run.time);
 return true;
}
