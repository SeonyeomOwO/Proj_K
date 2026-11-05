import {clamp} from './camera.js';
// ── 마을 구역(2026-11-05): 화면 한 장 크기 구역 4개. 메인(광산 입구)을 가운데에 두고
// 왼쪽 = 토템 마당(4), 오른쪽 = 이름 우물(3), 아래 = 특성 경기장(2). 메인과 각 구역 사이 경계에 문이 하나씩 있고,
// 등나무 공을 굴려 그 문을 지나가면 화면이 그 구역으로 넘어가고 햄찌들이 우르르 따라온다.
export const ZONE={w:720,h:1280};
export const ZONES=[
 {id:'hub',no:1,name:'광산 입구',col:1,row:0},
 {id:'arena',no:2,name:'특성 경기장',col:1,row:1},
 {id:'well',no:3,name:'이름 우물',col:2,row:0},
 {id:'totem',no:4,name:'토템 마당',col:0,row:0},
].map(z=>{const left=z.col*ZONE.w,top=z.row*ZONE.h;return{...z,left,top,right:left+ZONE.w,bottom:top+ZONE.h,cx:left+ZONE.w/2,cy:top+ZONE.h/2};});
export const zoneById=id=>ZONES.find(z=>z.id===id)??ZONES[0];
export const zoneAt=(x,y=ZONE.h/2)=>ZONES.find(z=>x>=z.left&&x<z.right&&y>=z.top&&y<z.bottom)
 ??ZONES.reduce((a,z)=>Math.hypot(x-z.cx,y-z.cy)<Math.hypot(x-a.cx,y-a.cy)?z:a);
