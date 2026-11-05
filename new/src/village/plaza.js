import {clamp} from './camera.js';
// ── 마을 구역(2026-11-05): 화면 한 장 크기 구역 4개를 가로로 잇는다. 레퍼런스 지리대로 왼쪽부터
// 토템 마당(4) · 광산 입구(1, 메인) · 특성 경기장(2) · 이름 우물(3). 이웃 구역 사이 경계에는 문이 하나씩 있고,
// 등나무 공을 굴려 그 문을 지나가면 화면이 다음 구역으로 넘어가고 햄찌들이 우르르 따라온다.
export const ZONE={w:720,h:1280};
export const ZONES=[
 {id:'totem',no:4,name:'토템 마당'},
 {id:'hub',no:1,name:'광산 입구'},
 {id:'arena',no:2,name:'특성 경기장'},
 {id:'well',no:3,name:'이름 우물'},
].map((z,i)=>({...z,i,left:i*ZONE.w,right:(i+1)*ZONE.w,top:0,bottom:ZONE.h,cx:i*ZONE.w+ZONE.w/2,cy:ZONE.h/2}));
export const zoneById=id=>ZONES.find(z=>z.id===id)??ZONES[1];
export const zoneAt=x=>ZONES[clamp(Math.floor(x/ZONE.w),0,ZONES.length-1)];
// 경계 문: 모든 경계에서 같은 높이(공 출발점 높이와 맞춰 옆으로 굴리면 지나간다)
export const GATE={top:760,bottom:900,y:830};
export const HOLE={x:1080,y:640,rx:39,ry:24};
export const BALL_HOME={x:1080,y:840};
// 공이 굴러다니는 벽: 구역 테두리(위는 상단 칸, 아래는 버튼에 가리지 않게 안쪽)
export const BALL_WALL={radius:22,top:200,bottom:1130};
export function freshBall(){return{...BALL_HOME,zone:'hub',vx:0,vy:0,angle:0};}
export function aimVelocity(origin,pointer){
 const dx=origin.x-pointer.x,dy=origin.y-pointer.y,d=Math.hypot(dx,dy),k=Math.min(1,110/Math.max(1,d));
 return{vx:dx*k*5.6,vy:dy*k*5.6,pull:d};
}
export function insideHole(ball){return((ball.x-HOLE.x)/HOLE.rx)**2+((ball.y-HOLE.y)/HOLE.ry)**2<1;}
const inGate=y=>y>GATE.top+BALL_WALL.radius&&y<GATE.bottom-BALL_WALL.radius;
// 한 걸음: 구역 벽에 튕기고, 문 높이에서 경계를 넘으면 ball.zone이 이웃 구역으로 바뀐다.
// Prediction and live motion share the same small-step collision solver. 구멍에 들어가면 true.
export function stepBall(ball,dt){
 for(let left=Math.min(.1,dt);left>1e-8;left-=1/120){
  const h=Math.min(left,1/120);ball.x+=ball.vx*h;ball.y+=ball.vy*h;
  let z=zoneById(ball.zone);
  if(z.id==='hub'&&insideHole(ball))return true;
  const R=BALL_WALL.radius,west=ZONES[z.i-1],east=ZONES[z.i+1];
  if(ball.x<z.left+R){if(west&&inGate(ball.y)){if(ball.x<z.left)ball.zone=west.id;}else{ball.x=z.left+R;ball.vx=Math.abs(ball.vx)*.45;}}
  else if(ball.x>z.right-R){if(east&&inGate(ball.y)){if(ball.x>z.right)ball.zone=east.id;}else{ball.x=z.right-R;ball.vx=-Math.abs(ball.vx)*.45;}}
  // 문 안쪽(두 구역 사이)에서는 문 기둥 높이를 벗어나지 않는다
  z=zoneById(ball.zone);
  const near=ball.x<z.left+R||ball.x>z.right-R,top=near?GATE.top+R:BALL_WALL.top,bottom=near?GATE.bottom-R:BALL_WALL.bottom;
  if(ball.y<top){ball.y=top;ball.vy=Math.abs(ball.vy)*.45;}
  if(ball.y>bottom){ball.y=bottom;ball.vy=-Math.abs(ball.vy)*.45;}
  const decay=Math.exp(-1.35*h);ball.vx*=decay;ball.vy*=decay;ball.angle+=ball.vx*h/20;
  if(Math.hypot(ball.vx,ball.vy)<9)ball.vx=ball.vy=0;
 }
 return false;
}
export function trajectory(ball,velocity){
 const b={...ball,...velocity},points=[];
 for(let i=0;i<32;i++){const hit=stepBall(b,1/30);points.push({x:b.x,y:b.y});if(hit||(!b.vx&&!b.vy))break;}
 return points;
}
