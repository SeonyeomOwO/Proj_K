import {center,noise,isMineable} from './grid.js';
import {contours,waveContours,traceWave} from './terrain-geometry.js';
import {getTheme} from './mineral-themes.js';
import {damageImage} from './surface-damage.js';
const masks=new WeakMap();
export const IMPACT={recoil:.22,flash:.11,fracture:.26,dust:.36,shards:.48};
export function recoilAt(age,reducedMotion=false){
 if(reducedMotion||age<0||age>=IMPACT.recoil)return 0;
 const t=age/IMPACT.recoil;return Math.sin(t*Math.PI*2)*4.5*(1-t)*(1-t);
}
function topClip(c,s){
 let mask=masks.get(s);if(!mask||mask.revision!==s.revision){mask={revision:s.revision,loops:waveContours(contours(s.cells))};masks.set(s,mask);}
 traceWave(c,mask.loops);c.clip('evenodd');
}
function impactDirection(cell,e){const[x,y]=center(cell.id),dx=x-e.x,dy=y+10-e.y,d=Math.hypot(dx,dy)||1;return {x:dx/d,y:dy/d};}
const collapsePieces=[
 {shape:[[-25,-25],[3,-25],[-2,-3],[-25,5]],x:-1,y:-.4},
 {shape:[[3,-25],[25,-25],[25,2],[-2,-3]],x:1,y:-.5},
 {shape:[[-25,5],[-2,-3],[5,25],[-25,25]],x:-.7,y:.8},
 {shape:[[-2,-3],[25,2],[25,25],[5,25]],x:.9,y:.9}
];
function drawCollapse(c,s,cell,damageTiles,age,reducedMotion){
 const image=damageImage(s,cell,damageTiles,true);if(!image)return;
 const[x,y]=center(cell.id),t=age/IMPACT.fracture;
 for(const piece of collapsePieces){
  c.save();c.translate(x+(reducedMotion?0:piece.x*t*11),y+(reducedMotion?0:piece.y*t*8+t*t*10));
  c.globalAlpha=Math.max(0,1-t*t);if(!reducedMotion)c.scale(1-t*.2,1-t*.2);
  c.beginPath();piece.shape.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.closePath();c.clip();
  c.drawImage(image,-25,-25,50,50);c.restore();
 }
}
// Sample the unchanged terrain image into fixed destination blocks, with a
// smoothly falling displacement. This moves the struck surface and its rim
// locally without shaking the camera, opening seams or changing collision.
function recoilPatch(c,terrain,cell,e,age,reducedMotion){
 const amount=recoilAt(age,reducedMotion);if(!terrain||Math.abs(amount)<.01)return;
 const[cx,cy]=center(cell.id),px=cx,py=cy+18,rx=34,ry=45;
 const {x:nx,y:ny}=impactDirection(cell,e);
 const sx=terrain.width/450,sy=terrain.height/800;
 const left=Math.max(0,Math.floor(px-rx)),top=Math.max(0,Math.floor(py-ry)),right=Math.min(450,Math.ceil(px+rx)),bottom=Math.min(800,Math.ceil(py+ry));
 for(let y=top;y<bottom;y+=3)for(let x=left;x<right;x+=3){
  const w=Math.min(3,right-x),h=Math.min(3,bottom-y),r=((x+w/2-px)/rx)**2+((y+h/2-py)/ry)**2;if(r>=1)continue;
  const k=(1-r)**2*amount,sourceX=Math.max(0,Math.min(450-w,x-nx*k)),sourceY=Math.max(0,Math.min(800-h,y-ny*k));
  c.drawImage(terrain,sourceX*sx,sourceY*sy,w*sx,h*sy,x,y,w,h);
 }
}
export function drawTerrainImpacts(c,s,{terrainCache,damageTiles,reducedMotion=false}){
 const hits=new Map();for(const e of s.events)if(e.type==='hit'&&s.time-e.time<IMPACT.recoil)hits.set(e.id,e);
 for(const[id,e]of hits){const cell=s.cells[id];if(isMineable(cell))recoilPatch(c,terrainCache,cell,e,s.time-e.time,reducedMotion);}
 for(const[id,e]of hits){
  const cell=s.cells[id],age=s.time-e.time;if(!isMineable(cell)||age>=IMPACT.flash)continue;
  const[x,y]=center(id),p=getTheme(s.themeId).palette,fade=(1-age/IMPACT.flash)**2;
  c.save();topClip(c,s);c.beginPath();c.ellipse(x,y,26,26,0,0,Math.PI*2);c.clip();c.globalAlpha=fade*.34;c.fillStyle=p.rim;
  c.fillRect(x-27,y-27,54,54);c.restore();
 }
 // The replacement surface itself separates into falling pieces. Collision
 // and the real reward still change immediately on the original break event.
 for(const e of s.events)if(e.type==='break'){
  const age=s.time-e.time;if(age<0||age>=IMPACT.fracture)continue;
  drawCollapse(c,s,s.cells[e.id],damageTiles,age,reducedMotion);
 }
}
export function breakBurst(s,e){
 const age=s.time-e.time,[x,y]=center(e.id);if(age<0||age>=IMPACT.shards)return null;
 const palette=getTheme(s.themeId).palette;
 return {x,y,age,palette,dustAlpha:age<IMPACT.dust?Math.max(0,1-age/IMPACT.dust)*.62:0,
  shards:Array.from({length:7},(_,i)=>{const angle=i*Math.PI*2/7+noise(e.id,i)*.35,speed=54+noise(e.id,i,82)*35;
   return {x:x+Math.cos(angle)*age*speed,y:y+Math.sin(angle)*age*speed*.65-age*54+age*age*90,size:5+i%3,alpha:1-age/IMPACT.shards};})};
}
// Cosmetic debris only: anchored to the actual pickaxe contact, with a
// different scatter for each impact. Nothing is added to collectible drops.
export function hitDebris(s,e,reducedMotion=false){
 const age=s.time-e.time;
 if(e.type!=='hit'||age<0||age>=.56||s.events.some(b=>b.type==='break'&&b.id===e.id&&b.time===e.time))return null;
 const[cx,cy]=center(e.id),x=e.x??cx,y=e.y??cy,dx=x-cx,dy=y-(cy+10),length=Math.hypot(dx,dy)||1;
 const nx=dx/length,ny=dy/length,seed=Math.round(e.time*1000)+184,amount=reducedMotion?.35:1;
 const chips=Array.from({length:reducedMotion?3:6},(_,i)=>{
  const r=noise(e.id,i,seed),spread=(i-2.5)*.36+(r-.5)*.4,speed=52+r*45,life=.38+noise(e.id,i,seed+1)*.18;
  const vx=(nx*Math.cos(spread)-ny*Math.sin(spread))*speed,vy=(ny*Math.cos(spread)+nx*Math.sin(spread))*speed*.55;
  const lift=140+noise(e.id,i,seed+2)*45,t=Math.min(age,life),fade=Math.max(0,Math.min(1,(life-age)/.14));
  return {x:x+vx*t*amount,y:y+(vy*t-lift*t+320*t*t)*amount,
   size:3.8+noise(e.id,i,seed+3)*2.8,angle:(r-.5)*2+(i%2?1:-1)*t*(5+r*5)*amount,alpha:fade};
 });
 return {x,y,age,palette:getTheme(s.themeId).palette,chips,dustAlpha:Math.max(0,1-age/.22)*.32};
}
