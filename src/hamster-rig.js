import { TIERS } from '../data/config.js';
import { RIG } from './hamster-rig-data.js';

export { RIG };
// Approved body artwork is mirrored for a rightward strike; weapon direction stays +X.
export const BODY_ART_FACING = -1;
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { const t=clamp(x);return t*t*(3-2*t); };
const mix = (a,b,t) => a+(b-a)*t;
const rotate = ([x,y],a) => [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
// Look up the hamster's own live pickaxe every draw: no skin-specific weapon or cached tier. Bare hands = D.
export function equippedPickaxe(s,hamsterId=s.crew?.[0]) {
  const id=s.gear?.[hamsterId],tier=s.inventory.find(item=>item.id===id)?.tier??0;
  return 'pickaxe_'+(TIERS[tier]??TIERS[0]).toLowerCase();
}

const REST={angle:.13,gripX:22,gripY:-25,tilt:0,sx:1,sy:1,bob:0};
const LOAD={angle:-.08,gripX:10,gripY:-27,tilt:-.065,sx:1.16,sy:.83,bob:0};
const LIFT={angle:-.48,gripX:-27,gripY:-37,tilt:-.12,sx:.94,sy:1.14,bob:0};
const HIT={angle:1.16,gripX:29,gripY:-26,tilt:.14,sx:1.27,sy:.74,bob:0};
const SQUASH={...HIT,angle:1.20,tilt:.12,sx:1.30,sy:.72};
const REBOUND={angle:.72,gripX:24,gripY:-27,tilt:-.065,sx:.93,sy:1.13,bob:-4};
const SETTLE={angle:.19,gripX:22,gripY:-25,tilt:.035,sx:1.08,sy:.92,bob:0};
function blend(a,b,t,stage) {
  return {...Object.fromEntries(Object.keys(REST).map(k=>[k,mix(a[k],b[k],t)])),stage};
}
// Pure shared motion. Skin and weapon art never determine the animation.
// Engine hits own contact time. Rendering never applies damage or changes unit clocks.
export function sampleHamsterPose({clock=0,index=0,motion=true,mining=true,moving=false,hasTarget=true,step=0,speed=0,period=2.1,toHit=2,sinceHit=9}={}) {
  const rest={...REST,stage:'idle'};
  if(!motion)return rest;
  const recovery=Math.min(.52,period*.42),impact=Math.min(.055,recovery*.16),windup=Math.min(.72,period*.48);
  // Compress at contact, then overshoot upward and settle with one smaller bounce.
  if(sinceHit>=0&&sinceHit<impact)return blend(HIT,SQUASH,smooth(sinceHit/impact),'hit');
  if(sinceHit>=impact&&sinceHit<recovery){
    const p=(sinceHit-impact)/(recovery-impact);
    if(p<.30)return blend(SQUASH,REBOUND,smooth(p/.30),'recover');
    if(p<.63)return blend(REBOUND,SETTLE,smooth((p-.30)/.33),'recover');
    return blend(SETTLE,REST,smooth((p-.63)/.37),'recover');
  }
  if(mining&&!moving&&hasTarget&&toHit>=0&&toHit<windup) {
    const p=1-toHit/windup;
    // Store weight in a squat before lifting. The fast release lands exactly on the hit event.
    if(p<.30)return blend(REST,LOAD,smooth(p/.30),'load');
    if(p<.80)return blend(LOAD,LIFT,smooth((p-.30)/.50),'lift');
    if(p<.88)return {...LIFT,tilt:LIFT.tilt+Math.sin((p-.8)/.08*Math.PI*2)*.012,stage:'lift'};
    return blend(LIFT,HIT,((p-.88)/.12)**2,'strike');
  }
  if(moving&&speed>8) {
    const ph=Math.sin(step*Math.PI),lift=Math.abs(ph),k=Math.min(1,speed/100);
    return {...rest,stage:'walk',bob:-lift*7*k,tilt:ph*.11*k,sy:1-(1-lift)*.10*k+lift*.035*k,sx:1+(1-lift)*.10*k-lift*.025*k,angle:REST.angle+ph*.06};
  }
  const breath=Math.sin(clock*3+index);
  return {...rest,sy:1+.02*breath,sx:1-.012*breath};
}

// The same tier selects inventory art and a held variant with a thinner, longer shaft.
export function weaponTransform(id) {
  const w=RIG.weapons[id]??RIG.weapons.pickaxe_d;
  const dx=w.head[0]-w.grip[0],dy=w.head[1]-w.grip[1];
  return {w,align:-Math.PI/2-Math.atan2(dy,dx),scale:w.shaftLength/Math.hypot(dx,dy)};
}
export function weaponPoint(id,sourcePoint) {
  const {w,align,scale}=weaponTransform(id);
  return rotate([(sourcePoint[0]-w.grip[0])*scale,(sourcePoint[1]-w.grip[1])*scale],align);
}
// Same transforms as the renderer. Useful for grip QA and effects anchored to the real blade.
export function rigWorldPoint(point,pose,{x=0,y=0,face=1}={},onWeapon=false) {
  let p;
  if(onWeapon){
    // Only the grip socket follows the squishy body. The tool and paws stay rigid.
    const g=rotate([pose.gripX,pose.gripY],pose.tilt),q=rotate(point,pose.angle+pose.tilt);
    p=[g[0]*pose.sx+q[0],g[1]*pose.sy+q[1]];
  }else{
    const q=rotate([point[0]*BODY_ART_FACING,point[1]],pose.tilt);p=[q[0]*pose.sx,q[1]*pose.sy];
  }
  return [x+p[0]*face,y+pose.bob+p[1]];
}
export function rigGeometry(type,weapon,pose,placement={}) {
  const skin=RIG.skins[type]??RIG.skins.miner,w=RIG.weapons[weapon]??RIG.weapons.pickaxe_d;
  return {body:skin.body,weapon,weaponAsset:w.asset,grips:[[0,0],[0,-w.handSpacing]].map(p=>rigWorldPoint(p,pose,placement,true)),tip:rigWorldPoint(weaponPoint(weapon,w.tip),pose,placement,true)};
}
export function drawHamsterRig(ctx,assets,{type='miner',weapon='pickaxe_d',pose=sampleHamsterPose(),x=0,y=0,face=1,debug=false,hideWeapon=false}={}) {
  const skin=RIG.skins[type]??RIG.skins.miner;
  const actualWeapon=RIG.weapons[weapon]?weapon:'pickaxe_d';
  const {w,align,scale}=weaponTransform(actualWeapon),body=assets.manifest.frames[skin.body];
  ctx.save();ctx.translate(x,y+pose.bob);ctx.scale(face,1);
  ctx.save();ctx.scale(pose.sx,pose.sy);ctx.rotate(pose.tilt);ctx.scale(BODY_ART_FACING,1);
  assets.draw(ctx,skin.body,-skin.foot[0]*skin.scale,-skin.foot[1]*skin.scale,body.w*skin.scale,body.h*skin.scale,false);
  ctx.restore();
  if(!hideWeapon){
    const grip=rotate([pose.gripX,pose.gripY],pose.tilt);
    ctx.save();ctx.translate(grip[0]*pose.sx,grip[1]*pose.sy);ctx.rotate(pose.angle+pose.tilt);
    ctx.save();ctx.rotate(align);ctx.scale(scale,scale);
    const f=assets.manifest.frames[w.asset];
    assets.draw(ctx,w.asset,-w.grip[0],-w.grip[1],f.w,f.h,false);
    ctx.restore();
    // Both tiny paws cover the shaft. They cannot slide off when the equipped art changes.
    assets.draw(ctx,skin.paws[0],-8,-8,16,16);
    assets.draw(ctx,skin.paws[1],-8,-w.handSpacing-8,16,16);
    ctx.restore();
  }
  ctx.restore();
  const g=rigGeometry(type,actualWeapon,pose,{x,y,face});
  if(debug){
    ctx.save();ctx.lineWidth=1;ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(x-10,y);ctx.lineTo(x+10,y);ctx.moveTo(x,y-10);ctx.lineTo(x,y+10);ctx.stroke();
    for(const [i,p] of [...g.grips,g.tip].entries()){ctx.strokeStyle=i===2?'#ff815e':'#63ffd4';ctx.beginPath();ctx.arc(...p,4,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  return g;
}
