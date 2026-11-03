import {renewalPose} from './animation/motion.js';
import {bodySocket} from './animation/elastic-motion.js';
import {ACTION,smoothStep} from './action-timing.js';
export {ACTOR_SIZE,FOOT_OFFSET} from './mining-contact.js';
import {ACTOR_SIZE,FOOT_OFFSET} from './mining-contact.js';
export function workerPose(h){
 // 날아가는 햄찌: 위로 길게 늘었다가 한 바퀴 돌고, 내려앉으면 납작하게 눌린다(높이는 visualWorker가 올린다)
 if(h.fling){
  const f=h.fling,idle=renewalPose('idle',h.breathTime??h.motion,0);
  if(f.landing>0){const q=Math.max(0,f.landing/.18);return{...idle,sx:idle.sx+.24*q,sy:idle.sy-.22*q};}
  const k=Math.min(1,f.time/f.duration),up=Math.sin(k*Math.PI);
  return{...idle,sx:idle.sx-.12*up,sy:idle.sy+.15*up,spin:k*Math.PI*2*f.dir};
 }
 if(['sleep','startle','eat','suction','drill','bomb','blown','pajamas'].includes(h.clip))return renewalPose(h.clip,h.motion,0);
 // Return the approved mining clip untouched: no target-dependent angle,
 // grip, squash or hit-stop overrides. Tool size is a fixed render setting.
 if(h.clip==='mine')return renewalPose('mine',h.motion,0);
 const idle=renewalPose('idle',h.breathTime??h.motion,0);
 let p=idle;
 if(h.clip==='walk'||h.clip==='carry'){
  const moving=renewalPose(h.clip,h.walkTime??h.motion,0),blend=h.moveBlend??1;
  p={...moving};for(const k of Object.keys(idle))if(typeof idle[k]==='number')p[k]=idle[k]+(moving[k]-idle[k])*blend;
  if(h.clip==='carry'){p.sx+=.035*(1-blend);p.sy-=.025*(1-blend);}
 }
 if(h.action){
  p={...idle};const t=h.actionTime;
  const bend=h.action==='pickup'?Math.sin(Math.PI*smoothStep(t/ACTION.pickup)):Math.sin(Math.PI*smoothStep(t/ACTION.deposit));
  p.sx+=bend*.14;p.sy-=bend*.13;p.bob+=bend*3;p.tilt+=bend*.055;
 }
 if(h.stepOverHeight>0&&!h.action&&(h.clip==='walk'||h.clip==='carry'))p={...p,bob:p.bob-h.stepOverHeight/ACTOR_SIZE};
 return p;
}
export function carrySocket(h,p=workerPose(h)){
 const socket=bodySocket(p,0,-29);
 return{x:h.x+(socket[0]+(p.shift??0))*ACTOR_SIZE*h.face,y:h.y+FOOT_OFFSET+(p.bob+socket[1]+(p.propY??0))*ACTOR_SIZE,angle:(p.tilt+(p.propAngle??0))*h.face};
}
export function actionFragment(s,h,p=workerPose(h)){
 const d=h.cargoDrop;if(!d||!h.action)return null;
 const hand=carrySocket(h,p),t=h.actionTime;
 if(h.action==='pickup'){
  const k=smoothStep((t-ACTION.grasp)/(ACTION.pickup-ACTION.grasp));
  const angle=d.angle+(hand.angle+d.angle*.15-d.angle)*k;
  const startY=d.y-(d.z??0),x=d.x+(hand.x-d.x)*k,y=startY+(hand.y-startY)*k-Math.sin(k*Math.PI)*8,reach=smoothStep(t/ACTION.grasp);
  return{x,y,angle,width:d.width*(1-.1*k),hands:true,handsX:hand.x+(x-hand.x)*reach,handsY:hand.y+(y-hand.y)*reach,alpha:1};
 }
 if(t>=ACTION.land)return null;
 const k=Math.max(0,(t-ACTION.release)/(ACTION.land-ACTION.release)),load=Math.sin(Math.min(1,t/ACTION.release)*Math.PI);
 const from=h.releaseFrom??hand,to={x:s.cart.x,y:s.cart.y-14};
 return{x:from.x+(to.x-from.x)*k-h.face*load*4,y:from.y+(to.y-from.y)*k-Math.sin(k*Math.PI)*21+load*2,angle:d.angle*.15+from.angle-k*.35*h.face,width:d.width*.9,hands:t<ACTION.release,alpha:1};
}
