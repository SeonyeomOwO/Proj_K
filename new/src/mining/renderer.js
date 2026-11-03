import {COLS,ROWS,TILE,ORIGIN,center,noise,holeMarker,isMineable} from './model.js';
import {drawActor} from './animation/motion.js';
import {paintWaveTerrain} from './terrain-wave.js';
import {drawHoleBase,drawHoleMarker} from './hole-marker.js';
import {getMineral} from './mineral-themes.js';
import {drawFragment,fragmentResources} from './loot/ore-fragments.js';
import {dropVisual} from './drop-system.js';
import {workerPose,actionFragment,ACTOR_SIZE,FOOT_OFFSET} from './worker-pose.js';
import {MINING_WEAPON_SCALE} from './mining-contact.js';
import {drawAim,visualWorker,drawFloorSeeds,drawTired,drawFloorTransition,drawTeamEnergy} from './interaction-renderer.js';
import {drawTerrainImpacts,breakBurst,hitDebris} from './terrain-impact.js';
import {ballHint,BALL_HINT} from './ball-hint.js';
export const paintTerrain=paintWaveTerrain;
function line(c,points,color,width=1){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
export function frame(c,rig,id,x,y,w,h,edge=14){const f=rig.manifest.frames[id],im=rig.images[f.sheet],cap=Math.floor(Math.min(f.w,f.h)*.34),d=Math.min(edge,w/3,h/3),sx=[f.x,f.x+cap,f.x+f.w-cap],sy=[f.y,f.y+cap,f.y+f.h-cap],sw=[cap,f.w-2*cap,cap],sh=[cap,f.h-2*cap,cap],dx=[x,x+d,x+w-d],dy=[y,y+d,y+h-d],dw=[d,w-2*d,d],dh=[d,h-2*d,d];for(let j=0;j<3;j++)for(let i=0;i<3;i++)c.drawImage(im,sx[i],sy[j],sw[i],sh[j],dx[i],dy[j],dw[i],dh[j]);}
function text(c,value,x,y,size=18){c.font=`900 ${size}px Game, sans-serif`;c.textAlign='center';c.lineWidth=3;c.strokeStyle='#3c261b';c.strokeText(value,x,y+1);c.fillStyle='#ffebbb';c.fillText(value,x,y);}
function chunk(c,x,y,kind,size=7,alpha=1,angle=0,palette=null){const mineral=getMineral(kind),colors=palette?[palette.top,palette.rim]:mineral?[mineral.colors[0],mineral.colors[1]]:kind==='copper'?['#d8a650','#f4d389']:kind==='jade'?['#87b4a0','#b9d7bd']:['#cbb38b','#e4d0a4'];c.save();c.globalAlpha=alpha;c.translate(x,y);c.rotate(angle);c.beginPath();c.moveTo(-size*.5,0);c.lineTo(-size*.28,-size*.6);c.lineTo(size*.3,-size*.6);c.lineTo(size*.6,0);c.lineTo(size*.22,size*.4);c.lineTo(-size*.3,size*.35);c.closePath();c.fillStyle=colors[0];c.fill();c.strokeStyle=palette?.ink??'#795b3b';c.lineWidth=.7;c.stroke();line(c,[[-size*.25,-size*.55],[size*.3,-size*.55],[size*.42,-size*.22]],colors[1],1.1);c.restore();}
export function drawScene(c,s,{res,terrainCache=null,reducedMotion=false,showResult=true}){
 if(terrainCache)c.drawImage(terrainCache,0,0,450,800);else paintTerrain(c,s,{damageTiles:res.damageTiles});
 drawTerrainImpacts(c,s,{terrainCache,damageTiles:res.damageTiles,reducedMotion});
 if(s.grid){c.save();c.strokeStyle='#fff6d948';c.lineWidth=.75;for(let y=0;y<=ROWS;y++)line(c,[[0,ORIGIN+y*TILE],[450,ORIGIN+y*TILE]],'#fff6d948',.75);for(let x=0;x<=COLS;x++)line(c,[[ORIGIN+x*TILE,0],[ORIGIN+x*TILE,800]],'#fff6d948',.75);c.restore();}
 const marker=holeMarker(s);drawHoleBase(c,marker,s.holeAt);drawFloorSeeds(c,s,res);
 // 바위에 박힌 상자: 처음부터 보여서 노릴 수 있다. 맞을 때마다 흔들리고, 가끔 반짝여 눈길을 끈다.
 for(const cell of s.cells){
  if(!cell.crate||!cell.solid)continue;
  const[x,y]=center(cell.id),hit=s.events.findLast(e=>e.type==='hit'&&e.id===cell.id),age=hit?s.time-hit.time:1;
  const shake=age<.25&&!reducedMotion?Math.sin(age*70)*3.2*(1-age/.25):0,squash=age<.18&&!reducedMotion?1-.08*(1-age/.18):1;
  c.save();c.translate(x+shake,y+17);c.scale(1/squash,squash);res.draw(c,'crate',0,0,46,40,{anchor:1});c.restore();
  const glint=(s.time*.55+cell.id*.13)%1;
  if(glint<.18&&!reducedMotion){const k=glint/.18,a=Math.sin(k*Math.PI);c.save();c.globalAlpha=a;c.fillStyle='#fff6c8';c.translate(x+12,y-8);c.rotate(k*1.2);
   c.beginPath();for(let i=0;i<8;i++){const r=i%2?2:7;c.lineTo(Math.cos(i*Math.PI/4)*r,Math.sin(i*Math.PI/4)*r);}c.closePath();c.fill();c.restore();}
 }
 if(s.focus!==null&&isMineable(s.cells[s.focus])){const[x,y]=center(s.focus),age=s.time-(s.focusAt??-1),pulse=Math.max(0,1-age/.65),r=24+pulse*5;c.save();c.globalAlpha=.3+pulse*.65;c.strokeStyle='#fff3bb';c.lineWidth=1.5+pulse;for(const[dx,dy]of[[-1,-1],[1,-1],[-1,1],[1,1]]){c.beginPath();c.moveTo(x+dx*(r-7),y+dy*r);c.lineTo(x+dx*r,y+dy*r);c.lineTo(x+dx*r,y+dy*(r-7));c.stroke();}c.restore();}
 const delivery=s.events.findLast(e=>e.type==='deposit'),deliveryAge=delivery?s.time-delivery.time:1;
 const bounce=deliveryAge<.35?Math.sin(deliveryAge/.35*Math.PI*2)*2*(1-deliveryAge/.35):0;
 const cart=s.cart??{x:150,y:653},ball=s.ball??{x:238,y:696};
 const objects=[...s.drops.map(d=>({depth:d.y,draw(){
  const p=dropVisual(d);c.fillStyle='#36283b2b';c.beginPath();c.ellipse(p.x,p.y+d.width*.3,d.width*(.44-Math.min(.15,d.z*.002)),d.width*.12,0,0,Math.PI*2);c.fill();
  drawFragment(c,d.kind,p.x,p.y-d.z,d.width,{variant:d.variant,angle:d.angle,sx:1+d.impact,sy:1-d.impact});
 }})),{depth:cart.y+25,draw(){res.draw(c,'cart-full',cart.x,cart.y+bounce,70,64);}},{depth:ball.y+18,draw(){
  const t=s.transition,k=t&&['suction','close','covered'].includes(t.stage)?t.stage==='suction'?Math.max(0,1-t.time/.38):0:1;
  if(k<=0)return;const diameter=ball.radius*2+1,r=diameter/2,hint=ballHint(s,reducedMotion);
  if(hint){
   // 먹일 햄찌가 있을 때만: 바닥 그림자(공이 뜰수록 작고 옅게)와 은은한 빛으로 "굴려 보세요"를 알린다
   const up=hint.lift/BALL_HINT.height;c.save();c.fillStyle='#3a24182e';c.globalAlpha=1-up*.45;
   c.beginPath();c.ellipse(ball.x,ball.y+r-2,r*(.9-up*.25),r*.28*(1-up*.3),0,0,Math.PI*2);c.fill();c.restore();
   if(hint.glow>0){c.save();c.globalAlpha=hint.glow;c.strokeStyle='#fff3bb';c.lineWidth=3;c.beginPath();c.arc(ball.x,ball.y-hint.lift,r+5,0,Math.PI*2);c.stroke();c.restore();}
  }
  // 늘고 줄어드는 기준은 공의 바닥(땅에 닿는 점)이고, 공 무늬의 회전과는 따로 적용한다
  c.save();c.translate(ball.x,ball.y);c.scale(k,k);c.translate(0,r-(hint?.lift??0));c.scale(hint?.sx??1,hint?.sy??1);c.translate(0,-r);c.rotate(ball.angle??0);res.draw(c,'ball-full',0,0,diameter,diameter);c.restore();
 }}];
 for(const original of s.crew){const h=visualWorker(s,original);objects.push({depth:s.transition?1000+h.y:Math.max(h.y,h.stepOverDepth??h.y)+FOOT_OFFSET,draw(){
  const d=h.cargoDrop,p=workerPose(h),f=actionFragment(s,h,p),actorRes=fragmentResources(res,{variant:d?.variant??0,width:d?d.width*.9/ACTOR_SIZE:null,angle:d?d.angle*.15:0,alpha:h.action?0:1,unmirror:h.face});
  const carryOverride=f?.hands?{x:((f.handsX??f.x)-h.x)/ACTOR_SIZE*h.face-(p.shift??0),y:((f.handsY??f.y)-h.y-FOOT_OFFSET)/ACTOR_SIZE-p.bob,angle:f.angle*h.face}:null;
  if(d&&(h.care||h.sleeping))drawFragment(c,d.kind,h.x-18,h.y+19,d.width*.9,{variant:d.variant,angle:d.angle});
  drawActor(c,actorRes,{x:h.x,y:h.y+FOOT_OFFSET,size:ACTOR_SIZE,clip:h.clip,skin:h.skin,t:h.motion,index:0,face:h.face,showTool:!h.cargo&&!h.care&&(!h.sleeping||h.clip==='pajamas'),emote:!!h.care||h.sleeping,prop:'fragment:'+(h.cargo??'stone'),poseOverride:p,carryOverride,weaponScale:MINING_WEAPON_SCALE});
  drawTired(c,s,h);
 }});}
 objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());
 // The same fragment is lifted into the paws, then tossed into the cart.
 for(const h of s.crew){const d=h.cargoDrop,f=actionFragment(s,h);if(!d||!f)continue;
  drawFragment(c,d.kind,f.x,f.y,f.width,{variant:d.variant,angle:f.angle});
 }
 for(const e of s.events){
  const age=s.time-e.time;
  if(e.type==='grasp')continue;
  if(e.type==='land'){
   if(age<.28){c.save();c.globalAlpha=(1-age/.28)*.3;c.fillStyle='#ecd3a7';for(let i=0;i<3;i++){c.beginPath();c.ellipse(e.x+(i-1)*(6+age*20),e.y+5-age*9,3+age*8,1.4+age*3,0,0,Math.PI*2);c.fill();}c.restore();}continue;
  }
  if(e.type==='deposit'){
   if(age<.3){c.save();c.globalAlpha=(1-age/.3)*.6;for(let i=0;i<4;i++){c.fillStyle='#e4cda0';c.beginPath();c.ellipse(cart.x+(i-1.5)*(7+age*23),cart.y-16-age*18,3+age*4,2+age*3,0,0,Math.PI*2);c.fill();}c.restore();}continue;
  }
  if(e.type==='crate'){
   // 상자가 열리는 순간: 열린 상자가 톡 튀어 오르며 금빛이 퍼지고, 씨앗은 드롭으로 따로 튀어 나간다
   if(age<.8){const[cx,cy]=center(e.id),pop=reducedMotion?1:age<.12?1+age/.12*.18:1.18-Math.min(.18,(age-.12)*.6);
    c.save();c.globalAlpha=Math.max(0,1-Math.max(0,age-.45)/.35);
    const glow=c.createRadialGradient(cx,cy,2,cx,cy,46);glow.addColorStop(0,'#fff3b0cc');glow.addColorStop(1,'#ffd56a00');c.fillStyle=glow;c.beginPath();c.arc(cx,cy,46,0,Math.PI*2);c.fill();
    c.translate(cx,cy+17);c.scale(pop,pop);res.draw(c,'crate-open',0,0,50,47,{anchor:1});c.restore();}
   continue;
  }
  const[x,y]=e.x===undefined?center(e.id):[e.x,e.y];
  if(e.type==='blast'){
   if(age<.42){c.save();c.globalAlpha=(1-age/.42)*.55;c.strokeStyle='#ffe1a5';c.lineWidth=4*(1-age/.42);c.beginPath();c.ellipse(x,y,20+age*165,14+age*110,0,0,Math.PI*2);c.stroke();c.restore();}continue;
  }
  if(e.type==='break'){
   const burst=breakBurst(s,e);if(!burst)continue;
   const {x:bx,y:by,palette,dustAlpha,shards}=burst;
   if(dustAlpha>0){c.save();c.globalAlpha=dustAlpha;c.fillStyle=palette.top;for(let i=0;i<6;i++){const a=i*Math.PI/3,r=7+age*48;c.beginPath();c.ellipse(bx+Math.cos(a)*r,by+Math.sin(a)*r*.55+7-age*16,7+age*17,5+age*11,0,0,Math.PI*2);c.fill();}c.restore();}
   for(const p of shards)chunk(c,p.x,p.y,e.kind,p.size,p.alpha);
   if(age<.07){c.save();c.globalAlpha=(1-age/.07)*.75;c.strokeStyle=palette.rim;c.lineWidth=2;c.beginPath();c.ellipse(bx,by,9+age*210,6+age*125,0,0,Math.PI*2);c.stroke();c.restore();}
  }else if(e.type==='hit'){
   const debris=hitDebris(s,e,reducedMotion);if(!debris)continue;
   const {palette,chips,dustAlpha}=debris;
   if(dustAlpha>0){c.save();c.globalAlpha=dustAlpha;c.fillStyle=palette.rim;for(let i=0;i<3;i++){c.beginPath();c.ellipse(x+(i-1)*(4+age*28),y+3-age*11,3+age*14,2+age*9,0,0,Math.PI*2);c.fill();}c.restore();}
   // A very short contact glint leaves time to read the flying rock chips.
   if(age<.075){c.save();c.globalAlpha=1-age/.075;c.translate(x,y);c.fillStyle=palette.rim;c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?2:7;i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();c.restore();}
   for(const p of chips)if(p.alpha>0)chunk(c,p.x,p.y,e.kind,p.size,p.alpha,p.angle,palette);
  }
 }
 drawHoleMarker(c,marker,s.time,s.holeAt);drawAim(c,s);
 frame(c,res.rig,'panel_brown',13,16,108,42);text(c,`지하 ${s.depth??1}층`,67,44);
 frame(c,res.rig,'panel_brown',342,16,95,42);res.draw(c,'seed',364,37,14,21);text(c,String(ball.seeds??0),402,44,17);
 if(s.crew?.length)drawTeamEnergy(c,s,{frame,rig:res.rig,text});
 // 이번 탐사에서 수레에 담은 황금 해바라기씨(상자를 열었을 때부터 보인다). 담길 때마다 톡 튄다.
 if(s.goldenFound){const got=s.events.findLast(e=>e.type==='deposit'&&e.golden),k=got&&s.time-got.time<.3&&!reducedMotion?1+.25*Math.sin((s.time-got.time)/.3*Math.PI):1;
  frame(c,res.rig,'panel_brown',342,62,95,34);c.save();c.translate(364,79);c.scale(k,k);res.draw(c,'golden-seed',0,0,22,22);c.restore();text(c,String(s.securedGolden??0),402,86,15);}
 if(s.phase==='ended'&&showResult){
  c.fillStyle='#21142666';c.fillRect(0,0,450,800);frame(c,res.rig,'panel_brown',55,291,340,180,25);
  text(c,'탐사 마침',225,334,24);text(c,`지하 ${s.depth}층 · 수레 확보 ${s.secured}개`,225,374,18);text(c,`수확 가치 ${s.securedValue??s.secured}`,225,401,17);text(c,'아래에서 다시 탐사할 수 있어요',225,434,13);
 }
 drawFloorTransition(c,s,{reducedMotion});
}
