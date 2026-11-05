import {center,isMineable} from './grid.js';

// 남은 체력 × 10. 실제 타격을 받은 바위만 작은 말풍선으로 알려 준다.
// 화면용 기록은 저장 데이터 밖에 둬서 채굴·재접속·층 이동 규칙에 영향을 주지 않는다.
const views=new WeakMap();
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const t=clamp(n);return t*t*(3-2*t);};
const ENTER=[
 [0,.34,.18,6,-.07],[.055,.86,.48,3,-.035],[.15,.88,1.24,-3,.045],
 [.25,1.12,.91,.5,-.025],[.39,.98,1.04,-.6,.008],[.55,1,1,0,0]
];
const TAP=[
 [0,1,1,0,0],[.045,1.12,.82,2,-.035],[.13,.91,1.18,-2.5,.025],
 [.24,1.06,.95,.5,-.015],[.39,1,1,0,0]
];
function poseAt(frames,age){
 const end=frames.at(-1);if(age>=end[0])return end.slice(1);
 for(let i=1;i<frames.length;i++)if(age<frames[i][0]){
  const a=frames[i-1],b=frames[i],t=smooth((age-a[0])/(b[0]-a[0]));
  return a.slice(1).map((v,k)=>v+(b[k+1]-v)*t);
 }
 return frames[0].slice(1);
}
export function rockHpBubbles(s,{reducedMotion=false}={}){
 let view=views.get(s);
 if(!view||view.cells!==s.cells||s.time<view.time){view={cells:s.cells,time:s.time,bubbles:new Map(),seen:new WeakSet()};views.set(s,view);}
 view.time=s.time;
 if(s.phase!=='mining'){view.bubbles.clear();return [];}
 const active=new Set();
 for(const h of s.crew??[])if(h.work!=null&&!h.goal&&!h.cargo&&!h.action&&!h.care&&!h.fling&&
  (!h.sleeping||h.clip==='pajamas')&&['mine','drill','bomb','pajamas'].includes(h.clip)&&
  !(s.aim?.what==='hamster'&&s.aim.id===h.id))active.add(h.work);
 for(const g of s.shadows??[])if(g.until>s.time)active.add(g.cell);
 for(const e of s.events??[]){
  if(e.type!=='hit'||e.time>s.time||s.time-e.time>.8||view.seen.has(e))continue;
  view.seen.add(e);if(!isMineable(s.cells[e.id]))continue;
  let b=view.bubbles.get(e.id);
  if(!b){b={born:e.time,hitAt:e.time,leaveAt:null};view.bubbles.set(e.id,b);}
  if(e.time>b.hitAt){b.hitAt=e.time;b.leaveAt=null;}
 }
 // 저장된 탐사에 재접속했을 때도 지금 캐는 손상된 바위만 복구한다.
 for(const id of active){const cell=s.cells[id];if(isMineable(cell)&&cell.hp<cell.maxHp&&!view.bubbles.has(id))
  view.bubbles.set(id,{born:s.time,hitAt:-Infinity,leaveAt:null});}
 const out=[];
 for(const [id,b] of view.bubbles){
  const cell=s.cells[id];
  if(!isMineable(cell)){view.bubbles.delete(id);continue;}
  if(active.has(id))b.leaveAt=null;
  else if(b.leaveAt==null)b.leaveAt=Math.max(s.time,b.born+.45,b.hitAt+.3);
  const leave=b.leaveAt==null?0:smooth((s.time-b.leaveAt)/.2);
  if(leave>=1){view.bubbles.delete(id);continue;}
  const age=Math.max(0,s.time-b.born),hitAge=s.time-b.hitAt;
  const [sx,sy,dy,angle]=reducedMotion?[1,1,0,0]:poseAt(age<.55?ENTER:TAP,age<.55?age:hitAge);
  const [cx,cy]=center(id),x=cx+(cell.hole?24:0),y=cy+(cell.hole?18:0);
  out.push({id,value:String(Math.ceil(cell.hp*10-1e-6)),x,y,
   sx:reducedMotion?1:sx*(1-leave*.16),sy:reducedMotion?1:sy*(1-leave*.28),dy:reducedMotion?0:dy+leave*3,angle,
   alpha:smooth(age/.06)*(1-leave),numberAlpha:reducedMotion?1:smooth((age-.045)/.065),
   numberLift:reducedMotion?0:2*(1-smooth((age-.045)/.12))});
 }
 return out;
}
// 기존 햄찌 말풍선의 크림·갈색을 그대로 사용한다. 둥근 꼬리와 얇은
// 아래쪽 음영만 넣어 작은 크기에서도 바위·햄찌보다 먼저 눈에 띄지 않게 한다.
function bubblePath(c){
 c.beginPath();c.moveTo(-8,-25);
 c.bezierCurveTo(-15,-25,-18,-21,-18,-14);
 c.bezierCurveTo(-18,-6,-15,-3,-8,-3);
 c.lineTo(-3,-3);c.quadraticCurveTo(-2,0,-5,3);
 c.quadraticCurveTo(2,2,5,-3);c.lineTo(8,-3);
 c.bezierCurveTo(15,-3,18,-6,18,-14);
 c.bezierCurveTo(18,-21,15,-25,8,-25);c.closePath();
}
export function drawRockHp(c,s,{reducedMotion=false}={}){
 for(const b of rockHpBubbles(s,{reducedMotion})){
  c.save();c.globalAlpha=b.alpha;c.translate(b.x,b.y-2+b.dy);c.rotate(b.angle);c.scale(b.sx,b.sy);
  c.lineJoin='round';c.lineCap='round';
  c.save();c.translate(0,1.8);bubblePath(c);c.fillStyle='#3a24182b';c.fill();c.restore();
  bubblePath(c);c.fillStyle='#fff3d5';c.fill();
  c.save();c.clip();c.fillStyle='#edd5a5';c.fillRect(-20,-6,40,12);c.restore();
  c.strokeStyle='#654534';c.lineWidth=1.7;c.stroke();
  c.beginPath();c.moveTo(-11,-21);c.quadraticCurveTo(-8,-23,-4,-23);c.lineTo(8,-23);
  c.strokeStyle='#fffdf1';c.lineWidth=1.4;c.stroke();
  // 숫자는 바탕보다 한 박자 늦게 나타나며 별도의 큰 외곽선 없이 또렷하게 읽힌다.
  c.globalAlpha*=b.numberAlpha;c.font='900 14px Game, sans-serif';c.textAlign='center';c.textBaseline='middle';
  c.fillStyle='#fffdf1';c.fillText(b.value,0,-12+b.numberLift);
  c.fillStyle='#654534';c.fillText(b.value,0,-13+b.numberLift);
  c.restore();
 }
}
