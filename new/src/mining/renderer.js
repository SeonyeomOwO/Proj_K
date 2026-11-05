import {COLS,ROWS,TILE,ORIGIN,RISE,center,noise,holeMarker,isMineable} from './model.js';
import {drawActor} from './animation/motion.js';
import {paintWaveTerrain,waveContours,traceWave,wavePoint} from './terrain-wave.js';
import {contours} from './terrain-geometry.js';
import {drawHoleBase,drawHoleMarker} from './hole-marker.js';
import {getMineral} from './mineral-themes.js';
import {drawFragment,fragmentResources} from './loot/ore-fragments.js';
import {dropVisual} from './drop-system.js';
import {workerPose,actionFragment,carrySocket,ACTOR_SIZE,FOOT_OFFSET} from './worker-pose.js';
import {MINING_WEAPON_SCALE} from './mining-contact.js';
import {drawAim,visualWorker,drawFloorSeeds,drawTired,drawFloorTransition,drawTeamEnergy} from './interaction-renderer.js';
import {drawTerrainImpacts,breakBurst,hitDebris} from './terrain-impact.js';
import {ballHint,BALL_HINT} from './ball-hint.js';
import {drawToolIcon,drawCrown} from './tool-art.js';
import {drawRockHp} from './rock-hp.js';
import {FLING} from './fling.js';
import {FLING_LAND} from './worker-pose.js';
import {BALL} from './ball.js';
import {jelly,bump,tremble,dizzy,star} from './animation/juice.js';
// 등나무 공의 과장 연출: 당기면 당기는 쪽으로 늘어나며 덜덜, 구를 땐 가는 방향으로 쭉, 튕기면 그 방향으로 납작 출렁
function ballJuice(s,b,still){
 if(still)return{x:0,y:0,a:0,st:0};
 const a=s.aim;
 if(a?.what==='ball'){const d=Math.hypot(a.dx,a.dy);if(d>6){const k=Math.min(1,d/BALL.maxPull),tr=k>.6?tremble(s.time,(k-.6)/.4):{x:0,y:0};return{x:tr.x,y:tr.y*.5,a:Math.atan2(a.dy,a.dx),st:Math.min(.3,d/350)};}}
 const age=s.time-(b.bumpAt??-9);if(age>=0&&age<.4)return{x:0,y:0,a:b.bumpA,st:bump(age,Math.min(.4,.14+(b.bumpV??0)/1500))};
 const sp=Math.hypot(b.vx??0,b.vy??0);return sp>40?{x:0,y:0,a:Math.atan2(b.vy,b.vx),st:Math.min(.22,sp/2600)}:{x:0,y:0,a:0,st:0};
}
// 세게 부딪힌 자리에서 작은 별이 팡 튄다(o.bumpAt·bumpA·bumpV를 남기는 공·수레 공용)
function impactStars(c,s,o,r,still,min=300){
 const age=s.time-(o.bumpAt??-9);if(still||age<0||age>=.4||(o.bumpV??0)<min)return;
 const k=age/.4,e=1-(1-k)**3,cx=o.x-Math.cos(o.bumpA)*r,cy=o.y-Math.sin(o.bumpA)*r;
 c.save();c.globalAlpha=1-k;for(let j=0;j<5;j++){const a=o.bumpA+(j-2)*.55,d=6+e*24;star(c,cx+Math.cos(a)*d,cy+Math.sin(a)*d-e*6,4.2*(1-k*.4),'#ffe27a','#8a5a2a');}c.restore();
}
// 수레: 당기면 뒤로 버티며 웅크리고 덜덜(예비) → 놓으면 앞바퀴를 번쩍 들었다(윌리) 덜컹덜컹 달리고 →
// 부딪히면 쾅 납작해지며 통 튀고 → 멈추면 앞으로 꾸벅 쏠렸다 앞뒤로 흔들리며 자리 잡는다.
const CART={w:70,h:64,ground:27,wheel:.36};
function drawCart(c,s,cart,bounce,res,still){
 let x=cart.x,y=cart.y+bounce,tilt=0,lift=0,sx=1,sy=1,pivot=0,st=0,sa=0;
 const sp=Math.hypot(cart.vx??0,cart.vy??0),a=s.aim;
 if(!still){
  if(a?.what==='cart'){const d=Math.hypot(a.dx,a.dy),k=Math.min(1,d/FLING.cart.maxPull),dir=a.dx>=0?1:-1;
   // 손가락 쪽으로 살짝 끌려오며 앞을 들고 뒤로 버틴다(웅크림)
   if(d>6){const tr=tremble(s.time,k);x+=tr.x-dir*7*k;y+=tr.y*.4;tilt=-dir*.2*k;pivot=-dir;sx=1+.1*k;sy=1-.14*k;}}
  else if(sp>0){
   // 지금 달리는 방향 기준: hx = 가로 성분(-1~1). 가로로 달릴수록 기울기·윌리가 크고, 세로면 늘었다 줄었다로만.
   const hx=cart.vx/sp,dir=hx>=0?1:-1,age=s.time-(cart.launchAt??-9),run=Math.min(1,sp/220);
   // 출발: 확 잡아끌려 가는 방향으로 쭉 늘었다 돌아오고, 앞바퀴를 번쩍 들었다 쿵 내려놓는다(.4초 안에)
   const kick=age<.4?Math.sin(Math.min(1,age/.06)*Math.PI/2)*Math.exp(-Math.max(0,age-.06)*9):0;
   st=.2*kick;sa=Math.atan2(cart.vy,cart.vx);
   tilt=-dir*Math.abs(hx)*.26*kick+Math.sin(s.time*27)*.04*run*Math.abs(hx);pivot=-dir;
   lift=Math.abs(Math.sin(s.time*21))*4*run;   // 덜컹덜컹
  }
  const ba=s.time-(cart.bumpAt??-9);
  if(ba>=0&&ba<.45){const v=Math.min(1,(cart.bumpV??0)/300);st=bump(ba,.14+.24*v);sa=cart.bumpA;if(ba<.3)lift+=Math.sin(ba/.3*Math.PI)*12*v;}
  const sa2=s.time-(cart.stopAt??-9);
  if(!sp&&a?.what!=='cart'&&sa2>=0&&sa2<.75){
   // 멈춤: 가로로 달렸으면 앞으로 꾸벅 쏠렸다 앞뒤로 흔들리고, 세로로 달렸으면 납작 눌렸다 출렁
   const h=cart.stopDir??1,w=.18*Math.exp(-sa2*5)*Math.cos(sa2*15),side=h>=0?1:-1;
   tilt+=side*Math.abs(h)*w;pivot=w>=0?side:-side;if(!st){st=-.22*(1-Math.abs(h))*Math.exp(-sa2*6)*Math.cos(sa2*20);sa=Math.PI/2;}}
 }
 // 그림자(뜨면 작게)
 c.save();c.fillStyle='#3a24182e';c.beginPath();c.ellipse(cart.x,cart.y+CART.ground,30*(1-Math.min(.3,lift/60)),7,0,0,Math.PI*2);c.fill();c.restore();
 c.save();c.translate(x,y-lift);
 const px=pivot*CART.w*CART.wheel,py=CART.ground;c.translate(px,py);c.rotate(tilt);c.scale(sx,sy);c.translate(-px,-py);
 if(st)jelly(c,0,0,sa,st);
 res.draw(c,'cart-full',0,0,CART.w,CART.h);c.restore();
 impactStars(c,s,cart,26,still,200);
}
// 동굴 맵 바깥(캘 수 없는 칸)은 어둠으로 덮어, 작은 맵 덩어리가 떠 있는 모양이 보이게 한다(레퍼런스 맵 연출).
function paintOutside(c,s){
 if(!s.cells.some(x=>x.outside))return;
 const loops=waveContours(contours(s.cells.map(x=>({...x,solid:!!x.outside}))));
 c.save();traceWave(c,loops);c.fillStyle='#2e2320';c.fill('evenodd');
 c.save();traceWave(c,loops);c.clip('evenodd');
 for(let i=0;i<70;i++){const x=noise(i,5,81)*450,y=noise(i,7,82)*800;c.fillStyle=i%3?'#3a2c27':'#4a3a31';c.beginPath();c.arc(x,y,1+noise(i,9,83)*2.2,0,Math.PI*2);c.fill();}
 c.restore();
 traceWave(c,loops);c.lineJoin='round';c.strokeStyle='#1d1513';c.lineWidth=6;c.stroke();c.strokeStyle='#5b4334';c.lineWidth=2;c.stroke();
 c.restore();
}
// 물길: 뚫린 바닥 위의 청록 물(바위 덩어리와 그 벽면 아래로는 칠하지 않는다). 지나가면 느려진다.
function paintWater(c,s){
 if(!s.cells.some(x=>x.water))return;
 const water=waveContours(contours(s.cells.map(x=>({...x,solid:!!x.water})))),rock=waveContours(contours(s.cells));
 c.save();
 for(const dy of [0,RISE]){c.beginPath();c.rect(0,0,450,800);for(const pts of rock){pts.forEach(([x,y],i)=>{const[a,b]=wavePoint(x,y+dy);i?c.lineTo(a,b):c.moveTo(a,b);});c.closePath();}c.clip('evenodd');}
 traceWave(c,water,4);c.fillStyle='#3f9c98';c.fill('evenodd');
 traceWave(c,water);c.fillStyle='#62c6bd';c.fill('evenodd');c.strokeStyle='#2f7f7d';c.lineWidth=3;c.lineJoin='round';c.stroke();
 c.strokeStyle='#bff0e2';c.lineWidth=2;c.lineCap='round';
 for(const cell of s.cells)if(cell.water){const[x,y]=center(cell.id);for(const[dx,dy,w]of[[-10,-4,9],[6,6,7]]){c.beginPath();c.moveTo(x+dx-w,y+dy);c.quadraticCurveTo(x+dx,y+dy-4,x+dx+w,y+dy);c.stroke();}}
 c.restore();
}
export function paintTerrain(c,s,options){paintWaveTerrain(c,s,options);paintWater(c,s);paintOutside(c,s);}
// 층 목표(왼쪽 위): 광석 캐기(구멍이 풀리는 조건) + 이 층의 황금 상자. 다 채우면 체크.
function drawFloorGoals(c,s,rig){
 if(!s.holeNeed)return;
 const crates=s.cells.filter(x=>x.crate||x.opened),opened=crates.filter(x=>x.opened).length;
 const rows=[[`광석 캐기 ${Math.min(s.floorBroken??0,s.holeNeed)}/${s.holeNeed}`,(s.floorBroken??0)>=s.holeNeed]];
 if(crates.length)rows.push([`황금 상자 ${opened}/${crates.length}`,opened>=crates.length]);
 frame(c,rig,'panel_brown',13,62,128,14+rows.length*20,12);
 c.save();c.font='900 12px Game, sans-serif';c.textBaseline='middle';c.lineJoin='round';
 rows.forEach(([label,done],i)=>{const y=79+i*20;
  c.beginPath();c.arc(29,y,6,0,Math.PI*2);c.fillStyle=done?'#8fd06e':'#f2e3c2';c.fill();c.lineWidth=1.6;c.strokeStyle='#5a3b26';c.stroke();
  if(done){c.strokeStyle='#2e5a22';c.lineWidth=2;c.beginPath();c.moveTo(26,y);c.lineTo(28.5,y+2.5);c.lineTo(32.5,y-3);c.stroke();}
  c.textAlign='left';c.lineWidth=3;c.strokeStyle='#3c261b';c.strokeText(label,41,y+1);c.fillStyle=done?'#c9f0b0':'#ffebbb';c.fillText(label,41,y+1);
 });
 c.restore();
}
function line(c,points,color,width=1){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.stroke();}
export function frame(c,rig,id,x,y,w,h,edge=14){const f=rig.manifest.frames[id],im=rig.images[f.sheet],cap=Math.floor(Math.min(f.w,f.h)*.34),d=Math.min(edge,w/3,h/3),sx=[f.x,f.x+cap,f.x+f.w-cap],sy=[f.y,f.y+cap,f.y+f.h-cap],sw=[cap,f.w-2*cap,cap],sh=[cap,f.h-2*cap,cap],dx=[x,x+d,x+w-d],dy=[y,y+d,y+h-d],dw=[d,w-2*d,d],dh=[d,h-2*d,d];for(let j=0;j<3;j++)for(let i=0;i<3;i++)c.drawImage(im,sx[i],sy[j],sw[i],sh[j],dx[i],dy[j],dw[i],dh[j]);}
function text(c,value,x,y,size=18){c.font=`900 ${size}px Game, sans-serif`;c.textAlign='center';c.lineWidth=3;c.strokeStyle='#3c261b';c.strokeText(value,x,y+1);c.fillStyle='#ffebbb';c.fillText(value,x,y);}
function chunk(c,x,y,kind,size=7,alpha=1,angle=0,palette=null){const mineral=getMineral(kind),colors=palette?[palette.top,palette.rim]:mineral?[mineral.colors[0],mineral.colors[1]]:kind==='copper'?['#d8a650','#f4d389']:kind==='jade'?['#87b4a0','#b9d7bd']:['#cbb38b','#e4d0a4'];c.save();c.globalAlpha=alpha;c.translate(x,y);c.rotate(angle);c.beginPath();c.moveTo(-size*.5,0);c.lineTo(-size*.28,-size*.6);c.lineTo(size*.3,-size*.6);c.lineTo(size*.6,0);c.lineTo(size*.22,size*.4);c.lineTo(-size*.3,size*.35);c.closePath();c.fillStyle=colors[0];c.fill();c.strokeStyle=palette?.ink??'#795b3b';c.lineWidth=.7;c.stroke();line(c,[[-size*.25,-size*.55],[size*.3,-size*.55],[size*.42,-size*.22]],colors[1],1.1);c.restore();}
// 화면 맞춤 카메라(동굴 맵, 2026-11-04): 층에 들어서면 맵 덩어리가 위 정보 띠와 아래 버튼 사이에 꽉 차게 보인다.
// 작은 1층은 크게(최대 maxZoom배), 커진 깊은 층은 거의 1배. 예전 맵(바깥 어둠 없음)은 카메라를 쓰지 않는다.
export const MINE_VIEW={top:104,bottom:756,margin:12,minZoom:.8,maxZoom:1.6};
const cameras=new WeakMap();
export function mineCamera(s){
 const cached=cameras.get(s.cells);if(cached)return cached;
 let cam={zoom:1,x:225,y:400,sx:225,sy:400};
 const map=s.cells.filter(x=>!x.outside||x.pit);
 if(map.length<s.cells.length){
  const xs=map.map(x=>x.x),ys=map.map(x=>x.y),left=ORIGIN+Math.min(...xs)*TILE,right=ORIGIN+(Math.max(...xs)+1)*TILE,top=ORIGIN+Math.min(...ys)*TILE,bottom=ORIGIN+(Math.max(...ys)+1)*TILE+8;
  const V=MINE_VIEW,zoom=Math.max(V.minZoom,Math.min(V.maxZoom,(450-2*V.margin)/(right-left),(V.bottom-V.top-2*V.margin)/(bottom-top)));
  cam={zoom,x:(left+right)/2,y:(top+bottom)/2,sx:225,sy:(V.top+V.bottom)/2};
 }
 cameras.set(s.cells,cam);return cam;
}
export const toWorld=(cam,p)=>({x:(p.x-cam.sx)/cam.zoom+cam.x,y:(p.y-cam.sy)/cam.zoom+cam.y});
export const toScreen=(cam,p)=>({x:(p.x-cam.x)*cam.zoom+cam.sx,y:(p.y-cam.y)*cam.zoom+cam.sy});
export function drawScene(c,s,{res,terrainCache=null,reducedMotion=false,showResult=true}){
 const cam=mineCamera(s);
 c.save();c.fillStyle='#2e2320';c.fillRect(0,0,450,800);c.translate(cam.sx,cam.sy);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-cam.y);
 if(terrainCache)c.drawImage(terrainCache,0,0,450,800);else paintTerrain(c,s,{damageTiles:res.damageTiles});
 drawTerrainImpacts(c,s,{terrainCache,damageTiles:res.damageTiles,reducedMotion});
 if(s.grid){c.save();c.strokeStyle='#fff6d948';c.lineWidth=.75;for(let y=0;y<=ROWS;y++)line(c,[[0,ORIGIN+y*TILE],[450,ORIGIN+y*TILE]],'#fff6d948',.75);for(let x=0;x<=COLS;x++)line(c,[[ORIGIN+x*TILE,0],[ORIGIN+x*TILE,800]],'#fff6d948',.75);c.restore();}
 const marker=holeMarker(s);drawHoleBase(c,marker,s.holeAt);drawFloorSeeds(c,s,res);
 // 상자가 묻힌 바위: 상자 그림 대신 바위 위로 은은한 금빛이 숨 쉬듯 번지고 작은 반짝임이 돌아가며 떠서
 // '특별한 바위'임을 알린다. 맞으면 잠깐 더 밝아진다. 깨면 상자가 톡 튀어나온다(아래 'crate' 이벤트).
 for(const cell of s.cells){
  if(!cell.crate||!cell.solid)continue;
  const[x,y]=center(cell.id),hit=s.events.findLast(e=>e.type==='hit'&&e.id===cell.id),age=hit?s.time-hit.time:1;
  const breath=reducedMotion?.5:.5+.5*Math.sin(s.time*2.4+cell.id),flash=age<.3?1-age/.3:0,alpha=.16+.14*breath+.3*flash;
  c.save();c.translate(x,y+10);c.globalCompositeOperation='lighter';
  const g=c.createRadialGradient(0,0,3,0,0,31);g.addColorStop(0,`rgba(255,213,105,${alpha})`);g.addColorStop(.65,`rgba(255,196,80,${alpha*.45})`);g.addColorStop(1,'rgba(255,190,80,0)');
  c.fillStyle=g;c.beginPath();c.arc(0,0,31,0,Math.PI*2);c.fill();c.globalCompositeOperation='source-over';
  for(let i=0;i<3&&!reducedMotion;i++){
   const run=s.time*.8+i/3+cell.id*.17,t=run%1;if(t>.4)continue;
   const k=t/.4,a=Math.sin(k*Math.PI),n=Math.floor(run),px=(noise(cell.id,i,n)-.5)*36,py=(noise(i,cell.id,n+5)-.5)*30-4,r=2+4.5*a;
   c.save();c.globalAlpha=a*.95;c.fillStyle='#fff6c8';c.translate(px,py);c.rotate(k*.9);
   c.beginPath();for(let j=0;j<8;j++){const rr=j%2?r*.28:r;c.lineTo(Math.cos(j*Math.PI/4)*rr,Math.sin(j*Math.PI/4)*rr);}c.closePath();c.fill();c.restore();
  }
  c.restore();
 }
 // 바위 속 도구·화분이 비쳐 보인다(살짝 맥박). 시큼 열매로 무른 바위는 연두빛.
 for(const cell of s.cells){if(!cell.solid||cell.unbreakable)continue;const[x,y]=center(cell.id);
  if(cell.soft){c.save();c.globalAlpha=.28;c.fillStyle='#b5e27a';c.beginPath();c.ellipse(x,y+8,24,18,0,0,Math.PI*2);c.fill();c.restore();}
  const buried=cell.tool??(cell.pot?'pot':null);if(buried){c.save();c.globalAlpha=.55+.15*Math.sin(s.time*3+cell.id);drawToolIcon(c,buried,x+13,y-9,16,s.time);c.restore();}}
 if(s.focus!==null&&isMineable(s.cells[s.focus])){const[x,y]=center(s.focus),age=s.time-(s.focusAt??-1),pulse=Math.max(0,1-age/.65),r=24+pulse*5;c.save();c.globalAlpha=.3+pulse*.65;c.strokeStyle='#fff3bb';c.lineWidth=1.5+pulse;for(const[dx,dy]of[[-1,-1],[1,-1],[-1,1],[1,1]]){c.beginPath();c.moveTo(x+dx*(r-7),y+dy*r);c.lineTo(x+dx*r,y+dy*r);c.lineTo(x+dx*r,y+dy*(r-7));c.stroke();}c.restore();}
 const delivery=s.events.findLast(e=>e.type==='deposit'),deliveryAge=delivery?s.time-delivery.time:1;
 const bounce=deliveryAge<.35?Math.sin(deliveryAge/.35*Math.PI*2)*2*(1-deliveryAge/.35):0;
 const cart=s.cart??{x:150,y:653},ball=s.ball??{x:238,y:696};
 const objects=[...s.drops.map(d=>({depth:d.y,draw(){
  const p=dropVisual(d);c.fillStyle='#36283b2b';c.beginPath();c.ellipse(p.x,p.y+d.width*.3,d.width*(.44-Math.min(.15,d.z*.002)),d.width*.12,0,0,Math.PI*2);c.fill();
  drawFragment(c,d.kind,p.x,p.y-d.z,d.width,{variant:d.variant,angle:d.angle,sx:1+d.impact,sy:1-d.impact});
 }})),{depth:cart.y+25,draw(){drawCart(c,s,cart,bounce,res,reducedMotion);}},{depth:ball.y+18,draw(){
  const t=s.transition,k=t&&['suction','close','covered'].includes(t.stage)?t.stage==='suction'?Math.max(0,1-t.time/.38):0:1;
  if(k<=0)return;const diameter=ball.radius*2+1,r=diameter/2,hint=ballHint(s,reducedMotion);
  if(hint){
   // 먹일 햄찌가 있을 때만: 바닥 그림자(공이 뜰수록 작고 옅게)와 은은한 빛으로 "굴려 보세요"를 알린다
   const up=hint.lift/BALL_HINT.height;c.save();c.fillStyle='#3a24182e';c.globalAlpha=1-up*.45;
   c.beginPath();c.ellipse(ball.x,ball.y+r-2,r*(.9-up*.25),r*.28*(1-up*.3),0,0,Math.PI*2);c.fill();c.restore();
   if(hint.glow>0){c.save();c.globalAlpha=hint.glow;c.strokeStyle='#fff3bb';c.lineWidth=3;c.beginPath();c.arc(ball.x,ball.y-hint.lift,r+5,0,Math.PI*2);c.stroke();c.restore();}
  }
  // 늘고 줄어드는 기준은 공의 바닥(땅에 닿는 점)이고, 공 무늬의 회전과는 따로 적용한다
  const bj=ballJuice(s,ball,reducedMotion);
  c.save();c.translate(ball.x+bj.x,ball.y+bj.y);c.scale(k,k);c.translate(0,r-(hint?.lift??0));c.scale(hint?.sx??1,hint?.sy??1);c.translate(0,-r);if(bj.st)jelly(c,0,0,bj.a,bj.st);c.rotate(ball.angle??0);res.draw(c,'ball-full',0,0,diameter,diameter);c.restore();
  impactStars(c,s,ball,r,reducedMotion);
 }}];
 for(const original of s.crew){const h=visualWorker(s,original);objects.push({depth:s.transition?1000+h.y:Math.max(original.y,h.stepOverDepth??original.y)+FOOT_OFFSET,draw(){
  // 날아가는 햄찌의 바닥 그림자(높이 뜰수록 작고 옅게)
  if(original.fling?.z){const up=Math.min(1,original.fling.z/70);c.save();c.fillStyle='#3a24182e';c.globalAlpha=1-up*.5;c.beginPath();c.ellipse(original.x,original.y+FOOT_OFFSET-2,16*(1-up*.35),5*(1-up*.35),0,0,Math.PI*2);c.fill();c.restore();}
  const d=h.cargoDrop,p=workerPose(h),f=actionFragment(s,h,p),actorRes=fragmentResources(res,{variant:d?.variant??0,width:d?d.width*.9/ACTOR_SIZE:null,angle:d?d.angle*.15:0,alpha:h.action?0:1,unmirror:h.face});
  const carryOverride=f?.hands?{x:((f.handsX??f.x)-h.x)/ACTOR_SIZE*h.face-(p.shift??0),y:((f.handsY??f.y)-h.y-FOOT_OFFSET)/ACTOR_SIZE-p.bob,angle:f.angle*h.face}:null;
  if(d&&(h.care||h.sleeping))drawFragment(c,d.kind,h.x-18,h.y+19,d.width*.9,{variant:d.variant,angle:d.angle});
  // 잡혀서 당겨지는 중: 몸은 평소 자세 그대로, 화들짝 표정('!')으로 부들부들(세게 당길수록 더)
  const aim=s.aim,pull=aim?.what==='hamster'&&aim.id===original.id&&!s.transition?Math.hypot(aim.dx,aim.dy):0,held=pull>6;
  const shake=held&&!reducedMotion?tremble(s.time,Math.min(1,pull/FLING.hamster.maxPull)):{x:0,y:0};
  // 날아가는 중: 가는 방향으로 쭉 늘어난다(몸 가운데 기준)
  const fl=original.fling,stretch=fl&&!(fl.landing>0)&&fl.vis&&!reducedMotion?Math.min(.38,fl.vis.sp/1500):0;
  if(stretch){c.save();jelly(c,h.x,h.y+FOOT_OFFSET-38*ACTOR_SIZE,fl.vis.a,stretch);}
  drawActor(c,actorRes,{x:h.x+shake.x,y:h.y+FOOT_OFFSET+shake.y,size:ACTOR_SIZE,clip:held?'startle':h.clip,skin:h.skin,t:held?.1:h.motion,index:0,face:h.face,showTool:!h.cargo&&!h.care&&(!h.sleeping||h.clip==='pajamas'),emote:held||!!h.care||h.sleeping,prop:'fragment:'+(h.cargo??'stone'),poseOverride:p,carryOverride,weaponScale:MINING_WEAPON_SCALE});
  if(stretch)c.restore();
  // 내려앉은 뒤 잠깐 어질어질: 머리 위로 별이 빙글빙글
  if(fl?.landing>0&&!reducedMotion){const age=FLING_LAND-fl.landing;dizzy(c,h.x,h.y+FOOT_OFFSET-44,s.time,age>.12?Math.min(1,(age-.12)/.1)*Math.min(1,fl.landing/.2):0,15,5);}
  // 두 개 나르기: 둘째 짐은 머리 위에 하나 더 얹어 보인다
  const x2=original.extraDrop;if(x2&&h.cargo&&!h.action){const sock=carrySocket(h,p);drawFragment(c,x2.kind,sock.x+3*h.face,sock.y-15,x2.width*.8,{variant:x2.variant,angle:x2.angle*.2});}
  // 대장 햄찌 왕관, 꿀물 마신 햄찌 주변 반짝임
  if(original.leader&&!s.transition)drawCrown(c,h.x,h.y-38,s.time+h.id);
  if(original.honeyUntil>s.time&&!reducedMotion){c.save();c.fillStyle='#f6c945';for(let i=0;i<3;i++){const a=s.time*3+i*2.1;c.globalAlpha=.7;c.beginPath();c.arc(h.x+Math.cos(a)*16,h.y-10+Math.sin(a)*6,2,0,Math.PI*2);c.fill();}c.restore();}
  drawTired(c,s,h);
 }});}
 // 바닥의 층 도구(깃발·폭탄 등): 그림자 + 그림, 날아가는 동안은 떠 있다
 for(const t of s.tools??[])objects.push({depth:t.y+6,draw(){
  c.save();c.fillStyle='#3a24182e';c.beginPath();c.ellipse(t.x,t.y+10,10,3.5,0,0,Math.PI*2);c.fill();c.restore();
  const pop=t.born&&s.time-t.born<.4&&!reducedMotion?1+Math.sin((s.time-t.born)/.4*Math.PI)*.4:1;
  drawToolIcon(c,t.type,t.x,t.y-(t.z??0)-2,24*pop,t.type==='woodpecker'&&t.pecked&&s.time-t.pecked<.25?s.time:s.time*.2);
 }});
 // 그림자 햄찌(마스터리): 반투명하게 바위를 함께 캔다
 for(const g of s.shadows??[])objects.push({depth:g.y+FOOT_OFFSET,draw(){
  const left=g.until-s.time;c.save();c.globalAlpha=Math.min(.5,left*1.2,(s.time-(g.until-(s.mods?.shadow??3)))*2);
  drawActor(c,fragmentResources(res,{variant:0,width:null,angle:0,alpha:1,unmirror:g.face}),{x:g.x,y:g.y+FOOT_OFFSET,size:ACTOR_SIZE,clip:'mine',skin:'miner',t:(s.time*1.4)%2.1,index:0,face:center(g.cell)[0]>=g.x?1:-1,showTool:true,emote:false,weaponScale:MINING_WEAPON_SCALE});
  c.restore();
 }});
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
  if(e.type==='hit'&&e.crit&&age<.35){
   // 반짝 일격: 큰 별이 번쩍
   const k=age/.35;c.save();c.globalAlpha=1-k;c.fillStyle='#fff3a0';c.translate(e.x,e.y);c.rotate(k);c.beginPath();for(let i=0;i<10;i++){const r=i%2?5:16+k*10;c.lineTo(Math.cos(i*Math.PI/5)*r,Math.sin(i*Math.PI/5)*r);}c.closePath();c.fill();c.restore();
  }
  if(e.type==='honey'||e.type==='sour'||e.type==='pot'){
   // 꿀물·시큼 열매·화분: 퍼지는 고리(노랑·연두·초록)
   if(age<.6){const k=age/.6;c.save();c.globalAlpha=(1-k)*.6;c.fillStyle=e.type==='honey'?'#f6c945':e.type==='sour'?'#b5e27a':'#8fd06e';c.beginPath();c.ellipse(e.x,e.y+8,(e.r??70)*k,(e.r??70)*k*.5,0,0,Math.PI*2);c.fill();c.restore();}
   continue;
  }
  if(e.type==='shock'){
   // 착지 충격(마스터리): 땅을 따라 퍼지는 고리
   if(age<.4){const k=age/.4;c.save();c.globalAlpha=(1-k)*.7;c.strokeStyle='#fff0bd';c.lineWidth=4*(1-k)+1;c.beginPath();c.ellipse(e.x,e.y+16,12+k*66,6+k*30,0,0,Math.PI*2);c.stroke();c.restore();}
   continue;
  }
  if(e.type==='unlock'){
   // 구멍이 풀리는 순간: 금빛 고리가 퍼진다
   if(age<.7){const[x,y]=center(e.id),k=age/.7;c.save();c.globalAlpha=1-k;c.strokeStyle='#ffe58a';c.lineWidth=5*(1-k)+1;c.beginPath();c.ellipse(x,y+4,14+k*46,9+k*30,0,0,Math.PI*2);c.stroke();c.restore();}
   continue;
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
 drawRockHp(c,s,{reducedMotion});
 drawHoleMarker(c,marker,s.time,s.holeAt);drawAim(c,s);
 c.restore();   // 여기부터는 화면에 고정된 정보(카메라와 무관)
 frame(c,res.rig,'panel_brown',13,16,108,42);text(c,`지하 ${s.depth??1}층`,67,44);
 frame(c,res.rig,'panel_brown',342,16,95,42);res.draw(c,'seed',364,37,14,21);text(c,String(ball.seeds??0),402,44,17);
 if(s.crew?.length)drawTeamEnergy(c,s,{frame,rig:res.rig,text});
 // 상자가 여러 개인 층은 글 알림 없이 바위의 금빛만으로 알린다(사용자 결정 2026-11-04)
 drawFloorGoals(c,s,res.rig);
 // 이번 탐사에서 수레에 담은 황금 해바라기씨(상자를 열었을 때부터 보인다). 담길 때마다 톡 튄다.
 if(s.goldenFound){const got=s.events.findLast(e=>e.type==='deposit'&&e.golden),k=got&&s.time-got.time<.3&&!reducedMotion?1+.25*Math.sin((s.time-got.time)/.3*Math.PI):1;
  frame(c,res.rig,'panel_brown',342,62,95,34);c.save();c.translate(364,79);c.scale(k,k);res.draw(c,'golden-seed',0,0,22,22);c.restore();text(c,String(s.securedGolden??0),402,86,15);}
 if(s.phase==='ended'&&showResult){
  c.fillStyle='#21142666';c.fillRect(0,0,450,800);frame(c,res.rig,'panel_brown',55,291,340,180,25);
  text(c,'탐사 마침',225,334,24);text(c,`지하 ${s.depth}층 · 수레 확보 ${s.secured}개`,225,374,18);text(c,`수확 가치 ${s.securedValue??s.secured}`,225,401,17);text(c,'아래에서 다시 탐사할 수 있어요',225,434,13);
 }
 // 층 이동 조리개는 화면 기준이라 구멍 위치를 화면 좌표로 바꿔 넘긴다
 const t=s.transition;drawFloorTransition(c,t?{...s,transition:{...t,hole:toScreen(cam,t.hole)}}:s,{reducedMotion});
}
