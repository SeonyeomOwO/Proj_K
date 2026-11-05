import {traitUnlocked} from './state.js';

// Same equipment-to-hamster ratio as the approved enlarged preview (.68 is the game actor scale).
const SCALE=.68, ENLARGE=1.45;
export const PEDESTAL={w:66*1.32*SCALE,h:39*1.32*SCALE};
export const DISPLAY_ART={
 workwear:{w:53,h:53,slot:16},drill:{w:65,h:36,slot:7},
 dynamite:{w:48,h:37,slot:9},pajamas:{w:53,h:50,slot:14},charge:{w:49,h:66,slot:5},
};
// The approved 20-position ring is a layout example, not an inventory limit.
export function displayRing(count=20){
 for(let n=24;;n+=2){
  const points=[];
  for(let i=0;i<n;i++){
   const a=-Math.PI/2+(i+.5)*Math.PI*2/n;
   if(Math.abs(Math.cos(a))<.2)continue; // leave both gates open
   points.push({x:1080+Math.cos(a)*260.8,y:1940+Math.sin(a)*360});
  }
  if(points.length>=Math.max(20,count))return points;
 }
}
export function traitDisplays(s){
 const ring=displayRing();
 return Object.entries(DISPLAY_ART).filter(([id])=>id!=='charge'||traitUnlocked(s,id)).map(([trait,a])=>{
  const w=a.w*ENLARGE*SCALE,h=a.h*ENLARGE*SCALE;
  return {trait,...ring[a.slot],w,h,dy:-28*SCALE-h*.32,rx:w*.46,ry:h*.46};
 });
}
export function displayContains(d,p,padding=0){
 return ((p.x-d.x)/(d.rx+padding))**2+((p.y-d.y-d.dy)/(d.ry+padding))**2<=1;
}
// The thrown actor is drawn above its ground point; test its visible body, not its shadow.
export function flyingContact(f){return{x:f.x,y:f.y-Math.min(34,Math.hypot(f.vx,f.vy)*.07)-26};}
