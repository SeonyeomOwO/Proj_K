import {ORIGIN,TILE,RISE,center,isMineable} from './grid.js';
import {floorIsClear} from './loot/loot-motion.js';
import {WATER,inWater} from './map-layouts.js';
import {miningContact,MAX_MINING_DISTANCE} from './mining-contact.js';

// Coordinates are body centres, not feet. Include the waviness of the wall in
// floorIsClear's margin, and keep independent workers a full body apart.
export const BODY_RADIUS=20;
export const BODY_GAP=52;
const STEP=10,cache=new WeakMap();
// 햄찌끼리는 서로 겹쳐 지나간다(2026-11-03 결정: 길 비켜 주기로 우왕좌왕하지 않게).
// false로 되돌리면 예전처럼 몸이 부딪히고, 잠든 햄찌만 넘어간다.
export const CREW_OVERLAP=true;
// A sleeping body can be stepped over. Keep an already crossing pair passable
// until they separate, even if food wakes the sleeper halfway through.
export const canPassWorker=(a,b)=>CREW_OVERLAP||a===b||a.sleeping||b.sleeping||a.passingSleepers?.includes(b.id)||b.passingSleepers?.includes(a.id);
export function syncSleepingPasses(s){
 for(const h of s.crew){
  h.passingSleepers=(h.passingSleepers??[]).filter(id=>s.crew.some(o=>o.id===id&&Math.hypot(h.x-o.x,h.y-o.y)<BODY_GAP+1));
  if(h.sleeping)continue;
  for(const o of s.crew)if(o!==h&&o.sleeping&&Math.hypot(h.x-o.x,h.y-o.y)<BODY_GAP+1&&!h.passingSleepers.includes(o.id))h.passingSleepers.push(o.id);
 }
}
export const restingSpotClear=(s,h,p)=>s.crew.every(o=>o===h||!canPassWorker(h,o)||Math.hypot(p.x-o.x,p.y-o.y)>=38);
export function clearSegment(s,a,b,r=BODY_RADIUS){
 const distance=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(distance/4));
 for(let i=0;i<=steps;i++)if(!floorIsClear(s,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,r))return false;
 return true;
}
// 2026-11-03: 바로 위·아래 바위도 캔다(동굴 맵은 위로 파고 들어가야 하므로). 승인된 옆 휘두르기 동작은 그대로 두고,
// 맞는 자리만 바위의 아랫면(벽면 포함)·윗면으로 잡는다. 옆 바위는 기존 miningContact가 먼저다.
function verticalContact(n,cell,left,top){
 if(n.x<left+6||n.x>left+TILE-6)return null;
 const above=n.y>top+TILE+RISE,below=n.y<top;if(!above&&!below)return null;
 const face=n.x<=left+TILE/2?1:-1;
 return{face,contact:{x:n.x+face*6,y:above?top+TILE+RISE-4:top+4}};
}
export function navigation(s){
 let graph=cache.get(s);if(graph?.revision===s.navRevision)return graph;
 const nodes=[],byPosition=new Map();
 for(let y=20;y<=770;y+=STEP)for(let x=20;x<=430;x+=STEP)if(floorIsClear(s,x,y,BODY_RADIUS)){
  const n={id:nodes.length,x,y,edges:[],jobs:[]};nodes.push(n);byPosition.set(`${x},${y}`,n);
 }
 for(const n of nodes){
  for(const [dx,dy]of [[10,0],[-10,0],[0,10],[0,-10],[10,10],[10,-10],[-10,10],[-10,-10]]){
   const next=byPosition.get(`${n.x+dx},${n.y+dy}`);if(next&&clearSegment(s,n,next))n.edges.push(next.id);
  }
  for(const cell of s.cells){if(!isMineable(cell))continue;
   const left=ORIGIN+cell.x*TILE,top=ORIGIN+cell.y*TILE;
   const x=Math.max(left,Math.min(left+TILE,n.x)),y=Math.max(top,Math.min(top+TILE+RISE,n.y));
   const distance=Math.hypot(x-n.x,y-n.y);
   if(distance>=BODY_RADIUS+4&&distance<=MAX_MINING_DISTANCE&&clearSegment(s,n,{x:x+(n.x-x)*5/distance,y:y+(n.y-y)*5/distance},0)){
    const match=miningContact(n,cell)??verticalContact(n,cell,left,top);if(match)n.jobs.push({work:cell.id,...match});
   }
  }
 }
 graph={nodes,revision:s.navRevision};cache.set(s,graph);return graph;
}
function trafficSegment(s,h,a,b,ignoreIds=null){
 const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
 return s.crew.every(o=>{if(canPassWorker(h,o)||ignoreIds?.has(o.id))return true;const t=length?Math.max(0,Math.min(1,((o.x-a.x)*dx+(o.y-a.y)*dy)/length)):0;return Math.hypot(o.x-a.x-dx*t,o.y-a.y-dy*t)>=BODY_GAP-.001;});
}
export function nearestNode(s,p,traffic=false,ignoreIds=null){
 let best=null,score=Infinity;for(const n of navigation(s).nodes){const d=Math.hypot(n.x-p.x,n.y-p.y);if(d<score&&clearSegment(s,p,n)&&(!traffic||trafficSegment(s,p,p,n,ignoreIds))){best=n;score=d;}}return best;
}
export function bodyClear(s,h,x,y){return floorIsClear(s,x,y,BODY_RADIUS)&&s.crew.every(other=>canPassWorker(h,other)||Math.hypot(other.x-x,other.y-y)>=BODY_GAP-.001);}
export function routesFrom(s,h,{traffic=true,ignoreIds=null}={}){
 const graph=navigation(s),start=nearestNode(s,h,traffic,ignoreIds),prev=new Map(),distance=new Map();if(!start)return{graph,prev,distance};
 const blocked=new Set();if(traffic)for(const n of graph.nodes)if(s.crew.some(o=>!canPassWorker(h,o)&&!ignoreIds?.has(o.id)&&Math.hypot(o.x-n.x,o.y-n.y)<BODY_GAP))blocked.add(n.id);
 const queue=[start.id];distance.set(start.id,0);
 for(let i=0;i<queue.length;i++){const id=queue[i];for(const next of graph.nodes[id].edges){if(distance.has(next)||blocked.has(next)||traffic&&!trafficSegment(s,h,graph.nodes[id],graph.nodes[next],ignoreIds))continue;distance.set(next,distance.get(id)+1);prev.set(next,id);queue.push(next);}}
 return{graph,prev,distance};
}
export function routeFrom(tree,id){
 if(!tree.distance.has(id))return null;const out=[tree.graph.nodes[id]];while(tree.prev.has(id)){id=tree.prev.get(id);out.unshift(tree.graph.nodes[id]);}return out.map(n=>({x:n.x,y:n.y}));
}
export function setDestination(h,node,tree){h.goal={x:node.x,y:node.y};h.route=routeFrom(tree,node.id)??[];h.repathAt=0;h.stuck=0;}
function routeTo(s,h,target,traffic=true){
 const tree=routesFrom(s,h,{traffic});let best=null,score=Infinity;
 for(const n of tree.graph.nodes){if(!tree.distance.has(n.id))continue;const d=Math.hypot(n.x-target.x,n.y-target.y);if(d<score){best=n;score=d;}}
 if(!best)return null;
 if(traffic&&score>1){
  // Approach the obstruction along the actual corridor. Euclidean proximity
  // alone can strand a worker at the far end of a U-shaped passage.
  const staticTree=routesFrom(s,h,{traffic:false});let goal=null,nearest=Infinity;
  for(const n of staticTree.graph.nodes){const d=Math.hypot(n.x-target.x,n.y-target.y);if(staticTree.distance.has(n.id)&&d<nearest){goal=n;nearest=d;}}
  if(goal){let id=goal.id;while(!tree.distance.has(id)&&staticTree.prev.has(id))id=staticTree.prev.get(id);if(tree.distance.has(id))best=tree.graph.nodes[id];}
 }
 return routeFrom(tree,best.id);
}
function yieldSpace(s,h){
 if(s.time<(h.yieldRetryAt??0))return;h.yieldRetryAt=s.time+.4;
 const ancestors=new Set([h.id]);let parent=h;
 while(parent.yieldFor!=null&&!ancestors.has(parent.yieldFor)){ancestors.add(parent.yieldFor);parent=s.crew.find(o=>o.id===parent.yieldFor);if(!parent)break;}
 const target=h.yieldGoal??h.goal,intended=routeTo(s,h,target,false)??[target];
 const blockers=s.crew.filter(o=>!ancestors.has(o.id)&&!canPassWorker(h,o)&&!o.care&&intended.some(p=>Math.hypot(o.x-p.x,o.y-p.y)<BODY_GAP+6)&&!o.action&&(!o.yieldGoal||o.yieldArrived)&&s.time>=(o.yieldCooldown??0)).sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y));
 for(const other of blockers){
  // Carrying has priority, then a stable id. Stationary workers can always
  // step aside; their mining clock and ownership are retained while yielding.
  if(!h.yieldGoal&&other.goal&&((!!other.cargo&&!h.cargo)||(!!other.cargo===!!h.cargo&&other.id<h.id)))continue;
  let tree,best=null,score=Infinity;
  for(const allowChain of [false,true]){
   const ignoreIds=allowChain?new Set(s.crew.filter(o=>!ancestors.has(o.id)).map(o=>o.id)):null;
   tree=routesFrom(s,other,{ignoreIds});
   for(const n of tree.graph.nodes){if(!tree.distance.has(n.id))continue;
    const d=Math.hypot(n.x-other.x,n.y-other.y);if(d<BODY_GAP||d>260)continue;
    if(intended.slice(0,20).some(p=>Math.hypot(n.x-p.x,n.y-p.y)<BODY_GAP+7))continue;
    const cost=tree.distance.get(n.id)+d*.01;if(cost<score){best=n;score=cost;}
   }
   if(best)break;
  }
  if(best){other.yieldGoal={x:best.x,y:best.y};other.yieldRoute=routeFrom(tree,best.id);other.yieldFor=h.id;other.yieldOrigin={x:other.x,y:other.y};other.yieldParentStart={x:h.x,y:h.y};other.yieldParentGoal={...(h.yieldGoal??h.goal)};other.yieldArrived=false;other.yieldCooldown=s.time+3;return;}
 }
 // At a dead end the loaded worker may have to back out first, even though
 // it normally has priority. Never push a trapped neighbour through a wall.
 if(!h.yieldGoal&&h.stuck>1.5){
  for(const other of blockers){if(!other.goal||other.yieldGoal)continue;
   const wanted=routeTo(s,other,other.goal,false)??[other.goal],tree=routesFrom(s,h);let best=null,score=Infinity;
   for(const n of tree.graph.nodes){if(!tree.distance.has(n.id)||Math.hypot(n.x-h.x,n.y-h.y)<BODY_GAP)continue;
    if(wanted.slice(0,20).some(p=>Math.hypot(n.x-p.x,n.y-p.y)<BODY_GAP+7))continue;
    const cost=tree.distance.get(n.id);if(cost<score){best=n;score=cost;}
   }
   if(best){h.yieldGoal={x:best.x,y:best.y};h.yieldRoute=routeFrom(tree,best.id);h.yieldFor=other.id;h.yieldOrigin={x:h.x,y:h.y};h.yieldParentStart={x:other.x,y:other.y};h.yieldParentGoal={...(other.yieldGoal??other.goal)};h.yieldArrived=false;h.yieldCooldown=s.time+3;return;}
  }
 }
}
export function moveWorker(s,h,dt){
 // A passing worker may finish its trip before the helper reaches its
 // sidestep. Release that obsolete detour immediately, even if it is blocked.
 if(h.yieldGoal){
  const parent=s.crew.find(o=>o.id===h.yieldFor);
  const target=parent?.yieldGoal??parent?.goal,changed=target&&h.yieldParentGoal&&Math.hypot(target.x-h.yieldParentGoal.x,target.y-h.yieldParentGoal.y)>1;
  const passed=parent&&Math.hypot(parent.x-h.yieldParentStart.x,parent.y-h.yieldParentStart.y)>BODY_GAP&&Math.hypot(parent.x-h.yieldOrigin.x,parent.y-h.yieldOrigin.y)>BODY_GAP+6;
  if(!parent||(parent.yieldGoal?parent.yieldArrived:!parent.goal)||changed||passed||h.stuck>2){h.yieldGoal=null;h.yieldFor=null;h.yieldRoute=[];h.route=[];h.repathAt=0;h.stuck=0;h.yieldCooldown=s.time+1;}
 }
 // A neighbour stepping aside does not own this worker's movement. If a
 // different route opens, continue through it; swept body checks below still
 // prevent contact. Waiting for the whole yield chain can create a cycle.
 const yielding=!!h.yieldGoal,target=h.yieldGoal??h.goal;if(!target)return true;
 let route=yielding?h.yieldRoute:h.route;
 if((!route?.length||h.stuck>.3)&&s.time>=h.repathAt){const fresh=routeTo(s,h,target);if(fresh){route=fresh;if(yielding)h.yieldRoute=fresh;else h.route=fresh;}h.repathAt=s.time+.55;}
 while(route?.length&&Math.hypot(route[0].x-h.x,route[0].y-h.y)<.1)route.shift();
 const next=route?.[0];if(!next){
  if(Math.hypot(target.x-h.x,target.y-h.y)<1){
   if(yielding){
    h.yieldArrived=true;h.clip=h.cargo?'carry':'idle';h.motion+=dt;
    const parent=s.crew.find(o=>o.id===h.yieldFor);
    const passed=parent&&Math.hypot(parent.x-h.yieldParentStart.x,parent.y-h.yieldParentStart.y)>BODY_GAP&&Math.hypot(parent.x-h.yieldOrigin.x,parent.y-h.yieldOrigin.y)>BODY_GAP+6;
    if(!parent||(parent.yieldGoal?parent.yieldArrived:!parent.goal)||passed){h.yieldGoal=null;h.yieldFor=null;h.route=[];}
    return false;
   }
   h.goal=null;return true;
  }
  h.stuck+=dt;if(h.stuck>.7)yieldSpace(s,h);h.clip=h.cargo?'carry':'idle';return false;
 }
 // 물길 위에서는 느리게 걷는다(동굴 맵 방해 요소)
 const wade=inWater(s,h.x,h.y)?Math.min(1,WATER.walk+(s.mods?.wade??0)):1;   // 물길 걷기(마스터리 wade)
 const dx=next.x-h.x,dy=next.y-h.y,d=Math.hypot(dx,dy),step=Math.min(d,h.speed*(h.cargo?.77:1)*wade*dt),x=h.x+dx/d*step,y=h.y+dy/d*step;
 if(bodyClear(s,h,x,y)&&clearSegment(s,h,{x,y})&&trafficSegment(s,h,h,{x,y})){
  h.x=x;h.y=y;h.stuck=0;h.clip=h.cargo?'carry':'walk';h.motion+=dt*h.gait;if(Math.abs(dx)>.1)h.face=dx>0?1:-1;
 }else{h.stuck+=dt;h.clip=h.cargo?'carry':'idle';h.motion+=dt*.25;if(h.stuck>.7)yieldSpace(s,h);}
 return false;
}
