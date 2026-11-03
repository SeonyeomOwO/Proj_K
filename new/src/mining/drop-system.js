import {center,hitCell,neighbors,noise} from './grid.js';
import {LOOT_WIDTH,floorIsClear,updateLootField} from './loot/loot-motion.js';
// One mined cell still produces one collectible. Dust is visual only.
function landingPoint(s,source,radius){
 const origin=center(source),seen=new Set([source]),queue=[source],candidates=[];
 for(let n=0;n<queue.length;n++){
  const id=queue[n],[cx,cy]=center(id);
  for(const oy of [0,10,18,-10,-18])for(const ox of [0,10,-10,18,-18]){
   const x=cx+ox,y=cy+oy;
   if(floorIsClear(s,x,y,radius))candidates.push({x,y,dist:Math.hypot(x-origin[0],y-origin[1])});
  }
  if(candidates.length&&n>6)break;
  for(const next of neighbors(id))if(!s.cells[next].solid&&!seen.has(next)){seen.add(next);queue.push(next);}
 }
 candidates.sort((a,b)=>a.dist-b.dist);
 // A sealed single-cell test excavation may have no room below the projected wall.
 // Keep its reward at its source until connected ground becomes available.
 return candidates[0]??{x:origin[0],y:origin[1],confined:true};
}
// golden: 상자에서 나온 황금 해바라기씨(광물 집계와 따로, 수레에 담으면 securedGolden)
export function spawnMinedDrop(s,cell,owner=null,{golden=false}={}){
 const id=s.nextDrop++,n=k=>noise(id+s.seed*37,k,cell.id),width=LOOT_WIDTH[0]+n(8)*(LOOT_WIDTH[1]-LOOT_WIDTH[0]);
 const radius=width*.45,p=landingPoint(s,cell.id,radius),[birthX,birthY]=center(cell.id);
 const a=n(3)*Math.PI*2,speed=75+n(4)*70;
 const d={id,sourceCell:cell.id,cell:hitCell(p.x,p.y),kind:cell.kind,reserved:false,width,radius,variant:Math.floor(n(7)*3),angle:n(6)*Math.PI*2,x:p.x,y:p.y,birthX,birthY,age:0,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,omega:(n(5)-.5)*12,z:0,vz:105+n(9)*65,impact:0,friction:1.8+n(11)*1.1,confined:!!p.confined};
 if(d.confined)d.vx=d.vy=d.vz=d.omega=0;
 d.owner=owner;d.value=golden?1:cell.value??1;
 if(golden){d.kind='golden';d.golden=true;d.vz+=60;}   // 상자에서 조금 더 높이 튀어 오른다
 s.drops.push(d);return d;
}
export function updateMinedDrops(s,dt){
 for(const d of s.drops){d.age+=dt;
  if(d.confined&&d.retryRevision!==s.navRevision){d.retryRevision=s.navRevision;const p=landingPoint(s,d.sourceCell,d.radius);if(!p.confined){d.x=p.x;d.y=p.y;d.confined=false;}}
 }
 const field={state:s,bodies:s.drops.filter(d=>!d.confined),time:0,accumulator:s.lootAccumulator};
 updateLootField(field,dt);s.lootAccumulator=field.accumulator;
 for(const d of s.drops){d.cell=hitCell(d.x,d.y);if(!d.landed&&d.impact>.01){d.landed=true;s.events.push({type:'land',time:s.time,kind:d.kind,x:d.x,y:d.y,dropId:d.id});}}
}
// Catch a low descending/rolling piece after the birth-to-floor visual ends.
export const canPickDrop=d=>!d.confined&&d.age>=.28&&d.z<=10&&(d.vz<=0||d.z<1)&&Math.hypot(d.vx,d.vy)<=110;
export function dropVisual(d){const k=Math.min(1,d.age/.28),ease=1-(1-k)**2;return{x:d.birthX+(d.x-d.birthX)*ease,y:d.birthY+(d.y-d.birthY)*ease};}
