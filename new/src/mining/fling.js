// 공처럼 당겼다 놓아 햄찌·수레를 날린다(검토용 값).
// 햄찌: 날아가다 바위에 부딪히면 한 번 쾅 치고 그 바위를 캔다. 바위가 아니면 내려앉은 자리 주변 바위를 캔다.
// 수레: 바닥을 미끄러지다 벽·햄찌·공에 튕기고 멈춘다. 멈추면 짐을 든 햄찌들이 새 자리로 길을 다시 찾는다.
import {ORIGIN,TILE,RISE,center,isMineable} from './grid.js';
import {ballWorldContact,terrainContact} from './terrain-collision.js';
import {navigation,bodyClear,clearSegment} from './navigation.js';
import {WATER,inWater} from './map-layouts.js';
export const FLING={
 hamster:{grab:27,maxPull:105,power:4.6,drag:1.7,radius:15,stop:30,speed:430,minTime:.3,maxTime:.75,arc:.24,maxArc:72,land:.18},
 cart:{grab:40,maxPull:95,power:4.4,drag:2.4,bounce:.38,stop:10}
};
export const canFling=h=>!h.sleeping&&!h.care&&!h.pendingStartle&&!h.action&&!h.cargo&&!h.fling&&h.blastTime==null&&!h.bomb;
const speed=o=>Math.hypot(o.vx??0,o.vy??0);
const travel=(drag,dt)=>-Math.expm1(-drag*dt)/drag;
// 손가락 아래 햄찌(가까운 순) 또는 수레를 잡는다. 공은 game-world에서 먼저 따진다.
export function grabTarget(s,p){
 const h=s.crew.map(h=>({h,d:Math.hypot(h.x-p.x,h.y-p.y)})).filter(o=>o.d<FLING.hamster.grab).sort((a,b)=>a.d-b.d)[0];
 if(h)return{what:'hamster',h:h.h,d:h.d};
 const d=Math.hypot(s.cart.x-p.x,s.cart.y-p.y);
 return d<FLING.cart.grab?{what:'cart',d}:null;
}
export function beginFling(s,p,target){
 if(s.phase!=='mining'||s.aim||!target)return false;
 if(target.what==='hamster'){if(!canFling(target.h))return false;s.aim={what:'hamster',id:target.h.id,x:target.h.x,y:target.h.y,pointerX:p.x,pointerY:p.y,dx:0,dy:0,maxPull:FLING.hamster.maxPull};return true;}
 s.cart.vx=s.cart.vy=0;s.aim={what:'cart',x:s.cart.x,y:s.cart.y,pointerX:p.x,pointerY:p.y,dx:0,dy:0,maxPull:FLING.cart.maxPull};return true;
}
// 'tap'(거의 안 당김) · true(날림) · false
export function launchFling(s){
 const a=s.aim;s.aim=null;if(!a||s.phase!=='mining')return false;
 if(Math.hypot(a.dx,a.dy)<6)return 'tap';
 if(a.what==='cart'){const p=power(s,'cart');s.cart.vx=a.dx*p;s.cart.vy=a.dy*p;s.cart.rammed=[];s.navRevision++;return true;}
 const h=s.crew.find(o=>o.id===a.id);if(!h||!canFling(h))return false;
 // 연속 던지기(마스터리 combo): 3초 안에 다시 던지면 더 빨리 날아간다
 const quick=s.time-(s.lastFlingAt??-9)<3?1+(s.mods?.combo??0):1;
 const p=power(s,'hamster');if(!startFlight(s,h,a.dx*p,a.dy*p,{bounce:s.mods?.bounce??0,pierce:s.mods?.pierce??0,quick}))return false;
 s.lastFlingAt=s.time;h.work=null;h.stand=null;h.goal=null;h.route=[];h.yieldGoal=null;h.yieldFor=null;h.order=null;h.wait=0;h.recover=0;h.foodTarget=null;
 h.face=a.dx>=0?1:-1;s.events.push({type:'fling',time:s.time,x:h.x,y:h.y,worker:h.id});
 return true;
}
// 던지는 힘: 던지기 거리·수레 던지기 거리(마스터리)만큼 세진다(감속이 같아 거리도 같은 비율로 는다)
const power=(s,what)=>what==='cart'?FLING.cart.power*(1+(s.mods?.cartRange??0)):FLING.hamster.power*(1+(s.mods?.throwRange??0));
// 한 번의 비행(튕김·관통이면 착지 때 이어서 한 번 더). chain: 남은 튕김·관통 횟수와 연속 던지기 배율.
function startFlight(s,h,vx,vy,chain){
 const plan=planFlight(s,h,vx,vy),node=plan&&landingNode(s,h,plan.end);if(!node)return false;
 const path=[...plan.points,{x:node.x,y:node.y}];let length=0;for(let i=1;i<path.length;i++)length+=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);
 const F=FLING.hamster;
 h.fling={path,length,time:0,duration:Math.max(F.minTime*.6,Math.min(F.maxTime,length/F.speed)/chain.quick),height:Math.min(F.maxArc,length*F.arc),cell:plan.cell,contact:plan.contact,
  vEnd:plan.vel,normal:plan.normal,chain,dir:vx>=0?1:-1,landing:0};
 return true;
}
// 벽 안쪽의 한 점이 속한 캘 수 있는 바위(벽면은 칸 아래로 RISE만큼 내려와 보인다)
function wallCell(s,x,y){
 let best=null,score=Infinity;
 for(const c of s.cells){if(!isMineable(c))continue;
  const left=ORIGIN+c.x*TILE,top=ORIGIN+c.y*TILE,dx=x-Math.max(left,Math.min(left+TILE,x)),dy=y-Math.max(top,Math.min(top+TILE+RISE,y)),d=Math.hypot(dx,dy);
  if(d<score&&d<14){score=d;best=c.id;}
 }
 return best;
}
// 공과 같은 감속으로 날아간다. 부딪히면 튕기지 않고 그 자리에서 멈춘다.
export function planFlight(s,h,vx,vy){
 const F=FLING.hamster,b={x:h.x,y:h.y,vx,vy},points=[{x:h.x,y:h.y}];let hit=null;
 if(speed(b)<F.stop)return null;
 for(let i=0;i<480;i++){
  const dt=1/120,k=travel(F.drag,dt),x=b.x+b.vx*k,y=b.y+b.vy*k,contact=ballWorldContact(s,x,y,F.radius);
  // 이미 벽에 붙어 서 있다가 벽 반대쪽으로 날리면 막히지 않는다
  if(contact&&(contact.nx*b.vx+contact.ny*b.vy<0||!contact.nx&&!contact.ny)){hit=contact;break;}
  b.x=x;b.y=y;const decay=Math.exp(-F.drag*dt);b.vx*=decay;b.vy*=decay;
  if(i%5===4)points.push({x,y});
  if(speed(b)<F.stop)break;
 }
 points.push({x:b.x,y:b.y});
 let cell=null,contact=null,normal=null;
 if(hit?.type==='terrain'){
  const inside=!hit.nx&&!hit.ny,nx=inside?-b.vx/(speed(b)||1):hit.nx,ny=inside?-b.vy/(speed(b)||1):hit.ny;
  for(const depth of [8,16,24]){cell=wallCell(s,b.x-nx*(F.radius+depth),b.y-ny*(F.radius+depth));if(cell!=null)break;}
  contact={x:b.x-nx*F.radius,y:b.y-ny*F.radius};normal={nx,ny};
 }
 return{points,end:{x:b.x,y:b.y},cell,contact,normal,vel:{vx:b.vx,vy:b.vy},hit:hit?.type??null};
}
// 내려앉을 실제 바닥(길찾기 점). 다른 햄찌 몸과 겹치지 않는 가장 가까운 곳.
function landingNode(s,h,p){
 let best=null,score=Infinity;
 for(const strict of [true,false]){
  for(const n of navigation(s).nodes){const d=Math.hypot(n.x-p.x,n.y-p.y);if(d>=score||d>110)continue;
   if(!bodyClear(s,h,n.x,n.y)||strict&&!clearSegment(s,p,n,0))continue;best=n;score=d;}
  if(best)return best;
 }
 return null;
}
// 날아가는 중이면 true. 착지하면 바위를 한 번 치고(맞았을 때) 그 바위를 캐라는 주문을 남긴다.
export function updateFlight(s,h,dt,strike){
 const f=h.fling;if(!f)return false;
 if(f.landing>0){f.landing-=dt;h.clip='idle';h.motion+=dt;if(f.landing<=0)h.fling=null;return true;}
 f.time+=dt;const k=Math.min(1,f.time/f.duration),along=(1-(1-k)**1.6)*f.length;
 let left=along;for(let i=1;i<f.path.length;i++){const a=f.path[i-1],b=f.path[i],d=Math.hypot(b.x-a.x,b.y-a.y);if(left<=d||i===f.path.length-1){const t=d?Math.min(1,left/d):1;h.x=a.x+(b.x-a.x)*t;h.y=a.y+(b.y-a.y)*t;break;}left-=d;}
 f.z=4*f.height*k*(1-k);h.clip='idle';h.motion+=dt;
 if(k<1)return true;
 f.z=0;f.landing=FLING.hamster.land;s.events.push({type:'land',time:s.time,x:h.x,y:h.y+14,worker:h.id});
 const chain=f.chain??{bounce:0,pierce:0,quick:1};
 if(f.cell!=null&&isMineable(s.cells[f.cell])){
  const[cx,cy]=center(f.cell);h.anchor={x:cx,y:cy};
  // 쾅! 부딪힌 힘으로 한 번 친다(부딪힘 피해 마스터리만큼 세게)
  h.contact=f.contact;const p=h.power;h.power=(p??1)*(1+(s.mods?.impact??0));strike(s,f.cell,h);h.power=p;
  const broke=!isMineable(s.cells[f.cell]),v=f.vEnd??{vx:0,vy:0};
  // 관통: 깨뜨리면 같은 방향으로 계속 날아간다
  if(broke&&chain.pierce>0&&speed(v)>FLING.hamster.stop&&startFlight(s,h,v.vx*.8,v.vy*.8,{...chain,pierce:chain.pierce-1}))return true;
  // 튕김: 벽에서 튕겨 나와 다른 바위로 한 번 더
  if(chain.bounce>0&&f.normal){const n=f.normal,dot=v.vx*n.nx+v.vy*n.ny,rv={vx:(v.vx-2*dot*n.nx)*.65,vy:(v.vy-2*dot*n.ny)*.65};
   if(speed(rv)>FLING.hamster.stop*1.5&&startFlight(s,h,rv.vx,rv.vy,{...chain,bounce:chain.bounce-1}))return true;}
  h.order=broke?null:f.cell;
 }else h.anchor={x:h.x,y:h.y};
 landingShock(s,h,strike);summonShadow(s,h);
 return true;
}
// 착지 충격(마스터리 landShock): 내려앉은 자리 주변 바위에 작은 피해
function landingShock(s,h,strike){
 const k=s.mods?.landShock;if(!k)return;
 s.events.push({type:'shock',time:s.time,x:h.x,y:h.y});
 for(const c of s.cells){if(!isMineable(c))continue;const[x,y]=center(c.id);if(Math.hypot(x-h.x,y-h.y)<78)strike(s,c.id,{id:null,power:(h.power??1)*k,contact:{x:(x+h.x)/2,y:(y+h.y)/2}});}
}
// 그림자 햄찌(마스터리 shadow): 내려앉은 자리 옆 바위를 잠깐 함께 캐는 반투명 햄찌(동시에 최대 3)
function summonShadow(s,h){
 const t=s.mods?.shadow;if(!t||(s.shadows??=[]).length>=3)return;
 const target=s.cells.filter(isMineable).map(c=>({c,d:Math.hypot(center(c.id)[0]-h.x,center(c.id)[1]-h.y)})).sort((a,b)=>a.d-b.d)[0];
 if(!target||target.d>90)return;
 s.shadows.push({x:h.x+(h.face??1)*-14,y:h.y+6,cell:target.c.id,until:s.time+t,next:s.time+.4,power:(h.power??1)*.6,face:h.face??1});
}
// 수레 미끄러짐: 벽·화면 끝은 약하게, 햄찌·공에는 튕긴다.
function cartContact(s,x,y,r){
 const bounds=[{gap:x-r,nx:1,ny:0},{gap:450-x-r,nx:-1,ny:0},{gap:y-r,nx:0,ny:1},{gap:800-y-r,nx:0,ny:-1}].find(b=>b.gap<0);
 if(bounds)return{nx:bounds.nx,ny:bounds.ny,type:'boundary'};
 const wall=terrainContact(s,x,y,r);if(wall)return wall;
 for(const o of [...s.crew.map(h=>({x:h.x,y:h.y,r:18})),{x:s.ball.x,y:s.ball.y,r:s.ball.radius}]){
  const dx=x-o.x,dy=y-o.y,d=Math.hypot(dx,dy);if(d<r+o.r)return{nx:dx/(d||1),ny:dy/(d||1),type:'body'};
 }
 return null;
}
function stepCart(s,c,dt,onWall=null){
 const C=FLING.cart,k=travel(C.drag+(inWater(s,c.x,c.y)?WATER.drag:0),dt),x=c.x+c.vx*k,y=c.y+c.vy*k,hit=cartContact(s,x,y,c.radius-6);
 const decay=Math.exp(-(C.drag+(inWater(s,c.x,c.y)?WATER.drag:0))*dt);
 // 이미 맞닿아 있어도 떨어지는 쪽으로는 움직인다
 if(hit&&c.vx*hit.nx+c.vy*hit.ny<0){const dot=c.vx*hit.nx+c.vy*hit.ny;if(onWall&&hit.type==='terrain')onWall(hit,-dot);c.vx-=(1+C.bounce)*dot*hit.nx;c.vy-=(1+C.bounce)*dot*hit.ny;c.vx*=decay;c.vy*=decay;return hit;}
 c.x=x;c.y=y;c.vx*=decay;c.vy*=decay;c.tilt=(c.tilt??0)*.9+Math.max(-.16,Math.min(.16,c.vx/1100));
 return null;
}
export function updateCart(s,dt,strike=null){
 const c=s.cart;if(!speed(c))return;
 // 수레 박치기(마스터리 cartRam): 세게 부딪힌 바위를 한 번 친다(던질 때마다 바위 하나에 한 번)
 const ram=s.mods?.cartRam&&strike?(hit,v)=>{if(v<120||!(hit.nx||hit.ny))return;const cell=wallCell(s,hit.x-hit.nx*10,hit.y-hit.ny*10);if(cell==null||(c.rammed??=[]).includes(cell))return;
  c.rammed.push(cell);strike(s,cell,{id:null,power:(s.crew[0]?.power??1)*s.mods.cartRam,contact:{x:hit.x,y:hit.y}});}:null;
 for(let left=dt;left>1e-8;){const step=Math.min(1/120,left);left-=step;stepCart(s,c,step,ram);}
 if(speed(c)<FLING.cart.stop){
  c.vx=c.vy=0;c.tilt=0;s.navRevision++;
  for(const h of s.crew)if(h.cargo&&!h.action){h.goal=null;h.route=[];}   // 새 자리로 다시 찾아간다
 }
}
// 조준선: 공과 같은 모양으로 그린다. 햄찌는 맞을 바위(target)도 돌려준다.
export function predictFling(s){
 const a=s.aim;if(!a||a.what==='ball'||!a.what)return null;
 if(a.what==='hamster'){
  const h=s.crew.find(o=>o.id===a.id);if(!h)return null;
  const p=power(s,'hamster'),plan=planFlight(s,h,a.dx*p,a.dy*p);if(!plan)return{points:[{x:h.x,y:h.y}],cell:null};
  return{points:plan.points,cell:plan.cell!=null&&isMineable(s.cells[plan.cell])?plan.cell:null};
 }
 const cp=power(s,'cart'),c={...s.cart,vx:a.dx*cp,vy:a.dy*cp},points=[{x:c.x,y:c.y}];
 for(let i=0;i<360&&speed(c)>=FLING.cart.stop;i++){stepCart(s,c,1/120);if(i%8===0)points.push({x:c.x,y:c.y});}
 points.push({x:c.x,y:c.y});return{points,cell:null};
}
