import {drawHamsterRig,sampleHamsterPose,RIG,BODY_ART_FACING} from '../../hamster-rig.js';
import {elasticPose,bodySocket,MOTION_INFO} from './elastic-motion.js';
export {MOTION_INFO};
export const CLIPS=[
 ['idle','대기', '기존 리깅'],['mine','곡괭이질','기존 리깅'],['walk','걷기','기존 리깅'],['tired','지친 채굴','속도 변형'],
 ['carry','광물 운반','추가 동작'],['sleep','퍼질러 잠','추가 동작'],['startle','화들짝','추가 동작'],['eat','옴뇸뇸','추가 동작'],
 ['full','배부름','추가 동작'],['drill','드릴 채굴','추가 동작'],['bomb','다이너마이트 설치','추가 동작'],['blown','폭발 반동','추가 동작'],
 ['pajamas','잠꼬대 채굴','추가 동작'],['suction','구멍으로 흡입','추가 동작'],['rest','마을 휴식','추가 동작'],['peek','창문에서 빼꼼','추가 동작']
].map(([id,name])=>({id,name,origin:'탄성 연출 시안',...MOTION_INFO[id]}));
const clamp=x=>Math.max(0,Math.min(1,x));
// Kept intact for the side-by-side comparison, including the previous preview clips.
export function legacyPose(clip,t=0,index=0){
 const period=clip==='tired'?4.1:2.1,phase=(t+index*.43)%period;
 const p=sampleHamsterPose({clock:t,index,mining:['mine','tired','pajamas'].includes(clip),moving:['walk','carry'].includes(clip),hasTarget:['mine','tired','pajamas'].includes(clip),step:t*(clip==='carry'?1.7:2.1),speed:clip==='carry'?65:85,period,toHit:period-phase,sinceHit:['mine','tired','pajamas'].includes(clip)?phase:99});
 if(clip==='sleep'){Object.assign(p,{sx:1.18+Math.sin(t*2)*.012,sy:.73+Math.sin(t*2)*.014,tilt:-.10,bob:0});}
 if(clip==='rest'){Object.assign(p,{sx:1.06+Math.sin(t*1.8)*.01,sy:.88+Math.sin(t*1.8)*.012,tilt:-.06,bob:0});}
 if(clip==='eat')Object.assign(p,{sx:1.04+Math.sin(t*17)*.018,sy:.94-Math.sin(t*17)*.013,tilt:0,bob:-Math.abs(Math.sin(t*8))*.8});
 if(clip==='full')Object.assign(p,{sx:1.12,sy:.95,tilt:Math.sin(t*1.5)*.035});
 if(clip==='startle'){const k=Math.sin(clamp(t%2/.55)*Math.PI);Object.assign(p,{sx:1-.14*k,sy:1+.23*k,bob:-28*k,tilt:.04*k});}
 if(clip==='drill')Object.assign(p,{sx:1.05,sy:.93,tilt:.09+Math.sin(t*60)*.016,bob:Math.sin(t*55)*1.1});
 if(clip==='bomb')Object.assign(p,{sx:1.21,sy:.72,tilt:.1,bob:0});
 if(clip==='blown'){const k=(t%2)/2;Object.assign(p,{sx:1-.1*Math.sin(k*Math.PI),sy:1+.1*Math.sin(k*Math.PI),tilt:0,bob:-Math.sin(k*Math.PI)*65});p.spin=k*Math.PI*2;}
 if(clip==='suction'){const k=(t%2)/2;p.size=1-k*.97;p.spin=k*Math.PI*2;p.bob=-Math.sin(k*Math.PI)*20;p.alpha=1-k*.65;}
 if(clip==='peek'){p.bob=Math.max(0,Math.sin(t*1.7))*20;p.sy=.95;}
 return p;
}
export function renewalPose(clip,t=0,index=0,{style='elastic',loop=false}={}){return style==='original'?legacyPose(clip,t,index):elasticPose(clip,t,index,{loop});}
// Face additions are code-native overlays anchored to the original sprite sockets.
// The approved body atlas is unchanged; different skins share the same motion.
const EYES={miner:[[129,148],[215,150]],farmer:[[130,163],[214,164]],star:[[133,163],[218,164]],rain:[[144,164],[228,168]],pink:[[132,154],[216,155]],explorer:[[132,164],[217,166]]};
function expression(c,skin,pose,type,face){
 if(!type)return;const s=RIG.skins[skin];c.save();c.translate(0,pose.bob);c.scale(face,1);c.scale(pose.sx,pose.sy);c.rotate(pose.tilt);c.scale(BODY_ART_FACING,1);
 for(const [i,eye]of EYES[skin].entries()){
  const x=(eye[0]-s.foot[0])*s.scale,y=(eye[1]-s.foot[1])*s.scale;
  c.fillStyle='#fff6e7';c.beginPath();c.ellipse(x,y,3.8,3.7,0,0,Math.PI*2);c.fill();c.strokeStyle='#382015';c.lineWidth=1.6;c.lineCap='round';c.beginPath();
  if(type==='closed'){c.moveTo(x-2.8,y);c.quadraticCurveTo(x,y+2.2,x+2.8,y);}
  if(type==='squeeze'){c.moveTo(x+(i?2.5:-2.5),y-2.2);c.lineTo(x+(i?-1.5:1.5),y);c.lineTo(x+(i?2.5:-2.5),y+2.2);}
  if(type==='wide')c.ellipse(x,y,2.6,3.2,0,0,Math.PI*2);c.stroke();
 }c.restore();
}
function bubble(c,label,x,y,t){c.save();c.translate(x,y-Math.sin(t*2)*2);c.fillStyle='#fff4dd';c.strokeStyle='#654534';c.lineWidth=1.4;const w=label==='헥헥'?32:26;c.beginPath();c.roundRect(-w/2,-12,w,21,8);c.fill();c.stroke();c.font='bold 12px Ham, sans-serif';c.textAlign='center';c.fillStyle='#654534';c.fillText(label,0,3);c.restore();}
// 손잡이(0,0 ~ 0,-21) 기준 도구 그림의 가운데·크기. 드릴은 손잡이 고리가 앞발에 오고 몸통·날이 앞으로 뻗는다.
const HELD_TOOLS={drill:{x:36,y:-10,w:92,h:47},dynamite:{x:9,y:-21,w:64,h:48}};
export function drawActor(c,res,{x=0,y=0,size=1,clip='mine',skin='miner',weapon='pickaxe_d',t=0,index=0,face=1,emote=true,prop='ore-stone',showTool=true,style='elastic',loop=false,poseOverride=null,carryOverride=null,weaponScale=1}={}){
 const pose=poseOverride??renewalPose(clip,t,index,{style,loop}),hasTool=showTool&&['mine','walk','idle','tired','pajamas'].includes(clip),original=style==='original';
 c.save();c.translate(x,y);c.scale(size,size);c.globalAlpha*=pose.alpha??1;
 const height=Math.max(0,-pose.bob),shadow=1-Math.min(.48,height/200);
 c.fillStyle='#54352222';c.beginPath();c.ellipse(0,1,36*(pose.size??1)*shadow,8*shadow,0,0,Math.PI*2);c.fill();
 c.translate((pose.shift??0)*face,0);
 c.scale(pose.size??1,pose.size??1);if(pose.spin){c.translate(0,-35+pose.bob);c.rotate(pose.spin);c.translate(0,35);pose.bob=0;}
 // 특성 도구: 드릴은 손잡이를 쥐고 앞으로 겨누고, 다이너마이트는 묶음을 받쳐 든다(광산 소품 그림 그대로)
 const held=HELD_TOOLS[weapon],customWeapon=held&&res.draw?ctx=>res.draw(ctx,weapon,held.x,held.y,held.w,held.h):null;
 drawHamsterRig(c,res.rig,{type:skin,weapon,pose,face,hideWeapon:!hasTool,weaponScale,customWeapon});
 const phase=t%(MOTION_INFO[clip]?.duration??2.1),blink=(t+index*.6)%4.4>4.28;
 const exp=['sleep','rest','pajamas','eat'].includes(clip)||blink?'closed':['drill','bomb'].includes(clip)?'squeeze':clip==='startle'&&phase<.46?'wide':!original&&pose.stage==='hit'?'squeeze':null;expression(c,skin,pose,exp,face);
 if(!hasTool){
  const s=RIG.skins[skin];c.save();c.translate(0,pose.bob);c.scale(face,1);
  const paws=(hands,pawSize=14)=>hands.forEach(([hx,hy],i)=>res.rig.draw(c,s.paws[i%2],hx-pawSize/2,hy-pawSize/2,pawSize,pawSize));
  const group=(id,x,y,w,h,hands,pawSize=14)=>{c.save();const override=clip==='carry'?carryOverride:null,at=override?[override.x,override.y]:original?[x,y]:bodySocket(pose,x,y);c.translate(at[0],at[1]+(override?0:pose.propY??0));c.rotate(override?override.angle:original?0:pose.tilt+(pose.propAngle??0));res.draw(c,id,0,0,w,h);paws(hands,pawSize);c.restore();};
  if(clip==='carry')group(prop,0,-29,38,32,[[-15,7],[16,7]]);
  else if(clip==='eat')group('seed',0,-35,10,15,[[-7,5],[7,5]],10);
  else if(clip==='drill')group('drill',28,-27,66,42,[[-26,1],[-2,5]]);
  else if(clip==='bomb'){
   if(original){res.draw(c,'dynamite',33,-8,30,28);paws([[-18,-45],[20,-45]]);}
   else{res.draw(c,'dynamite',33,-8+pose.propY,30,28);const k=pose.pawLift??0;paws([[16+( -18-16)*k,-17+(-47+17)*k+pose.propY*(1-k)],[42+(20-42)*k,-17+(-47+17)*k+pose.propY*(1-k)]].map(([hx,hy])=>bodySocket(pose,hx,hy)));}
  }else{
   const lift=pose.pawLift??0,handY=['sleep','rest'].includes(clip)?-16:clip==='full'?-22:-28-lift;
   const sway=['walk','idle','peek'].includes(clip)?Math.sin(t*7)*2:0;
   paws([[-18,handY+sway],[18,handY-sway]].map(([hx,hy])=>original?[hx,hy]:bodySocket(pose,hx,hy)),clip==='full'?12:14);
  }c.restore();
 }
 if(emote){const b={sleep:'z',rest:'z',tired:'헥헥',startle:'!',full:'♡',pajamas:'z'}[clip];if(b)bubble(c,b,32,clip==='sleep'||clip==='rest'?-75:-100,t);}
 c.restore();return pose;
}