// 옆 경계 문(왼쪽·오른쪽): 모든 구역에서 같은 높이. 공 출발점 높이와 맞춰 옆으로 굴리면 지나간다.
export const GATE={top:810,bottom:950,y:880};
// 경계 문 목록: a = 왼쪽(또는 위) 구역, b = 오른쪽(또는 아래) 구역. axis 'x'는 세로 경계(x=at), 'y'는 가로 경계(y=at).
export const GATES=[
 {a:'totem',b:'hub',axis:'x',at:ZONE.w,from:GATE.top,to:GATE.bottom},
 {a:'hub',b:'well',axis:'x',at:ZONE.w*2,from:GATE.top,to:GATE.bottom},
 {a:'hub',b:'arena',axis:'y',at:ZONE.h,from:ZONE.w+290,to:ZONE.w+430},
];
export const gateCenter=g=>g.axis==='x'?{x:g.at,y:(g.from+g.to)/2}:{x:(g.from+g.to)/2,y:g.at};
export const gateBetween=(p,q)=>GATES.find(g=>g.a===p&&g.b===q||g.a===q&&g.b===p);
export const HOLE={x:1080,y:640,rx:39,ry:24};
export const BALL_HOME={x:1080,y:GATE.y};
// 공이 굴러다니는 벽: 구역 테두리(위는 상단 칸, 아래는 버튼에 가리지 않게 구역 안쪽 높이)
export const BALL_WALL={radius:22,top:200,bottom:1130};
// 문을 지나 새 구역에 들어설 때 최소한 이만큼의 속도로 굴러 들어온다(문 앞에 멈춰 가려지지 않게).
// 위아래 문은 화면 위 칸·아래 버튼 뒤를 지나야 해서 더 깊이 굴러 들어온다.
const ENTRY_SPEED={x:320,y:520};
export function freshBall(){return{...BALL_HOME,zone:'hub',vx:0,vy:0,angle:0};}
export function aimVelocity(origin,pointer){
 const dx=origin.x-pointer.x,dy=origin.y-pointer.y,d=Math.hypot(dx,dy),k=Math.min(1,110/Math.max(1,d));
 return{vx:dx*k*5.6,vy:dy*k*5.6,pull:d};
}
export function insideHole(ball){return((ball.x-HOLE.x)/HOLE.rx)**2+((ball.y-HOLE.y)/HOLE.ry)**2<1;}
const R=BALL_WALL.radius;
const walls=z=>({left:z.left+R,right:z.right-R,top:z.top+BALL_WALL.top,bottom:z.top+BALL_WALL.bottom});
// 구역 z의 한쪽 변에 난 문
function sideGate(z,side){
 return GATES.find(g=>side==='west'?g.axis==='x'&&g.at===z.left&&g.b===z.id:side==='east'?g.axis==='x'&&g.at===z.right&&g.a===z.id
  :side==='north'?g.axis==='y'&&g.at===z.top&&g.b===z.id:g.axis==='y'&&g.at===z.bottom&&g.a===z.id);
}
const within=(v,g)=>v>g.from+R&&v<g.to-R;
// 한 걸음: 구역 벽에 튕기고, 문 자리에서 경계를 넘으면 ball.zone이 이웃 구역으로 바뀐다.
// Prediction and live motion share the same small-step collision solver. 구멍에 들어가면 true.
export function stepBall(ball,dt){
 for(let left=Math.min(.1,dt);left>1e-8;left-=1/120){
  const h=Math.min(left,1/120);ball.x+=ball.vx*h;ball.y+=ball.vy*h;
  let z=zoneById(ball.zone);
  if(z.id==='hub'&&insideHole(ball))return true;
  const w=walls(z),cross=(id,axis,sign)=>{ball.zone=id;if(axis==='x')ball.vx=sign*Math.max(Math.abs(ball.vx),ENTRY_SPEED.x);else ball.vy=sign*Math.max(Math.abs(ball.vy),ENTRY_SPEED.y);};
  let g;
  if(ball.x<w.left){if((g=sideGate(z,'west'))&&within(ball.y,g)){if(ball.x<z.left)cross(g.a,'x',-1);}else{ball.x=w.left;ball.vx=Math.abs(ball.vx)*.45;}}
  else if(ball.x>w.right){if((g=sideGate(z,'east'))&&within(ball.y,g)){if(ball.x>z.right)cross(g.b,'x',1);}else{ball.x=w.right;ball.vx=-Math.abs(ball.vx)*.45;}}
  if(ball.y<w.top){if((g=sideGate(z,'north'))&&within(ball.x,g)){if(ball.y<z.top)cross(g.a,'y',-1);}else{ball.y=w.top;ball.vy=Math.abs(ball.vy)*.45;}}
  else if(ball.y>w.bottom){if((g=sideGate(z,'south'))&&within(ball.x,g)){if(ball.y>z.bottom)cross(g.b,'y',1);}else{ball.y=w.bottom;ball.vy=-Math.abs(ball.vy)*.45;}}
  // 문 통로(벽 너머 두 구역 사이)에서는 문 기둥 사이를 벗어나지 않는다
  z=zoneById(ball.zone);const v=walls(z);
  if(ball.x<v.left||ball.x>v.right){const gate=sideGate(z,ball.x<v.left?'west':'east');if(gate)ball.y=clamp(ball.y,gate.from+R,gate.to-R);}
  if(ball.y<v.top||ball.y>v.bottom){const gate=sideGate(z,ball.y<v.top?'north':'south');if(gate)ball.x=clamp(ball.x,gate.from+R,gate.to-R);}
  const decay=Math.exp(-1.35*h);ball.vx*=decay;ball.vy*=decay;ball.angle+=(ball.vx+ball.vy)*h/20;
  if(Math.hypot(ball.vx,ball.vy)<9){
   ball.vx=ball.vy=0;
   // 문 통로에 멈추면 구역 안쪽(보이는 곳)으로 들인다
   ball.x=clamp(ball.x,v.left,v.right);ball.y=clamp(ball.y,v.top,v.bottom);
  }
 }
 return false;
}
export function trajectory(ball,velocity){
 const b={...ball,...velocity},points=[];
 for(let i=0;i<32;i++){const hit=stepBall(b,1/30);points.push({x:b.x,y:b.y});if(hit||(!b.vx&&!b.vy))break;}
 return points;
}
