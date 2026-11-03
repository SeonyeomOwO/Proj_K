import {predictBall} from './ball.js';
import {predictFling} from './fling.js';
import {center} from './grid.js';
import {drawIris} from '../intro/iris-transition.js';
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>x*x*(3-2*x);
export function drawAim(c,s){
 if(s.aim&&s.aim.what&&s.aim.what!=='ball'){drawFlingAim(c,s);return;}
 const points=predictBall(s);if(points.length<2)return;
 c.save();c.lineCap='round';c.strokeStyle='#fff0bd';c.lineWidth=2;c.setLineDash([3,8]);c.beginPath();
 points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();c.setLineDash([]);
 const end=points.at(-1);c.strokeStyle=end.target?'#ffe179':'#fff0bd88';c.beginPath();c.arc(end.x,end.y,end.target?15:6,0,Math.PI*2);c.stroke();
 c.strokeStyle='#ffdf8b77';c.beginPath();c.moveTo(s.ball.x,s.ball.y);c.lineTo(s.aim.x-s.aim.dx,s.aim.y-s.aim.dy);c.stroke();c.restore();
}
// 햄찌·수레 조준선. 햄찌가 맞힐 바위는 네 귀퉁이 괄호로 미리 보여 준다(못 맞히면 착지점에 작은 원).
function drawFlingAim(c,s){
 const a=s.aim,plan=predictFling(s);if(!plan||plan.points.length<2)return;const end=plan.points.at(-1);
 c.save();c.lineCap='round';c.strokeStyle='#fff0bd';c.lineWidth=2;c.setLineDash([3,8]);c.beginPath();
 plan.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();c.setLineDash([]);
 if(plan.cell!=null){
  const[x,y]=center(plan.cell),r=25+Math.sin(s.time*10)*1.5;c.strokeStyle='#ffe179';c.lineWidth=3;
  for(const[dx,dy]of[[-1,-1],[1,-1],[-1,1],[1,1]]){c.beginPath();c.moveTo(x+dx*(r-8),y+dy*r);c.lineTo(x+dx*r,y+dy*r);c.lineTo(x+dx*r,y+dy*(r-8));c.stroke();}
 }else{c.strokeStyle='#fff0bd88';c.beginPath();c.arc(end.x,end.y,a.what==='cart'?14:8,0,Math.PI*2);c.stroke();}
 c.strokeStyle='#ffdf8b77';c.beginPath();c.moveTo(a.x,a.y);c.lineTo(a.x-a.dx,a.y-a.dy);c.stroke();c.restore();
}
export function visualWorker(s,h){
 const t=s.transition;if(!t||!['suction','close','covered'].includes(t.stage))return h.fling?.z?{...h,y:h.y-h.fling.z}:h;
 const from=t.from.find(p=>p.id===h.id),elapsed=t.stage==='suction'?t.time:1.35+t.time;
 const k=clamp((elapsed-h.id*.055)/1.16),ease=smooth(k);
 return {...h,x:from.x+(t.hole.x-from.x)*ease,y:from.y+(t.hole.y-from.y)*ease,clip:'suction',motion:k*2,cargo:null,cargoDrop:null,action:null};
}
export function drawFloorSeeds(c,s,res){
 for(const d of s.seeds){const hop=d.age<.4?Math.sin(d.age/.4*Math.PI)*22:0;
  c.fillStyle='#39243422';c.beginPath();c.ellipse(d.x,d.y+3,5,2,0,0,Math.PI*2);c.fill();
  c.save();c.translate(d.x,d.y-hop);c.rotate(Math.sin(d.id*2.3)*.55);res.draw(c,'seed',0,0,11,16);c.restore();
 }
}
// 지쳐 가는 햄찌: 기운 30 이하부터 '헥헥' 말풍선이 계속 떠 있고(숨쉬듯 들썩), 15 이하면 빨갛게 바뀌고 땀방울이 떨어진다.
// "곧 잠들겠다 → 먹일 준비"를 미리 읽게 하는 신호다(그리기 전용).
export const TIRED_AT=30,EXHAUSTED_AT=15;
export function drawTired(c,s,h){
 if(h.stamina>TIRED_AT||h.sleeping||h.care||h.fling||s.phase!=='mining')return;
 const red=h.stamina<=EXHAUSTED_AT,pant=Math.abs(Math.sin(s.time*(red?7:5)+h.id)),bx=h.x+8,by=h.y-46-pant*2;
 c.save();c.font='900 12px Game, sans-serif';c.textAlign='center';c.textBaseline='middle';
 c.fillStyle=red?'#ffe1d6':'#fff3d5';c.strokeStyle=red?'#b4442f':'#72533e';c.lineWidth=1.6;
 c.beginPath();c.roundRect(bx,by,38,19,8);c.fill();c.stroke();
 c.beginPath();c.moveTo(bx+8,by+18);c.lineTo(bx+4,by+25);c.lineTo(bx+14,by+18);c.fill();
 c.fillStyle=red?'#b4442f':'#72533e';c.fillText('헥헥',bx+19,by+10);
 if(red){
  // 땀방울 두 개가 번갈아 떨어진다
  for(let i=0;i<2;i++){const t=(s.time*1.4+i*.5+h.id*.3)%1,x=h.x-12+i*24,y=h.y-34+t*14;
   c.globalAlpha=1-t;c.fillStyle='#8fd0ff';c.strokeStyle='#3d7aa8';c.lineWidth=1;
   c.beginPath();c.moveTo(x,y-5);c.quadraticCurveTo(x+4,y+1,x,y+3);c.quadraticCurveTo(x-4,y+1,x,y-5);c.fill();c.stroke();}
 }
 c.restore();
}
// 화면 위 '팀 기운' 게이지: 네 햄찌의 기운을 한 줄에 칸으로 이어 붙여, 한 판의 남은 여력을 시계처럼 보여 준다.
// 칸 색: 넉넉 초록 · 지침 노랑 · 바닥 빨강, 잠든 햄찌 칸은 회색 z. 팀 합계가 30% 아래면 테두리가 깜빡인다.
export function drawTeamEnergy(c,s,{frame,rig,text}){
 const x=126,y=16,w=210,h=42,inner={x:x+46,y:y+15,w:w-58,h:13},crew=s.crew,gap=4,cell=(inner.w-gap*(crew.length-1))/crew.length;
 const total=crew.reduce((n,o)=>n+Math.max(0,o.stamina),0)/(crew.length*100);
 frame(c,rig,'panel_brown',x,y,w,h);
 if(total<.3&&s.phase==='mining'){c.save();c.globalAlpha=.35+.35*Math.sin(s.time*6);c.strokeStyle='#ff6b4a';c.lineWidth=3;c.beginPath();c.roundRect(x+3,y+3,w-6,h-6,10);c.stroke();c.restore();}
 text(c,'기운',x+25,y+28,14);
 crew.forEach((o,i)=>{
  const cx=inner.x+i*(cell+gap),k=Math.max(0,Math.min(1,o.stamina/100));
  c.save();c.fillStyle='#3a261c';c.beginPath();c.roundRect(cx,inner.y,cell,inner.h,4);c.fill();
  if(o.sleeping){c.fillStyle='#8d8378';c.beginPath();c.roundRect(cx+1.5,inner.y+1.5,cell-3,inner.h-3,3);c.fill();
   c.fillStyle='#f3ead8';c.font='900 10px Game, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('z',cx+cell/2,inner.y+inner.h/2+.5);}
  else if(k>0){c.fillStyle=o.stamina>60?'#7fc46b':o.stamina>TIRED_AT?'#f2c14e':'#e0634f';c.beginPath();c.roundRect(cx+1.5,inner.y+1.5,Math.max(3,(cell-3)*k),inner.h-3,3);c.fill();}
  c.restore();
 });
}
export function drawFloorTransition(c,s,{reducedMotion=false}={}){
 const t=s.transition;if(!t||t.stage==='suction')return;
 const openness=t.stage==='close'?1-smooth(clamp(t.time/.52)):t.stage==='covered'?0:smooth(clamp(t.time/.65));
 const center=t.stage==='open'?[.5,.5]:[t.hole.x/450,t.hole.y/800];
 drawIris(c,450,800,openness,{shape:t.shape,center,reducedMotion});
}
