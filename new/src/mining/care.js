import {floorIsClear} from './loot/loot-motion.js';
import {routesFrom,setDestination,moveWorker,clearSegment} from './navigation.js';
// Review tuning, not final economy/balance. Fullness is per hamster per trip.
// digest: 깨어 있는 동안 이 초마다 배부름 1칸이 꺼진다(2026-11-04: 공의 씨앗을 연료처럼 계속 먹일 수 있게)
export const CARE={maxStamina:100,fullness:3,recovery:55,workDrain:2.3,moveDrain:.7,initialSeeds:8,startle:.72,eat:2.1,digest:20};
export const canEat=h=>h.fullness<CARE.fullness;
export const workRate=h=>h.trait==='drill'?1:h.trait==='workwear'?.7+.3*Math.max(0,Math.min(1,h.stamina/CARE.maxStamina)):.35+.65*Math.max(0,Math.min(1,h.stamina/CARE.maxStamina));
function resetRoute(h){h.goal=null;h.route=[];h.yieldGoal=null;h.yieldFor=null;h.foodTarget=null;}
function setCare(h,kind){resetRoute(h);h.recover=0;h.wait=0;h.care=kind;h.careTime=0;h.clip=kind;h.motion=0;}
export function hitWithBall(s,h){
 if(!h||!s.careEnabled)return;
 if(s.ball.seeds>0){
  s.ball.seeds--;let p={x:h.x,y:h.y};
  // Place the seed beside the body, on real floor, including near walls.
  for(const[dx,dy]of [[0,23],[23,0],[-23,0],[0,-23],[12,12]])if(floorIsClear(s,h.x+dx,h.y+dy,4,{ignoreBall:true})){p={x:h.x+dx,y:h.y+dy};break;}
  s.seeds.push({id:s.nextSeed++,x:p.x,y:p.y,age:0,reserved:canEat(h)&&h.care!=='eat'?h.id:null});
  s.events.push({type:'seed',time:s.time,x:p.x,y:p.y,worker:h.id});
 }
 // Full or already eating: spend the collision seed but preserve that action.
 if(!canEat(h)||h.care==='eat'||h.care==='startle')return;
 const food=s.seeds.find(d=>d.reserved===h.id)||s.seeds.find(d=>d.reserved===null&&Math.hypot(d.x-h.x,d.y-h.y)<40);
 if(!food)return;
 food.reserved=h.id;h.pendingStartle=true;
}
function reachableFood(s,h){
 const candidates=s.seeds.filter(d=>d.age>.25&&(d.reserved===null||d.reserved===h.id));
 for(const d of candidates)if(Math.hypot(d.x-h.x,d.y-h.y)<31&&clearSegment(s,h,d,0))return {d};
 if(!candidates.length||h.stamina<=0)return null;
 const tree=routesFrom(s,h);let best=null,score=Infinity;
 for(const d of candidates)for(const n of tree.graph.nodes){
  if(!tree.distance.has(n.id)||Math.hypot(n.x-d.x,n.y-d.y)>30||!clearSegment(s,n,d,0))continue;
  const cost=tree.distance.get(n.id);if(cost<score){best={d,node:n,tree};score=cost;}
 }
 return best;
}
export function updateCare(s,h,dt){
 if(!s.careEnabled)return false;
 if(h.pendingStartle){h.pendingStartle=false;h.sleeping=false;setCare(h,'startle');}
 if(h.care==='startle'){
  h.careTime+=dt;h.clip='startle';h.motion=h.careTime;
  if(h.careTime<CARE.startle)return true;
  h.care=null;
 }
 if(h.care==='eat'){
  h.careTime+=dt;h.clip='eat';h.motion=h.careTime;
  if(h.careTime>=CARE.eat){
   h.fullness=Math.min(CARE.fullness,h.fullness+1);h.stamina=Math.min(CARE.maxStamina,h.stamina+CARE.recovery);
   h.eatingSeed=null;h.care=null;h.sleeping=false;h.sleepHitsRemaining=null;h.clip='idle';resetRoute(h);
   s.events.push({type:'fed',time:s.time,x:h.x,y:h.y,worker:h.id});
  }
  return true;
 }
 // A sleeper only eats the seed delivered by a ball hit. Awake workers seek
 // spare floor seeds before resuming their own mining or carrying task.
 if(canEat(h)&&(!h.sleeping||h.pendingStartle)){
  if(h.foodTarget!==null&&h.foodTarget!==undefined){
   const d=s.seeds.find(d=>d.id===h.foodTarget&&d.reserved===h.id);
   if(d&&Math.hypot(h.x-d.x,h.y-d.y)>30){h.clip=h.cargo?'carry':'walk';moveWorker(s,h,dt);return true;}
   resetRoute(h);
  }
  const food=reachableFood(s,h);
  if(food){
   const {d}=food;d.reserved=h.id;
   if(food.node){resetRoute(h);h.foodTarget=d.id;setDestination(h,food.node,food.tree);moveWorker(s,h,dt);return true;}
   s.seeds.splice(s.seeds.indexOf(d),1);h.eatingSeed=d;setCare(h,'eat');return true;
  }
 }
 if(h.stamina<=0){
  if(!h.sleeping){h.sleeping=true;h.sleepTime=0;resetRoute(h);}
  h.sleepTime+=dt;h.clip='sleep';h.motion=h.sleepTime;return true;
 }
 return false;
}
export function drainStamina(s,h,dt,distance){
 if(!s.careEnabled||h.sleeping||h.care)return;
 const drain=['mine','drill','bomb'].includes(h.clip)&&!h.goal?CARE.workDrain*(h.trait==='drill'?2.4:1):distance>.01?CARE.moveDrain:0;
 h.stamina=Math.max(0,h.stamina-drain*dt);
}
// 소화: 배부름이 천천히 꺼져 다시 씨앗을 먹을 수 있다(잠든 동안에도 꺼진다 → 공에 씨앗이 남아 있으면 언제든 다시 깨울 수 있음)
export function digest(s,h,dt){
 if(!s.careEnabled||!(h.fullness>0)||h.care==='eat')return;
 h.digest=(h.digest??0)+dt;if(h.digest>=CARE.digest){h.digest=0;h.fullness--;}
}
export function cannotContinue(s){
 if(!s.careEnabled||!s.crew.every(h=>h.sleeping)||s.crew.some(h=>h.care||h.action||h.pendingStartle||h.sleepHitsRemaining>0||h.blastTime!=null))return false;
 // 배부름은 시간이 지나면 꺼지므로, 공과 바닥에 씨앗이 남아 있는 동안은 탐사가 끝나지 않는다(유저가 귀환을 고를 수 있음)
 return s.ball.seeds===0&&s.seeds.length===0;
}
