import {RISE,center,noise} from './grid.js';
import {contours} from './terrain-geometry.js';
import {getTheme} from './mineral-themes.js';
import {drawMineral} from './mineral-art.js';
import {paintDamageSurface} from './surface-damage.js';
const TAU=Math.PI*2;
function oval(c,x,y,rx,ry,fill,rotation=0){c.beginPath();c.ellipse(x,y,rx,ry,rotation,0,TAU);c.fillStyle=fill;c.fill();}
function line(c,p,color,w=1){c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.lineWidth=w;c.strokeStyle=color;c.lineCap='round';c.lineJoin='round';c.stroke();}
function motif(c,x,y,r,t){
 const p=t.palette;c.save();c.translate(x,y);
 switch(t.pattern){
  case 'vein':line(c,[[-r,7],[-r*.25,-3],[r*.4,2],[r,-7]],p.rim+'9a',3);line(c,[[0,-1],[r*.15,-10]],p.motif+'88',1.2);break;
  case 'geode':
   for(let i=3;i>=1;i--)oval(c,0,0,r*i/3,r*.7*i/3,i%2?p.motif+'66':p.rim+'66',-.2);
   for(let i=0;i<6;i++){const a=i*TAU/6;line(c,[[Math.cos(a)*r*.8,Math.sin(a)*r*.6],[Math.cos(a)*r*.42,Math.sin(a)*r*.3]],p.rim+'99',2);}break;
  case 'square':
   c.rotate(-.2);for(let i=0;i<2;i++){c.strokeStyle=p.motif+'80';c.lineWidth=2;c.strokeRect(-r*.6+i*8,-r*.4+i*6,r*.7,r*.7);}break;
  case 'rings':
   for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,r*.1,5+i*r*.3,4+i*r*.21,-.2,0,TAU);c.strokeStyle=i%2?p.rim+'75':p.motif+'88';c.lineWidth=3;c.stroke();}break;
  case 'rosette':
   for(let i=0;i<5;i++){const a=i*TAU/5;oval(c,Math.cos(a)*r*.4,Math.sin(a)*r*.4,r*.43,r*.2,p.motif+'66',a);}break;
  case 'zones':
   c.rotate(.3);c.fillStyle='#b8a4d150';c.fillRect(-r*.6,-r*.6,r*1.2,r*1.2);c.strokeStyle=p.rim+'88';c.lineWidth=2;c.strokeRect(-r*.3,-r*.3,r*.6,r*.6);break;
  case 'rosebands':
   for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,0,r*(.4+i*.3),r*(.22+i*.18),-.2,.15,Math.PI*1.9);c.strokeStyle=i%2?p.rim+'a0':p.motif+'88';c.lineWidth=3;c.stroke();}break;
  case 'iron':line(c,[[-r*.7,-6],[-r*.3,0],[r*.7,3]],p.motif+'a0',4);line(c,[[-r*.6,0],[r*.5,7]],p.ink+'30',2);break;
  case 'columns':
   c.rotate(-.25);for(let i=0;i<3;i++)line(c,[[-7+i*7,-r*.7],[-7+i*7,r*.5]],i%2?p.rim+'a0':p.motif+'88',2.5);break;
 }c.restore();
}
function broadVeins(c,t){
 const p=t.palette;
 if(['rings','rosebands','vein'].includes(t.pattern)){
  for(let i=0;i<4;i++){c.beginPath();c.moveTo(-30,80+i*210);c.bezierCurveTo(120,20+i*210,220,200+i*210,480,90+i*210);c.strokeStyle=t.pattern==='rosebands'?p.rim+'52':p.motif+'42';c.lineWidth=t.pattern==='vein'?3:8;c.stroke();}
 }else if(t.pattern==='zones'){
  for(let i=0;i<4;i++)oval(c,noise(i,3,6)*450,80+i*220,110,55,i%2?'#bb9bd63d':'#ddedb147',-.45);
 }
}
// Repaint only the raised mineral, so ground fractures remain behind it.
export function paintRaisedMineral(c,cell){
 if(cell.kind==='stone'||cell.hole)return;
 const[px,py]=center(cell.id),x=px+(noise(cell.x,cell.y,71)-.5)*12,y=py+(noise(cell.x,cell.y,72)-.5)*12;
 drawMineral(c,cell.kind,x,y,9.5+noise(cell.x,cell.y,74)*3,cell.variant+cell.rotation);
}
export function paintMineralTerrain(c,s,{waveContours,traceWave,damageTiles}){
 const theme=getTheme(s.themeId),p=theme.palette;
 c.save();c.fillStyle=p.floor;c.fillRect(0,0,450,800);
 for(let i=0;i<18;i++)oval(c,noise(i,1,51)*520-35,noise(i,2,52)*860-30,45+noise(i,4)*48,16+noise(i,5)*20,i%2?p.rim+'0d':p.ink+'0e',-.15);
 for(const cell of s.cells){const n=noise(cell.x,cell.y,59);if(n>.2)continue;const[x,y]=center(cell.id);for(let i=0;i<3;i++)line(c,[[x-8+i,y+i*4],[x+8-i*2,y+i*4]],p.ink+'25',1.5);if(n<.04)oval(c,x+11,y-10,3.4,2.1,p.rim+'65');}
 const loops=waveContours(contours(s.cells));if(!loops.length){c.restore();return;}
 c.lineJoin='round';c.lineCap='round';traceWave(c,loops,RISE+4);c.fillStyle=p.ink+'40';c.fill('evenodd');
 traceWave(c,loops,RISE);c.fillStyle=p.strata[0];c.fill('evenodd');c.strokeStyle=p.ink;c.lineWidth=4.5;c.stroke();
 for(const[dy,color]of[[RISE-7,p.strata[1]],[RISE-16,p.strata[2]],[0,p.top]]){traceWave(c,loops,dy);c.fillStyle=color;c.fill('evenodd');}
 c.save();traceWave(c,loops);c.clip('evenodd');
 for(let i=0;i<11;i++)oval(c,noise(i,3,66)*500-25,noise(i,6,67)*850-25,55+noise(i,8)*48,35+noise(i,9)*28,i%2?p.rim+'20':p.motif+'22',.2);
 broadVeins(c,theme);
 for(const cell of s.cells){if(!cell.solid)continue;if(paintDamageSurface(c,s,cell,damageTiles))continue;if(cell.hole)continue;const[px,py]=center(cell.id),x=px+(noise(cell.x,cell.y,71)-.5)*12,y=py+(noise(cell.x,cell.y,72)-.5)*12,n=noise(cell.x,cell.y,73);
  if(cell.kind!=='stone'){oval(c,x,y+7,11,3,p.ink+'20');paintRaisedMineral(c,cell);}
  else if(n<.27)motif(c,x,y,12+noise(cell.x,cell.y,75)*7,theme);
  else if(n<.42){oval(c,x-4,y+2,2.7,3.4,p.motif+'80',.4);oval(c,x+4,y-3,2,2.6,p.motif+'65',.4);}
 }
 traceWave(c,loops);c.strokeStyle=p.rim;c.lineWidth=3.5;c.stroke();c.restore();c.restore();
}
