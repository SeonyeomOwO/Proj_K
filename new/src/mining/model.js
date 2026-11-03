// Shared by the game and design preview. Speeds, hit counts and layouts are review values.
import {getTheme} from './mineral-themes.js';
import {getLayout,LAYOUTS} from './map-layouts.js';
import {COLS,ROWS,TILE,ORIGIN,RISE,key,xy,center,hitCell,noise,neighbors,isMineable} from './grid.js';
import {spawnMinedDrop,updateMinedDrops,canPickDrop} from './drop-system.js';
import {navigation,routesFrom,setDestination,moveWorker,BODY_RADIUS,BODY_GAP,clearSegment,syncSleepingPasses,restingSpotClear} from './navigation.js';
import {ACTION} from './action-timing.js';
import {carrySocket} from './worker-pose.js';
import {CARE,updateCare,hitWithBall,drainStamina,workRate,cannotContinue} from './care.js';
import {BALL,updateBall,holeContains,ballSpeed} from './ball.js';
import {ballPositionClear} from './terrain-collision.js';
import {chooseIrisShape} from '../intro/iris-transition.js';
import {assignFocusWork} from './focus-command.js';
import {mineralRule,miningPeriod,equipTrait} from './mining-rules.js';
import {updateBlastFlight,updateSleepMining,updateBomb} from './trait-actions.js';
export {equipTrait};
export {COLS,ROWS,TILE,ORIGIN,RISE,key,xy,center,hitCell,noise,neighbors,isMineable};
export function createState(seed=1,{themeId='base',layoutId='classic',careEnabled=true,mineralRules='varied',traits=[]}={}){
 const theme=getTheme(themeId),map=getLayout(layoutId),layout=map.rows.map(row=>[...row].map(v=>v==='#'));
 const cells=layout.flatMap((row,y)=>row.map((solid,x)=>{
  const copper=(x<4&&y>=3&&y<=6)||(x>=8&&y>=10&&y<=13),jade=x>=7&&y>=2&&y<=6;
  let kind=copper&&noise(x,y,seed+3)>.35?'copper':jade&&noise(x,y,seed+3)>.3?'jade':'stone';
  if(theme.id!=='base'){
   const vein=Math.abs(x-(2.3+Math.sin(y*.7+seed)*1.6))<1.3||Math.abs(x-(7.2+Math.cos(y*.45+seed)*1.1))<.9,n=noise(x,y,seed+15);
   kind=vein&&n>.32?theme.primary:n>.87?theme.secondary:'stone';
  }
  const rule=mineralRule(kind,mineralRules),hp=rule.hits;
  // Only existing edge rock becomes permanent; keep the approved silhouette
  // and any authored openings intact. Interior rock remains excavatable.
  const unbreakable=solid&&(x===0||x===COLS-1||y===0||y===ROWS-1);
  return{id:key(x,y),x,y,solid,unbreakable,kind,value:rule.value,texture:rule.texture,geology:copper?'copper':jade?'jade':'stone',hp,maxHp:hp,variant:Math.floor(noise(x,y,seed)*4),rotation:Math.floor(noise(x,y,seed+9)*4),hole:false};
 }));
 const holeCell=cells.find(c=>isMineable(c)&&c.y>=3&&c.y<=6&&neighbors(c.id).some(n=>!cells[n].solid));holeCell.hole=true;
 const s={seed,careEnabled,phase:'mining',depth:1,seeds:[],nextSeed:0,lostOre:0,aim:null,holeAt:null,transition:null,result:null,themeId:theme.id,layoutId:map.id,cells,crew:[],time:0,revision:0,navRevision:0,commandRevision:0,focus:null,drops:[],secured:0,mined:0,hole:null,events:[],nextDrop:0,lootAccumulator:0,paused:false,grid:false,cartStand:key(4,13),cart:{x:177,y:653,radius:34},ball:{x:283,y:704,radius:BALL.radius,vx:0,vy:0,angle:0,contacts:[],seeds:CARE.initialSeeds}};
 for(const [i,[x,y]]of [[2,7],[5,10],[6,6],[4,12]].entries()){
  const node=navigation(s).nodes.filter(n=>s.crew.every(h=>Math.hypot(h.x-n.x,h.y-n.y)>BODY_GAP+5&&hitCell(h.x,h.y)!==hitCell(n.x,n.y))).sort((a,b)=>Math.hypot(a.x-x*50,a.y-y*50)-Math.hypot(b.x-x*50,b.y-y*50))[0];
  const individuality=noise(i,seed,43);
  s.crew.push({id:i,stamina:CARE.maxStamina,fullness:0,sleeping:false,care:null,careTime:0,foodTarget:null,x:node.x,y:node.y,skin:i===3?'star':'miner',role:'worker',clip:'idle',face:i%2?-1:1,motion:i*.37,walkTime:0,moveBlend:0,breathTime:i*.47,route:[],goal:null,work:null,command:-1,mineTime:.3+i*.29,period:1.8+individuality*.65,speed:76+individuality*18,gait:.88+individuality*.25,cargo:null,wait:i*.19,stuck:0,delivered:0});
 }
 s.mineralRules=mineralRules;s.minedValue=0;s.securedValue=0;s.lostValue=0;
 for(const h of s.crew){h.baseSkin=h.skin;h.trait='none';equipTrait(s,h.id,traits[h.id]??'none');}
 return s;
}
export function selectCell(s,id){if(s.phase!=='mining'||id===null||!isMineable(s.cells[id]))return false;s.focusAt=s.time;if(s.focus===id)return true;s.focus=id;s.commandRevision++;return true;}
export function holeMarker(s){const cell=s.cells.find(c=>c.hole);return cell?{id:cell.id,state:cell.solid?'buried':'revealed'}:null;}
export function strike(s,id,worker=null){const c=s.cells[id];if(s.phase!=='mining'||!isMineable(c))return false;c.hp=Math.max(0,c.hp-(worker?.power??1));s.revision++;const contact=worker?.contact??{x:center(id)[0],y:center(id)[1]};s.events.push({type:'hit',id,time:s.time,kind:c.kind,worker:worker?.id,...contact});if(c.hp<=0){c.hp=0;c.solid=false;s.mined++;s.minedValue+=c.value??1;s.navRevision++;s.events.push({type:'break',id,time:s.time,kind:c.kind,worker:worker?.id,...contact});const drop=spawnMinedDrop(s,c,worker?.id??null);if(worker){worker.pickup=drop.id;worker.recover=worker.trait==='drill'?.1:.32;worker.work=null;worker.goal=null;worker.route=[];}if(c.hole){s.hole=id;s.holeAt=placeHole(s,id);}if(s.focus===id)s.focus=null;}return true;}
export function pathTo(s,start,goal,{throughRock=false}={}){
 if(start===null||goal===null||!s.cells[start]||!s.cells[goal]||s.cells[start].unbreakable||s.cells[goal].unbreakable)return null;
 const dist=new Map([[start,0]]),prev=new Map(),open=new Set([start]);
 while(open.size){let at=null,best=Infinity;for(const id of open)if(dist.get(id)<best){at=id;best=dist.get(id);}open.delete(at);if(at===goal){const p=[at];while(prev.has(p[0]))p.unshift(prev.get(p[0]));return p;}
  for(const n of neighbors(at)){if(s.cells[n].unbreakable||s.cells[n].solid&&!throughRock)continue;const cost=best+(s.cells[n].solid?8:1);if(cost<(dist.get(n)??Infinity)){dist.set(n,cost);prev.set(n,at);open.add(n);}}
 }return null;
}
export function planMine(s,start,target){const route=pathTo(s,start,target,{throughRock:true});if(!route)return null;const stop=route.findIndex(id=>s.cells[id].solid);if(stop<1)return null;return{work:route[stop],stand:route[stop-1],route:route.slice(1,stop)};}
function chooseWork(s,h){
 const tree=routesFrom(s,h),focus=s.focus===null?null:center(s.focus);let best=null,score=Infinity;
 for(const n of tree.graph.nodes){if(!tree.distance.has(n.id))continue;
  if(!restingSpotClear(s,h,n))continue;
  if(s.crew.some(o=>o!==h&&o.stand&&Math.hypot(o.stand.x-n.x,o.stand.y-n.y)<BODY_GAP+12))continue;
  for(const job of n.jobs){
   const [x,y]=center(job.work),cost=tree.distance.get(n.id)*10+(focus?Math.hypot(x-focus[0],y-focus[1])*5:0)+noise(h.id,job.work,s.seed)*12;
   if(cost<score){score=cost;best={node:n,...job};}
  }
 }
 if(!best){h.clip='idle';h.wait=.45;return;}
 h.work=best.work;h.contact=best.contact;h.workFace=best.face;h.stand={x:best.node.x,y:best.node.y};h.command=s.commandRevision;
 setDestination(h,best.node,tree);
}
function goToDrop(s,h,d,traffic=true){
 const tree=routesFrom(s,h,{traffic});let best=null,score=Infinity;
 for(const n of tree.graph.nodes){if(!tree.distance.has(n.id))continue;const distance=Math.hypot(n.x-d.x,n.y-d.y);
  if(!restingSpotClear(s,h,n))continue;
  if(distance>38||!clearSegment(s,n,d,1))continue;
  const cost=tree.distance.get(n.id)+distance*.04;if(cost<score){score=cost;best=n;}
 }
 if(best){h.pickupPosition={x:d.x,y:d.y};setDestination(h,best,tree);}else if(traffic)goToDrop(s,h,d,false);else h.wait=.35;
}
export function canDeposit(s,h){
 if(!restingSpotClear(s,h,h))return false;
 const dx=h.x-s.cart.x,dy=h.y-s.cart.y,d=Math.hypot(dx,dy),near=s.cart.radius+BODY_RADIUS;
 if(d<near-.001||d>near+11)return false;
 // Check the short reach to the rim, not through the cart's solid body.
 const rim=s.cart.radius+2;
 return clearSegment(s,h,{x:s.cart.x+dx*rim/d,y:s.cart.y+dy*rim/d},0);
}
function goToCart(s,h,traffic=true){
 const tree=routesFrom(s,h,{traffic});let best=null,score=Infinity;
 for(const n of tree.graph.nodes){if(!tree.distance.has(n.id)||!canDeposit(s,n))continue;
  // Prefer a different approach from another carrier, without reserving the
  // cart or forbidding a usable spot. Actual bodies still cannot overlap.
  const approaching=s.crew.some(o=>o!==h&&o.cargo&&o.goal&&Math.hypot(o.goal.x-n.x,o.goal.y-n.y)<BODY_GAP);
  const cost=tree.distance.get(n.id)+(approaching?12:0);if(cost<score){score=cost;best=n;}
 }
 if(best){
  // Keep a blocked route's wait clock when the best approach did not change,
  // so the normal step-aside behaviour can still resolve a narrow passage.
  if(!h.goal||Math.hypot(h.goal.x-best.x,h.goal.y-best.y)>1)setDestination(h,best,tree);
 }else if(traffic)goToCart(s,h,false);else h.wait=.35;
}
function finishAction(s,h,dt){
 const before=h.actionTime;h.actionTime+=dt;h.motion+=dt;
 if(h.action==='pickup'){
  if(before<ACTION.grasp&&h.actionTime>=ACTION.grasp)s.events.push({type:'grasp',time:s.time,kind:h.cargo,worker:h.id,x:h.cargoDrop.x,y:h.cargoDrop.y});
  if(h.actionTime>=ACTION.pickup){h.action=null;h.goal=null;h.route=[];h.clip='carry';}
 }else if(h.action==='deposit'){
  if(before<ACTION.release&&h.actionTime>=ACTION.release)h.releaseFrom=carrySocket(h);
  if(before<ACTION.land&&h.actionTime>=ACTION.land){
   const value=h.cargoDrop.value??1;s.secured++;s.securedValue+=value;h.delivered++;s.events.push({type:'deposit',time:s.time,kind:h.cargo,value,dropId:h.cargoDrop.id,worker:h.id,owner:h.cargoDrop.owner,x:s.cart.x,y:s.cart.y});h.cargo=null;
  }
  if(h.actionTime>=ACTION.deposit){h.cargoDrop=null;h.releaseFrom=null;h.pickup=null;h.action=null;h.clip='idle';}
 }
}
function updateWorker(s,h,dt){
 if(h.action){finishAction(s,h,dt);return;}
 if(updateBlastFlight(h,dt))return;
 if(updateCare(s,h,dt)){h.bomb=null;updateSleepMining(s,h,dt,strike);return;}
 // Arriving in reach is enough, even while another worker is depositing.
 if(h.cargo&&canDeposit(s,h)){
  h.stand=null;h.goal=null;h.route=[];h.yieldGoal=null;h.yieldFor=null;
  h.clip='carry';h.action='deposit';h.actionTime=0;h.face=s.cart.x>=h.x?1:-1;return;
 }
 if(h.yieldGoal){moveWorker(s,h,dt);return;}
 if(h.recover>0){h.recover-=dt;h.clip=h.trait==='drill'?'drill':'mine';h.motion+=dt*2.1/h.period;return;}
 if(h.wait>0){h.wait-=dt;h.motion+=dt;return;}
 // Carried and reserved ore take priority over a new command. A different
 // worker breaking a cell never resets this worker's swing or its route.
 if(h.cargo){
  h.stand=null;h.clip='carry';
  if(h.goal){
   if(h.stuck>.3&&s.time>=(h.cartReplanAt??0)){goToCart(s,h);h.cartReplanAt=s.time+.6;}
   moveWorker(s,h,dt);return;
  }
  goToCart(s,h);return;
 }
 if(h.pickup==null){const owned=s.drops.filter(d=>d.owner===h.id).sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[0];if(owned)h.pickup=owned.id;}
 if(h.pickup!=null){
  h.stand=null;const d=s.drops.find(d=>d.id===h.pickup&&d.owner===h.id);
  if(!d){h.pickup=null;h.goal=null;h.route=[];return;}
  if(canPickDrop(d)&&Math.hypot(d.x-h.x,d.y-h.y)<=38&&clearSegment(s,h,d,1)){
   h.goal=null;h.route=[];
   h.cargo=d.kind;h.cargoDrop={...d};s.drops.splice(s.drops.indexOf(d),1);h.pickup=null;h.action='pickup';h.actionTime=0;h.clip='carry';h.face=d.x>=h.x?1:-1;
   return;
  }
  if(d.confined){h.clip='idle';return;}
  if(h.goal&&h.pickupPosition&&Math.hypot(d.x-h.pickupPosition.x,d.y-h.pickupPosition.y)>14&&s.time>=(h.pickupReplanAt??0)){h.goal=null;h.route=[];h.pickupReplanAt=s.time+.2;}
  if(h.goal)moveWorker(s,h,dt);
  else if(Math.hypot(d.x-h.x,d.y-h.y)>32||!clearSegment(s,h,d,1))goToDrop(s,h,d);
  else{h.clip='idle';h.face=d.x>=h.x?1:-1;}
  return;
 }
 if(h.work!==null&&!isMineable(s.cells[h.work])){h.work=null;h.stand=null;h.goal=null;h.route=[];}
 if(h.command!==s.commandRevision){h.work=null;h.stand=null;h.goal=null;h.route=[];}
 if(h.work===null){chooseWork(s,h);return;}
 if(h.goal){moveWorker(s,h,dt);return;}
 if(Math.hypot(h.x-h.stand.x,h.y-h.stand.y)>1){h.goal={...h.stand};h.route=[];moveWorker(s,h,dt);return;}
 if(updateBomb(s,h,dt,strike))return;
 h.clip=h.trait==='drill'?'drill':'mine';h.face=h.workFace;
 const period=miningPeriod(h,s.cells[h.work]),old=Math.floor(h.mineTime/period);h.mineTime+=dt*(s.careEnabled?workRate(h):1);h.motion=h.trait==='drill'?h.mineTime:(h.mineTime/period%1)*2.1;
 if(Math.floor(h.mineTime/period)>old){strike(s,h.work,h);h.lastHit=s.time;}
}
export function update(s,dt){
 if(s.paused)return;dt=Math.max(0,Math.min(dt,.05));s.time+=dt;s.events=s.events.filter(e=>s.time-e.time<.8);
 if(s.phase==='transition'){updateTransition(s,dt);return;}if(s.phase==='ended')return;
 syncSleepingPasses(s);
 updateBall(s,dt,h=>hitWithBall(s,h),()=>beginDescent(s));if(s.phase!=='mining')return;
 for(const d of s.seeds)d.age+=dt;updateMinedDrops(s,dt);
 assignFocusWork(s);
 // Rotate update order so the same hamster does not win every open footstep.
 const offset=Math.floor(s.time*2)%s.crew.length;
 for(let i=0;i<s.crew.length;i++){
  const h=s.crew[(i+offset)%s.crew.length],x=h.x,y=h.y;updateWorker(s,h,dt);
  const distance=Math.hypot(h.x-x,h.y-y);h.walkTime+=distance/(h.speed*(h.cargo?.77:1))*h.gait;
  const over=s.crew.filter(o=>o!==h&&(o.sleeping||h.passingSleepers?.includes(o.id)));
  const lift=distance>.01&&!h.action?Math.max(0,...over.map(o=>{const k=Math.max(0,1-Math.hypot(h.x-o.x,h.y-o.y)/46);return 13*k*k*(3-2*k);})):0;
  h.stepOverHeight=lift;
  h.stepOverDepth=lift>0?Math.max(h.y,...over.filter(o=>Math.hypot(h.x-o.x,h.y-o.y)<46).map(o=>o.y+1)):h.y;
  h.moveBlend+=((distance>.01?1:0)-h.moveBlend)*(1-Math.exp(-18*dt));h.breathTime+=dt;drainStamina(s,h,dt,distance);
 }
 if(cannotContinue(s)&&!ballSpeed(s.ball))finishExpedition(s,'exhausted');
}
function placeHole(s,id){
 const [x,y]=center(id);let best=null,cost=Infinity;
 // The painted cliff occupies part of a cleared cell. Anchor the revealed
 // mouth on its nearest usable floor so a ball can physically enter it.
 for(let yy=y-55;yy<=y+65;yy+=5)for(let xx=x-55;xx<=x+55;xx+=5){
  if(!ballPositionClear(s,xx,yy))continue;
  const d=Math.hypot(xx-x,yy-(y+15));if(d<cost){cost=d;best={x:xx,y:yy};}
 }
 return best??{x,y:y+25};
}
function discardUnsecured(s){
 s.lostValue+=s.drops.reduce((v,d)=>v+(d.value??1),0)+s.crew.reduce((v,h)=>v+(h.cargo?(h.cargoDrop.value??1):0),0);
 s.lostOre+=s.drops.length+s.crew.filter(h=>h.cargo).length;s.drops=[];
 for(const h of s.crew){
  h.cargo=null;h.cargoDrop=null;h.action=null;h.releaseFrom=null;h.pickup=null;h.bomb=null;h.blastTime=null;
  h.goal=null;h.route=[];h.work=null;h.stand=null;h.yieldGoal=null;h.yieldFor=null;
 }
}
export function beginDescent(s){
 if(s.phase!=='mining'||!holeContains(s,s.ball))return false;
 s.phase='transition';s.aim=null;s.ball.vx=s.ball.vy=0;
 s.transition={stage:'suction',time:0,shape:chooseIrisShape(()=>noise(s.depth,s.seed,112)),hole:{...s.holeAt},from:s.crew.map(h=>({id:h.id,x:h.x,y:h.y}))};
 discardUnsecured(s);return true;
}
function nextFloor(s){
 const old=s.crew,revision=s.revision+1,navRevision=s.navRevision+1;
 // User rule: floor seeds stay behind. Only seeds still inside the ball carry
 // over; an interrupted bite does not grant recovery or refund a seed.
 const seeds=s.ball.seeds;
 const next=getLayout(LAYOUTS[(LAYOUTS.findIndex(l=>l.id===s.layoutId)+1)%LAYOUTS.length].id);
 const fresh=createState(s.seed+1,{themeId:s.themeId,layoutId:next.id,careEnabled:s.careEnabled,mineralRules:s.mineralRules});
 for(const h of fresh.crew){
  const prior=old.find(o=>o.id===h.id);
  for(const field of ['stamina','fullness','skin','baseSkin','trait','period','power','speed','gait','delivered','mineTime','sleepHitsRemaining'])h[field]=prior[field];
  h.sleeping=h.stamina<=0;h.sleepTime=0;h.clip=h.sleeping?'sleep':'idle';
 }
 const carried={time:s.time,depth:s.depth+1,rewardMultiplier:s.rewardMultiplier,mined:s.mined,minedValue:s.minedValue,secured:s.secured,securedValue:s.securedValue,lostOre:s.lostOre,lostValue:s.lostValue,nextDrop:s.nextDrop,nextSeed:s.nextSeed,grid:s.grid,paused:s.paused,transition:s.transition,phase:'transition',revision,navRevision};
 Object.assign(s,fresh,carried);s.ball.seeds=seeds;
}
function updateTransition(s,dt){
 const t=s.transition;t.time+=dt;
 if(t.stage==='suction'&&t.time>=1.35){t.stage='close';t.time=0;}
 else if(t.stage==='close'&&t.time>=.52){t.stage='covered';t.time=0;}
 else if(t.stage==='covered'&&t.time>=.12){nextFloor(s);t.stage='open';t.time=0;}
 else if(t.stage==='open'&&t.time>=.65){s.transition=null;s.phase='mining';s.events.push({type:'floor',time:s.time,depth:s.depth});}
}
export function finishExpedition(s,reason='return'){
 if(s.phase!=='mining')return false;
 s.aim=null;discardUnsecured(s);s.ball.vx=s.ball.vy=0;s.phase='ended';
 s.result={reason,depth:s.depth,secured:s.secured,securedValue:s.securedValue,lostOre:s.lostOre,lostValue:s.lostValue,seeds:s.ball.seeds};return true;
}
export {boundaryEdges,contours} from './terrain-geometry.js';
