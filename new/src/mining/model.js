// Shared by the game and design preview. Speeds, hit counts and layouts are review values.
import {getTheme} from './mineral-themes.js';
import {getLayout,LAYOUTS,CAVE,tutorialCave,caveLayout,holeNeedFor,rareShare,crateCount} from './map-layouts.js';
import {COLS,ROWS,TILE,ORIGIN,RISE,key,xy,center,hitCell,noise,neighbors,isMineable} from './grid.js';
import {spawnMinedDrop,updateMinedDrops,canPickDrop} from './drop-system.js';
import {navigation,routesFrom,setDestination,moveWorker,BODY_RADIUS,BODY_GAP,clearSegment,syncSleepingPasses,restingSpotClear} from './navigation.js';
import {ACTION} from './action-timing.js';
import {carrySocket} from './worker-pose.js';
import {CARE,updateCare,hitWithBall,drainStamina,workRate,cannotContinue,digest} from './care.js';
import {BALL,updateBall,holeContains,ballSpeed} from './ball.js';
import {ballPositionClear} from './terrain-collision.js';
import {chooseIrisShape} from '../intro/iris-transition.js';
import {assignFocusWork} from './focus-command.js';
import {mineralRule,miningPeriod,equipTrait,TRAITS,hasTrait,chargeBonus} from './mining-rules.js';
// 수레 곁 채굴 속도(마스터리 cartAura): 수레에서 130px 안에서 일하면 빨라진다
const cartAura=(s,h)=>s.mods?.cartAura&&Math.hypot(h.x-s.cart.x,h.y-s.cart.y)<130?1+s.mods.cartAura:1;
// 떨어지는 씨앗(마스터리): 단계가 오를수록 자주(검토용 값)
export const windfallEvery=level=>Math.max(12,40-6*level);
import {updateBlastFlight,updateSleepMining,updateBomb} from './trait-actions.js';
import {updateFlight,updateCart} from './fling.js';
import {TOOL,buryTools,startTools,openBuried,updateTools,honeyWork,flagWork} from './tools.js';
export {equipTrait};
export {COLS,ROWS,TILE,ORIGIN,RISE,key,xy,center,hitCell,noise,neighbors,isMineable};
// 층마다 박혀 있는 상자(검토용 임시 값). 캐서 열면 황금 해바라기씨가 튀어나오고, 햄찌가 수레에 담아야 확보된다.
// 황금 해바라기씨는 일반 광물 집계(mined/secured)와 따로 센다(securedGolden).
export const CRATE={perFloor:1,hits:4,golden:3};
// step: 동굴 맵에서 이번 탐사 동안 내려간 층 수(0=첫 층). 맵 크기와 구멍 조건이 여기서 정해진다.
// depth: 지하 몇 층인지. 동굴 맵의 희귀 광석 비율과 황금 상자 개수가 여기서 정해진다.
// mods: 출발할 때 모은 마스터리 효과(mining-mastery.js의 miningMods). 맵·햄찌 수·기운 등에 쓰고 s.mods로 들고 다닌다.
// tutorialMap: 프롤로그 뒤 첫 탐사는 튜토리얼 전용 맵(1 = 지하 1층 TUTORIAL_CAVE, 2 = 지하 2층 TUTORIAL_CAVE2, map-layouts.js)
export function createState(seed=1,{themeId='base',layoutId='classic',careEnabled=true,mineralRules='varied',traits=[],traits2=[],step=0,depth=1,mods={},tutorialMap=0}={}){
 const mod=k=>mods?.[k]??0;tutorialMap=tutorialMap===true?1:Number(tutorialMap)||0;
 const theme=getTheme(themeId),cave=layoutId===CAVE.id?(tutorialCave(tutorialMap)??caveLayout(seed,step)):null,map=cave?{id:CAVE.id,rows:cave.rows}:getLayout(layoutId);
 const layout=map.rows.map(row=>[...row].map(v=>v!=='.'&&v!=='~'));
 const cells=layout.flatMap((row,y)=>row.map((solid,x)=>{
  const copper=(x<4&&y>=3&&y<=6)||(x>=8&&y>=10&&y<=13),jade=x>=7&&y>=2&&y<=6;
  let kind=copper&&noise(x,y,seed+3)>.35?'copper':jade&&noise(x,y,seed+3)>.3?'jade':'stone';
  if(theme.id!=='base'){
   const vein=Math.abs(x-(2.3+Math.sin(y*.7+seed)*1.6))<1.3||Math.abs(x-(7.2+Math.cos(y*.45+seed)*1.1))<.9,n=noise(x,y,seed+15);
   kind=vein&&n>.32?theme.primary:n>.87?theme.secondary:'stone';
  }
  if(cave){
   // 동굴: 희귀 광석(기본 광산은 구리·옥, 테마 광산은 그 테마의 대표 광석)이 2×2칸 무리로 박히고 깊을수록 늘어난다.
   // 나머지는 돌, 테마 광산은 부 광석이 조금 섞인다.
   const rare=noise(Math.floor(x/2),Math.floor(y/2),seed+31)>1-(rareShare(depth)+mod('rare'))&&noise(x,y,seed+15)>.22;
   kind=rare?(theme.id==='base'?(noise(Math.floor(x/2),Math.floor(y/2),seed+5)>.5?'copper':'jade'):theme.primary):theme.id!=='base'&&noise(x,y,seed+44)>.86?theme.secondary:'stone';
  }
  const rule=mineralRule(kind,mineralRules),hp=rule.hits;
  // Only existing edge rock becomes permanent; keep the approved silhouette
  // and any authored openings intact. Interior rock remains excavatable.
  // 동굴 맵의 바깥(outside)은 캘 수 없는 어둠이다. 예전 맵은 격자 가장자리 바위만 영구 바위.
  // 구덩이('o')도 바깥처럼 캘 수 없는 어둠 칸이다. 물길('~')은 뚫린 바닥이지만 느려진다.
  const mark=cave?.rows[y][x],outside=mark===' '||mark==='o',pit=mark==='o',water=mark==='~';
  const unbreakable=solid&&(outside||x===0||x===COLS-1||y===0||y===ROWS-1);
  return{id:key(x,y),x,y,solid,unbreakable,outside,pit,water,kind,value:rule.value,texture:rule.texture,geology:copper?'copper':jade?'jade':'stone',hp,maxHp:hp,variant:Math.floor(noise(x,y,seed)*4),rotation:Math.floor(noise(x,y,seed+9)*4),hole:false};
 }));
 const holeCell=cave?cells[key(cave.hole.x,cave.hole.y)]:cells.find(c=>isMineable(c)&&c.y>=3&&c.y<=6&&neighbors(c.id).some(n=>!cells[n].solid));holeCell.hole=true;
 // 동굴: 바위를 holeNeed개 부숴야 구멍을 캘 수 있다(그 전엔 잠김 → isMineable이 false).
 const holeNeed=cave?cave.holeNeed??Math.max(2,holeNeedFor(step)-mod('holeEase')):0;if(holeNeed)holeCell.locked=true;
 if(cave?.holeHits)holeCell.hp=holeCell.maxHp=cave.holeHits;
 // 상자는 구멍·수레 근처(아래쪽 줄)를 피해 길에 맞닿은 안쪽 바위에 시드로 정해 박는다. 처음부터 보여서 노릴 수 있다.
 // 동굴에서는 처음 공간에 바로 붙지 않은 바위 속(한 칸 이상 파야 닿음)에 묻는다.
 const touchesOpen=c=>neighbors(c.id).some(n=>!cells[n].solid);
 cells.filter(c=>isMineable(c)&&!c.hole&&(cave?!touchesOpen(c):c.y>=2&&c.y<=11&&touchesOpen(c)))
  .sort((a,b)=>noise(a.x,a.y,seed+77)-noise(b.x,b.y,seed+77)).slice(0,cave?.noCrates?0:cave?crateCount(seed,depth,mod('crateChance')):CRATE.perFloor)
  .forEach(c=>{c.crate=true;c.hp=c.maxHp=CRATE.hits;});
 // 튜토리얼 맵은 상자 자리를 정해 둔다
 for(const p of cave?.crates??[]){const c=cells[key(p.x,p.y)];c.crate=true;c.hp=c.maxHp=p.hits??CRATE.hits;}
 // 동굴: 해금한 층 도구·화분을 바위 속에 묻는다(tools.js)
 if(cave&&!tutorialMap)buryTools(cells,seed,mods);
 // 동굴: 수레는 처음 공간 왼쪽 아래, 공은 오른쪽 아래(벽에서 몸 반지름+여유만큼 띄움)
 const pocket=cave&&{left:ORIGIN+cave.pocket.x*TILE,right:ORIGIN+(cave.pocket.x+cave.pocket.w)*TILE,top:ORIGIN+cave.pocket.y*TILE,bottom:ORIGIN+(cave.pocket.y+cave.pocket.h)*TILE};
 const tile=p=>({x:ORIGIN+p.x*TILE,y:ORIGIN+p.y*TILE});
 const cart=cave?.cartAt?tile(cave.cartAt):pocket?{x:pocket.left+50,y:pocket.bottom-42}:{x:177,y:653},ballAt=cave?.ballAt?tile(cave.ballAt):pocket?{x:pocket.right-28,y:pocket.bottom-28}:{x:283,y:704};
 const s={seed,careEnabled,tutorialMap,phase:'mining',depth:1,seeds:[],nextSeed:0,lostOre:0,aim:null,holeAt:null,transition:null,result:null,themeId:theme.id,layoutId:map.id,cells,crew:[],time:0,revision:0,navRevision:0,commandRevision:0,focus:null,drops:[],secured:0,mined:0,hole:null,events:[],nextDrop:0,lootAccumulator:0,paused:false,grid:false,cartStand:key(4,13),cart:{...cart,radius:34,vx:0,vy:0},ball:{...ballAt,radius:BALL.radius,vx:0,vy:0,angle:0,contacts:[],seeds:CARE.initialSeeds},holeNeed,floorBroken:0,floorStart:0,
  mods:{...mods},shadows:[],windfallAt:mod('windfall')?windfallEvery(mod('windfall')):null,lastFlingAt:-9};
 // 동굴의 처음 공간은 좁아서 햄찌끼리 조금 붙어 서도 된다(겹쳐 지나가기 규칙과 같은 이유). 증원된 햄찌(5·6번째)는 둘째 줄.
 const count=Math.min(6,4+mod('crew'));
 const spots=(pocket?[...Array.from({length:4},(_,i)=>[(pocket.left+30+i*46)/50,(pocket.top+75)/50]),[(pocket.left+60)/50,(pocket.top+125)/50],[(pocket.left+140)/50,(pocket.top+125)/50]]:[[2,7],[5,10],[6,6],[4,12],[3,9],[5,7]]).slice(0,count),spacing=pocket?40:BODY_GAP+5;
 for(const [i,[x,y]]of spots.entries()){
  const node=navigation(s).nodes.filter(n=>s.crew.every(h=>Math.hypot(h.x-n.x,h.y-n.y)>spacing&&(pocket||hitCell(h.x,h.y)!==hitCell(n.x,n.y)))).sort((a,b)=>Math.hypot(a.x-x*50,a.y-y*50)-Math.hypot(b.x-x*50,b.y-y*50))[0];
  const individuality=noise(i,seed,43);
  s.crew.push({id:i,stamina:CARE.maxStamina+mod('stamina'),maxStamina:CARE.maxStamina+mod('stamina'),fullCap:CARE.fullness+mod('fullness'),fullness:0,sleeping:false,care:null,careTime:0,foodTarget:null,x:node.x,y:node.y,skin:'miner',role:'worker',clip:'idle',face:i%2?-1:1,motion:i*.37,walkTime:0,moveBlend:0,breathTime:i*.47,route:[],goal:null,work:null,command:-1,mineTime:.3+i*.29,period:1.8+individuality*.65,speed:76+individuality*18,gait:.88+individuality*.25,cargo:null,wait:i*.19,stuck:0,delivered:0});
 }
 s.mineralRules=mineralRules;s.minedValue=0;s.securedValue=0;s.lostValue=0;s.goldenFound=0;s.securedGolden=0;s.lostGolden=0;
 for(const h of s.crew){h.baseSkin=h.skin;h.trait='none';equipTrait(s,h.id,traits[h.id]??'none');
  // 둘째 특성 칸(마스터리 '특성 칸'): 첫째 칸과 다른 특성만
  const second=traits2?.[h.id];h.trait2=TRAITS[second]&&second!=='none'&&second!==h.trait?second:null;h.traitLevel=mod('traitLevel');}
 // 대장 햄찌(레퍼런스의 '선택받은 미니오'): 탐사마다 한 마리가 왕관을 쓴다. 힘은 출발할 때(startMining) 더한다.
 s.crew[Math.floor(noise(seed,depth,301)*s.crew.length)].leader=true;
 // 해바라기 깃발은 처음부터 하나, 수레 옆에 꽂혀 있다
 startTools(s,{x:s.cart.x+58,y:s.cart.y-6});
 return s;
}
export function selectCell(s,id){if(s.phase!=='mining'||id===null||!isMineable(s.cells[id]))return false;s.focusAt=s.time;if(s.focus===id)return true;s.focus=id;s.commandRevision++;return true;}
// 이번 탐사에서 내려간 층 수(동굴 맵 크기 단계). 저장 검사(validRun)도 같은 값으로 맵을 다시 만든다.
export const caveStep=s=>Math.max(0,(s.depth??1)-(s.startDepth??1));
// remaining: 구멍이 잠겨 있으면 더 부숴야 하는 바위 수(0이면 캘 수 있음)
export function holeMarker(s){const cell=s.cells.find(c=>c.hole);if(!cell)return null;const m={id:cell.id,state:cell.solid?'buried':'revealed'};if(s.holeNeed)m.remaining=cell.locked?Math.max(0,s.holeNeed-(s.floorBroken??0)):0;return m;}
// 바위 하나가 부서질 때마다(상자 포함) 센다. 조건을 채우면 구멍이 풀린다.
function countBroken(s){
 s.floorBroken=(s.floorBroken??0)+1;
 const hole=s.cells.find(c=>c.hole&&c.locked);
 if(hole&&s.floorBroken>=(s.holeNeed??0)){hole.locked=false;s.navRevision++;const[x,y]=center(hole.id);s.events.push({type:'unlock',id:hole.id,time:s.time,x,y});}
}
export function strike(s,id,worker=null){const c=s.cells[id];if(s.phase!=='mining'||!isMineable(c))return false;
 // 시큼 열매로 무른 바위는 더 아프게, 반짝 일격(치명타)은 확률로 크게
 let damage=(worker?.power??1)*(c.soft?1+TOOL.sour.extra+(s.mods?.sourPower??0):1);const crit=worker&&s.mods?.crit&&noise(s.time*97,id,s.seed+(s.revision%977))<s.mods.crit;if(crit)damage*=1.5+(s.mods.critDamage??0);
 c.hp=Math.max(0,c.hp-damage);s.revision++;const contact=worker?.contact??{x:center(id)[0],y:center(id)[1]};s.events.push({type:'hit',id,time:s.time,kind:c.kind,worker:worker?.id,crit:!!crit,...contact});
 if(c.hp<=0&&(c.tool||c.pot))openBuried(s,c);
 if(c.hp<=0&&c.crate){
  // 상자: 광물 집계에 넣지 않고 황금 해바라기씨를 흩뿌린다. 깬 햄찌가 하나씩 수레로 나른다.
  c.hp=0;c.solid=false;c.crate=false;c.opened=true;s.navRevision++;const golden=CRATE.golden+(s.mods?.crateSeeds??0);s.goldenFound+=golden;countBroken(s);
  s.events.push({type:'crate',id,time:s.time,worker:worker?.id,...contact});
  // 깬 햄찌가 첫 알을 맡고, 나머지는 주인 없이 떨어져 가까운 햄찌들이 하던 일을 멈추고 먼저 주워 간다.
  const drops=Array.from({length:golden},(_,i)=>spawnMinedDrop(s,c,i===0?worker?.id??null:null,{golden:true}));
  if(worker){worker.pickup=drops[0].id;worker.recover=.4;worker.work=null;worker.goal=null;worker.route=[];}
  if(s.focus===id)s.focus=null;return true;
 }
 if(c.hp<=0){c.hp=0;c.solid=false;s.mined++;s.minedValue+=c.value??1;s.navRevision++;if(!c.hole)countBroken(s);s.events.push({type:'break',id,time:s.time,kind:c.kind,worker:worker?.id,...contact});const drop=spawnMinedDrop(s,c,worker?.id??null);if(worker){worker.pickup=drop.id;worker.recover=hasTrait(worker,'drill')?.1:.32;worker.work=null;worker.goal=null;worker.route=[];}if(c.hole){s.hole=id;s.holeAt=placeHole(s,id);if(s.mods?.vacuum)vacuumFloor(s);}if(s.focus===id)s.focus=null;}return true;}
