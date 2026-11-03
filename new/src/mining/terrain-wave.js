// A shared world-space wave makes connected cells one terrain mass. The logical
// mining grid stays rectangular; visual displacement is bounded to 4.2 pixels.
import {TILE,ORIGIN,RISE,center,noise} from './grid.js';
import {contours} from './terrain-geometry.js';
import {paintMineralTerrain,paintRaisedMineral} from './mineral-terrain.js';
import {paintDamageSurface} from './surface-damage.js';

import {wavePoint,waveContours,traceWave} from './terrain-geometry.js';
export {wavePoint,waveContours,traceWave};
const TAU=Math.PI*2;
function ellipse(c,x,y,rx,ry,fill,rotation=0){c.beginPath();c.ellipse(x,y,rx,ry,rotation,0,TAU);c.fillStyle=fill;c.fill();}
function dash(c,x,y,w,color,h=2){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,h/2);c.fill();}
function shape(c,pts,fill,stroke,width=1.2){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.lineJoin='round';c.stroke();}}
function mineral(c,x,y,size,jade,rot){
 c.save();c.translate(x,y);c.rotate(rot);
 const pts=[[-size*.65,-size*.1],[-size*.22,-size*.69],[size*.43,-size*.57],[size*.68,size*.05],[size*.22,size*.59],[-size*.4,size*.46]];
 const dark=jade?'#689d85':'#c78d46',mid=jade?'#9fc9a1':'#efb955',light=jade?'#d3e5ad':'#ffe49a';
 shape(c,pts,mid,jade?'#75936d':'#c68d45',1.2);
 shape(c,[pts[0],pts[1],pts[2],[0,-size*.04]],light);
 shape(c,[pts[2],pts[3],pts[4],[0,-size*.04]],dark);
 c.restore();
}
function surfaceMotif(c,cell,raisedOnly=false){
 const[x0,y0]=center(cell.id),x=x0+(noise(cell.x,cell.y,71)-.5)*12,y=y0+(noise(cell.x,cell.y,72)-.5)*12,n=noise(cell.x,cell.y,73);
 if(cell.hole)return;
 if(cell.kind!=='stone'){
  const jade=cell.kind==='jade',size=8+noise(cell.x,cell.y,74)*4;
  if(!raisedOnly)ellipse(c,x,y+size*.4,size*.9,3,jade?'#99b78866':'#d6ae6170');
  mineral(c,x,y,size,jade,(n-.5)*.65);
  if(n>.28)mineral(c,x+size+3,y+size*.45,4.2,jade,.4);
  if(n>.7)mineral(c,x-size*.7,y-size*.85,3.3,jade,-.3);
  return;
 }
 if(n<.26){
  for(const[dx,dy,rx,ry]of[[-7,3,5,3.4],[1,-5,4.6,4],[8,5,3.5,3]])ellipse(c,x+dx,y+dy,rx,ry,'#d9b36970',-.25);
 }else if(n<.42){
  ellipse(c,x-6,y+3,2.8,3.5,'#d5ad6778',.35);ellipse(c,x+4,y-4,2,2.7,'#d5ad6760',.35);
 }else if(n<.53){
  for(let i=0;i<3;i++){dash(c,x-10+i*2,y+i*5,14-i*2,'#dcb87565',1.7);dash(c,x+8+i,y+i*5,3,'#dcb87550',1.7);}
 }
}
export function paintRaisedTerrainMineral(c,s,cell){
 if(cell.kind==='stone'||cell.hole)return;
 if(s.themeId&&s.themeId!=='base')paintRaisedMineral(c,cell);
 else surfaceMotif(c,cell,true);
}
export function paintWaveTerrain(c,s,{damageTiles}={}){
 if(s.themeId&&s.themeId!=='base')return paintMineralTerrain(c,s,{waveContours,traceWave,damageTiles});
 c.save();c.fillStyle='#c29260';c.fillRect(0,0,450,800);
 // Quiet, broad patches and short scuffs rather than a high-detail bitmap.
 for(let i=0;i<20;i++){const x=noise(i,1,51)*520-35,y=noise(i,2,52)*860-30;ellipse(c,x,y,45+noise(i,4)*48,16+noise(i,5)*20,i%2?'#c99b674d':'#b9875540',-.15);}
 for(const cell of s.cells){const n=noise(cell.x,cell.y,59);if(n>.25)continue;const[x,y]=center(cell.id);for(let i=0;i<3;i++)dash(c,x-9+i*2,y+i*5,18-i*4,'#ad7b4a42',1.5);if(n<.05){ellipse(c,x+12,y-11,4,2.5,'#9e704544');ellipse(c,x+12,y-12,3.4,2.2,'#dfb77d');}}
 const loops=waveContours(contours(s.cells));if(!loops.length){c.restore();return;}
 c.lineJoin='round';c.lineCap='round';
 traceWave(c,loops,RISE+4);c.fillStyle='#956b4859';c.fill('evenodd');
 // The same undulating silhouette repeats through each broad, flat color band.
 traceWave(c,loops,RISE);c.fillStyle='#805a50';c.fill('evenodd');c.strokeStyle='#6d4d3b';c.lineWidth=4.5;c.stroke();
 traceWave(c,loops,RISE-7);c.fillStyle='#b36c4e';c.fill('evenodd');
 traceWave(c,loops,RISE-16);c.fillStyle='#ea985d';c.fill('evenodd');
 traceWave(c,loops);c.fillStyle='#f4d38a';c.fill('evenodd');
 c.save();traceWave(c,loops);c.clip('evenodd');
 for(let i=0;i<13;i++){const x=noise(i,3,66)*500-25,y=noise(i,6,67)*850-25;ellipse(c,x,y,55+noise(i,8)*48,35+noise(i,9)*28,i%2?'#ffe4a351':'#edc57b52',.2);}
 for(const cell of s.cells)if(cell.solid&&!paintDamageSurface(c,s,cell,damageTiles))surfaceMotif(c,cell);
 traceWave(c,loops);c.strokeStyle='#fff0bd';c.lineWidth=3.5;c.stroke();c.restore();
 c.restore();
}
