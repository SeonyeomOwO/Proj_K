import {center,neighbors,isMineable} from './grid.js';
export function updateBlastFlight(h,dt){
 if(h.blastTime==null)return false;
 h.blastTime+=dt;h.clip='blown';h.motion=h.blastTime;
 if(h.blastTime>=2){h.blastTime=null;h.sleeping=true;h.sleepTime=0;h.clip='sleep';h.motion=0;}
 return true;
}
export function updateSleepMining(s,h,dt,strike){
 if(h.trait!=='pajamas'||!h.sleeping)return;
 if(h.sleepHitsRemaining==null){h.sleepHitsRemaining=!h.cargo&&h.pickup==null&&h.work!=null&&h.stand&&Math.hypot(h.x-h.stand.x,h.y-h.stand.y)<1?2:0;h.sleepMineTime=0;}
 if(h.sleepHitsRemaining<=0)return;
 if(!isMineable(s.cells[h.work])){h.sleepHitsRemaining=0;return;}
 const before=Math.floor(h.sleepMineTime/3);h.sleepMineTime+=dt;h.clip='pajamas';h.motion=h.sleepMineTime;h.face=h.workFace;
 if(Math.floor(h.sleepMineTime/3)>before){strike(s,h.work,h);h.sleepHitsRemaining--;h.recover=0;if(h.work===null)h.sleepHitsRemaining=0;}
}
export function updateBomb(s,h,dt,strike){
 if(h.trait!=='dynamite')return false;
 if(!h.bomb)h.bomb={cell:h.work,time:0};
 if(!isMineable(s.cells[h.bomb.cell])){h.bomb=null;return true;}
 h.bomb.time+=dt;h.clip='bomb';h.motion=h.bomb.time;h.face=h.workFace;
 if(h.bomb.time<2.4)return true;
 const origin=h.bomb.cell,targets=[origin,...neighbors(origin)].filter(id=>isMineable(s.cells[id])),[x,y]=center(origin);
 for(const id of targets)while(isMineable(s.cells[id]))strike(s,id,h);
 s.events.push({type:'blast',time:s.time,x,y,worker:h.id,count:targets.length});
 h.bomb=null;h.blastTime=0;h.stamina=0;h.recover=0;h.work=null;h.stand=null;h.goal=null;h.route=[];h.clip='blown';h.motion=0;
 return true;
}
