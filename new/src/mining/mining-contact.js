import {renewalPose} from './animation/motion.js';
import {RIG,rigWorldPoint,weaponPoint} from '../hamster-rig.js';
import {ORIGIN,TILE,RISE} from './grid.js';
export const ACTOR_SIZE=.51,FOOT_OFFSET=21;
// A fixed, smaller tool for this map only. Never stretch it to reach a target.
export const MINING_WEAPON_SCALE=.62,MAX_MINING_DISTANCE=42;
const weapon=RIG.weapons.pickaxe_d,hit=renewalPose('mine',0);
// Use the two ends of the existing pickaxe head. Work positions adapt to the
// approved swing. Body pose, grip socket and swing timing stay unchanged.
const ends=[weapon.tip,[2*weapon.head[0]-weapon.tip[0],weapon.tip[1]]].map(p=>rigWorldPoint(weaponPoint('pickaxe_d',p),hit,{weaponScale:MINING_WEAPON_SCALE},true));
export function miningContact(node,cell){
 const left=ORIGIN+cell.x*TILE,top=ORIGIN+cell.y*TILE,right=left+TILE,bottom=top+TILE+RISE;
 let best=null,score=Infinity;
 for(const face of [-1,1])for(let i=0;i<=12;i++){
  const t=i/12,x=node.x+(ends[0][0]+(ends[1][0]-ends[0][0])*t)*ACTOR_SIZE*face;
  const y=node.y+FOOT_OFFSET+(ends[0][1]+(ends[1][1]-ends[0][1])*t)*ACTOR_SIZE;
  const wallX=Math.max(left,Math.min(right,x)),wallY=Math.max(top,Math.min(bottom,y));
  const gap=Math.hypot(wallX-x,wallY-y);
  // Small allowance follows the painted, wavy edge, including its outline.
  if(gap>10)continue;
  const depth=Math.min(Math.abs(x-left),Math.abs(x-right),Math.abs(y-top),Math.abs(y-bottom));
  const cost=gap*10+depth*.1+i*.001;if(cost<score){score=cost;best={face,contact:{x,y}};}
 }
 return best;
}
