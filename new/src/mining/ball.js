import {ballWorldContact} from './terrain-collision.js';
export const BALL={radius:18,grabRadius:36,maxPull:105,power:5.6,drag:1.35,bounce:.68,wallBounce:.42,stop:9};
export const ballSpeed=b=>Math.hypot(b.vx??0,b.vy??0);
export function beginAim(s,p){
 if(s.phase!=='mining'||s.aim||Math.hypot(p.x-s.ball.x,p.y-s.ball.y)>BALL.grabRadius)return false;
 if(ballSpeed(s.ball)){s.ball.vx=s.ball.vy=0;s.ball.contacts=[];s.navRevision++;}
 // Drag displacement starts at the finger, so grabbing the generous hit area
 // off-centre does not fire a shot before the player has actually pulled.
 s.aim={what:'ball',x:s.ball.x,y:s.ball.y,pointerX:p.x,pointerY:p.y,dx:0,dy:0};return true;
}
// 햄찌·수레 조준(fling.js)도 같은 당김 계산을 쓴다. maxPull만 다르다.
export function moveAim(s,p){
 if(!s.aim)return;const dx=s.aim.pointerX-p.x,dy=s.aim.pointerY-p.y,k=Math.min(1,(s.aim.maxPull??BALL.maxPull)/(Math.hypot(dx,dy)||1));
 s.aim.dx=dx*k;s.aim.dy=dy*k;
}
export function cancelAim(s){s.aim=null;}
export function launchBall(s){
 const a=s.aim;if(a&&a.what&&a.what!=='ball')return false;s.aim=null;if(!a||s.phase!=='mining'||Math.hypot(a.dx,a.dy)<6)return false;
 s.ball.vx=a.dx*BALL.power;s.ball.vy=a.dy*BALL.power;s.ball.contacts=[];s.navRevision++;return true;
}
export function holeContains(s,b){
 const p=s.holeAt;return s.hole!==null&&p&&Math.hypot(b.x-p.x,b.y-p.y)<18;
}
// Same substeps for the aiming guide and live motion. Prediction never changes
// workers, seeds, terrain or rewards; it only returns contact information.
function contactAt(s,x,y,r){
 let contact=ballWorldContact(s,x,y,r);
 for(const h of s.crew){
  const dx=x-h.x,dy=y-h.y,d=Math.hypot(dx,dy),gap=r+20;
  if(d>=gap)continue;
  if(!contact||gap-d>contact.penetration)contact={nx:dx/(d||1),ny:dy/(d||1),penetration:gap-d,type:'hamster',worker:h.id};
 }
 return contact;
}
const travel=dt=>-Math.expm1(-BALL.drag*dt)/BALL.drag;
function stepBall(s,b,dt){
 const old={x:b.x,y:b.y},hits=[];let remaining=dt;
 for(let collision=0;collision<4&&remaining>1e-8;collision++){
  const factor=travel(remaining),x=b.x+b.vx*factor,y=b.y+b.vy*factor;
  let contact=contactAt(s,x,y,b.radius);
  if(!contact){b.x=x;b.y=y;const decay=Math.exp(-BALL.drag*remaining);b.vx*=decay;b.vy*=decay;remaining=0;break;}
  // Locate contact along the full movement vector, then reflect about the
  // actual curved surface normal. X/Y reversal creates invisible box corners.
  let lo=0,hi=remaining;
  for(let i=0;i<12;i++){
   const mid=(lo+hi)/2,k=travel(mid),at=contactAt(s,b.x+b.vx*k,b.y+b.vy*k,b.radius);
   if(at){hi=mid;contact=at;}else lo=mid;
  }
  const k=travel(lo);b.x+=b.vx*k;b.y+=b.vy*k;
  const decay=Math.exp(-BALL.drag*lo);b.vx*=decay;b.vy*=decay;remaining-=lo;
  const dot=b.vx*contact.nx+b.vy*contact.ny;
  if(dot>=0||!Number.isFinite(dot)){b.vx=b.vy=0;break;}
  const bounce=contact.type==='terrain'||contact.type==='boundary'?BALL.wallBounce:BALL.bounce;
  b.vx-=(1+bounce)*dot*contact.nx;b.vy-=(1+bounce)*dot*contact.ny;
  if(contact.type==='hamster')hits.push(contact.worker);
  const px=b.x+contact.nx*.02,py=b.y+contact.ny*.02;
  if(!contactAt(s,px,py,b.radius)){b.x=px;b.y=py;}
  remaining=Math.max(0,remaining-1e-6);
 }
 b.angle+=(b.x-old.x)/b.radius+(b.y-old.y)/b.radius*.35;
 if(ballSpeed(b)<BALL.stop)b.vx=b.vy=0;
 return hits;
}
export function updateBall(s,dt,onHit,onHole){
 const b=s.ball;if(!ballSpeed(b))return;
 let remaining=dt;
 while(remaining>1e-8){
  const step=Math.min(1/120,remaining);remaining-=step;
  const hits=stepBall(s,b,step);
  b.contacts=b.contacts.filter(id=>{const h=s.crew.find(h=>h.id===id);return h&&Math.hypot(h.x-b.x,h.y-b.y)<b.radius+23;});
  for(const hit of hits)if(!b.contacts.includes(hit)){b.contacts.push(hit);onHit(s.crew.find(h=>h.id===hit));}
  if(holeContains(s,b)){b.vx=b.vy=0;onHole();return;}
 }
 if(!ballSpeed(b)){s.navRevision++;b.contacts=[];}
}
export function predictBall(s){
 if(!s.aim||s.aim.what&&s.aim.what!=='ball')return[];const b={...s.ball,vx:s.aim.dx*BALL.power,vy:s.aim.dy*BALL.power},points=[{x:b.x,y:b.y}];
 if(ballSpeed(b)<BALL.stop)return points;
 for(let i=0;i<180;i++){
  const hits=stepBall(s,b,1/120);
  if(i%8===0)points.push({x:b.x,y:b.y});
  if(hits.length||holeContains(s,b)||!ballSpeed(b)){points.push({x:b.x,y:b.y,target:hits.length?'hamster':holeContains(s,b)?'hole':null});break;}
 }
 return points;
}
