import {drawActor} from '../mining/animation/motion.js';
import {frame} from '../mining/renderer.js';
import {fatigueState,canDepart} from './state.js';
import {HOME,WORLD,worldPoint,pan,zoomAt,pinch} from './camera.js';
import {HOLE,PLAZA,freshBall,aimVelocity,stepBall,trajectory} from './plaza.js';

const BUILDINGS=[
 {id:'forge',x:480,y:820,w:185,h:185,label:'대장간',action:'mine-forge'},
 {id:'mastery',x:920,y:820,w:185,h:185,label:'마스터리',action:'mastery'},
 {id:'care-house',x:480,y:1130,w:195,h:180,label:'쉼터',action:'village-rest'},
 {id:'home',x:930,y:1150,w:190,h:185,label:'햄찌의 집',action:'village-rest'},
];
const DECOR=[
 {id:'playground',x:700,y:410,w:200,h:180},
 {id:'bench',x:500,y:460,w:110,h:70},{id:'bench',x:910,y:480,w:110,h:70},
 {id:'flowerbed',x:520,y:590,w:120,h:85},{id:'flowerbed',x:895,y:590,w:120,h:85},
 {id:'flowerbed',x:440,y:940,w:100,h:70},{id:'flowerbed',x:970,y:940,w:100,h:70},
 {id:'bench',x:760,y:1290,w:110,h:70},
 ...[[250,340],[1100,350],[220,680],[1180,720],[240,1040],[1160,1080],[350,1400],[1000,1470],[600,1510],[740,210],[420,210],[1010,180]].map(([x,y],i)=>({id:'tree',x,y,w:180+i%3*18,h:215+i%3*18})),
];
const REST_SPOTS=[[450,1184],[515,1184],[565,1228],[475,1254]];
const SKINS=['miner','star','miner','miner'];
function label(c,text,x,y,size=17){
 c.font=`900 ${size}px Game, sans-serif`;c.textAlign='center';c.lineJoin='round';c.lineWidth=3.5;
 c.strokeStyle='#67472d';c.strokeText(text,x,y);c.fillStyle='#fff3d4';c.fillText(text,x,y);
}
function rounded(c,x,y,w,h,r,color){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function path(c,points,width,color){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.strokeStyle=color;c.stroke();}
const rand=n=>{const r=Math.sin(n*127.1+41.7)*43758.5453;return r-Math.floor(r);};

export class VillageWorld{
 constructor(canvas,res,{getState,blocked,open,notify,onEnter,onChange}){
  Object.assign(this,{canvas,res,getState,blocked,open,notify,onEnter,onChange});
  this.context=canvas.getContext('2d');this.camera={...HOME};this.time=0;this.pointers=new Map();this.reset();
 }
 async load(){
  const base=new URL('../../assets/village/',import.meta.url);
  // manifest.web.json: tools/build-renewal-assets.mjs가 만든 게임용 WebP 목록(원본 PNG 목록은 manifest.json)
  const manifest=await fetch(new URL('manifest.web.json',base)).then(r=>{if(!r.ok)throw Error('마을 리소스를 열 수 없어요');return r.json();});
  this.sprites={};await Promise.all(manifest.assets.map(async p=>{this.sprites[p.id]={...p,image:await this.res.rig.image(new URL(p.path,base))};}));
  this.background=document.createElement('canvas');this.background.width=WORLD.width;this.background.height=WORLD.height;
  this.paintGround(this.background.getContext('2d'));this.bind();return this;
 }
 active(){const s=this.getState();return s.renewal?.village.scene==='village'&&!s.dungeon&&!s.rubyStage;}
 reset(){this.cancel();this.ball=freshBall();this.suction=null;this.camera={...HOME};this.wasResting=null;}
 cancel(){this.aim=null;this.gesture=null;this.pointers.clear();if(this.ball)this.ball.vx=this.ball.vy=0;}
 home(){this.cancel();this.camera={...HOME};}
 focusEntrance(){this.cancel();this.camera={x:700,y:795,zoom:.92};this.ball=freshBall();}
 zoom(factor){zoomAt(this.camera,factor,{x:225,y:400});}
 sprite(c,id,x,y,w,h,anchor=1){
  const p=this.sprites[id];if(!p)return;
  const[sx,sy,sw,sh]=p.bounds,k=Math.min(w/sw,h/sh);
  c.drawImage(p.image,sx,sy,sw,sh,x-sw*k/2,y-sh*k*anchor,sw*k,sh*k);
 }
 paintGround(c){
  c.fillStyle='#a5bb79';c.fillRect(0,0,WORLD.width,WORLD.height);
  // Low contrast clover patches leave buildings and the original hamsters readable.
  for(let i=0;i<95;i++){c.fillStyle=i%2?'#adc384':'#9eb674';c.beginPath();c.ellipse(rand(i)*1400,rand(i+99)*1700,45+rand(i+2)*80,25+rand(i+4)*45,0,0,Math.PI*2);c.fill();}
  const routes=[[[700,320],[700,600],[700,1310]],[[340,860],[700,920],[1060,860]],[[390,1200],[700,1230],[1020,1210]],[[440,480],[700,490],[990,490]]];
  for(const points of routes){path(c,points,123,'#82965d');path(c,points,116,'#d2b47d');path(c,points,105,'#ead09b');}
  c.fillStyle='#d5b987';c.beginPath();c.ellipse(700,900,170,185,0,0,Math.PI*2);c.fill();
  c.fillStyle='#ead09b';c.beginPath();c.ellipse(700,895,165,180,0,0,Math.PI*2);c.fill();
  // Visible stone rim matches the launch court's collision bounds.
  rounded(c,PLAZA.left-17,PLAZA.top-17,PLAZA.right-PLAZA.left+34,PLAZA.bottom-PLAZA.top+34,27,'#89745a');
  rounded(c,PLAZA.left-12,PLAZA.top-12,PLAZA.right-PLAZA.left+24,PLAZA.bottom-PLAZA.top+24,24,'#c4b28d');
  rounded(c,PLAZA.left-4,PLAZA.top-4,PLAZA.right-PLAZA.left+8,PLAZA.bottom-PLAZA.top+8,20,'#e8cd9d');
  for(let y=620;y<1040;y+=45){path(c,[[PLAZA.left-15,y],[PLAZA.left-5,y+3]],2,'#968161');path(c,[[PLAZA.right+5,y],[PLAZA.right+15,y+3]],2,'#968161');}
  for(let i=0;i<350;i++){
   const x=rand(i+310)*1400,y=rand(i+970)*1700;
   if(Math.abs(x-700)<175||Math.abs(y-880)<100||Math.abs(y-1210)<90||Math.abs(y-480)<80)continue;
   path(c,[[x-3,y],[x-6,y-7]],2,'#879e61');path(c,[[x+1,y],[x+4,y-8]],2,'#879e61');
   if(i%9===0){c.fillStyle=i%2?'#f7e5af':'#eec29e';c.beginPath();c.arc(x,y-9,3,0,7);c.fill();}
  }
  for(let i=0;i<48;i++){const x=620+rand(i+600)*160,y=690+rand(i+700)*330;c.fillStyle='#dabb88';c.beginPath();c.ellipse(x,y,2+rand(i)*3,1.3,0,0,7);c.fill();}
 }
 bind(){
  const c=this.canvas,point=e=>{const b=c.getBoundingClientRect();return{x:(e.clientX-b.left)*450/b.width,y:(e.clientY-b.top)*800/b.height};};
  c.addEventListener('wheel',e=>{
   if(!this.active()||this.blocked())return;e.preventDefault();
   if(this.pointers.size)this.cancel();
   const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?800:1);
   zoomAt(this.camera,Math.exp(-Math.max(-150,Math.min(150,delta))*.0025),point(e));
  },{passive:false});
  c.addEventListener('pointerdown',e=>{
   if(!this.active()||this.blocked()||this.suction||e.button!==0)return;
   e.preventDefault();c.focus({preventScroll:true});const p=point(e);this.pointers.set(e.pointerId,p);c.setPointerCapture(e.pointerId);
   if(this.pointers.size>1){this.aim=null;this.gesture={type:'pinch'};return;}
   const w=worldPoint(this.camera,p),near=Math.hypot(w.x-this.ball.x,w.y-this.ball.y)<34/this.camera.zoom;
   if(near){
    const s=this.getState();this.ball.vx=this.ball.vy=0;
    if(!s.renewal.village.prepared||!canDepart(s)){
     // Defer opening a panel until release so a pinch may start over the ball.
     this.gesture={type:'pan',start:p,moved:false};return;
    }
    this.aim={origin:w,pointer:w};this.gesture={type:'aim'};
   }else this.gesture={type:'pan',start:p,moved:false};
  });
  c.addEventListener('pointermove',e=>{
   if(!this.pointers.has(e.pointerId))return;
   if(this.blocked()||!this.active()){this.cancel();return;}
   const previous=[...this.pointers.values()].slice(0,2),old=this.pointers.get(e.pointerId),p=point(e);this.pointers.set(e.pointerId,p);
   if(this.pointers.size>=2){pinch(this.camera,previous,[...this.pointers.values()].slice(0,2));return;}
   if(this.gesture?.type==='aim'){this.aim.pointer=worldPoint(this.camera,p);}
   else if(this.gesture?.type==='pan'){
    const g=this.gesture;
    if(!g.moved&&Math.hypot(p.x-g.start.x,p.y-g.start.y)>5){g.moved=true;pan(this.camera,p.x-g.start.x,p.y-g.start.y);}
    else if(g.moved)pan(this.camera,p.x-old.x,p.y-old.y);
   }
   e.preventDefault();
  });
  const finish=(e,cancelled=false)=>{
   if(!this.pointers.has(e.pointerId))return;
   const g=this.gesture,p=point(e);
   if(!cancelled&&this.active()&&!this.blocked()&&this.pointers.size===1){
    if(g?.type==='aim'&&this.aim){
     const velocity=aimVelocity(this.aim.origin,worldPoint(this.camera,p));
     if(velocity.pull>6)Object.assign(this.ball,{vx:velocity.vx,vy:velocity.vy});
    }else if(g?.type==='pan'&&!g.moved)this.tap(worldPoint(this.camera,p));
   }
   this.aim=null;this.pointers.delete(e.pointerId);
   // A pinch remains suppressed until every finger is lifted.
   this.gesture=this.pointers.size?{type:'pinch'}:null;
   if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);
  };
  c.addEventListener('pointerup',e=>finish(e));c.addEventListener('pointercancel',e=>finish(e,true));
  c.addEventListener('lostpointercapture',e=>{if(this.pointers.has(e.pointerId))finish(e,true);});
  c.addEventListener('keydown',e=>{
   if(!this.active()||this.blocked())return;
   const keys={ArrowLeft:[50,0],ArrowRight:[-50,0],ArrowUp:[0,50],ArrowDown:[0,-50]};
   if(keys[e.key]){e.preventDefault();pan(this.camera,...keys[e.key]);}
   if(e.key==='+'||e.key==='=')this.zoom(1.15);if(e.key==='-')this.zoom(1/1.15);
   if(e.key==='Home'){e.preventDefault();this.home();}if(e.key==='Escape')this.cancel();
  });
 }
 tap(p){
  if(Math.hypot(p.x-this.ball.x,p.y-this.ball.y)<34/this.camera.zoom){this.open(canDepart(this.getState())?'mine-prepare':'village-rest');return;}
  if(Math.hypot((p.x-HOLE.x), (p.y-HOLE.y)*1.6)<70){this.open('mine-prepare');return;}
  const b=[...BUILDINGS].reverse().find(b=>p.x>=b.x-b.w/2&&p.x<=b.x+b.w/2&&p.y>=b.y-b.h&&p.y<=b.y+30);
  if(b)this.open(b.action);
 }
 async enter(){
  const s=this.getState();if(!canDepart(s)||!s.renewal.village.prepared){this.ball=freshBall();return;}
  this.cancel();this.suction={time:0,crew:this.crewPositions().map(p=>({...p}))};
 }
 crewPositions(){
  // 피곤할수록 쉼터 앞에서 늘어져 쉬는 햄찌가 늘고(5칸 중 칸 수에 비례), 다 차면 모두 퍼질러 잔다.
  const f=fatigueState(this.getState()),resting=f.count>=f.max?SKINS.length:Math.floor(f.count/f.max*SKINS.length);
  return SKINS.map((_,i)=>{
   if(i<resting){const[x,y]=REST_SPOTS[i];return{x,y,clip:f.count>=f.max?'sleep':'rest',t:this.time+i*.71,face:i%2?1:-1};}
   const t=(this.time+i*2.7)%12,moving=t<5,progress=moving?t/5:1;
   const x=620+(i%2)*160,y=865+Math.floor(i/2)*115+(i%2?1:-1)*Math.sin(progress*Math.PI)*32;
   return{x,y,clip:moving?'walk':'idle',t:this.time+i*.71,face:i%2?-1:1};
  });
 }
 step(dt){
  this.time+=Math.min(.1,dt);
  if(this.suction){
   this.suction.time+=dt;
   if(this.suction.time>=.82&&!this.suction.called){this.suction.called=true;this.onEnter();}
  }else if(!this.blocked()&&!this.aim&&(this.ball.vx||this.ball.vy)&&stepBall(this.ball,dt))this.enter();
 }
 render(){
  const c=this.context,cam=this.camera,s=this.getState(),f=fatigueState(s),tired=f.count>=f.max;
  c.save();c.setTransform(c.canvas.width/450,0,0,c.canvas.height/800,0,0);c.clearRect(0,0,450,800);
  c.save();c.translate(225,400);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-cam.y);c.drawImage(this.background,0,0);
  this.sprite(c,'mine-hole',HOLE.x,HOLE.y+45,132,91);
  label(c,'광산 입구',HOLE.x,HOLE.y-64,19);
  c.fillStyle='#fff4cb';c.beginPath();const bounce=s.settings.motion?Math.sin(this.time*3)*3:0;c.moveTo(HOLE.x-6,HOLE.y-51+bounce);c.lineTo(HOLE.x+6,HOLE.y-51+bounce);c.lineTo(HOLE.x,HOLE.y-43+bounce);c.fill();
  const objects=[...DECOR,...BUILDINGS].map(b=>({depth:b.y,draw:()=>{
   this.sprite(c,b.id,b.x,b.y,b.w,b.h);if(b.label)label(c,b.label,b.x,b.y+24,17);
  }}));
  const crew=this.suction?this.suction.crew:this.crewPositions();
  crew.forEach((p,i)=>objects.push({depth:this.suction?3000:p.y,draw:()=>{
   let x=p.x,y=p.y,size=.68,clip=p.clip,t=p.t;
   if(this.suction){const k=Math.max(0,Math.min(1,(this.suction.time-i*.045)/.6)),ease=k*k*(3-2*k);x+=(HOLE.x-x)*ease;y+=(HOLE.y-y)*ease;size*=1-ease;if(size<.01)return;clip='startle';t=k*.5;}
   drawActor(c,this.res,{x,y,size,clip,skin:SKINS[i],t:s.settings.motion?t:0,face:p.face,emote:true,showTool:false,loop:true});
  }}));
  objects.push({depth:this.ball.y+20,draw:()=>{
   if(this.suction)return;c.save();c.translate(this.ball.x,this.ball.y);c.rotate(this.ball.angle);
   this.res.draw(c,'ball-full',0,0,42,42);c.restore();
   if(!this.aim&&Math.hypot(this.ball.vx,this.ball.vy)<9)label(c,tired?'햄찌들이 지쳤어요':s.renewal.village.prepared?'당겨서 구멍으로!':'눌러서 탐사 준비',this.ball.x,this.ball.y+37,13);
  }});
  objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());
  if(this.aim){
   const v=aimVelocity(this.aim.origin,this.aim.pointer),points=trajectory(this.ball,v);
   c.strokeStyle='#fff6cb';c.lineWidth=3/cam.zoom;c.setLineDash([4/cam.zoom,7/cam.zoom]);c.beginPath();c.moveTo(this.ball.x,this.ball.y);points.forEach(p=>c.lineTo(p.x,p.y));c.stroke();c.setLineDash([]);
   path(c,[[this.ball.x,this.ball.y],[this.aim.pointer.x,this.aim.pointer.y]],2/cam.zoom,'#a18459');
  }
  c.restore();
  frame(c,this.res.rig,'panel_brown',13,16,125,42);label(c,'햄찌 마을',75,44,18);
  frame(c,this.res.rig,'panel_brown',326,16,111,42);this.res.draw(c,'seed',347,37,14,21);label(c,String(s.renewal.seeds),392,44,17);
  // 피곤함 칸(모바일 스테미너): 찬 칸은 주황, 빈 칸은 연하게. 칸이 남아 있으면 다음 1칸 회복까지 남은 시간.
  frame(c,this.res.rig,'panel_brown',100,67,250,34);
  for(let i=0;i<f.max;i++){c.beginPath();c.arc(124+i*19,84,6.5,0,Math.PI*2);c.fillStyle=i<f.count?'#e48a54':'#efe1c4';c.fill();c.lineWidth=1.6;c.strokeStyle=i<f.count?'#8a4a2a':'#b99a70';c.stroke();}
  const left=Math.ceil(f.nextMs/1000),time=`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
  label(c,f.count?`${tired?'지쳤어요':'피곤함'} · ${time}`:'쌩쌩해요!',275,90,13);
  c.restore();
  const desc=`햄찌 마을 · 피곤함 ${f.count}/${f.max}${f.count?' · 1칸 회복까지 '+time:''} · 씨앗 ${s.renewal.seeds}개 · 확대 ${Math.round(cam.zoom*100)}%`;
  if(this.canvas.getAttribute('aria-label')!==desc)this.canvas.setAttribute('aria-label',desc);
 }
}
