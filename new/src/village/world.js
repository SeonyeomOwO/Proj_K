import {drawActor} from '../mining/animation/motion.js';
import {frame} from '../mining/renderer.js';
import {fatigueState,canDepart,equipVillageTrait,villageCrew,traitUnlocked} from './state.js';
import {enhancementQuote} from '../mining/game-state.js';
import {TRAITS} from '../mining/mining-rules.js';
import {TIERS} from '../../data/config.js';
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
const REST_SPOTS=[[450,1184],[515,1184],[565,1228],[475,1254],[530,1270],[420,1222]];
const baseSkin=i=>i===3?'star':'miner';   // 광산과 같은 기본 옷(4번째가 별 잠옷)
// 장비 광장(레퍼런스의 더미 던지기, 검토용 배치): 광장 아래쪽에 특성 허수아비 4개.
// 햄찌를 당겼다 놓아 허수아비에 맞히면 그 특성을 끼고, 같은 허수아비에 다시 맞히면 뺀다.
const BASE_DUMMIES=[['workwear',612],['drill',671],['dynamite',730],['pajamas',789]].map(([trait,x])=>({trait,x,y:1024}));
// 마스터리로 연 특성(충전 곡괭이)은 구멍 왼쪽 아래에 허수아비가 하나 더 선다
const dummiesFor=s=>[...BASE_DUMMIES,...(traitUnlocked(s,'charge')?[{trait:'charge',x:612,y:715}]:[])];
const wornBy=(s,trait)=>{const r=s.renewal,i=r.traits.indexOf(trait);return i>=0?i:(r.traits2??[]).indexOf(trait);};
const DUMMY_HIT={dy:-30,r:25},FLING={grab:30,drag:1.6,stop:14,back:.9};
const josa=(word,a,b)=>{const c=word.charCodeAt(word.length-1);return c>=0xac00&&c<=0xd7a3&&(c-0xac00)%28?a:b;};
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
 reset(){this.cancel();this.ball=freshBall();this.suction=null;this.camera={...HOME};this.wasResting=null;this.flights=new Map();this.dummyHit={};this.rebuild={};this.seen=null;}
 cancel(){this.aim=null;this.fling=null;this.gesture=null;this.pointers.clear();if(this.ball)this.ball.vx=this.ball.vy=0;}
 skin(s,i){return TRAITS[s.renewal.traits?.[i]]?.skin??baseSkin(i);}
 crewCount(){return villageCrew(this.getState());}
 // 날아가는 중이 아닌 햄찌 중 손가락에 가장 가까운 한 마리
 grabHamster(w){
  const crew=this.crewPositions();let best=null;
  crew.forEach((p,i)=>{if(this.flights.has(i))return;const d=Math.hypot(w.x-p.x,w.y-(p.y-14));if(d<FLING.grab/Math.min(1,this.camera.zoom)&&(!best||d<best.d))best={i,d,x:p.x,y:p.y};});
  return best;
 }
 // 허수아비에 맞았을 때: 특성을 끼우거나 빼고 저장한다
 hitDummy(i,d){
  const res=equipVillageTrait(this.getState(),i,d.trait);this.dummyHit[d.trait]=this.time;if(!res)return;
  const name=TRAITS[d.trait].name;
  this.notify(res.removed?`햄찌 ${i+1}${i+1===1||i+1===3?'이':'가'} ${name}${josa(name,'을','를')} 벗었어요.`:`햄찌 ${i+1}에게 ${name}! ${TRAITS[d.trait].description}${res.from!=null?` (햄찌 ${res.from+1}는 기본 곡괭이로)`:''}`);
  this.onChange();
 }
 // 마을 건물의 '단계': 바뀌면 공사 연출(먼지·통통 튐)이 한 번 나온다. 아직 단계별 건물 그림은 없어 깃발 글씨로 보여 준다.
 levels(s){
  const pick=s.renewal.pick,book=s.masteryBook,mastery=book?Object.values(book.levels??{}).reduce((a,b)=>a+b,0):0;
  return{forge:pick?`${TIERS[pick.tier]}+${pick.level}`:'',mastery:`Lv ${mastery}`};
 }
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
   const w=worldPoint(this.camera,p),ballDistance=Math.hypot(w.x-this.ball.x,w.y-this.ball.y),near=ballDistance<34/this.camera.zoom;
   // 햄찌를 잡으면 공처럼 당겨 던진다(장비 광장). 공과 겹치면 손가락에 가까운 쪽.
   const hamster=this.grabHamster(w);
   if(hamster&&(!near||hamster.d<ballDistance)){this.fling={i:hamster.i,origin:{x:hamster.x,y:hamster.y},pointer:w};this.gesture={type:'fling'};return;}
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
   else if(this.gesture?.type==='fling'&&this.fling){this.fling.pointer=worldPoint(this.camera,p);}
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
    }else if(g?.type==='fling'&&this.fling){
     const f=this.fling,velocity=aimVelocity(f.origin,worldPoint(this.camera,p));
     if(velocity.pull>6)this.flights.set(f.i,{x:f.origin.x,y:f.origin.y,vx:velocity.vx,vy:velocity.vy,t:0,phase:'fly',hit:null});
     else{const t=this.getState().renewal.traits[f.i]??'none';this.notify(`햄찌 ${f.i+1} · ${TRAITS[t].name} — 당겼다 놓아 허수아비에 던지면 특성을 바꿔요.`);}
    }else if(g?.type==='pan'&&!g.moved)this.tap(worldPoint(this.camera,p));
   }
   this.aim=null;this.fling=null;this.pointers.delete(e.pointerId);
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
  const d=dummiesFor(this.getState()).find(d=>Math.hypot(p.x-d.x,p.y-(d.y+DUMMY_HIT.dy))<DUMMY_HIT.r+6);
  if(d){const t=TRAITS[d.trait],who=wornBy(this.getState(),d.trait);this.notify(`${t.name} 허수아비 · ${t.description}${who>=0?` · 지금 햄찌 ${who+1}`:''} — 햄찌를 던져 맞히면 껴요.`);return;}
  if(Math.hypot((p.x-HOLE.x), (p.y-HOLE.y)*1.6)<70){this.open('mine-prepare');return;}
  const b=[...BUILDINGS].reverse().find(b=>p.x>=b.x-b.w/2&&p.x<=b.x+b.w/2&&p.y>=b.y-b.h&&p.y<=b.y+30);
  if(b)this.open(b.action);
 }
 async enter(){
  const s=this.getState();if(!canDepart(s)||!s.renewal.village.prepared){this.ball=freshBall();return;}
  this.cancel();this.flights.clear();this.suction={time:0,crew:this.crewPositions().map(p=>({...p}))};
 }
 // 씨앗이 모여 곡괭이를 강화할 수 있으면 대장간 화덕에서 불길이 '확' 뿜어져 나와 알려 준다(글 안내 없이).
 forgeReady(s){const q=enhancementQuote(s);return !!q&&s.renewal.seeds>=q.cost&&(!s.renewal.run||s.renewal.run.phase==='ended');}
 forgeFlame(c,b,motion){
  const fx=b.x+61,fy=b.y-50,cycle=motion?(this.time%1.6)/1.6:.2,burst=cycle<.35?Math.sin(cycle/.35*Math.PI):0;
  c.save();c.globalCompositeOperation='lighter';
  const glow=c.createRadialGradient(fx,fy,2,fx,fy,34+burst*16);glow.addColorStop(0,'#ffd36acc');glow.addColorStop(1,'#ff7a2a00');
  c.fillStyle=glow;c.beginPath();c.arc(fx,fy,34+burst*16,0,Math.PI*2);c.fill();
  // 화덕 입구에서 위로 솟는 불혀 세 개(터질 때 크게, 평소엔 작게 일렁). 마을 원화처럼 진한 테두리를 둔다.
  c.globalCompositeOperation='source-over';c.lineJoin='round';
  for(const i of [0,2,1]){
   const sway=motion?Math.sin(this.time*9+i*2.1)*3:0,hgt=(10+burst*28)*(i===1?1:.78),x=fx-9+i*9+sway,wide=i===1?7:5.5;
   c.globalAlpha=.95;c.fillStyle=i===1?'#ffd84a':'#ff8a2e';c.strokeStyle='#9c3f17';c.lineWidth=1.8;
   c.beginPath();c.moveTo(x-wide,fy+4);c.quadraticCurveTo(x-wide-1,fy-hgt*.45,x,fy-hgt);c.quadraticCurveTo(x+wide+1,fy-hgt*.45,x+wide,fy+4);c.closePath();c.fill();c.stroke();
   if(i===1){c.fillStyle='#fff6c4';c.beginPath();c.moveTo(x-2.5,fy+2);c.quadraticCurveTo(x-3,fy-hgt*.3,x,fy-hgt*.55);c.quadraticCurveTo(x+3,fy-hgt*.3,x+2.5,fy+2);c.closePath();c.fill();}
  }
  c.globalCompositeOperation='lighter';
  // 불티
  if(motion)for(let i=0;i<5;i++){const t=(this.time*.9+i*.21)%1;c.globalAlpha=(1-t)*.9;c.fillStyle='#ffd27a';c.beginPath();c.arc(fx+Math.sin(i*2.3+t*4)*10,fy-10-t*44,1.8,0,Math.PI*2);c.fill();}
  c.restore();
 }
 // 특성 허수아비: 나무 기둥 + 짚 몸통 + 자루 머리 + 이름 팻말. 특성마다 소품 하나, 낀 햄찌가 있으면 번호 배지.
 drawDummy(c,d,s){
  const age=this.time-(this.dummyHit[d.trait]??-9),wob=age<.7&&s.settings.motion?Math.sin(age*22)*(1-age/.7)*.35:0,who=wornBy(s,d.trait);
  c.save();c.translate(d.x,d.y);
  c.fillStyle='#4a3a2233';c.beginPath();c.ellipse(0,2,18,5,0,0,Math.PI*2);c.fill();
  c.rotate(wob);c.lineJoin='round';c.lineCap='round';
  const ink='#6b4a30';
  c.fillStyle='#a87a4f';c.strokeStyle=ink;c.lineWidth=2;c.beginPath();c.roundRect(-3,-46,6,48,3);c.fill();c.stroke();
  c.beginPath();c.roundRect(-20,-38,40,6,3);c.fill();c.stroke();
  c.fillStyle='#e8c56a';c.beginPath();c.ellipse(0,-27,13,15,0,0,Math.PI*2);c.fill();c.stroke();
  c.strokeStyle='#c9a24a';c.lineWidth=1.4;for(const x of [-6,0,6]){c.beginPath();c.moveTo(x,-38);c.lineTo(x*.8,-15);c.stroke();}
  c.fillStyle='#d9bf91';c.strokeStyle=ink;c.lineWidth=2;c.beginPath();c.arc(0,-50,10,0,Math.PI*2);c.fill();c.stroke();
  c.fillStyle=ink;c.beginPath();c.arc(-3.5,-51,1.4,0,7);c.arc(3.5,-51,1.4,0,7);c.fill();
  // 특성 소품
  if(d.trait==='workwear'){c.fillStyle='#5b8fd0';c.strokeStyle='#30558a';c.beginPath();c.roundRect(-10,-31,20,16,4);c.fill();c.stroke();c.fillStyle='#f3d56a';c.beginPath();c.arc(-5,-28,1.8,0,7);c.arc(5,-28,1.8,0,7);c.fill();}
  if(d.trait==='drill'){c.fillStyle='#b9c2c9';c.strokeStyle='#5c6670';c.beginPath();c.moveTo(13,-30);c.lineTo(30,-25);c.lineTo(13,-20);c.closePath();c.fill();c.stroke();c.fillStyle='#e0a03c';c.beginPath();c.roundRect(5,-32,10,14,3);c.fill();c.stroke();}
  if(d.trait==='dynamite'){for(const x of [-6,0,6]){c.fillStyle='#d9483b';c.strokeStyle='#7d2a22';c.beginPath();c.roundRect(x-3,-34,6,15,2);c.fill();c.stroke();}c.strokeStyle='#5a4030';c.beginPath();c.moveTo(0,-34);c.quadraticCurveTo(4,-40,9,-38);c.stroke();c.fillStyle='#ffd25a';c.beginPath();c.arc(9,-38,2,0,7);c.fill();}
  if(d.trait==='pajamas'){c.fillStyle='#6d86d6';c.strokeStyle='#3c4f93';c.beginPath();c.moveTo(-10,-55);c.quadraticCurveTo(0,-72,14,-62);c.lineTo(10,-55);c.closePath();c.fill();c.stroke();c.fillStyle='#ffe27a';c.beginPath();c.arc(15,-63,3,0,7);c.fill();}
  if(d.trait==='charge'){c.fillStyle='#ffd84a';c.strokeStyle='#9c6a17';c.beginPath();c.moveTo(14,-40);c.lineTo(6,-26);c.lineTo(12,-26);c.lineTo(5,-12);c.lineTo(20,-30);c.lineTo(13,-30);c.lineTo(19,-40);c.closePath();c.fill();c.stroke();}
  c.restore();
  // 이름 팻말과 낀 햄찌 번호
  c.save();c.font='900 11px Game, sans-serif';const name=TRAITS[d.trait].name,pw=Math.max(44,c.measureText(name).width+12);
  c.fillStyle='#f2dfb6';c.strokeStyle=ink;c.lineWidth=1.8;c.beginPath();c.roundRect(d.x-pw/2,d.y+4,pw,18,5);c.fill();c.stroke();
  c.textAlign='center';c.fillStyle='#5a3d27';c.fillText(name,d.x,d.y+17);
  if(who>=0){c.fillStyle='#7cc46a';c.strokeStyle='#3d6d33';c.beginPath();c.arc(d.x+19,d.y-58,9,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#fff';c.font='900 11px Game, sans-serif';c.fillText(String(who+1),d.x+19,d.y-54);}
  c.restore();
 }
 // 건물 단계 깃발(대장간: 곡괭이 등급, 마스터리: 배운 단계 합)
 levelFlag(c,b,text,k){
  const x=b.x-b.w*.1,y=b.y-b.h*1.02,pop=k<1?1+Math.sin(k*Math.PI)*.35:1;
  c.save();c.translate(x,y);c.scale(pop,pop);c.strokeStyle='#6b4a30';c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.lineTo(0,34);c.stroke();
  c.font='900 12px Game, sans-serif';const w=c.measureText(text).width+14;
  c.fillStyle='#e9785a';c.beginPath();c.moveTo(0,0);c.lineTo(w,0);c.lineTo(w-5,9);c.lineTo(w,18);c.lineTo(0,18);c.closePath();c.fill();c.stroke();
  c.fillStyle='#fff6dc';c.textAlign='left';c.fillText(text,5,13);c.restore();
 }
 rebuildDust(c,b,k){
  c.save();c.globalAlpha=(1-k)*.8;
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2,r=b.w*.25+k*b.w*.35;c.fillStyle=i%2?'#e9dcc0':'#d8c6a2';c.beginPath();c.ellipse(b.x+Math.cos(a)*r,b.y-8+Math.sin(a)*r*.3-k*16,10+k*14,6+k*8,0,0,Math.PI*2);c.fill();}
  c.fillStyle='#fff3b0';for(let i=0;i<4;i++){const x=b.x+(i-1.5)*b.w*.2,y=b.y-b.h*(.4+k*.6)-i%2*12,r=3+4*Math.sin(k*Math.PI);c.beginPath();for(let j=0;j<8;j++){const rr=j%2?r*.3:r;c.lineTo(x+Math.cos(j*Math.PI/4)*rr,y+Math.sin(j*Math.PI/4)*rr);}c.closePath();c.fill();}
  c.restore();
 }
 crewPositions(){
  // 피곤할수록 쉼터 앞에서 늘어져 쉬는 햄찌가 늘고(5칸 중 칸 수에 비례), 다 차면 모두 퍼질러 잔다.
  const f=fatigueState(this.getState()),crew=this.crewCount(),resting=f.count>=f.max?crew:Math.floor(f.count/f.max*4);
  return Array.from({length:crew},(_,i)=>{
   if(i<resting){const[x,y]=REST_SPOTS[i];return{x,y,clip:f.count>=f.max?'sleep':'rest',t:this.time+i*.71,face:i%2?1:-1};}
   const t=(this.time+i*2.7)%12,moving=t<5,progress=moving?t/5:1;
   // 아래쪽 장비 광장(허수아비 줄)과 겹치지 않게 조금 위에서 오간다
   // 5·6번째(증원) 햄찌는 공 위쪽 가운데 줄에서 오간다
   const x=i<4?620+(i%2)*160:650+(i-4)*100,y=(i<4?850+Math.floor(i/2)*92:742)+(i%2?1:-1)*Math.sin(progress*Math.PI)*(i<4?30:18);
   return{x,y,clip:moving?'walk':'idle',t:this.time+i*.71,face:i%2?-1:1};
  });
 }
 // 던진 햄찌: 광장 안을 미끄러지듯 날다가(벽에 튕김) 허수아비에 맞으면 특성을 바꾸고, 멈추면 제자리로 걸어 돌아간다.
 stepFlights(dt){
  for(const [i,f] of this.flights){
   f.t+=dt;
   if(f.phase==='fly'){
    for(let left=Math.min(.1,dt);left>1e-8;left-=1/120){
     const h=Math.min(left,1/120);f.x+=f.vx*h;f.y+=f.vy*h;
     if(f.x<PLAZA.left||f.x>PLAZA.right){f.x=Math.max(PLAZA.left,Math.min(PLAZA.right,f.x));f.vx*=-.45;}
     if(f.y<PLAZA.top||f.y>PLAZA.bottom){f.y=Math.max(PLAZA.top,Math.min(PLAZA.bottom,f.y));f.vy*=-.45;}
     if(!f.hit)for(const d of dummiesFor(this.getState())){const dx=f.x-d.x,dy=f.y-(d.y+DUMMY_HIT.dy),dist=Math.hypot(dx,dy);
      if(dist<DUMMY_HIT.r){f.hit=d.trait;this.hitDummy(i,d);const nx=dx/(dist||1),ny=dy/(dist||1),dot=f.vx*nx+f.vy*ny;if(dot<0){f.vx-=1.4*dot*nx;f.vy-=1.4*dot*ny;}f.vx*=.45;f.vy*=.45;break;}}
     const decay=Math.exp(-FLING.drag*h);f.vx*=decay;f.vy*=decay;
     if(Math.hypot(f.vx,f.vy)<FLING.stop){f.vx=f.vy=0;f.phase='back';f.t=0;f.from={x:f.x,y:f.y};break;}
    }
   }else if(f.t>=FLING.back)this.flights.delete(i);
  }
 }
 // 건물 단계가 바뀌면(강화·마스터리) 창을 닫고 마을이 보일 때 한 번 공사 연출
 checkRebuild(s){
  if(this.blocked())return;const now=this.levels(s);
  if(this.seen)for(const id of Object.keys(now))if(now[id]!==this.seen[id])this.rebuild[id]=this.time;
  this.seen=now;
 }
 step(dt){
  this.time+=Math.min(.1,dt);
  if(!this.blocked()){this.stepFlights(dt);this.checkRebuild(this.getState());}
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
  const motion=s.settings.motion,levels=this.levels(s);
  const objects=[...DECOR,...BUILDINGS].map(b=>({depth:b.y,draw:()=>{
   // 공사 연출: 건물이 통통 튀고 바닥에서 먼지가 퍼지며 반짝임이 오른다(1.2초)
   const age=this.time-(this.rebuild[b.id]??-9),k=age/1.2,building=k>=0&&k<1;
   c.save();
   if(building&&motion){const wob=Math.sin(k*Math.PI*4)*(1-k)*.07;c.translate(b.x,b.y);c.scale(1+wob,1-wob);c.translate(-b.x,-b.y);}
   this.sprite(c,b.id,b.x,b.y,b.w,b.h);c.restore();
   if(b.label)label(c,b.label,b.x,b.y+24,17);
   if(levels[b.id])this.levelFlag(c,b,levels[b.id],building?k:1);
   if(building)this.rebuildDust(c,b,k);
   if(b.id==='forge'&&this.forgeReady(s))this.forgeFlame(c,b,motion);
  }}));
  for(const d of dummiesFor(s))objects.push({depth:d.y,draw:()=>this.drawDummy(c,d,s)});
  const crew=this.suction?this.suction.crew:this.crewPositions();
  crew.forEach((p,i)=>{
   const f=!this.suction&&this.flights.get(i);let gx=p.x,gy=p.y,lift=0,clip=p.clip,t=p.t,face=p.face;
   if(f?.phase==='fly'){gx=f.x;gy=f.y;const sp=Math.hypot(f.vx,f.vy);lift=Math.min(34,sp*.07);clip='startle';t=Math.min(.5,f.t);face=f.vx>=0?1:-1;}
   else if(f?.phase==='back'){const k=Math.min(1,f.t/FLING.back),e=k*k*(3-2*k);gx=f.from.x+(p.x-f.from.x)*e;gy=f.from.y+(p.y-f.from.y)*e;clip='walk';face=p.x>=f.from.x?1:-1;}
   objects.push({depth:this.suction?3000:gy,draw:()=>{
    let x=gx,y=gy,size=.68;
    if(this.suction){const k=Math.max(0,Math.min(1,(this.suction.time-i*.045)/.6)),ease=k*k*(3-2*k);x+=(HOLE.x-x)*ease;y+=(HOLE.y-y)*ease;size*=1-ease;if(size<.01)return;clip='startle';t=k*.5;}
    if(lift>1){c.fillStyle='#4a3a2240';c.beginPath();c.ellipse(x,y+4,17,5,0,0,Math.PI*2);c.fill();}
    drawActor(c,this.res,{x,y:y-lift,size,clip,skin:this.skin(s,i),t:motion?t:0,face,emote:true,showTool:false,loop:true});
    // 낀 특성 이름표
    // 낀 특성 이름표(둘째 칸까지)
    const worn=[s.renewal.traits?.[i],s.renewal.traits2?.[i]].filter(t=>t&&t!=='none'&&TRAITS[t]);if(!this.suction&&worn.length)label(c,worn.map(t=>TRAITS[t].name).join('·'),x,y+19-lift,11);
   }});
  });
  objects.push({depth:this.ball.y+20,draw:()=>{
   if(this.suction)return;c.save();c.translate(this.ball.x,this.ball.y);c.rotate(this.ball.angle);
   this.res.draw(c,'ball-full',0,0,42,42);c.restore();
   if(!this.aim&&Math.hypot(this.ball.vx,this.ball.vy)<9)label(c,tired?'햄찌들이 지쳤어요':s.renewal.village.prepared?'당겨서 구멍으로!':'눌러서 탐사 준비',this.ball.x,this.ball.y+37,13);
  }});
  objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());
  if(this.fling){
   // 햄찌 조준선: 공과 같은 감속으로 미끄러질 길(광장 벽에 튕김)
   const f=this.fling,v=aimVelocity(f.origin,f.pointer),b={x:f.origin.x,y:f.origin.y,vx:v.vx,vy:v.vy},pts=[];
   for(let i=0;i<40&&Math.hypot(b.vx,b.vy)>=FLING.stop;i++){for(let j=0;j<4;j++){const h=1/120;b.x+=b.vx*h;b.y+=b.vy*h;if(b.x<PLAZA.left||b.x>PLAZA.right){b.x=Math.max(PLAZA.left,Math.min(PLAZA.right,b.x));b.vx*=-.45;}if(b.y<PLAZA.top||b.y>PLAZA.bottom){b.y=Math.max(PLAZA.top,Math.min(PLAZA.bottom,b.y));b.vy*=-.45;}const k=Math.exp(-FLING.drag*h);b.vx*=k;b.vy*=k;}pts.push({x:b.x,y:b.y});}
   c.strokeStyle='#fff6cb';c.lineWidth=3/cam.zoom;c.setLineDash([4/cam.zoom,7/cam.zoom]);c.beginPath();c.moveTo(f.origin.x,f.origin.y);pts.forEach(p=>c.lineTo(p.x,p.y));c.stroke();c.setLineDash([]);
   path(c,[[f.origin.x,f.origin.y],[f.pointer.x,f.pointer.y]],2/cam.zoom,'#a18459');
  }
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
