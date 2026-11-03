import {predictBall} from './ball.js';
import {drawIris} from '../intro/iris-transition.js';
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>x*x*(3-2*x);
export function drawAim(c,s){
 const points=predictBall(s);if(points.length<2)return;
 c.save();c.lineCap='round';c.strokeStyle='#fff0bd';c.lineWidth=2;c.setLineDash([3,8]);c.beginPath();
 points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();c.setLineDash([]);
 const end=points.at(-1);c.strokeStyle=end.target?'#ffe179':'#fff0bd88';c.beginPath();c.arc(end.x,end.y,end.target?15:6,0,Math.PI*2);c.stroke();
 c.strokeStyle='#ffdf8b77';c.beginPath();c.moveTo(s.ball.x,s.ball.y);c.lineTo(s.aim.x-s.aim.dx,s.aim.y-s.aim.dy);c.stroke();c.restore();
}
export function visualWorker(s,h){
 const t=s.transition;if(!t||!['suction','close','covered'].includes(t.stage))return h;
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
export function drawTired(c,s,h){
 if(h.stamina>25||h.sleeping||h.care||s.phase!=='mining'||Math.sin(s.time*2+h.id)<.3)return;
 c.save();c.font='900 10px Ham, sans-serif';c.textAlign='center';c.fillStyle='#fff3d5';c.strokeStyle='#72533e';c.lineWidth=1;
 c.beginPath();c.roundRect(h.x+10,h.y-39,31,16,6);c.fill();c.stroke();c.fillStyle='#72533e';c.fillText('헥헥',h.x+25,h.y-28);c.restore();
}
export function drawFloorTransition(c,s,{reducedMotion=false}={}){
 const t=s.transition;if(!t||t.stage==='suction')return;
 const openness=t.stage==='close'?1-smooth(clamp(t.time/.52)):t.stage==='covered'?0:smooth(clamp(t.time/.65));
 const center=t.stage==='open'?[.5,.5]:[t.hole.x/450,t.hole.y/800];
 drawIris(c,450,800,openness,{shape:t.shape,center,reducedMotion});
}
