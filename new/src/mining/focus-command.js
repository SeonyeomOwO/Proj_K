import {isMineable} from './grid.js';
import {routesFrom,setDestination,BODY_GAP,restingSpotClear} from './navigation.js';
const available=h=>!h.cargo&&h.pickup==null&&!h.action&&!h.sleeping&&!h.care&&!(h.recover>0)&&!h.bomb&&h.blastTime==null;
export function assignFocusWork(s){
 if(s.focus===null||!isMineable(s.cells[s.focus]))return;
 const workers=s.crew.filter(available),stamp=`${s.commandRevision}/${s.navRevision}/${workers.map(h=>h.id).join(',')}`;
 if(stamp===s.focusPlanStamp&&s.time<(s.focusPlanAt??0))return;
 s.focusPlanStamp=stamp;s.focusPlanAt=s.time+.8;
 const assigned=new Set(),stands=[];
 // Valid occupied slots and independent swing clocks remain stable.
 for(const h of workers)if(h.work===s.focus&&h.stand){assigned.add(h.id);stands.push(h.stand);h.command=s.commandRevision;}
 const candidates=[];
 for(const h of workers){if(assigned.has(h.id))continue;const tree=routesFrom(s,h,{traffic:false});
  for(const n of tree.graph.nodes){if(!tree.distance.has(n.id)||!restingSpotClear(s,h,n))continue;
   const job=n.jobs.find(job=>job.work===s.focus);if(job)candidates.push({h,node:n,job,tree,cost:tree.distance.get(n.id)*10+Math.hypot(n.x-h.x,n.y-h.y)*.01});
  }
 }
 candidates.sort((a,b)=>a.cost-b.cost||a.h.id-b.h.id||a.node.id-b.node.id);
 for(const {h,node,job,tree}of candidates){
  if(assigned.has(h.id)||stands.some(p=>Math.hypot(p.x-node.x,p.y-node.y)<BODY_GAP+2))continue;
  assigned.add(h.id);stands.push(node);h.work=job.work;h.contact=job.contact;h.workFace=job.face;h.stand={x:node.x,y:node.y};h.command=s.commandRevision;h.wait=0;
  setDestination(h,node,tree);
 }
}
