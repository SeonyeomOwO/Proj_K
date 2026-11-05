import {clamp} from './camera.js';
export const HOLE={x:1060,y:1000,rx:39,ry:24};
export const BALL_HOME={x:1060,y:1160};
export const PLAZA={left:945,right:1175,top:954,bottom:1400};
export function freshBall(){return{...BALL_HOME,vx:0,vy:0,angle:0};}
export function aimVelocity(origin,pointer){
 const dx=origin.x-pointer.x,dy=origin.y-pointer.y,d=Math.hypot(dx,dy),k=Math.min(1,110/Math.max(1,d));
 return{vx:dx*k*5.6,vy:dy*k*5.6,pull:d};
}
export function insideHole(ball){return((ball.x-HOLE.x)/HOLE.rx)**2+((ball.y-HOLE.y)/HOLE.ry)**2<1;}
// Prediction and live motion share the same small-step collision solver.
export function stepBall(ball,dt){
 for(let left=Math.min(.1,dt);left>1e-8;left-=1/120){
  const h=Math.min(left,1/120);ball.x+=ball.vx*h;ball.y+=ball.vy*h;
  if(insideHole(ball))return true;
  if(ball.x<PLAZA.left||ball.x>PLAZA.right){ball.x=clamp(ball.x,PLAZA.left,PLAZA.right);ball.vx*=-.45;}
  if(ball.y<PLAZA.top||ball.y>PLAZA.bottom){ball.y=clamp(ball.y,PLAZA.top,PLAZA.bottom);ball.vy*=-.45;}
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