// 수레 청소기(마스터리 vacuum): 구멍이 열리면 바닥에 남은 조각을 한꺼번에 수레에 담는다
function vacuumFloor(s){
 for(const d of [...s.drops]){if(d.confined)continue;s.drops.splice(s.drops.indexOf(d),1);if(d.golden)s.securedGolden++;else{s.secured++;s.securedValue+=d.value??1;}
  for(const h of s.crew)if(h.pickup===d.id)h.pickup=null;}
 s.events.push({type:'deposit',time:s.time,kind:'stone',value:0,golden:false,dropId:-1,worker:null,owner:null,x:s.cart.x,y:s.cart.y});
}
export function pathTo(s,start,goal,{throughRock=false}={}){
 if(start===null||goal===null||!s.cells[start]||!s.cells[goal]||s.cells[start].unbreakable||s.cells[goal].unbreakable)return null;
 const dist=new Map([[start,0]]),prev=new Map(),open=new Set([start]);
 while(open.size){let at=null,best=Infinity;for(const id of open)if(dist.get(id)<best){at=id;best=dist.get(id);}open.delete(at);if(at===goal){const p=[at];while(prev.has(p[0]))p.unshift(prev.get(p[0]));return p;}
  for(const n of neighbors(at)){if(s.cells[n].unbreakable||s.cells[n].solid&&!throughRock)continue;const cost=best+(s.cells[n].solid?8:1);if(cost<(dist.get(n)??Infinity)){dist.set(n,cost);prev.set(n,at);open.add(n);}}
 }return null;
}
export function planMine(s,start,target){const route=pathTo(s,start,target,{throughRock:true});if(!route)return null;const stop=route.findIndex(id=>s.cells[id].solid);if(stop<1)return null;return{work:route[stop],stand:route[stop-1],route:route.slice(1,stop)};}
function chooseWork(s,h){
 // 날려 보낸 햄찌는 내려앉은 곳(anchor) 주변 바위를 이어서 캔다.
 const tree=routesFrom(s,h),focus=h.anchor?[h.anchor.x,h.anchor.y]:s.focus===null?null:center(s.focus);let best=null,score=Infinity;
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
// 날려서 맞힌 바위(h.order)를 캘 자리. 못 찾으면 false(→ 주변 아무 바위).
function standFor(s,h,cell){
 const tree=routesFrom(s,h,{traffic:false});let best=null,score=Infinity;
 for(const n of tree.graph.nodes){if(!tree.distance.has(n.id)||!restingSpotClear(s,h,n))continue;
  if(s.crew.some(o=>o!==h&&o.stand&&Math.hypot(o.stand.x-n.x,o.stand.y-n.y)<BODY_GAP+2))continue;
  const job=n.jobs.find(j=>j.work===cell);if(!job)continue;
  const cost=tree.distance.get(n.id);if(cost<score){score=cost;best={node:n,...job};}
 }
 if(!best)return false;
 h.work=best.work;h.contact=best.contact;h.workFace=best.face;h.stand={x:best.node.x,y:best.node.y};h.command=s.commandRevision;h.wait=0;
 setDestination(h,best.node,tree);return true;
}
// 바닥의 황금 해바라기씨가 최우선: 주인이 없거나(상자에서 튄 것) 주인이 잠들었으면 가장 가까운 손 빈 햄찌가 맡는다.
function claimGolden(s,h){
 if(s.drops.some(d=>d.id===h.pickup&&d.owner===h.id&&d.golden))return;
 const idle=id=>{const o=s.crew.find(x=>x.id===id);return !o||o.sleeping||o.blastTime!=null;};
 const d=s.drops.filter(d=>d.golden&&!d.confined&&(d.owner==null||d.owner===h.id||idle(d.owner))).sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[0];
 if(!d)return;
 d.owner=h.id;h.pickup=d.id;h.pickupPosition=null;h.goal=null;h.route=[];h.work=null;h.stand=null;
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
   const value=h.cargoDrop.value??1,golden=!!h.cargoDrop.golden;
   if(golden)s.securedGolden++;else{s.secured++;s.securedValue+=value;}
   // 두 개 나르기(마스터리 carry2): 둘째 짐도 함께 담는다
   const extra=h.extraDrop;if(extra){if(extra.golden)s.securedGolden++;else{s.secured++;s.securedValue+=extra.value??1;}h.extraDrop=null;}
   h.delivered++;s.events.push({type:'deposit',time:s.time,kind:h.cargo,value,golden,dropId:h.cargoDrop.id,worker:h.id,owner:h.cargoDrop.owner,x:s.cart.x,y:s.cart.y});h.cargo=null;
  }
  if(h.actionTime>=ACTION.deposit){h.cargoDrop=null;h.releaseFrom=null;h.pickup=null;h.action=null;h.clip='idle';}
 }
}
function updateWorker(s,h,dt){
 if(h.action){finishAction(s,h,dt);return;}
 // 손가락으로 잡혀 있는 동안은 제자리에서 버둥거리지 않고 기다린다
 if(s.aim?.what==='hamster'&&s.aim.id===h.id){h.clip='idle';h.motion+=dt;return;}
 if(updateFlight(s,h,dt,strike))return;
 if(updateBlastFlight(h,dt))return;
 if(updateCare(s,h,dt)){h.bomb=null;updateSleepMining(s,h,dt,strike);return;}
 // Arriving in reach is enough, even while another worker is depositing.
 if(h.cargo&&canDeposit(s,h)){
  h.stand=null;h.goal=null;h.route=[];h.yieldGoal=null;h.yieldFor=null;
  h.clip='carry';h.action='deposit';h.actionTime=0;h.face=s.cart.x>=h.x?1:-1;return;
 }
 if(h.yieldGoal){moveWorker(s,h,dt);return;}
 if(h.recover>0){h.recover-=dt;h.clip=hasTrait(h,'drill')?'drill':'mine';h.motion+=dt*2.1/h.period;return;}
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
 // 날려서 맞힌 바위가 남아 있으면 그 바위부터(제 광석 줍기·황금 씨앗보다 먼저). 캘 자리가 없으면 주문을 버린다.
 if(h.order!=null&&(!isMineable(s.cells[h.order])||h.work!==h.order&&!standFor(s,h,h.order)))h.order=null;
 if(h.order==null)claimGolden(s,h);
 if(h.order==null&&h.pickup==null){const owned=s.drops.filter(d=>d.owner===h.id).sort((a,b)=>(b.golden?1:0)-(a.golden?1:0)||Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[0];if(owned)h.pickup=owned.id;}
 if(h.order==null&&h.pickup!=null){
  h.stand=null;const d=s.drops.find(d=>d.id===h.pickup&&d.owner===h.id);
  if(!d){h.pickup=null;h.goal=null;h.route=[];return;}
  if(canPickDrop(d)&&Math.hypot(d.x-h.x,d.y-h.y)<=38&&clearSegment(s,h,d,1)){
   h.goal=null;h.route=[];
   h.cargo=d.kind;h.cargoDrop={...d};s.drops.splice(s.drops.indexOf(d),1);h.pickup=null;h.action='pickup';h.actionTime=0;h.clip='carry';
   // 두 개 나르기: 바로 옆(45px)에 주인 없거나 내 몫인 조각이 있으면 같이 든다
   if(s.mods?.carry2){const near=s.drops.find(o=>canPickDrop(o)&&(o.owner==null||o.owner===h.id)&&Math.hypot(o.x-d.x,o.y-d.y)<45);if(near){h.extraDrop={...near};s.drops.splice(s.drops.indexOf(near),1);}}h.face=d.x>=h.x?1:-1;
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
 h.clip=hasTrait(h,'drill')?'drill':'mine';h.face=h.workFace;
 const period=miningPeriod(h,s.cells[h.work]),old=Math.floor(h.mineTime/period);h.mineTime+=dt*(s.careEnabled?workRate(h):1)*cartAura(s,h)*honeyWork(s,h)*flagWork(s,h);h.motion=hasTrait(h,'drill')?h.mineTime:(h.mineTime/period%1)*2.1;
 // 충전 곡괭이: 쌓인 만큼 이번 타격만 세게
 if(Math.floor(h.mineTime/period)>old){const p=h.power,boost=chargeBonus(h);if(boost)h.power=(p??1)*(1+boost);strike(s,h.work,h);h.power=p;h.lastHit=s.time;}
}
export function update(s,dt){
 if(s.paused)return;dt=Math.max(0,Math.min(dt,.05));s.time+=dt;s.events=s.events.filter(e=>s.time-e.time<.8);
 if(s.phase==='transition'){updateTransition(s,dt);return;}if(s.phase==='ended')return;
 syncSleepingPasses(s);
 updateBall(s,dt,h=>hitWithBall(s,h),()=>beginDescent(s));if(s.phase!=='mining')return;
 updateCart(s,dt,strike);
 for(const d of s.seeds)d.age+=dt;updateMinedDrops(s,dt);
 updateMagnet(s,dt);updateShadows(s,dt);updateWindfall(s);updateTools(s,dt,strike);
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
  h.moveBlend+=((distance>.01?1:0)-h.moveBlend)*(1-Math.exp(-18*dt));h.breathTime+=dt;drainStamina(s,h,dt,distance);digest(s,h,dt);
  if(!h.sleeping&&hasTrait(h,'charge'))h.charge=(h.charge??0)+dt;
 }
 if(cannotContinue(s)&&!ballSpeed(s.ball))finishExpedition(s,'exhausted');
}
// 수레 자석(마스터리 magnet, 칸 단위): 바닥에 내려앉은 조각을 수레 쪽으로 끌어오고, 닿으면 그대로 수레에 담긴다
function updateMagnet(s,dt){
 const reach=s.mods?.magnet;if(!reach)return;const c=s.cart,R=c.radius+20+reach*TILE;
 for(const d of [...s.drops]){if(!canPickDrop(d))continue;const dx=c.x-d.x,dy=c.y-d.y,dist=Math.hypot(dx,dy);if(dist>R)continue;
  if(dist<c.radius+8){s.drops.splice(s.drops.indexOf(d),1);if(d.golden)s.securedGolden++;else{s.secured++;s.securedValue+=d.value??1;}
   s.events.push({type:'deposit',time:s.time,kind:d.kind,value:d.value??1,golden:!!d.golden,dropId:d.id,worker:null,owner:d.owner,x:c.x,y:c.y});continue;}
  const step=Math.min(dist,70*dt);d.x+=dx/dist*step;d.y+=dy/dist*step;d.vx=d.vy=0;
 }
}
// 그림자 햄찌(마스터리 shadow): 날려 보낸 자리에서 잠깐 그 바위를 함께 캐다 사라진다(본 햄찌 채굴력의 60%)
const SHADOW={every:.9,power:.6};
function updateShadows(s,dt){
 s.shadows=(s.shadows??[]).filter(g=>s.time<g.until);
 for(const g of s.shadows){
  if(!isMineable(s.cells[g.cell])){const next=s.cells.filter(isMineable).sort((a,b)=>Math.hypot(...center(a.id).map((v,i)=>v-[g.x,g.y][i]))-Math.hypot(...center(b.id).map((v,i)=>v-[g.x,g.y][i])))[0];if(!next||Math.hypot(center(next.id)[0]-g.x,center(next.id)[1]-g.y)>90){g.until=s.time;continue;}g.cell=next.id;}
  if(s.time>=g.next){g.next=s.time+SHADOW.every;const[x,y]=center(g.cell);strike(s,g.cell,{id:null,power:g.power,contact:{x:(x+g.x)/2,y:(y+g.y)/2}});}
 }
}
// 떨어지는 씨앗(마스터리 windfall): 정해진 시간마다 열린 바닥에 해바라기씨 하나 → 배고픈 햄찌가 주워 먹는다
function updateWindfall(s){
 if(s.windfallAt==null||s.time-(s.floorStart??0)<s.windfallAt)return;
 s.windfallAt+=windfallEvery(s.mods?.windfall??1);
 const nodes=navigation(s).nodes;if(!nodes.length)return;const n=nodes[Math.floor(noise(s.time,s.seed,131)*nodes.length)];
 s.seeds.push({id:s.nextSeed++,x:n.x,y:n.y,age:0,reserved:null});s.events.push({type:'seed',time:s.time,x:n.x,y:n.y,worker:null});
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
 // 바닥·손에 남은 것은 잃는다. 황금 해바라기씨는 광물과 따로 센다.
 // 손에 든 짐은 둘째 짐(두 개 나르기)까지 함께 센다
 const loads=s.crew.flatMap(h=>h.cargo?[h.cargoDrop,...(h.extraDrop?[h.extraDrop]:[])]:[]),ore=[...s.drops,...loads].filter(d=>!d.golden);
 s.lostGolden=(s.lostGolden??0)+[...s.drops,...loads].filter(d=>d.golden).length;
 s.lostValue+=ore.reduce((v,d)=>v+(d.value??1),0);
 s.lostOre+=ore.length;s.drops=[];s.shadows=[];
 for(const h of s.crew){
  h.cargo=null;h.cargoDrop=null;h.extraDrop=null;h.action=null;h.releaseFrom=null;h.pickup=null;h.bomb=null;h.blastTime=null;
  h.goal=null;h.route=[];h.work=null;h.stand=null;h.yieldGoal=null;h.yieldFor=null;h.order=null;
  if(h.fling){h.fling=null;h.clip='idle';}
 }
 s.cart.vx=s.cart.vy=0;
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
 // 동굴은 같은 방식으로 한 단계 넓은 맵을 새로 만든다. 예전 맵은 목록을 돌아가며 바뀐다.
 const nextId=s.layoutId===CAVE.id?CAVE.id:getLayout(LAYOUTS[(LAYOUTS.findIndex(l=>l.id===s.layoutId)+1)%LAYOUTS.length].id).id;
 const fresh=createState(s.seed+1,{themeId:s.themeId,layoutId:nextId,careEnabled:s.careEnabled,mineralRules:s.mineralRules,step:caveStep(s)+1,depth:s.depth+1,mods:s.mods,tutorialMap:s.tutorialMap===1?2:0});
 for(const h of fresh.crew){
  const prior=old.find(o=>o.id===h.id);
  // 충전 곡괭이(charge)는 층마다 처음부터라 넘기지 않는다
  for(const field of ['stamina','maxStamina','fullness','fullCap','skin','baseSkin','trait','trait2','traitLevel','period','power','speed','gait','delivered','mineTime','sleepHitsRemaining','leader'])h[field]=prior[field];
  // 내려갈 때 기운 회복(쉼터 나무 descendRest)
  if(s.mods?.descendRest)h.stamina=Math.min(h.maxStamina??CARE.maxStamina,h.stamina+s.mods.descendRest);
  h.sleeping=h.stamina<=0;h.sleepTime=0;h.clip=h.sleeping?'sleep':'idle';
 }
 const carried={time:s.time,depth:s.depth+1,rewardMultiplier:s.rewardMultiplier,mined:s.mined,minedValue:s.minedValue,secured:s.secured,securedValue:s.securedValue,lostOre:s.lostOre,lostValue:s.lostValue,goldenFound:s.goldenFound??0,securedGolden:s.securedGolden??0,lostGolden:s.lostGolden??0,nextDrop:s.nextDrop,nextSeed:s.nextSeed,grid:s.grid,paused:s.paused,transition:s.transition,phase:'transition',revision,navRevision};
 // 내려갈 때 씨앗(마스터리 descendSeeds): 공에 해바라기씨가 더 들어온다
 Object.assign(s,fresh,carried);s.ball.seeds=seeds+(s.mods?.descendSeeds??0);s.floorStart=s.time;s.flagAt=null;
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
 s.result={reason,depth:s.depth,secured:s.secured,securedValue:s.securedValue,lostOre:s.lostOre,lostValue:s.lostValue,seeds:s.ball.seeds,securedGolden:s.securedGolden??0};return true;
}
export {boundaryEdges,contours} from './terrain-geometry.js';
