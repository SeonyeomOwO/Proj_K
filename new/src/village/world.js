import {drawActor,renewalPose} from '../mining/animation/motion.js';
import {frame} from '../mining/renderer.js';
import {fatigueState,canDepart,equipVillageTrait,villageCrew,traitUnlocked,GENERATORS,collectGenerator,hamsterName,renameHamster,randomName,NAME_MAX} from './state.js';
import {enhancementQuote,ballCapacity,GOLDEN_NAME} from '../mining/game-state.js';
import {TRAITS} from '../mining/mining-rules.js';
import {TIERS} from '../../data/config.js';
import {HOME,ZOOM,WORLD,worldPoint,pan,zoomAt,pinch} from './camera.js';
import {HOLE,ZONES,ZONE,GATE,GATES,BALL_HOME,zoneById,zoneAt,gateBetween,gateCenter,freshBall,aimVelocity,stepBall,trajectory} from './plaza.js';

// ── 마을 구역(2026-11-05): 화면 한 장 크기 구역 4개 ──
//            [4 토템 마당] ─문─ [1 광산 입구(메인)] ─문─ [3 이름 우물]
//                                     │문
//                               [2 특성 경기장]
// 등나무 공을 굴려 경계 문을 지나가면 화면이 그 구역으로 넘어가고, 햄찌들이 문을 지나 우르르 따라온다.
// 1 광산 입구: 구멍 + 업그레이드 건물(햄찌의 집·도구 놀이터·마스터리·대장간·쉼터와 모닥불) + 층 깃발
// 2 특성 경기장: 울타리 두른 원형 경기장(특성 허수아비 + 해바라기 문양), 위쪽 출입구
// 3 이름 우물: 우물 + 폐허 기둥 + 분홍 숲
// 4 토템 마당: 해바라기 토템 · 황금 풍차 · 씨앗 창고 + 왼쪽 끝 바닷가
const ARENA={x:1080,y:1940,rx:300,ry:215};
const octagon=(k=1)=>Array.from({length:8},(_,i)=>{const a=(i*45+22.5)*Math.PI/180;return[ARENA.x+Math.cos(a)*ARENA.rx*k,ARENA.y+Math.sin(a)*ARENA.ry*k];});
// 경기장 울타리 출입구: 위쪽 변 가운데(광산 입구에서 내려오는 길)
const ARENA_DOORS=[{x:ARENA.x,y:ARENA.y-ARENA.ry*.924}];
const BUILDINGS=[
 // 성장 나무(2026-11-04): 마스터리 = 특별한 힘(황금), 햄찌의 집 = 햄찌 능력(해바라기씨), 쉼터 = 피곤함 + 돌봄 나무(해바라기씨),
 // 놀이터 = 층 도구(황금). 대장간은 곡괭이 강화 그대로. 모두 1구역(광산 입구)에 모은다.
 {id:'home',x:870,y:440,w:190,h:185,label:'햄찌의 집',action:'tree-home'},
 {id:'playground',x:1080,y:365,w:190,h:172,label:'도구 놀이터',action:'tree-tools'},
 {id:'mastery',x:1290,y:440,w:185,h:185,label:'마스터리',action:'tree-mastery'},
 {id:'forge',x:850,y:1120,w:185,h:185,label:'대장간',action:'mine-forge'},
 {id:'care-house',x:1310,y:1120,w:195,h:180,label:'쉼터',action:'village-rest'},
];
// 그림 파일 없이 캔버스로 그리는 마을 소품(눌러서 쓰는 것들)
const PROPS=[
 {id:'storage',x:320,y:480,w:150,h:170,label:'씨앗 창고'},
 {id:'mill',x:560,y:520,w:150,h:200,label:'황금 풍차',gen:'mill'},
 {id:'totem',x:420,y:1060,w:90,h:175,label:'해바라기 토템',gen:'totem'},
 {id:'well',x:1800,y:720,w:270,h:315,label:'이름 우물'},
];
const prop=id=>PROPS.find(p=>p.id===id);
// 이름 우물은 3구역의 주인공이라 크게(그림 배율 k). roof = 지붕 꼭대기 높이, 입구는 물 표면.
const WELL_ART={k:2.1,roof:150*2.1};
const WELL=prop('well'),WELL_MOUTH={x:WELL.x,y:WELL.y-24*WELL_ART.k,r:66};
// 햄찌를 받는 연출 시간(초): 구멍은 삼켰다가(swallow) 퉤 뱉고(spit), 우물은 들어갔다가(dive) 이름을 정하면 튀어나온다(pop)
// 디즈니식 과장: 움츠렸다(예비 동작) 쭉 늘어나며 튀어나가고(늘임) 꼭대기에서 잠깐 머물렀다(행 타임) 쿵 눌린 뒤 통 튀며 출렁 멈춘다(여운).
// spit·pop·ballSpit은 앞쪽 rumble초 동안 구멍·우물 속에서 우르르 부풀며 떨다가(예비) 펑 하고 뱉는다.
const ACT={swallow:.42,rumble:.42,spit:1.17,popRumble:.36,pop:1.06,charge:1.28,ballRumble:.32,ballFly:.55,ballSpit:1.27};
const CHARGE={seeds:.5,crouch:.14,jump:.34};   // 충전: 씨앗 쏙쏙 → 움츠림 → 점프 → 착지(나머지)
const clamp01=k=>Math.max(0,Math.min(1,k));
// 꼭대기에서 느려지는 시간 왜곡(0→1): 처음과 끝은 빠르고 가운데에서 둥실 머문다
const hang=u=>{const d=1-2*clamp01(u);return .5-.5*Math.sign(d)*Math.abs(d)**1.5;};
// from→to 포물선(높이 h): 땅 위치·떠오른 높이·지금 화면 진행 방향(a)과 빠르기(sp, u .02당 px)
const arc=(from,to,u,h)=>{const at=v=>{const k=hang(v);return[from.x+(to.x-from.x)*k,from.y+(to.y-from.y)*k,4*h*k*(1-k),k];};
 const [x,y,lift,k]=at(u),[x2,y2,l2]=at(Math.min(1,u+.02));return{x,y,lift,k,a:Math.atan2((y2-l2)-(y-lift),x2-x),sp:Math.hypot(x2-x,(y2-l2)-(y-lift))};};
// 착지: 쿵 눌렸다(0~.1) → 통 튀어 오르고(.1~.4) → 출렁이며 멈춘다(.4~.75). dur로 전체 길이를, amp로 세기를 바꾼다.
const landing=(age,dur=.75,amp=1)=>{const a=age*.75/dur;if(a<0||a>=.75)return{lift:0,st:0};
 if(a<.1)return{lift:0,st:-.45*amp*Math.sin(a/.1*Math.PI)};
 if(a<.4){const k=(a-.1)/.3;return{lift:Math.sin(k*Math.PI)*24*amp,st:.2*amp*Math.abs(Math.cos(k*Math.PI))};}
 const k=(a-.4)/.35;return{lift:0,st:-.3*amp*Math.cos(k*Math.PI*3)*(1-k)**2};};
// 젤리 변형: 점(x,y)을 축으로 a 방향으로 1+st배 늘이고 직각으로는 줄인다(st<0이면 그 방향으로 납작)
const jelly=(c,x,y,a,st)=>{c.translate(x,y);c.rotate(a);c.scale(1+st,1-st*.6);c.rotate(-a);c.translate(-x,-y);};
// 작은 별(어질어질·반짝)
const star=(c,x,y,r,fill,stroke)=>{c.beginPath();for(let j=0;j<10;j++){const rr=j%2?r*.45:r,a=-Math.PI/2+j*Math.PI/5;c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.4;c.stroke();}};
const CAMPFIRE={x:1165,y:1012};
const BANNERS=[{x:940,y:705,kind:'floor'},{x:1220,y:705,kind:'best'}];
const RUINS=[[1580,500,92],[2040,540,70],[2070,880,104],[1580,1010,58],[1980,1085,66]];
const DECOR=[
 {id:'flowerbed',x:600,y:1080,w:105,h:72},{id:'flowerbed',x:860,y:2300,w:105,h:72},{id:'flowerbed',x:1300,y:2300,w:105,h:72},
 {id:'bench',x:1080,y:2330,w:110,h:70},{id:'bench',x:2010,y:1070,w:110,h:70},
 ...[[260,150],[460,125],[660,160],[820,1530],[1340,1530]].map(([x,y],i)=>({id:'tree',x,y,w:180+i%3*18,h:215+i%3*18})),
 // 레퍼런스 오른쪽의 분홍 숲(3구역)
 ...[[2110,1180],[1900,1250],[2110,330],[1670,170],[1900,150]].map(([x,y],i)=>({id:'tree',pink:true,x,y,w:190+i%2*24,h:225+i%2*24})),
];
const REST_SPOTS=[[1115,1030],[1215,1035],[1165,1062],[1112,982],[1218,986],[1065,1055]];
// 구역마다 햄찌가 모여 오가는 자리(공이 그 구역에 있으면 모두 그리로 간다)
const SPOTS={
 hub:[[975,800],[1185,800],[985,935],[1175,935],[1080,1010],[1080,520]],
 arena:[[-110,-70],[110,-70],[-175,-5],[175,-5],[-50,-130],[60,-130]].map(([x,y])=>[ARENA.x+x,ARENA.y+30+y]),
 well:[[1640,840],[1960,840],[1700,940],[1900,940],[1800,1000],[1590,750]],
 totem:[[390,720],[570,720],[340,830],[590,840],[545,955],[470,620]],
};
const baseSkin=i=>i===3?'star':'miner';   // 광산과 같은 기본 옷(4번째가 별 잠옷)
// 특성 허수아비: 경기장 울타리 안쪽 아래 둘레에 줄지어 선다(위쪽은 출입구).
const onRing=deg=>{const a=deg*Math.PI/180;return{x:Math.round(ARENA.x+Math.cos(a)*ARENA.rx*.78),y:Math.round(ARENA.y+Math.sin(a)*ARENA.ry*.78)};};
const BASE_DUMMIES=[['workwear',150],['drill',118],['dynamite',90],['pajamas',62]].map(([trait,deg])=>({trait,...onRing(deg)}));
// 마스터리로 연 특성(충전 곡괭이)은 오른쪽 아래에 허수아비가 하나 더 선다
const dummiesFor=s=>[...BASE_DUMMIES,...(traitUnlocked(s,'charge')?[{trait:'charge',...onRing(32)}]:[])];
const wornBy=(s,trait)=>{const r=s.renewal,i=r.traits.indexOf(trait);return i>=0?i:(r.traits2??[]).indexOf(trait);};
const DUMMY_HIT={dy:-30,r:25},FLING={grab:30,drag:1.6,stop:14,walk:240,dive:.55};
// 구역이 바뀌면: 카메라가 옆(또는 아래)으로 미끄러지고(slide초), 햄찌들은 차례로(follow초 간격) 달려서(run px/s) 문을 지나 따라온다
const TRAVEL={slide:.8,follow:.1,run:300,card:1.8};
// 문 양쪽의 갈 곳 팻말 위치와 화살표 방향(a 구역 쪽 팻말은 b를, b 구역 쪽 팻말은 a를 가리킨다)
const gateSigns=g=>g.axis==='x'
 ?[{x:g.at-95,y:g.from-28,dir:'right',to:g.b},{x:g.at+95,y:g.from-28,dir:'left',to:g.a}]
 :[{x:(g.from+g.to)/2,y:g.at-118,dir:'down',to:g.b},{x:(g.from+g.to)/2,y:g.at+290,dir:'up',to:g.a}];
const zoneRect=z=>({left:z.left,right:z.right,top:z.top,bottom:z.bottom});
const flightBounds=z=>({left:z.left+30,right:z.right-30,top:z.top+190,bottom:z.top+1140});
const zoneView=(z,view)=>({x:view?.x??z.cx,y:view?.y??z.cy,zoom:view?.zoom??ZOOM.min,bounds:zoneRect(z)});
// 구역 사이 가는 길: 메인(광산 입구)을 거친다
const zonePath=(from,to)=>from===to?[from]:from==='hub'||to==='hub'?[from,to]:[from,'hub',to];
const josa=(word,a,b)=>{const c=word.charCodeAt(word.length-1);return c>=0xac00&&c<=0xd7a3&&(c-0xac00)%28?a:b;};
const INK='#6b4a30';
function label(c,text,x,y,size=17){
 c.font=`900 ${size}px Game, sans-serif`;c.textAlign='center';c.lineJoin='round';c.lineWidth=3.5;
 c.strokeStyle='#67472d';c.strokeText(text,x,y);c.fillStyle='#fff3d4';c.fillText(text,x,y);
}
function rounded(c,x,y,w,h,r,color){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function path(c,points,width,color){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.strokeStyle=color;c.stroke();}
function ellipse(c,x,y,rx,ry,fill,stroke,width=2){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
const rand=n=>{const r=Math.sin(n*127.1+41.7)*43758.5453;return r-Math.floor(r);};
const beachEdge=y=>205+Math.sin(y/120)*20+Math.sin(y/47)*7;
const waterEdge=y=>95+Math.sin(y/90+1)*14;
const DICE='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm2 3a1.6 1.6 0 1 0 0 3.2A1.6 1.6 0 0 0 6 5Zm8 0a1.6 1.6 0 1 0 0 3.2A1.6 1.6 0 0 0 14 5Zm-4 3.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2ZM6 11.8a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Zm8 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z"/></svg>';

export class VillageWorld{
 // ── 공 위 씨앗 말풍선: ◀ 개수 ▶ · 숫자 직접 입력 · MAX · [넣기] ──
 // 탐사를 다녀오면 공은 빈 공이 된다. 개수를 정하고 '넣기'를 눌러야 씨앗이 들어가며(충전 연출) 출발 준비가 된다.
 // 개수만 바꾸는 동안은 저장된 개수(village.pack)만 바뀌고, 이미 넣은 공이면 다시 넣어야 한다.
 packMax(){const s=this.getState();return Math.max(0,Math.min(ballCapacity(s),s.renewal.seeds));}
 packValue(){const v=this.getState().renewal.village?.pack;return Math.min(this.packMax(),Number.isFinite(v)?v:this.packMax());}
 // 최대(공 용량과 가진 씨앗 중 작은 쪽)보다 크게 적으면 최대만큼만 담긴다
 setPack(n){
  const v=Math.max(0,Math.min(this.packMax(),Math.floor(Number(n)||0))),vil=this.getState().renewal.village;
  if(vil.pack!==v){vil.pack=v;if(vil.prepared)vil.prepared=false;}
  this.syncPackText(v,true);
 }
 syncPackText(v=this.packValue(),force=false){
  if(!this.pack)return;const input=this.pack.querySelector('input');if(force||document.activeElement!==input)input.value=String(v);
  this.pack.querySelector('[data-pack-max-label]').textContent=`최대 ${this.packMax()}개`;
  this.pack.querySelector('[data-pack="fill"]').textContent=this.getState().renewal.village.prepared?'다시 넣기':'넣기';
 }
 // 넣기: 정한 개수로 탐사 준비를 마친다(공에 씨앗이 쏙쏙 들어가고 공이 톡 튀어 오르는 연출은 step에서 준비 상태가 켜질 때 나온다)
 fillBall(){const n=this.packValue(),vil=this.getState().renewal.village;if(vil.prepared)this.charge=null;vil.prepared=false;this.wasPrepared=false;this.onPack?.(n);this.hidePack();}
 togglePack(){if(this.pack?.classList.contains('open'))this.hidePack();else this.showPack();}
 showPack(){if(!this.pack)return;this.pack.classList.add('open');this.syncPackText();}
 hidePack(){if(this.pack?.classList.contains('open')){this.pack.classList.remove('open');this.pack.querySelector('input').blur();}}
 buildPack(){
  const host=this.canvas.parentElement,el=document.createElement('div');el.className='pack-bubble';el.setAttribute('role','group');el.setAttribute('aria-label','공에 넣을 해바라기씨');
  const arrow=d=>`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${d}"/></svg>`;
  el.innerHTML=`<button type="button" data-pack="-" aria-label="하나 덜 넣기">${arrow('M13 3 L5 10 L13 17 Z')}</button><img src="assets/mining/web/props/seed.webp" alt=""><input type="number" inputmode="numeric" min="0" step="1" aria-label="넣을 해바라기씨 개수"><button type="button" data-pack="+" aria-label="하나 더 넣기">${arrow('M7 3 L15 10 L7 17 Z')}</button><button type="button" class="pack-max" data-pack="max">MAX</button><button type="button" class="pack-fill" data-pack="fill">넣기</button><small data-pack-max-label></small><i class="pack-tail"></i>`;
  // 누르고 있으면 계속 오르내린다
  let hold=null;const stop=()=>{clearTimeout(hold);hold=null;};
  el.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-pack]');e.stopPropagation();if(!b)return;const k=b.dataset.pack;
   if(k==='max'){this.setPack(this.packMax());return;}
   if(k==='fill'){this.setPack(el.querySelector('input').value);this.fillBall();return;}
   const step=()=>{this.setPack(this.packValue()+(k==='+'?1:-1));hold=setTimeout(step,hold?70:380);};step();});
  for(const ev of ['pointerup','pointerleave','pointercancel'])el.addEventListener(ev,stop);
  const input=el.querySelector('input');
  input.addEventListener('change',()=>this.setPack(input.value));
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){this.setPack(input.value);input.blur();}e.stopPropagation();});
  input.addEventListener('blur',()=>this.setPack(input.value));
  host.appendChild(el);this.pack=el;
 }
 // ── 이름 우물 말풍선: 우물에 던져 넣은 햄찌의 이름을 적거나(최대 NAME_MAX자) 주사위로 고른다 ──
 // 이름을 확정(바꾸기)할 때까지 햄찌는 우물 속에 있다가, 확정하면 우물에서 폴짝 튀어나온다.
 buildName(){
  const host=this.canvas.parentElement,el=document.createElement('div');el.className='pack-bubble name-bubble';el.setAttribute('role','group');el.setAttribute('aria-label','햄찌 이름 바꾸기');
  el.innerHTML=`<small data-name-title></small><input type="text" maxlength="${NAME_MAX}" autocomplete="off" aria-label="새 이름"><button type="button" data-name="dice" aria-label="무작위 이름">${DICE}</button><button type="button" class="pack-max" data-name="ok">바꾸기</button><i class="pack-tail"></i>`;
  const input=el.querySelector('input');
  el.addEventListener('pointerdown',e=>{e.stopPropagation();const b=e.target.closest('[data-name]');if(!b||this.naming==null)return;
   if(b.dataset.name==='dice')input.value=randomName(this.getState(),this.naming);else this.confirmName();});
  input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')this.confirmName();});
  host.appendChild(el);this.nameBox=el;
 }
 showName(i){
  // 다른 햄찌가 이미 우물 속에 있으면 그 햄찌는 지금 이름 그대로 먼저 내보낸다
  if(this.naming!=null&&this.naming!==i)this.hideName();
  this.naming=i;const el=this.nameBox;if(!el)return;this.hidePack();
  el.querySelector('[data-name-title]').textContent=`${hamsterName(this.getState(),i)}의 새 이름 (최대 ${NAME_MAX}자)`;
  el.querySelector('input').value=hamsterName(this.getState(),i);el.classList.add('open');
 }
 // 말풍선을 닫고 우물 속 햄찌를 내보낸다(확정·다른 햄찌가 들어옴·구역 이동·마을 초기화)
 hideName(){
  const i=this.naming;this.naming=null;
  if(this.nameBox?.classList.contains('open')){this.nameBox.classList.remove('open');this.nameBox.querySelector('input').blur();}
  if(i!=null)this.popFromWell(i);
 }
 confirmName(){
  const i=this.naming,s=this.getState();if(i==null)return;const before=hamsterName(s,i),after=renameHamster(s,i,this.nameBox?.querySelector('input').value??before);
  this.hideName();if(!after)return;
  if(after!==before){this.notify(`${before}${josa(before,'은','는')} 이제 ${after}${josa(after,'이에요','예요')}!`);this.onChange?.();this.pops.push({x:WELL.x,y:WELL.y-WELL_ART.roof-20,text:after,t:this.time});}
 }
 // 말풍선을 마을 좌표 한 점 바로 위에 붙인다(카메라를 움직여도 따라감)
 placeBubble(el,show,wx,wy){
  if(!el)return;el.hidden=!show;if(!show)return;
  // 게임 화면(#game)이 CSS로 축소돼 있어 화면 px를 그 축소 배율로 나눠 부모 안 좌표로 바꾼다
  const c=this.canvas,host=c.parentElement,r=c.getBoundingClientRect(),hr=host.getBoundingClientRect(),scale=hr.width/(host.offsetWidth||hr.width),k=r.width/450,cam=this.camera;
  const x=(wx-cam.x)*cam.zoom+225,y=(wy-cam.y)*cam.zoom+400;
  el.style.left=`${(r.left-hr.left+x*k)/scale}px`;el.style.top=`${(r.top-hr.top+y*k)/scale}px`;
 }
 placePack(){
  const live=this.active()&&!this.blocked()&&!this.suction;
  if(this.pack)this.placeBubble(this.pack,this.pack.classList.contains('open')&&live&&canDepart(this.getState())&&!this.ballSpit,this.ball.x,this.ball.y-26);
  if(this.nameBox)this.placeBubble(this.nameBox,this.nameBox.classList.contains('open')&&live,WELL.x,WELL.y-WELL_ART.roof-6);
 }
 constructor(canvas,res,{getState,blocked,open,notify,onEnter,onChange,onPack}){
  Object.assign(this,{canvas,res,getState,blocked,open,notify,onEnter,onChange,onPack});
  this.context=canvas.getContext('2d');this.camera={...HOME};this.time=0;this.pointers=new Map();this.reset();
 }
 async load(){
  const base=new URL('../../assets/village/',import.meta.url);
  // manifest.web.json: tools/build-renewal-assets.mjs가 만든 게임용 WebP 목록(원본 PNG 목록은 manifest.json)
  const manifest=await fetch(new URL('manifest.web.json',base)).then(r=>{if(!r.ok)throw Error('마을 리소스를 열 수 없어요');return r.json();});
  this.sprites={};await Promise.all(manifest.assets.map(async p=>{this.sprites[p.id]={...p,image:await this.res.rig.image(new URL(p.path,base))};}));
  this.pinkTree=this.pinkLeaves('tree');
  // 바닥은 구역마다 한 장씩(빈 모서리는 그리지 않아 메모리를 아낀다)
  this.backgrounds=ZONES.map(z=>{const cv=document.createElement('canvas');cv.width=ZONE.w;cv.height=ZONE.h;const g=cv.getContext('2d');g.translate(-z.left,-z.top);this.paintGround(g);return{z,cv};});
  this.bind();
  if(typeof document!=='undefined'&&this.canvas.parentElement){this.buildPack();this.buildName();}
  return this;
 }
 // 분홍 숲 나무: 초록 나무 그림의 잎(초록 픽셀)만 한 번 분홍으로 바꿔 따로 담아 둔다. 갈색 줄기와 테두리는 그대로.
 pinkLeaves(id){
  const p=this.sprites[id];if(!p)return null;const[sx,sy,sw,sh]=p.bounds,cv=document.createElement('canvas');cv.width=sw;cv.height=sh;
  const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(p.image,sx,sy,sw,sh,0,0,sw,sh);
  try{
   const img=g.getImageData(0,0,sw,sh),d=img.data;
   for(let i=0;i<d.length;i+=4){const r=d[i],gr=d[i+1],b=d[i+2];if(gr>r+6&&gr>=b){const l=(r+gr+b)/3/255;d[i]=Math.min(255,170+l*95);d[i+1]=Math.min(255,95+l*120);d[i+2]=Math.min(255,140+l*105);}}
   g.putImageData(img,0,0);
  }catch{return null;}
  return{...p,image:cv,bounds:[0,0,sw,sh]};
 }
 // 빈 공(씨앗을 아직 안 넣음): 공 그림을 한 번 흐릿하게(색을 빼고 밝게) 만들어 두고 쓴다
 drawEmptyBall(c){
  if(this.emptyBall===undefined){
   this.emptyBall=null;
   try{const cv=document.createElement('canvas');cv.width=cv.height=96;const g=cv.getContext('2d',{willReadFrequently:true});g.scale(2,2);this.res.draw(g,'ball-full',24,24,42,42);
    const img=g.getImageData(0,0,96,96),d=img.data;for(let i=0;i<d.length;i+=4){const y=.3*d[i]+.59*d[i+1]+.11*d[i+2];for(let k=0;k<3;k++)d[i+k]=Math.min(255,(d[i+k]*.3+y*.7)*1.12+14);}
    g.setTransform(1,0,0,1,0,0);g.putImageData(img,0,0);this.emptyBall=cv;}catch{}
  }
  if(this.emptyBall)c.drawImage(this.emptyBall,-24,-24,48,48);
  else{c.globalAlpha=.55;this.res.draw(c,'ball-full',0,0,42,42);c.globalAlpha=1;}
 }
 active(){const s=this.getState();return s.renewal?.village.scene==='village'&&!s.dungeon&&!s.rubyStage;}
 // 마을에 돌아오면 늘 메인 구역(광산 입구)에서, 햄찌들은 그 구역 자리에서 시작한다
 reset(){
  this.cancel();this.hideName();this.ball=freshBall();this.suction=null;this.zone='hub';this.slide=null;this.arrival=null;this.camera={...HOME};
  this.flights=new Map();this.dummyHit={};this.propHit={};this.rebuild={};this.seen=null;this.pops=[];this.crew=[];
  this.charge=null;this.ballSpit=null;this.holeSpit=null;this.holeGulp=null;this.ballBump=null;this.wasPrepared=null;
 }
 // ── 구역 이동: 카메라가 옆 구역으로 미끄러지고, 도착하면 구역 이름표가 뜨고, 햄찌들이 차례로 따라온다 ──
 goZone(id,view){
  const z=zoneById(id),from=this.zone;this.zone=z.id;this.hidePack?.();this.hideName?.();this.aim=null;this.fling=null;
  this.slide={from:{x:this.camera.x,y:this.camera.y,zoom:this.camera.zoom},to:zoneView(z,view),t:0};
  if(from!==z.id){this.arrival={name:z.name,no:z.no,t:this.time+TRAVEL.slide*.6};this.crew.forEach((h,i)=>{h.route=null;h.wait=TRAVEL.follow*(i+1)+rand(i+this.time)*.08;});}
 }
 spotFor(i){const list=SPOTS[this.zone]??SPOTS.hub;return list[i%list.length];}
 // 가는 길: 지금 구역에서 목표 구역까지 경계 문을 차례로 지난다(문 앞 → 문 너머)
 routeTo(h,target,i){
  const pts=[],jitter=((i%3)-1)*28,list=zonePath(zoneAt(h.x,h.y).id,zoneAt(target[0],target[1]).id);
  for(let k=0;k+1<list.length;k++){
   const g=gateBetween(list[k],list[k+1]),c=gateCenter(g),dir=g.a===list[k]?1:-1;   // a → b 방향이면 +1
   if(g.axis==='x')pts.push([c.x-dir*55,c.y+jitter],[c.x+dir*55,c.y+jitter]);else pts.push([c.x+jitter,c.y-dir*55],[c.x+jitter,c.y+dir*55]);
  }
  pts.push(target);return pts;
 }
 // 햄찌 실제 위치 갱신: 지친 햄찌는 쉼터 모닥불 곁에서 쉬고, 나머지는 공이 있는 구역 자리로 달려간다
 syncCrew(dt){
  const f=fatigueState(this.getState()),n=this.crewCount(),resting=f.count>=f.max?n:Math.floor(f.count/f.max*4);
  while(this.crew.length<n){const[x,y]=this.spotFor(this.crew.length);this.crew.push({x,y,route:null,wait:0});}
  this.crew.length=n;
  this.crew.forEach((h,i)=>{
   if(i<resting){[h.x,h.y]=REST_SPOTS[i];h.route=null;h.resting=true;h.moving=false;return;}
   h.resting=false;const target=this.spotFor(i);
   if(!h.route){if(Math.hypot(target[0]-h.x,target[1]-h.y)<3){h.moving=false;return;}h.route=this.routeTo(h,target,i);}
   if(h.wait>0){h.wait-=dt;h.moving=false;return;}
   let step=TRAVEL.run*dt;h.moving=true;
   while(step>0&&h.route.length){const[tx,ty]=h.route[0],d=Math.hypot(tx-h.x,ty-h.y);h.face=tx>=h.x?1:-1;
    if(d<=step){h.x=tx;h.y=ty;step-=d;h.route.shift();}else{h.x+=(tx-h.x)/d*step;h.y+=(ty-h.y)/d*step;step=0;}}
   if(!h.route.length){h.route=null;h.moving=false;}
  });
 }
 // 이름 말풍선은 여기서 닫지 않는다(우물 속 햄찌는 이름을 정할 때까지 기다림). 닫는 곳: 확정·구역 이동·초기화·출발.
 cancel(){this.aim=null;this.fling=null;this.gesture=null;this.pointers.clear();if(this.ball)this.ball.vx=this.ball.vy=0;this.hidePack?.();}
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
  const s=this.getState(),res=equipVillageTrait(s,i,d.trait);this.dummyHit[d.trait]=this.time;if(!res)return;
  const name=TRAITS[d.trait].name,who=hamsterName(s,i);
  this.notify(res.removed?`${who}${josa(who,'이','가')} ${name}${josa(name,'을','를')} 벗었어요.`:`${who}에게 ${name}! ${TRAITS[d.trait].description}${res.from!=null?` (${hamsterName(s,res.from)}${josa(hamsterName(s,res.from),'은','는')} 기본 곡괭이로)`:''}`);
  this.onChange();
 }
 // 생산기 걷기(톡 누르기·햄찌 던져 맞히기 공통): 걷은 만큼 숫자가 솟아오른다
 collect(p){
  const s=this.getState(),g=GENERATORS[p.gen],n=collectGenerator(s,p.gen);this.propHit[p.id]=this.time;
  if(n>0){this.pops.push({x:p.x,y:p.y-p.h-10,text:`+${n}`,golden:g.currency==='golden',t:this.time});this.onChange?.();return n;}
  const stock=s.renewal.village.stock[p.gen]??0,unit=g.currency==='golden'?GOLDEN_NAME:'해바라기씨';
  this.notify(`${g.name} · 햄찌들이 광산에 있는 동안 ${unit}${josa(unit,'이','가')} 조금씩 쌓여요(최대 ${g.cap}개) · 지금 ${stock.toFixed(1)}개`);
  return 0;
 }
 // 마을 건물의 '단계': 바뀌면 공사 연출(먼지·통통 튐)이 한 번 나온다. 아직 단계별 건물 그림은 없어 깃발 글씨로 보여 준다.
 levels(s){
  // 나무마다 배운 단계 합(노드 id 앞머리 = 나무, 마스터리 뿌리는 'root')
  const pick=s.renewal.pick,levels=Object.entries(s.masteryBook?.levels??{}),sum=pre=>levels.filter(([id])=>id.startsWith(pre)||pre==='mastery_'&&id==='root').reduce((a,[,v])=>a+v,0);
  return{forge:pick?`${TIERS[pick.tier]}+${pick.level}`:'',mastery:`Lv ${sum('mastery_')}`,home:`Lv ${sum('home_')}`,'care-house':`Lv ${sum('care_')}`,playground:`Lv ${sum('tools_')}`};
 }
 // '중앙' 버튼: 지금 구역 전체가 보이게
 home(){this.cancel();this.camera=zoneView(zoneById(this.zone));}
 // 탐사 준비를 마치면 공을 광산 입구로 돌려놓고(다른 구역이면 넘어가며 햄찌도 따라옴) 구멍 쪽을 크게 보여 준다
 focusEntrance(){
  this.cancel();this.ball=freshBall();const view={x:HOLE.x,y:HOLE.y+155,zoom:.92};
  if(this.zone!=='hub')this.goZone('hub',view);else this.camera=zoneView(zoneById('hub'),view);
 }
 zoom(factor){zoomAt(this.camera,factor,{x:225,y:400});}
 sprite(c,id,x,y,w,h,anchor=1,p=this.sprites[id]){
  if(!p)return;
  const[sx,sy,sw,sh]=p.bounds,k=Math.min(w/sw,h/sh);
  c.drawImage(p.image,sx,sy,sw,sh,x-sw*k/2,y-sh*k*anchor,sw*k,sh*k);
 }
 paintGround(c){
  c.fillStyle='#a5bb79';c.fillRect(0,0,WORLD.width,WORLD.height);
  // Low contrast clover patches leave buildings and the original hamsters readable.
  for(let i=0;i<130;i++){c.fillStyle=i%2?'#adc384':'#9eb674';c.beginPath();c.ellipse(rand(i)*WORLD.width,rand(i+99)*WORLD.height,45+rand(i+2)*80,25+rand(i+4)*45,0,0,Math.PI*2);c.fill();}
  // 왼쪽 바닷가: 물결 모래 → 얕은 물 → 바다
  const shore=(edge,color)=>{c.fillStyle=color;c.beginPath();c.moveTo(0,0);for(let y=0;y<=WORLD.height;y+=20)c.lineTo(edge(y),y);c.lineTo(0,WORLD.height);c.closePath();c.fill();};
  shore(y=>beachEdge(y)+14,'#d7c48e');shore(beachEdge,'#efdcaa');shore(y=>waterEdge(y)+16,'#bfe0d6');shore(waterEdge,'#7cc0c9');shore(y=>waterEdge(y)-46,'#5fa9b8');
  c.strokeStyle='#e9f6f0';c.lineWidth=3;for(let y=60;y<WORLD.height;y+=150){c.beginPath();for(let k=0;k<5;k++)c.lineTo(waterEdge(y+k*14)-26+k%2*8,y+k*14);c.stroke();}
  for(let i=0;i<40;i++){const y=rand(i+40)*WORLD.height,x=waterEdge(y)+30+rand(i+80)*(beachEdge(y)-waterEdge(y)-50);c.fillStyle='#e3cf9c';c.beginPath();c.ellipse(x,y,3+rand(i)*3,2,0,0,7);c.fill();}
  // 부두와 작은 배(4구역 바닷가, 재건 없이 처음부터 그대로)
  for(let k=0;k<5;k++){rounded(c,10+k*24,960,20,60,4,k%2?'#b98a5a':'#c99a68');c.strokeStyle='#7a5434';c.lineWidth=2;c.strokeRect(10+k*24,960,20,60);}
  for(const x of [14,62,110])rounded(c,x,1014,9,24,3,'#7a5434');
  c.save();c.translate(70,1120);c.rotate(-.12);c.fillStyle='#a8683e';c.strokeStyle='#5c3a20';c.lineWidth=3;c.beginPath();c.moveTo(-52,-12);c.quadraticCurveTo(0,26,52,-12);c.closePath();c.fill();c.stroke();c.fillStyle='#d9a26a';c.beginPath();c.ellipse(0,-12,52,8,0,0,Math.PI*2);c.fill();c.stroke();c.restore();
  // 길: 경계 문 ↔ 구역 안 중심, 구역 안 건물 ↔ 광장
  const g=GATE.y,routes=[
   [[720,g],[620,g-10],[560,g-30]],   // 4 토템 마당(가운데 흙마당으로)
   [[720,g],[860,g],[960,g-20]],[[1440,g],[1300,g],[1200,g-20]],[[1000,760],[905,480]],[[1160,760],[1260,480]],[[990,920],[880,1000]],[[1170,920],[1250,980]],[[1080,950],[1080,1300]],   // 1 광산 입구
   [[1080,1260],[1080,ARENA_DOORS[0].y+20]],   // 2 특성 경기장(위쪽 문 → 경기장 출입구)
   [[1440,g],[1600,g],[1720,760]],[[1720,760],[1800,740]],   // 3 이름 우물
  ];
  for(const points of routes){path(c,points,96,'#82965d');path(c,points,89,'#d2b47d');path(c,points,78,'#ead09b');}
  // 2구역: 원형 경기장 바닥(울타리는 깊이 순서대로 따로 그린다)
  const ring=octagon(1.03),floor=octagon(.99);
  c.fillStyle='#b9b26f';c.beginPath();ring.forEach(p=>c.lineTo(...p));c.closePath();c.fill();
  c.fillStyle='#d8cf8a';c.beginPath();floor.forEach(p=>c.lineTo(...p));c.closePath();c.fill();
  for(let i=0;i<70;i++){const a=rand(i+300)*Math.PI*2,k=Math.sqrt(rand(i+400))*.9;ellipse(c,ARENA.x+Math.cos(a)*ARENA.rx*k,ARENA.y+Math.sin(a)*ARENA.ry*k,6+rand(i)*14,3+rand(i+7)*6,i%2?'#cdc37f':'#e2d898');}
  // 가운데 해바라기 문양(레퍼런스의 룬 원 자리): 꽃잎 고리 + 씨앗 점
  const cx=ARENA.x,cy=ARENA.y+30,line='#b3a564';
  ellipse(c,cx,cy,150,100,'#e7dea0',line,4);ellipse(c,cx,cy,118,78,null,line,3);
  for(let k=0;k<16;k++){const a=k/16*Math.PI*2;c.save();c.translate(cx+Math.cos(a)*92,cy+Math.sin(a)*61);c.scale(1,.66);c.rotate(a);c.beginPath();c.ellipse(0,0,24,10,0,0,Math.PI*2);c.strokeStyle=line;c.lineWidth=3;c.stroke();c.restore();}
  ellipse(c,cx,cy,52,34,'#d6c983',line,3);
  for(let k=0;k<22;k++){const a=k*2.4,r=Math.sqrt(k/22)*44;ellipse(c,cx+Math.cos(a)*r,cy+Math.sin(a)*r*.66,3,2,'#b3a564');}
  // 4구역: 창고·풍차·토템이 둘러싼 흙마당
  ellipse(c,460,790,196,232,'#d2b47d');ellipse(c,460,788,188,224,'#ead09b');
  // 1구역: 공이 노는 흙 광장 + 구멍 둘레의 주황 흙
  ellipse(c,1080,770,228,196,'#d2b47d');ellipse(c,1080,768,220,188,'#ead09b');
  for(const [dx,dy,rx,ry,col] of [[0,8,104,70,'#efb46c'],[-30,30,60,40,'#f2c27e'],[36,-10,62,40,'#f2c27e'],[0,6,80,52,'#f0a85d']])ellipse(c,HOLE.x+dx,HOLE.y+dy,rx,ry,col);
  // 물웅덩이(레퍼런스의 하늘색 웅덩이)
  for(const [x,y,rx,ry] of [[640,330,34,20],[960,1050,28,16],[1320,1520,40,22],[870,2180,34,20],[1660,930,46,26],[1980,780,30,18]]){ellipse(c,x,y,rx+5,ry+4,'#8fbf8a');ellipse(c,x,y,rx,ry,'#9fd8d4');ellipse(c,x-rx*.3,y-ry*.3,rx*.35,ry*.25,'#c9eeea');}
  for(let i=0;i<620;i++){
   const x=rand(i+310)*WORLD.width,y=rand(i+970)*WORLD.height;
   if(x<beachEdge(y)+20||((x-ARENA.x)/ARENA.rx)**2+((y-ARENA.y)/ARENA.ry)**2<1.1||((x-1080)/230)**2+((y-770)/200)**2<1||((x-460)/200)**2+((y-790)/236)**2<1)continue;
   path(c,[[x-3,y],[x-6,y-7]],2,'#879e61');path(c,[[x+1,y],[x+4,y-8]],2,'#879e61');
   if(i%9===0){c.fillStyle=i%2?'#f7e5af':'#eec29e';c.beginPath();c.arc(x,y-9,3,0,7);c.fill();}
  }
  // 구역 경계 울타리 덤불: 문 자리만 비워 둔다(구역이 확실히 나뉘어 보이게)
  const bush=(x,y,seed)=>{const r=34+rand(seed*3)*12;ellipse(c,x,y+6,r+3,r*.8+3,'#5f7d43');ellipse(c,x,y,r,r*.8,'#7f9f55');ellipse(c,x-r*.3,y-r*.3,r*.45,r*.32,'#9cbb6a');};
  const gap=(axis,at,v)=>GATES.some(g=>g.axis===axis&&g.at===at&&v>g.from-34&&v<g.to+34);
  // 세로 경계(x=at, y 범위)와 가로 경계(y=at, x 범위)
  for(const [at,y0,y1] of [[720,0,1280],[1440,0,1280],[2160,0,1280],[720,1280,2560],[1440,1280,2560]])
   for(let y=y0-20;y<y1+40;y+=46)if(!gap('x',at,y))bush(at+(rand(y+at)-.5)*14,y,y+at);
  for(const [at,x0,x1] of [[1280,0,2160],[2560,720,1440]])
   for(let x=x0;x<x1+40;x+=46)if(!gap('y',at,x))bush(x,at+(rand(x+at)-.5)*14,x*7+at);
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
   if(!this.active()||this.blocked()||this.suction||this.slide||this.ballSpit||e.button!==0)return;
   e.preventDefault();c.focus({preventScroll:true});const p=point(e);this.pointers.set(e.pointerId,p);c.setPointerCapture(e.pointerId);
   if(this.pointers.size>1){this.aim=null;this.gesture={type:'pinch'};return;}
   const w=worldPoint(this.camera,p),ballDistance=Math.hypot(w.x-this.ball.x,w.y-this.ball.y),near=ballDistance<34/this.camera.zoom;
   // 햄찌를 잡으면 공처럼 당겨 던진다(허수아비 = 특성, 우물 = 이름, 생산기 = 걷기). 공과 겹치면 손가락에 가까운 쪽.
   const hamster=this.grabHamster(w);
   if(hamster&&(!near||hamster.d<ballDistance)){this.fling={i:hamster.i,origin:{x:hamster.x,y:hamster.y},pointer:w};this.gesture={type:'fling'};return;}
   if(near){
    const s=this.getState();this.ball.vx=this.ball.vy=0;
    // 공은 언제든 당겨 굴릴 수 있다(구역 이동). 씨앗은 공을 톡 눌러 나오는 말풍선에서 '넣기'로 넣어야 하고,
    // 빈 공이나 지쳤을 때는 구멍에 넣어도 구멍이 퉤 뱉어 낸다.
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
    if(!g.moved&&Math.hypot(p.x-g.start.x,p.y-g.start.y)>5){g.moved=true;this.hidePack();pan(this.camera,p.x-g.start.x,p.y-g.start.y);}
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
     if(velocity.pull>6){Object.assign(this.ball,{vx:velocity.vx,vy:velocity.vy});this.hidePack();}
     else if(canDepart(this.getState()))this.togglePack();   // 공을 톡 누르면 씨앗 말풍선
     else this.open('village-rest');
    }else if(g?.type==='fling'&&this.fling){
     const f=this.fling,velocity=aimVelocity(f.origin,worldPoint(this.camera,p));
     if(velocity.pull>6){this.flights.set(f.i,{x:f.origin.x,y:f.origin.y,vx:velocity.vx,vy:velocity.vy,t:0,phase:'fly',hit:null});}
     else{const s=this.getState(),worn=[s.renewal.traits[f.i],s.renewal.traits2?.[f.i]].filter(t=>t&&t!=='none'&&TRAITS[t]).map(t=>TRAITS[t].name);
      this.notify(`${hamsterName(s,f.i)} · ${worn.length?worn.join('·'):TRAITS.none.name} — 허수아비에 던지면 특성, 우물에 던지면 이름을 바꿔요.`);}
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
  if(Math.hypot(p.x-this.ball.x,p.y-this.ball.y)<34/this.camera.zoom){if(canDepart(this.getState()))this.togglePack();else this.open('village-rest');return;}
  this.hidePack();
  const s=this.getState();
  const d=dummiesFor(s).find(d=>Math.hypot(p.x-d.x,p.y-(d.y+DUMMY_HIT.dy))<DUMMY_HIT.r+6);
  if(d){const t=TRAITS[d.trait],who=wornBy(s,d.trait);this.notify(`${t.name} 허수아비 · ${t.description}${who>=0?` · 지금 ${hamsterName(s,who)}`:''} — 햄찌를 던져 맞히면 껴요.`);return;}
  if(Math.hypot((p.x-HOLE.x), (p.y-HOLE.y)*1.6)<70){this.open('mine-prepare');return;}
  const hit=b=>p.x>=b.x-b.w/2&&p.x<=b.x+b.w/2&&p.y>=b.y-b.h&&p.y<=b.y+30;
  const q=PROPS.find(hit);
  if(q){
   this.propHit[q.id]=this.time;
   if(q.gen)this.collect(q);
   else if(q.id==='well')this.notify(this.naming!=null?`${hamsterName(s,this.naming)}${josa(hamsterName(s,this.naming),'이','가')} 우물 속에서 새 이름을 기다려요. 위 말풍선에서 정해 주세요.`:'이름 우물 · 햄찌를 당겨 우물에 던져 넣으면 이름을 바꿀 수 있어요.');
   else if(q.id==='storage')this.notify(`씨앗 창고 · 해바라기씨 ${s.renewal.seeds}개 · ${GOLDEN_NAME} ${s.renewal.golden??0}개 — 모일수록 통이 차올라요.`);
   return;
  }
  const b=[...BUILDINGS].reverse().find(hit);
  if(b)this.open(b.action);
 }
 async enter(){
  const s=this.getState();if(!canDepart(s)||!s.renewal.village.prepared){this.ball=freshBall();return;}
  this.cancel();this.hideName();this.flights.clear();this.suction={time:0,crew:this.crewPositions().map(p=>({...p}))};
 }
 // 씨앗이 모여 곡괭이를 강화할 수 있으면 대장간 화덕에서 불길이 '확' 뿜어져 나와 알려 준다(글 안내 없이).
 forgeReady(s){const q=enhancementQuote(s);return !!q&&s.renewal.seeds>=q.cost&&(!s.renewal.run||s.renewal.run.phase==='ended');}
 flames(c,fx,fy,burst,motion,scale=1){
  c.save();c.globalCompositeOperation='lighter';
  const glow=c.createRadialGradient(fx,fy,2,fx,fy,(34+burst*16)*scale);glow.addColorStop(0,'#ffd36acc');glow.addColorStop(1,'#ff7a2a00');
  c.fillStyle=glow;c.beginPath();c.arc(fx,fy,(34+burst*16)*scale,0,Math.PI*2);c.fill();
  // 위로 솟는 불혀 세 개(터질 때 크게, 평소엔 작게 일렁). 마을 원화처럼 진한 테두리를 둔다.
  c.globalCompositeOperation='source-over';c.lineJoin='round';
  for(const i of [0,2,1]){
   const sway=motion?Math.sin(this.time*9+i*2.1)*3:0,hgt=(10+burst*28)*(i===1?1:.78)*scale,x=fx+(-9+i*9)*scale+sway,wide=(i===1?7:5.5)*scale;
   c.globalAlpha=.95;c.fillStyle=i===1?'#ffd84a':'#ff8a2e';c.strokeStyle='#9c3f17';c.lineWidth=1.8;
   c.beginPath();c.moveTo(x-wide,fy+4);c.quadraticCurveTo(x-wide-1,fy-hgt*.45,x,fy-hgt);c.quadraticCurveTo(x+wide+1,fy-hgt*.45,x+wide,fy+4);c.closePath();c.fill();c.stroke();
   if(i===1){c.fillStyle='#fff6c4';c.beginPath();c.moveTo(x-2.5,fy+2);c.quadraticCurveTo(x-3,fy-hgt*.3,x,fy-hgt*.55);c.quadraticCurveTo(x+3,fy-hgt*.3,x+2.5,fy+2);c.closePath();c.fill();}
  }
  c.globalCompositeOperation='lighter';
  if(motion)for(let i=0;i<5;i++){const t=(this.time*.9+i*.21)%1;c.globalAlpha=(1-t)*.9;c.fillStyle='#ffd27a';c.beginPath();c.arc(fx+Math.sin(i*2.3+t*4)*10*scale,fy-10-t*44*scale,1.8,0,Math.PI*2);c.fill();}
  c.restore();
 }
 forgeFlame(c,b,motion){const cycle=motion?(this.time%1.6)/1.6:.2;this.flames(c,b.x+61,b.y-50,cycle<.35?Math.sin(cycle/.35*Math.PI):0,motion);}
 // 쉼터 앞 모닥불(레퍼런스 초가집 옆 모닥불): 장작 두 개 + 늘 일렁이는 작은 불
 drawCampfire(c,motion){
  const {x,y}=CAMPFIRE;ellipse(c,x,y+2,30,9,'#4a3a2233');
  for(const [r,col] of [[.35,'#8a5a36'],[-.35,'#a06a40']]){c.save();c.translate(x,y-4);c.rotate(r);c.fillStyle=col;c.strokeStyle=INK;c.lineWidth=2;c.beginPath();c.roundRect(-24,-5,48,10,5);c.fill();c.stroke();c.restore();}
  for(let k=0;k<7;k++){const a=k/7*Math.PI*2;ellipse(c,x+Math.cos(a)*28,y+Math.sin(a)*9,6,4,'#a7a29a',INK,1.4);}
  this.flames(c,x,y-8,motion?.25+.15*Math.sin(this.time*5):.3,motion,.8);
 }
 // 특성 허수아비: 나무 기둥 + 짚 몸통 + 자루 머리 + 이름 팻말. 특성마다 소품 하나, 낀 햄찌가 있으면 번호 배지.
 drawDummy(c,d,s){
  const age=this.time-(this.dummyHit[d.trait]??-9),wob=age<.7&&s.settings.motion?Math.sin(age*22)*(1-age/.7)*.35:0,who=wornBy(s,d.trait);
  c.save();c.translate(d.x,d.y);
  c.fillStyle='#4a3a2233';c.beginPath();c.ellipse(0,2,18,5,0,0,Math.PI*2);c.fill();
  // 맞으면 휘청 꺾이면서 납작 눌렸다 쭉 펴지기를 되풀이한다
  const sq=age<.8&&s.settings.motion?.28*Math.exp(-age*6)*Math.cos(age*26):0;
  c.rotate(wob);c.scale(1+sq*.6,1-sq);c.lineJoin='round';c.lineCap='round';
  const ink=INK;
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
 // 경기장 울타리 한 변(통나무 난간 + 말뚝). 위쪽 변 가운데는 출입구로 비운다.
 // 구역 경계 문: 굵은 나무 기둥 두 개(세로 경계면 위·아래, 가로 경계면 왼쪽·오른쪽)
 drawGatePosts(c,g){
  const posts=g.axis==='x'?[[g.at,g.from-6],[g.at,g.to+6]]:[[g.from-6,g.at],[g.to+6,g.at]];
  for(const [x,y] of posts){ellipse(c,x,y+3,16,6,'#4a3a2238');c.fillStyle='#8a5a36';c.strokeStyle=INK;c.lineWidth=2.6;c.beginPath();c.roundRect(x-9,y-58,18,60,5);c.fill();c.stroke();ellipse(c,x,y-57,9,4,'#c8935e',INK,1.8);}
 }
 // 갈 곳 팻말: 기둥 + 화살표 판자(이웃 구역 번호와 이름). 위·아래 방향은 판자 왼쪽에 세모 화살표.
 drawGateSign(c,x,y,dir,z){
  c.save();c.translate(x,y);ellipse(c,0,3,12,4,'#4a3a2238');
  c.fillStyle='#9a6a40';c.strokeStyle=INK;c.lineWidth=2;c.beginPath();c.roundRect(-4,-58,8,60,3);c.fill();c.stroke();
  c.font='900 14px Game, sans-serif';const text=`${z.no} ${z.name}`,side=dir==='right'||dir==='left',w=c.measureText(text).width+(side?40:52);
  const bx=dir==='right'?-w/2+6:dir==='left'?-w/2-6:-w/2;
  c.fillStyle='#f2dfb6';c.lineWidth=2.4;c.beginPath();
  if(dir==='right'){c.moveTo(bx,-84);c.lineTo(bx+w-12,-84);c.lineTo(bx+w,-70);c.lineTo(bx+w-12,-56);c.lineTo(bx,-56);}
  else if(dir==='left'){c.moveTo(bx+12,-84);c.lineTo(bx+w,-84);c.lineTo(bx+w,-56);c.lineTo(bx+12,-56);c.lineTo(bx,-70);}
  else c.roundRect(bx,-84,w,28,5);
  c.closePath();c.fill();c.stroke();
  c.fillStyle='#5a3d27';c.textAlign='center';
  if(side)c.fillText(text,bx+w/2+(dir==='right'?-4:4),-65);
  else{c.fillText(text,bx+w/2+8,-65);const ax=bx+14,ay=-70;c.beginPath();if(dir==='down'){c.moveTo(ax-7,ay-5);c.lineTo(ax+7,ay-5);c.lineTo(ax,ay+6);}else{c.moveTo(ax-7,ay+5);c.lineTo(ax+7,ay+5);c.lineTo(ax,ay-6);}c.closePath();c.fill();}
  c.restore();
 }
 drawFence(c,a,b){
  const len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(2,Math.round(len/38)),posts=[];
  for(let k=0;k<=n;k++){const x=a[0]+(b[0]-a[0])*k/n,y=a[1]+(b[1]-a[1])*k/n;if(!ARENA_DOORS.some(d=>Math.hypot(x-d.x,y-d.y)<48))posts.push([x,y]);}
  c.lineCap='round';
  for(let k=0;k+1<posts.length;k++){const[p,q]=[posts[k],posts[k+1]];if(Math.hypot(q[0]-p[0],q[1]-p[1])>len/n*1.5)continue;
   for(const dy of [-17,-8]){path(c,[[p[0],p[1]+dy],[q[0],q[1]+dy]],6,INK);path(c,[[p[0],p[1]+dy],[q[0],q[1]+dy]],3.4,'#b98250');}}
  for(const [x,y] of posts){c.fillStyle='#4a3a2230';c.beginPath();c.ellipse(x,y+2,7,3,0,0,7);c.fill();c.fillStyle='#9a6a40';c.strokeStyle=INK;c.lineWidth=2;c.beginPath();c.roundRect(x-5,y-28,10,30,4);c.fill();c.stroke();ellipse(c,x,y-27,5,2.6,'#c8935e',INK,1.5);}
 }
 // 생산기 위 말풍선: 걷을 만큼 쌓이면 아이콘과 개수가 통통 뜬다
 stockBubble(c,p,s){
  const g=GENERATORS[p.gen],n=Math.floor(s.renewal.village.stock[p.gen]??0);if(n<1)return;
  const bob=s.settings.motion?Math.sin(this.time*3+p.x)*3:0,x=p.x,y=p.y-p.h-22+bob,text=String(n);
  c.save();c.font='900 15px Game, sans-serif';const w=c.measureText(text).width+38;
  c.fillStyle='#fff6dc';c.strokeStyle=INK;c.lineWidth=2.4;c.beginPath();c.roundRect(x-w/2,y-15,w,30,13);c.fill();c.stroke();
  c.beginPath();c.moveTo(x-6,y+14);c.lineTo(x,y+22);c.lineTo(x+6,y+14);c.fill();c.stroke();c.fillRect(x-7,y+11,14,4);
  if(g.currency==='golden')this.res.draw(c,'golden-seed',x-w/2+15,y,18,18);else this.res.draw(c,'seed',x-w/2+15,y,11,17);
  c.fillStyle='#4a3122';c.textAlign='left';c.fillText(text,x-w/2+27,y+6);c.restore();
 }
 // 해바라기 토템(레퍼런스의 티키 토템): 햄찌 얼굴 세 칸을 쌓고 꼭대기에 해바라기
 drawTotem(c,p,s){
  const age=this.time-(this.propHit[p.id]??-9),wob=age<.8&&s.settings.motion?Math.sin(age*24)*Math.exp(-age*5)*.12:0,sq=age<.8&&s.settings.motion?.24*Math.exp(-age*6)*Math.cos(age*22):0;
  c.save();c.translate(p.x,p.y);ellipse(c,0,2,34,9,'#4a3a2238');c.rotate(wob);c.scale(1+sq*.6,1-sq);c.lineJoin='round';
  const blocks=[[-46,46,'#c98a52'],[-90,42,'#b6743f'],[-130,38,'#d39a5e']];
  blocks.forEach(([top,w,col],k)=>{
   c.fillStyle=col;c.strokeStyle=INK;c.lineWidth=2.6;c.beginPath();c.roundRect(-w/2,top,w,k?42:48,10);c.fill();c.stroke();
   const fy=top+(k?20:22);
   if(k===2){for(const sx of [-1,1]){ellipse(c,sx*15,top+2,7,7,col,INK,2.2);ellipse(c,sx*15,top+2,3.5,3.5,'#f0b9a0');}}
   c.fillStyle=INK;c.beginPath();c.arc(-8,fy-3,2.6,0,7);c.arc(8,fy-3,2.6,0,7);c.fill();
   ellipse(c,-13,fy+4,4.5,2.8,'#ef9c86');ellipse(c,13,fy+4,4.5,2.8,'#ef9c86');
   c.strokeStyle=INK;c.lineWidth=2;c.beginPath();if(k===1){c.ellipse(0,fy+6,4,3.4,0,0,7);}else{c.moveTo(-5,fy+4);c.quadraticCurveTo(0,fy+9,5,fy+4);}c.stroke();
   if(k===1){c.fillStyle='#fff';c.fillRect(-3,fy-1,2.6,3.4);c.fillRect(.6,fy-1,2.6,3.4);}
  });
  // 꼭대기 해바라기
  const spin=s.settings.motion?this.time*.6:0;
  for(let k=0;k<12;k++){const a=k/12*Math.PI*2+spin;c.save();c.translate(Math.cos(a)*15,-146+Math.sin(a)*15);c.rotate(a);ellipse(c,0,0,10,5,'#f6c945','#a8792d',1.6);c.restore();}
  ellipse(c,0,-146,11,11,'#7a4a26',INK,2);
  for(let k=0;k<7;k++){const a=k*2.4,r=Math.sqrt(k/7)*7;ellipse(c,Math.cos(a)*r,-146+Math.sin(a)*r,1.5,1.5,'#3f2614');}
  c.restore();
 }
 // 황금 풍차(레퍼런스의 닻 생산기 자리): 돌 탑 + 빨간 지붕 + 도는 날개, 날개 끝이 황금빛
 drawMill(c,p,s){
  const motion=s.settings.motion,age=this.time-(this.propHit[p.id]??-9),boost=age<1?3*(1-age):0,spin=motion?this.time*(.9+boost):.4;
  c.save();c.translate(p.x,p.y);ellipse(c,0,2,48,11,'#4a3a2238');c.lineJoin='round';
  c.fillStyle='#ece0c4';c.strokeStyle=INK;c.lineWidth=2.6;c.beginPath();c.moveTo(-40,0);c.lineTo(-26,-112);c.lineTo(26,-112);c.lineTo(40,0);c.closePath();c.fill();c.stroke();
  c.strokeStyle='#cbb894';c.lineWidth=1.6;for(const [y,x0] of [[-30,-36],[-58,-33],[-86,-29]]){c.beginPath();c.moveTo(x0+2,y);c.lineTo(-x0-2,y);c.stroke();}
  c.fillStyle='#8a5a36';c.strokeStyle=INK;c.lineWidth=2.2;c.beginPath();c.roundRect(-11,-30,22,30,[10,10,2,2]);c.fill();c.stroke();
  ellipse(c,0,-74,8,8,'#9fd3e0',INK,2);
  c.fillStyle='#d4664c';c.beginPath();c.moveTo(-36,-108);c.lineTo(0,-150);c.lineTo(36,-108);c.closePath();c.fill();c.stroke();
  c.translate(0,-120);
  for(let k=0;k<4;k++){c.save();c.rotate(spin+k*Math.PI/2);c.fillStyle='#f3e3b8';c.strokeStyle=INK;c.lineWidth=2;c.beginPath();c.roundRect(4,-8,62,16,3);c.fill();c.stroke();
   c.strokeStyle='#c9b48a';c.lineWidth=1.3;for(const x of [20,36,52]){c.beginPath();c.moveTo(x,-8);c.lineTo(x,8);c.stroke();}
   ellipse(c,64,0,6,6,'#f2c43c','#9c6a17',1.6);c.restore();}
  ellipse(c,0,0,8,8,'#8a5a36',INK,2);
  c.restore();
 }
 // 이름 우물: 돌 우물 + 나무 지붕 + 도르래 두레박. 물이 반짝인다.
 drawWell(c,p,s){
  const motion=s.settings.motion,age=this.time-(this.propHit[p.id]??-9),k=WELL_ART.k;
  // 햄찌가 풍덩 들어가거나 펑 튀어나올 때 우물이 크게 출렁(납작 눌렸다 쭉 펴지기를 되풀이하며 잦아든다).
  // 튀어나오기 직전(age<0)에는 우물이 위로 부풀며 덜덜 떤다(예비 동작).
  let wob=0,shake=0,swell=0;
  if(motion&&age>=0&&age<.8)wob=.16*Math.exp(-age*6)*Math.cos(age*24);
  if(motion&&age<0&&age>-.5){const a=(1+age/.5)**1.5;shake=Math.sin(this.time*80)*6*a;swell=.17*a+Math.sin(this.time*43)*.025*a;}
  c.save();c.translate(p.x+shake,p.y);c.scale(k*(1+wob-swell*.4),k*(1-wob+swell));ellipse(c,0,4,58,13,'#4a3a2238');c.lineJoin='round';
  for(const sx of [-1,1]){c.fillStyle='#9a6a40';c.strokeStyle=INK;c.lineWidth=2.2;c.beginPath();c.roundRect(sx*44-5,-118,10,96,4);c.fill();c.stroke();}
  c.fillStyle='#b9b0a0';c.strokeStyle=INK;c.lineWidth=2.6;c.beginPath();c.moveTo(-50,-24);c.lineTo(-50,-2);c.ellipse(0,-2,50,14,0,Math.PI,0,true);c.lineTo(50,-24);c.closePath();c.fill();c.stroke();
  c.strokeStyle='#8e8576';c.lineWidth=1.6;for(const [x,y] of [[-34,-12],[-10,-8],[14,-9],[36,-14],[-22,-20],[24,-20]]){c.beginPath();c.roundRect(x-9,y-5,18,9,3);c.stroke();}
  ellipse(c,0,-24,50,16,'#cfc6b4',INK,2.6);ellipse(c,0,-24,38,10,'#5fa9b8');
  const glint=motion?Math.sin(this.time*2.4)*.5+.5:.5;c.globalAlpha=.5+glint*.4;ellipse(c,-10,-26,12,3,'#d9f3f5');c.globalAlpha=1;
  if(age>=0&&age<.9){const q=age/.9;c.globalAlpha=1-q;ellipse(c,0,-24,38*(.4+q),10*(.4+q),null,'#e9f8fa',3);c.globalAlpha=1;}
  // 부풀 때는 물이 불룩 솟아오른다
  if(swell>0){ellipse(c,0,-24-swell*40,30*(.6+swell*3),8+swell*60,'#5fa9b8','#e9f8fa',1.6);}
  // 햄찌가 우물 속에서 이름을 기다리는 동안: 물방울이 보글보글 올라온다
  if(this.naming!=null){for(let j=0;j<4;j++){const t=((motion?this.time:0)*1.3+j*.27)%1;c.globalAlpha=(1-t)*.9;ellipse(c,-16+j*11+Math.sin(j*2+t*6)*3,-24-t*16,2.2+j%2,2.2+j%2,'#e9f8fa','#7fb9c4',1);}c.globalAlpha=1;}
  c.fillStyle='#a0603a';c.strokeStyle=INK;c.lineWidth=2.6;c.beginPath();c.moveTo(-62,-110);c.lineTo(0,-150);c.lineTo(62,-110);c.lineTo(52,-104);c.lineTo(0,-136);c.lineTo(-52,-104);c.closePath();c.fill();c.stroke();
  path(c,[[-44,-98],[44,-98]],5,INK);path(c,[[-44,-98],[44,-98]],2.6,'#c8935e');
  path(c,[[8,-98],[8,-62]],1.6,'#5a4030');c.fillStyle='#9a6a40';c.strokeStyle=INK;c.lineWidth=2;c.beginPath();c.moveTo(-1,-62);c.lineTo(17,-62);c.lineTo(15,-46);c.lineTo(1,-46);c.closePath();c.fill();c.stroke();
  // 풍덩·펑: 물방울이 왕관처럼 튀어 올랐다 떨어진다
  if(motion&&age>=0&&age<.7){c.globalAlpha=1-age/.7;for(let j=0;j<9;j++){const a=Math.PI*(1.08+.84*j/8),v=45+(j%3)*14,x=Math.cos(a)*v*age*1.6,y=-26+Math.sin(a)*v*1.5*age*1.6+150*age*age;
   ellipse(c,x,y,2.6,3.4,'#bfe6ee','#5f9fae',.8);}c.globalAlpha=1;}
  c.restore();
 }
 // 씨앗 창고(레퍼런스의 통 집): 가진 해바라기씨가 많을수록 통 위로 씨앗 더미가 차오르고, 황금 씨앗도 섞여 보인다
 drawStorage(c,p,s){
  const r=s.renewal,fill=Math.max(0,Math.min(1,Math.log10((r.seeds??0)+1)/4)),golden=Math.min(6,r.golden??0),age=this.time-(this.propHit[p.id]??-9),pop=age<.5&&s.settings.motion?Math.sin(age/.5*Math.PI)*.05:0;
  c.save();c.translate(p.x,p.y);ellipse(c,0,3,62,13,'#4a3a2238');c.scale(1+pop,1-pop);c.lineJoin='round';
  c.fillStyle='#b07a48';c.strokeStyle=INK;c.lineWidth=2.8;c.beginPath();c.moveTo(-50,-6);c.quadraticCurveTo(-62,-56,-50,-106);c.lineTo(50,-106);c.quadraticCurveTo(62,-56,50,-6);c.quadraticCurveTo(0,8,-50,-6);c.closePath();c.fill();c.stroke();
  c.strokeStyle='#8a5a36';c.lineWidth=1.6;for(const x of [-30,-10,10,30]){c.beginPath();c.moveTo(x,-104);c.quadraticCurveTo(x*1.18,-56,x,-4);c.stroke();}
  for(const y of [-88,-24]){c.strokeStyle=INK;c.lineWidth=7;c.beginPath();c.moveTo(-56,y);c.quadraticCurveTo(0,y+10,56,y);c.stroke();c.strokeStyle='#8f8f8f';c.lineWidth=4;c.stroke();}
  ellipse(c,0,-106,50,15,'#5b3a22',INK,2.6);
  // 씨앗 더미: 통 높이를 넘어 소복이 솟는다
  const h=6+fill*46;
  c.fillStyle='#7a6048';c.beginPath();c.ellipse(0,-106,46,12,0,0,Math.PI);c.lineTo(-46,-106);c.quadraticCurveTo(-30,-106-h,0,-106-h);c.quadraticCurveTo(30,-106-h,46,-106);c.closePath();c.fill();c.strokeStyle=INK;c.lineWidth=2;c.stroke();
  const n=3+Math.round(fill*12);
  for(let k=0;k<n;k++){const u=(rand(k+5)-.5)*1.7,x=u*44,top=-106-h*(1-u*u)*.9,y=top+8+rand(k+9)*10;c.save();c.translate(x,y);c.rotate((rand(k)-.5)*1.4);this.res.draw(c,'seed',0,0,9,14);c.restore();}
  for(let k=0;k<golden;k++){const u=(rand(k+50)-.5)*1.4,x=u*40,y=-106-h*(1-u*u)*.8+10+rand(k+60)*6;this.res.draw(c,'golden-seed',x,y,14,14);}
  c.restore();
 }
 // 구멍 옆 깃발 2개(레퍼런스): 지금 내려갈 층 / 가장 깊이 간 층
 drawBanner(c,b,s){
  const sway=s.settings.motion?Math.sin(this.time*1.8+b.x)*.04:0,num=b.kind==='floor'?s.floor:Math.max(s.floor,s.lifetimeMax??s.floor);
  c.save();c.translate(b.x,b.y);ellipse(c,0,2,12,4,'#4a3a2238');
  c.fillStyle='#9a6a40';c.strokeStyle=INK;c.lineWidth=2;c.beginPath();c.roundRect(-4,-118,8,120,3);c.fill();c.stroke();
  ellipse(c,0,-120,7,7,'#f2c43c',INK,2);
  path(c,[[-26,-108],[26,-108]],5,INK);path(c,[[-26,-108],[26,-108]],2.6,'#c8935e');
  c.rotate(sway);
  c.fillStyle=b.kind==='floor'?'#f4ead0':'#ffe9a8';c.strokeStyle=INK;c.lineWidth=2.4;c.beginPath();c.moveTo(-23,-106);c.lineTo(23,-106);c.lineTo(23,-44);c.lineTo(0,-54);c.lineTo(-23,-44);c.closePath();c.fill();c.stroke();
  c.textAlign='center';c.fillStyle='#6b4a30';c.font='900 11px Game, sans-serif';c.fillText(b.kind==='floor'?'지하':'최고',0,-90);
  c.font='900 22px Game, sans-serif';c.fillStyle='#4a3122';c.fillText(String(num),0,-65);
  c.restore();
 }
 drawRuin(c,[x,y,h]){
  c.save();c.translate(x,y);ellipse(c,0,2,22,6,'#4a3a2230');c.lineJoin='round';
  c.fillStyle='#efe6d2';c.strokeStyle='#8e8576';c.lineWidth=2.4;c.beginPath();c.roundRect(-15,-h,30,h,3);c.fill();c.stroke();
  c.fillStyle='#e2d7bf';c.beginPath();c.roundRect(-20,-h-12,40,14,3);c.fill();c.stroke();
  c.strokeStyle='#cfc3a8';c.lineWidth=2;for(const fx of [-6,0,6]){c.beginPath();c.moveTo(fx,-h+6);c.lineTo(fx,-6);c.stroke();}
  c.strokeStyle='#a99f8a';c.lineWidth=1.6;c.beginPath();c.moveTo(-15,-h*.55);c.lineTo(-6,-h*.48);c.lineTo(-9,-h*.38);c.stroke();
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
  // 피곤할수록 쉼터 모닥불 곁에서 늘어져 쉬는 햄찌가 늘고(5칸 중 칸 수에 비례), 다 차면 모두 퍼질러 잔다.
  // 나머지는 공이 있는 구역 자리로 달려가(syncCrew), 도착하면 그 둘레를 살랑살랑 오간다.
  if(this.crew.length!==this.crewCount())this.syncCrew(0);
  const f=fatigueState(this.getState());
  return this.crew.map((h,i)=>{
   if(h.resting)return{x:h.x,y:h.y,clip:f.count>=f.max?'sleep':'rest',t:this.time+i*.71,face:h.x<CAMPFIRE.x?1:-1};
   // 달리는 중: 걸음을 빠르게(우르르)
   if(h.moving)return{x:h.x,y:h.y,clip:'walk',t:this.time*1.7+i*.71,face:h.face??1,running:true};
   if(h.route)return{x:h.x,y:h.y,clip:'idle',t:this.time+i*.71,face:h.face??1};
   const t=(this.time+i*2.7)%12,moving=t<5,progress=moving?t/5:1;
   const x=h.x+(i%2?1:-1)*Math.sin(progress*Math.PI)*30,y=h.y+Math.sin(progress*Math.PI*2)*7;
   return{x,y,clip:moving?'walk':'idle',t:this.time+i*.71,face:(i%2?1:-1)*(Math.cos(progress*Math.PI)>=0?1:-1)};
  });
 }
 // 던진 햄찌: 마을 위를 미끄러지듯 날다가 허수아비(특성)·우물(이름)·생산기(걷기)에 맞으면 그 일을 하고, 멈추면 제자리로 걸어 돌아간다.
 stepFlights(dt){
  const s=this.getState(),B=flightBounds(zoneById(this.zone));
  for(const [i,f] of this.flights){
   f.t+=dt;
   if(f.phase==='fly'){
    for(let left=Math.min(.1,dt);left>1e-8;left-=1/120){
     const h=Math.min(left,1/120);f.x+=f.vx*h;f.y+=f.vy*h;
     // 벽에 부딪히면 그 방향으로 납작 눌렸다 출렁(bump)
     if(f.x<B.left||f.x>B.right){f.x=Math.max(B.left,Math.min(B.right,f.x));f.vx*=-.45;f.bump=this.time;f.bumpA=0;}
     if(f.y<B.top||f.y>B.bottom){f.y=Math.max(B.top,Math.min(B.bottom,f.y));f.vy*=-.45;f.bump=this.time;f.bumpA=Math.PI/2;}
     if(this.zone==='well'&&Math.hypot(f.x-WELL_MOUTH.x,f.y-WELL_MOUTH.y)<WELL_MOUTH.r){f.phase='dive';f.t=0;f.from={x:f.x,y:f.y};break;}
     // 광산 입구에 빠지면: 구멍이 꿀꺽 삼켰다가 퉤 뱉어 낸다(햄찌는 공으로만 들어간다)
     if(this.zone==='hub'&&((f.x-HOLE.x)/48)**2+((f.y-HOLE.y)/32)**2<1){f.phase='swallow';f.t=0;f.from={x:f.x,y:f.y};f.dir=Math.atan2(-f.vy,-f.vx);break;}
     const bounce=(dx,dy,dist,k=.45)=>{const nx=dx/(dist||1),ny=dy/(dist||1),dot=f.vx*nx+f.vy*ny;if(dot<0){f.vx-=1.4*dot*nx;f.vy-=1.4*dot*ny;}f.vx*=k;f.vy*=k;f.bump=this.time;f.bumpA=Math.atan2(ny,nx);};
     if(!f.hit)for(const d of dummiesFor(s)){const dx=f.x-d.x,dy=f.y-(d.y+DUMMY_HIT.dy),dist=Math.hypot(dx,dy);
      if(dist<DUMMY_HIT.r){f.hit=d.trait;this.hitDummy(i,d);bounce(dx,dy,dist);break;}}
     if(!f.hit)for(const p of PROPS)if(p.gen){const dx=f.x-p.x,dy=f.y-(p.y-p.h*.45),dist=Math.hypot(dx,dy);
      if(dist<40){f.hit=p.id;this.collect(p);bounce(dx,dy,dist,.5);break;}}
     const decay=Math.exp(-FLING.drag*h);f.vx*=decay;f.vy*=decay;
     if(Math.hypot(f.vx,f.vy)<FLING.stop){f.vx=f.vy=0;this.walkBack(i,f,{x:f.x,y:f.y},{amp:.45});break;}
    }
   }else if(f.phase==='swallow'){
    if(f.t>=ACT.swallow){
     // 들어온 쪽으로(조금 흔들린 방향) 130~170 떨어진 곳에 퉤
     const a=f.dir+(rand(this.time*7+i)-.5)*1.2,d=130+rand(this.time*3+i)*40;
     const to={x:Math.max(B.left,Math.min(B.right,HOLE.x+Math.cos(a)*d)),y:Math.max(B.top,Math.min(B.bottom,HOLE.y+Math.abs(Math.sin(a))*d*.7+30))};
     // 꿀꺽 삼킨 순간 구멍이 오므라들고(gulp), rumble초 동안 우르르 부풀며 떨다가 holeSpit 시각에 펑!
     Object.assign(f,{phase:'spit',t:0,from:{x:HOLE.x,y:HOLE.y},to});this.holeGulp=this.time;this.holeSpit=this.time+ACT.rumble;
     this.notify(`광산 입구가 ${hamsterName(s,i)}${josa(hamsterName(s,i),'을','를')} 퉤 뱉었어요! 광산엔 등나무 공을 넣어 다 함께 들어가요.`);
    }
   }else if(f.phase==='spit'){if(f.t>=ACT.spit)this.walkBack(i,f,f.to,{hold:1.05,daze:true});}
   else if(f.phase==='dive'){
    // 우물 속으로 풍덩(물이 튀고 우물이 출렁) → 이름 말풍선(이름을 정할 때까지 우물 속에 있다)
    if(f.t>=FLING.dive){f.phase='inwell';f.t=0;this.propHit.well=this.time;this.showName(i);}
   }else if(f.phase==='inwell'){}
   else if(f.phase==='pop'){if(f.t>=ACT.pop)this.walkBack(i,f,f.to,{hold:.55});}
   else if(f.t>=f.dur+(f.hold??0))this.flights.delete(i);
  }
 }
 // 이름이 정해지면 우물이 우르르 부풀며 떨다가(popRumble) 햄찌가 퐁 튀어나와 우물 옆에 내려앉는다
 popFromWell(i){
  const f=this.flights?.get(i);if(!f||f.phase!=='inwell'&&f.phase!=='dive')return;
  const side=i%2?1:-1;Object.assign(f,{phase:'pop',t:0,from:{x:WELL_MOUTH.x,y:WELL_MOUTH.y},to:{x:WELL.x+side*150,y:WELL.y+55}});this.propHit.well=this.time+ACT.popRumble;
 }
 // 착지했으면 쿵·통·출렁(landing) 하고 hold초 그 자리에 있다가(뱉긴 햄찌는 어질어질 별) 제자리로 걸어간다
 walkBack(i,f,from,{hold=0,daze=false,amp=1}={}){const home=this.crewPositions()[i]??from;Object.assign(f,{phase:'back',t:0,from,hold,daze,landAt:this.time,landAmp:amp,dur:Math.max(.5,Math.hypot(home.x-from.x,home.y-from.y)/FLING.walk)});}
 // 건물 단계가 바뀌면(강화·마스터리) 창을 닫고 마을이 보일 때 한 번 공사 연출
 checkRebuild(s){
  if(this.blocked())return;const now=this.levels(s);
  if(this.seen)for(const id of Object.keys(now))if(now[id]!==this.seen[id])this.rebuild[id]=this.time;
  this.seen=now;
 }
 step(dt){
  this.time+=Math.min(.1,dt);
  if(!this.blocked()){this.stepFlights(dt);this.checkRebuild(this.getState());if(!this.suction)this.syncCrew(Math.min(.1,dt));}
  this.pops=this.pops.filter(p=>this.time-p.t<1.2);
  // 공에 씨앗이 들어간 순간(말풍선 '넣기'·탐사 준비 창 모두): 충전 연출을 한 번
  const prepared=!!this.getState().renewal?.village?.prepared;
  if(prepared&&this.wasPrepared===false&&!this.suction)this.charge={t0:this.time,n:this.packValue()};
  this.wasPrepared=prepared;
  if(this.charge&&this.time-this.charge.t0>=ACT.charge)this.charge=null;
  if(this.ballSpit&&this.time-this.ballSpit.t0>=ACT.ballSpit)this.ballSpit=null;
  // 화면 넘김: 옆 구역으로 부드럽게 미끄러진 뒤 그 구역 안에 카메라를 묶는다
  if(this.slide){
   // 살짝 뒤로 물러났다(예비) 휙 넘어가서 조금 지나쳤다 돌아온다(오버슈트)
   const sl=this.slide;sl.t+=Math.min(.1,dt);const k=Math.min(1,sl.t/TRAVEL.slide),b=1.2*1.525,e=k<.5?((2*k)**2*((b+1)*2*k-b))/2:((2*k-2)**2*((b+1)*(2*k-2)+b)+2)/2;
   this.camera={x:sl.from.x+(sl.to.x-sl.from.x)*e,y:sl.from.y+(sl.to.y-sl.from.y)*e,zoom:sl.from.zoom+(sl.to.zoom-sl.from.zoom)*k*k*(3-2*k),bounds:sl.to.bounds};
   if(k>=1){this.camera={...sl.to};this.slide=null;}
  }
  if(this.suction){
   this.suction.time+=dt;
   if(this.suction.time>=.82&&!this.suction.called){this.suction.called=true;this.onEnter();}
  }else if(!this.blocked()&&!this.aim&&(this.ball.vx||this.ball.vy)){
   const pvx=this.ball.vx,pvy=this.ball.vy,inside=stepBall(this.ball,dt);
   // 벽에 튕기면 공이 그 방향으로 납작 눌렸다 출렁
   if(pvx*this.ball.vx<0)this.ballBump={t:this.time,a:0};else if(pvy*this.ball.vy<0)this.ballBump={t:this.time,a:Math.PI/2};
   if(inside){
    // 씨앗을 넣은 공만 들어간다. 빈 공이거나 지쳤으면 구멍이 공을 퉤 뱉어 제자리로 돌려보낸다.
    const s=this.getState();
    if(canDepart(s)&&s.renewal.village.prepared)this.enter();
    else{this.ball=freshBall();this.ballSpit={t0:this.time};this.notify(canDepart(s)?'빈 공은 못 들어가요! 공을 톡 눌러 해바라기씨를 넣어 주세요.':'햄찌들이 너무 지쳤어요. 쉼터에서 피곤함이 풀리면 출발할 수 있어요.');}
   }
   if(this.ball.zone!==this.zone)this.goZone(this.ball.zone);
  }
 }
 render(){
  const c=this.context,cam=this.camera,s=this.getState(),f=fatigueState(s),tired=f.count>=f.max;
  c.save();c.setTransform(c.canvas.width/450,0,0,c.canvas.height/800,0,0);c.clearRect(0,0,450,800);
  c.save();c.translate(225,400);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-cam.y);for(const b of this.backgrounds??[])c.drawImage(b.cv,b.z.left,b.z.top);
  // 광산 입구 연출: 꿀꺽(삼키면 오므라졌다 출렁) → 우르르(뱉기 전 부풀며 덜덜) → 펑!(크게 벌어졌다 출렁 + 흙먼지·돌멩이)
  const booms=[this.holeSpit,this.ballSpit&&this.ballSpit.t0+ACT.ballRumble].filter(b=>b!=null);
  let hsx=1,hsy=1,hdx=0,boomAge=9,rumble=0;
  if(s.settings.motion){
   for(const b of booms){const a=this.time-b;
    if(a<0&&a>-.45){const amp=(1+a/.45)**1.5;rumble=Math.max(rumble,amp);hdx+=Math.sin(this.time*85)*7*amp;hsx+=.22*amp+Math.sin(this.time*41)*.05*amp;hsy+=.32*amp+Math.cos(this.time*37)*.06*amp;}
    else if(a>=0&&a<.7){const w=Math.exp(-a*6)*Math.cos(a*24);hsx+=.45*w;hsy-=.22*w;}
    if(a>=0)boomAge=Math.min(boomAge,a);}
   const g=this.time-(this.holeGulp??-9);if(g>=0&&g<.5){const w=Math.exp(-g*7)*Math.cos(g*22);hsx-=.3*w;hsy+=.18*w;}
  }
  c.save();c.translate(HOLE.x+hdx,HOLE.y);c.scale(hsx,hsy);c.translate(-HOLE.x,-HOLE.y);this.sprite(c,'mine-hole',HOLE.x,HOLE.y+45,132,91);c.restore();
  // 우르르: 입구 둘레 돌멩이가 통통 튀고 흙 부스러기가 들썩인다
  if(rumble>0)for(let j=0;j<6;j++){const a=j/6*Math.PI*2+.4,hop=Math.abs(Math.sin(this.time*(26+j*3)+j))*16*rumble;
   ellipse(c,HOLE.x+Math.cos(a)*62*hsx,HOLE.y+Math.sin(a)*34*hsy-hop,4+j%2,3.4,'#8a6a4a',INK,1.2);}
  if(boomAge<.75){const k=boomAge/.75,e=1-(1-k)**3;c.save();c.globalAlpha=(1-k)*.9;
   // 흙먼지 고리가 확 퍼지고, 돌멩이가 사방으로 포물선을 그리며 튄다
   for(let j=0;j<10;j++){const a=j/10*Math.PI*2+.3;ellipse(c,HOLE.x+Math.cos(a)*(34+e*95),HOLE.y+Math.sin(a)*(20+e*48)-e*14,9+e*14,6+e*8,j%2?'#e9dcc0':'#d8c6a2');}
   for(let j=0;j<7;j++){const a=-Math.PI*(.12+.76*j/6),v=120+rand(j*3.1)*90,x=HOLE.x+Math.cos(a)*v*boomAge*1.4,y=HOLE.y-10+Math.sin(a)*v*boomAge*1.4+260*boomAge*boomAge;
    ellipse(c,x,y,3.4+rand(j)*2.4,3+rand(j+5)*2,'#8a6a4a',INK,1.2);}
   c.restore();}
  label(c,'광산 입구',HOLE.x,HOLE.y-64,19);
  c.fillStyle='#fff4cb';c.beginPath();const bounce=s.settings.motion?Math.sin(this.time*3)*3:0;c.moveTo(HOLE.x-6,HOLE.y-51+bounce);c.lineTo(HOLE.x+6,HOLE.y-51+bounce);c.lineTo(HOLE.x,HOLE.y-43+bounce);c.fill();
  const motion=s.settings.motion,levels=this.levels(s);
  const objects=[...DECOR,...BUILDINGS].map(b=>({depth:b.y,draw:()=>{
   // 공사 연출: 건물이 통통 튀고 바닥에서 먼지가 퍼지며 반짝임이 오른다(1.2초)
   const age=this.time-(this.rebuild[b.id]??-9),k=age/1.2,building=k>=0&&k<1;
   c.save();
   if(building&&motion){const wob=Math.sin(k*Math.PI*4)*(1-k)*.07;c.translate(b.x,b.y);c.scale(1+wob,1-wob);c.translate(-b.x,-b.y);}
   this.sprite(c,b.id,b.x,b.y,b.w,b.h,1,b.pink?this.pinkTree??this.sprites.tree:undefined);c.restore();
   if(b.label)label(c,b.label,b.x,b.y+24,17);
   if(levels[b.id])this.levelFlag(c,b,levels[b.id],building?k:1);
   if(building)this.rebuildDust(c,b,k);
   if(b.id==='forge'&&this.forgeReady(s))this.forgeFlame(c,b,motion);
  }}));
  const painters={storage:this.drawStorage,mill:this.drawMill,totem:this.drawTotem,well:this.drawWell};
  for(const p of PROPS)objects.push({depth:p.y,draw:()=>{painters[p.id].call(this,c,p,s);label(c,p.label,p.x,p.y+24,15);if(p.gen)this.stockBubble(c,p,s);}});
  objects.push({depth:CAMPFIRE.y,draw:()=>this.drawCampfire(c,motion)});
  for(const b of BANNERS)objects.push({depth:b.y,draw:()=>this.drawBanner(c,b,s)});
  for(const r of RUINS)objects.push({depth:r[1],draw:()=>this.drawRuin(c,r)});
  const pts=octagon();for(let k=0;k<8;k++){const a=pts[k],b=pts[(k+1)%8];objects.push({depth:(a[1]+b[1])/2,draw:()=>this.drawFence(c,a,b)});}
  // 경기장 이름표는 위쪽 출입구 바로 안, 해바라기 문양 위에 바닥 글씨처럼
  objects.push({depth:ARENA.y-180,draw:()=>label(c,'특성 경기장',ARENA.x,ARENA.y-160,16)});
  for(const d of dummiesFor(s))objects.push({depth:d.y,draw:()=>this.drawDummy(c,d,s)});
  // 구역 경계 문 기둥과 양쪽 팻말(이 구역에서 갈 수 있는 이웃 구역)
  for(const g of GATES){const ctr=gateCenter(g);
   objects.push({x:ctr.x,y:ctr.y,depth:g.axis==='x'?g.from-6:g.at,draw:()=>this.drawGatePosts(c,g)});
   for(const sg of gateSigns(g))objects.push({x:sg.x,y:sg.y,depth:sg.y,draw:()=>this.drawGateSign(c,sg.x,sg.y,sg.dir,zoneById(sg.to))});}
  const crew=this.suction?this.suction.crew:this.crewPositions();
  crew.forEach((p,i)=>{
   const f=!this.suction&&this.flights.get(i);let gx=p.x,gy=p.y,lift=0,clip=p.clip,t=p.t,face=p.face,size=.68;
   // st/sa = 늘임 세기·방향, feet = 발을 축으로(착지·뜀) 아니면 몸 가운데를 축으로, rot = 공중제비, daze = 어질어질 별
   let st=0,sa=Math.PI/2,feet=true,rot=0,daze=0,held=null;
   const flyArc=(r,h)=>{gx=r.x;gy=r.y;lift=r.lift;st=Math.min(.5,r.sp*h);sa=r.a;feet=false;};
   // 우르르 따라 달릴 때: 통통 뛰며 땅에 닿을 때 납작, 떠오를 때 쭉
   if(p.running&&!f){const ph=(this.time*13+i*1.3)%Math.PI;lift=Math.sin(ph)*10;st=-.14*Math.cos(2*ph);}
   // 집어서 당기는 동안: 놀란 표정으로 부들부들 떤다(늘어나지 않음, 세게 당길수록 더 세게) — 놓으면 날아간다
   if(this.fling?.i===i&&!f){const dx=this.fling.pointer.x-this.fling.origin.x,dy=this.fling.pointer.y-this.fling.origin.y,d=Math.hypot(dx,dy);
    // 몸은 평소 자세(idle) 그대로, 표정만 화들짝(동그란 눈 + '!' 말풍선)
    if(d>6){held=renewalPose('idle',this.time+i*.71,i,{loop:true});clip='startle';t=.1;if(motion){const a=.6+2.4*Math.min(1,d/180);gx+=Math.sin(this.time*95)*a;lift+=Math.abs(Math.cos(this.time*83))*a*.6;}}}
   if(f?.phase==='fly'){gx=f.x;gy=f.y;const sp=Math.hypot(f.vx,f.vy);lift=Math.min(34,sp*.07);clip='startle';t=Math.min(.5,f.t);face=f.vx>=0?1:-1;
    st=Math.min(.42,sp/2000);sa=Math.atan2(f.vy,f.vx);feet=false;
    const b=f.bump!=null?this.time-f.bump:9;if(b<.4){st=-.4*Math.exp(-b*8)*Math.cos(b*30);sa=f.bumpA;}}
   else if(f?.phase==='dive'){
    // 우물로 빨려 들어가듯 쭉 늘어나 머리부터 풍덩(물에 닿기 직전 작아진다)
    const u=f.t/FLING.dive,r=arc(f.from,WELL_MOUTH,u,90);flyArc(r,.035);size*=1-.85*clamp01((u-.7)/.3);rot=(f.from.x<=WELL_MOUTH.x?1:-1)*Math.PI*.85*r.k*r.k;clip='startle';t=.27;}
   else if(f?.phase==='inwell')return;   // 이름이 정해질 때까지 우물 속(보이지 않음)
   else if(f?.phase==='swallow'){
    // 붙잡힘(앞 35%): 제자리에서 구멍 쪽으로 쭈욱 늘어나며 버둥 → 국수처럼 후루룩 빨려 들어간다
    const u=f.t/ACT.swallow;clip='startle';t=.27;sa=Math.atan2(HOLE.y-f.from.y,HOLE.x-f.from.x);feet=false;
    if(u<.35){const k=u/.35;gx=f.from.x+Math.sin(this.time*70)*2*k;gy=f.from.y;st=.6*k;lift=6*k;}
    else{const e=((u-.35)/.65)**3;gx=f.from.x+(HOLE.x-f.from.x)*e;gy=f.from.y+(HOLE.y-f.from.y)*e;size*=1-e*.92;st=.6+e*.3;rot=e*Math.PI*1.5;}}
   else if(f?.phase==='spit'||f?.phase==='pop'){
    // 우르르(구멍·우물 속, 안 보임) → 펑! 늘어난 채 튀어나와 공중제비를 돌며 꼭대기에서 둥실 머물다 떨어진다
    const spit=f.phase==='spit',wait=spit?ACT.rumble:ACT.popRumble,u=(f.t-wait)/((spit?ACT.spit:ACT.pop)-wait);
    if(u<0)return;
    const r=arc(f.from,f.to,u,spit?175:150);flyArc(r,.03);clip='startle';t=.27;face=f.to.x>=f.from.x?1:-1;
    // 공중제비(뱉기는 두 바퀴, 우물은 한 바퀴)와 크기 튐(작게 나와 1.2배까지 부풀었다 제 크기로)
    rot=face*Math.PI*2*r.k*(spit?2:1);size=.68*(u<.25?.3+.9*(u/.25):1.2-.2*clamp01((u-.25)/.3));}
   else if(f?.phase==='back'){
    const hold=f.hold??0,k=clamp01((f.t-hold)/f.dur),e=k*k*(3-2*k);gx=f.from.x+(p.x-f.from.x)*e;gy=f.from.y+(p.y-f.from.y)*e;
    clip=f.t<hold?(f.daze?'startle':'idle'):'walk';if(f.t<hold)t=f.daze?.1+Math.sin(this.time*9)*.05:t;face=f.t<hold?face:p.x>=f.from.x?1:-1;
    if(f.daze&&f.t<hold+.7)daze=clamp01((hold+.7-f.t)/.35);}
   // 내려앉을 때: 쿵 눌렸다 통 튀어 오르고 출렁 멈춘다
   if(f?.landAt!=null&&f.phase==='back'){const L=landing(this.time-f.landAt,.75,f.landAmp??1);if(L.st||L.lift){lift+=L.lift;st=L.st;sa=Math.PI/2;feet=true;}}
   if(!motion){st=0;rot=0;}
   const inside=f&&(f.phase==='dive'||f.phase==='swallow');
   objects.push({depth:this.suction?3000:f?.phase==='dive'?WELL.y+1:f?.phase==='swallow'?HOLE.y+1:gy,draw:()=>{
    let x=gx,y=gy,sz=size,pst=st,psa=sa,pfeet=feet,prot=rot;
    // 광산으로 출발: 차례로 구멍 쪽으로 쭉 늘어나 빙글 돌며 빨려 들어간다
    if(this.suction){const k=Math.max(0,Math.min(1,(this.suction.time-i*.045)/.6)),ease=k*k*k;pst=motion?.55*Math.sin(Math.min(1,k*1.6)*Math.PI/2):0;psa=Math.atan2(HOLE.y-y,HOLE.x-x);pfeet=false;prot=motion?ease*Math.PI*2:0;
     x+=(HOLE.x-x)*ease;y+=(HOLE.y-y)*ease;sz*=1-ease;if(sz<.01)return;clip='startle';t=.27;}
    if(lift>1){c.fillStyle='#4a3a2240';c.beginPath();c.ellipse(x,y+4,17*sz/.68*Math.max(.5,1-lift/260),5,0,0,Math.PI*2);c.fill();}
    const cy=y-lift-26*sz/.68,changed=pst||prot;
    if(changed){c.save();if(prot){c.translate(x,cy);c.rotate(prot);c.translate(-x,-cy);}if(pst)jelly(c,x,pfeet?y-lift:cy,psa,pst);}
    drawActor(c,this.res,{x,y:y-lift,size:sz,clip,skin:this.skin(s,i),t:motion?t:0,face,emote:true,showTool:false,loop:true,poseOverride:this.suction?null:held});
    if(changed)c.restore();
    // 뱉긴 햄찌: 머리 위로 별이 빙글빙글
    if(daze>0){c.save();c.globalAlpha=daze;for(let j=0;j<3;j++){const a=this.time*7+j*Math.PI*2/3;star(c,x+Math.cos(a)*22,y-lift-50+Math.sin(a)*7,7.5,'#ffe27a',INK);}c.restore();}
    if(this.suction||inside||f?.phase==='spit'||f?.phase==='pop')return;
    // 이름표(머리 위)와 낀 특성(발밑, 둘째 칸까지)
    label(c,hamsterName(s,i),x,y-60-lift,12);
    const worn=[s.renewal.traits?.[i],s.renewal.traits2?.[i]].filter(t=>t&&t!=='none'&&TRAITS[t]);if(worn.length)label(c,worn.map(t=>TRAITS[t].name).join('·'),x,y+19-lift,11);
   }});
  });
  objects.push({depth:this.ball.y+20,draw:()=>{
   if(this.suction)return;
   const prepared=s.renewal.village.prepared,ch=this.charge,ck=ch?(this.time-ch.t0)/ACT.charge:9,cs=ch?this.time-ch.t0:9;
   const J0=CHARGE.seeds,J1=J0+CHARGE.crouch,J2=J1+CHARGE.jump;
   // st/sa = 늘임 세기·방향, feet = 공 바닥을 축으로(착지·움츠림) 아니면 공 가운데, spin = 덤으로 도는 양, gulp = 씨앗 삼킬 때 불룩
   let bx=this.ball.x,by=this.ball.y,lift=0,st=0,sa=Math.PI/2,feet=false,spin=0,gulp=0;
   // 굴러갈 때는 가는 방향으로 쭉, 벽에 튕기면 그 방향으로 납작 출렁, 당기는 동안은 당기는 쪽으로 늘어나 덜덜
   const sp=Math.hypot(this.ball.vx,this.ball.vy);if(sp>40){st=Math.min(.24,sp/2500);sa=Math.atan2(this.ball.vy,this.ball.vx);}
   const bb=this.ballBump?this.time-this.ballBump.t:9;if(bb<.4){st=-.36*Math.exp(-bb*8)*Math.cos(bb*30);sa=this.ballBump.a;}
   if(this.aim){const dx=this.aim.pointer.x-this.aim.origin.x,dy=this.aim.pointer.y-this.aim.origin.y,d=Math.hypot(dx,dy);
    if(d>6){st=Math.min(.32,d/320);sa=Math.atan2(dy,dx);if(d>120)bx+=Math.sin(this.time*90)*1.4*Math.min(1,(d-120)/80);}}
   // 구멍이 빈 공을 뱉음: 우르르(구멍 속, 안 보임) → 펑! 늘어난 채 빙글빙글 날아와 → 쿵·통·출렁
   if(this.ballSpit){const a=this.time-this.ballSpit.t0;if(a<ACT.ballRumble)return;
    const u=(a-ACT.ballRumble)/ACT.ballFly;
    if(u<1){const r=arc(HOLE,{x:bx,y:by},u,150);bx=r.x;by=r.y;lift=r.lift;st=Math.min(.45,r.sp*.03);sa=r.a;spin=r.k*Math.PI*4;}
    else{const L=landing(a-ACT.ballRumble-ACT.ballFly,ACT.ballSpit-ACT.ballRumble-ACT.ballFly);lift=L.lift;st=L.st;sa=Math.PI/2;feet=true;}}
   // 충전: 씨앗이 하나 들어갈 때마다 불룩(꿀꺽) → 꽉 차면 번쩍 → 납작 움츠렸다 → 쭉 늘어나며 점프·한 바퀴 → 쿵·통·출렁 + 반짝 터짐
   if(ch&&motion){
    if(cs<J0){const n=Math.min(8,Math.max(1,ch.n));for(let j=0;j<n;j++){const g=cs-(j/n*.28+.22);if(g>=0&&g<.16)gulp+=.2*Math.sin(g/.16*Math.PI);}gulp=Math.min(.3,gulp);}
    else if(cs<J1){const k=(cs-J0)/CHARGE.crouch;st=-.42*Math.sin(k*Math.PI/2);sa=Math.PI/2;feet=true;bx+=Math.sin(this.time*80)*1.6*k;}
    else if(cs<J2){const r=arc({x:bx,y:by},{x:bx,y:by},(cs-J1)/CHARGE.jump,80);lift=r.lift;st=Math.min(.42,r.sp*.05);sa=Math.PI/2;spin=r.k*Math.PI*2;}
    else{const L=landing(cs-J2,ACT.charge-J2);lift=L.lift;st=L.st;sa=Math.PI/2;feet=true;}
   }
   if(ch)this.burstAt=ch.t0+J2;else if(this.burstAt>this.time)this.burstAt=null;   // 충전이 도중에 끊기면 터짐도 없다
   if(!motion){st=0;spin=0;gulp=0;}
   if(lift>1){c.fillStyle='#4a3a2240';c.beginPath();c.ellipse(bx,by+18,18*Math.max(.4,1-lift/200),5,0,0,Math.PI*2);c.fill();}
   const full=prepared&&!(cs<J0);
   c.save();c.translate(bx,by-lift);if(st)jelly(c,0,feet?20:0,sa,st);if(gulp)c.scale(1+gulp,1+gulp*.8);c.rotate(this.ball.angle+spin);
   if(full)this.res.draw(c,'ball-full',0,0,42,42);else this.drawEmptyBall(c);
   c.restore();
   if(ch){
    // 씨앗들이 공 둘레에서 소용돌이치며 점점 빨라져 공 속으로 쏙(작게 나타났다 부풀며 날아든다)
    const n=Math.min(8,Math.max(1,ch.n));
    for(let j=0;j<n;j++){const k=(cs-j/n*.28)/.22;if(k<=0||k>=1)continue;const e=k*k;
     const a=-Math.PI/2+(j-(n-1)/2)*.5+(1-e)*1.6,r=(1-e)*85,x=bx+Math.cos(a)*r,y=by-6+Math.sin(a)*r*.8-Math.sin(k*Math.PI)*22,sc=Math.min(1.3,k*5)*(1-e*.3);
     c.save();c.globalAlpha=Math.min(1,k*5);c.translate(x,y);c.rotate(k*6+j);c.scale(sc,sc);this.res.draw(c,'seed',0,0,9,14);c.restore();}
    // 꽉 찬 순간 번쩍
    if(cs>=J0&&cs<J0+.16){c.save();c.globalAlpha=(1-(cs-J0)/.16)*.85;ellipse(c,bx,by-lift,23,23,'#fffbe6');c.restore();}
   }
   // 착지한 순간 반짝 터짐: 고리가 퍼지고 별이 사방으로 튄다
   const ba=this.time-(this.burstAt??-9);
   if(motion&&ba>=0&&ba<.6){const k=ba/.6,e=1-(1-k)**3;c.save();c.globalAlpha=(1-k)*.95;ellipse(c,bx,by-4,26+e*40,(26+e*40)*.55,null,'#fff3b0',3.4);
    for(let j=0;j<8;j++){const a=j/8*Math.PI*2+.2,r=24+e*58;star(c,bx+Math.cos(a)*r,by-14+Math.sin(a)*r*.7-e*10,5*(1-k*.5),'#ffe27a','#b8862a');}c.restore();}
   if(!this.aim&&!this.ballSpit&&ck>=1&&Math.hypot(this.ball.vx,this.ball.vy)<9)label(c,this.ball.zone!=='hub'?'당겨서 굴려요':tired?'햄찌들이 지쳤어요':prepared?'당겨서 구멍으로!':'톡! 씨앗 넣기',bx,by+37,13);
  }});
  // 경계 문·팻말은 화면 밖(먼 구역)이면 건너뛴다(x가 없는 나머지는 그대로 그린다)
  const half=225/cam.zoom+280,halfY=400/cam.zoom+320;
  objects.filter(o=>o.x==null||Math.abs(o.x-cam.x)<half&&Math.abs((o.y??cam.y)-cam.y)<halfY).sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());
  // 걷은 생산기·바뀐 이름이 위로 솟았다 사라진다
  for(const p of this.pops){const k=(this.time-p.t)/1.2;c.save();c.globalAlpha=1-k*k;
   if(p.text.startsWith('+')){const y=p.y-k*40;if(p.golden)this.res.draw(c,'golden-seed',p.x-22,y-6,18,18);else this.res.draw(c,'seed',p.x-22,y-6,11,17);label(c,p.text,p.x+8,y,20);}
   else label(c,p.text,p.x,p.y-k*40,18);c.restore();}
  if(this.fling){
   // 햄찌 조준선: 같은 감속으로 미끄러질 길
   const f=this.fling,v=aimVelocity(f.origin,f.pointer),b={x:f.origin.x,y:f.origin.y,vx:v.vx,vy:v.vy},pts=[],B=flightBounds(zoneById(this.zone));
   for(let i=0;i<40&&Math.hypot(b.vx,b.vy)>=FLING.stop;i++){for(let j=0;j<4;j++){const h=1/120;b.x+=b.vx*h;b.y+=b.vy*h;if(b.x<B.left||b.x>B.right){b.x=Math.max(B.left,Math.min(B.right,b.x));b.vx*=-.45;}if(b.y<B.top||b.y>B.bottom){b.y=Math.max(B.top,Math.min(B.bottom,b.y));b.vy*=-.45;}const k=Math.exp(-FLING.drag*h);b.vx*=k;b.vy*=k;}pts.push({x:b.x,y:b.y});}
   c.strokeStyle='#fff6cb';c.lineWidth=3/cam.zoom;c.setLineDash([4/cam.zoom,7/cam.zoom]);c.beginPath();c.moveTo(f.origin.x,f.origin.y);pts.forEach(p=>c.lineTo(p.x,p.y));c.stroke();c.setLineDash([]);
   path(c,[[f.origin.x,f.origin.y],[f.pointer.x,f.pointer.y]],2/cam.zoom,'#a18459');
  }
  if(this.aim){
   const v=aimVelocity(this.aim.origin,this.aim.pointer),points=trajectory(this.ball,v);
   c.strokeStyle='#fff6cb';c.lineWidth=3/cam.zoom;c.setLineDash([4/cam.zoom,7/cam.zoom]);c.beginPath();c.moveTo(this.ball.x,this.ball.y);points.forEach(p=>c.lineTo(p.x,p.y));c.stroke();c.setLineDash([]);
   path(c,[[this.ball.x,this.ball.y],[this.aim.pointer.x,this.aim.pointer.y]],2/cam.zoom,'#a18459');
  }
  c.restore();
  // 위쪽 재화 칸(레퍼런스처럼 왼쪽 위에 이름, 오른쪽에 재화): 해바라기씨 · 황금 해바라기씨
  // 왼쪽 위: 지금 있는 구역 번호와 이름
  const zone=zoneById(this.zone);frame(c,this.res.rig,'panel_brown',13,16,150,42);label(c,`${zone.no} ${zone.name}`,88,44,17);
  // 구역에 도착하면 가운데 위에 구역 이름표가 잠깐 떴다 사라진다(화면이 넘어간 느낌)
  if(this.arrival){const k=(this.time-this.arrival.t)/TRAVEL.card;
   // 위에서 툭 떨어져 쿵 눌렸다 출렁 → 잠깐 머물고 → 위로 쏙 빠진다
   if(k>=1)this.arrival=null;else if(k>0){const a=k*TRAVEL.card,out=Math.max(0,(a-(TRAVEL.card-.3))/.3);
    const drop=a<.22?-120*(1-a/.22)**2:-out*out*140,sq=a>=.22&&a<.7?.22*Math.exp(-(a-.22)*8)*Math.cos((a-.22)*26):0;
    c.save();c.globalAlpha=Math.min(1,a*8,1-out);c.translate(225,182+drop);c.scale(1+sq,1-sq);c.translate(-225,-182);
    frame(c,this.res.rig,'panel_brown',95,150,260,64);label(c,`구역 ${this.arrival.no}`,225,174,14);label(c,this.arrival.name,225,203,24);c.restore();}}
  frame(c,this.res.rig,'panel_brown',226,16,104,42);this.res.draw(c,'seed',246,37,14,21);label(c,String(s.renewal.seeds),290,44,17);
  frame(c,this.res.rig,'panel_brown',336,16,101,42);this.res.draw(c,'golden-seed',356,37,24,24);label(c,String(s.renewal.golden??0),398,44,17);
  // 피곤함 칸(모바일 스테미너): 찬 칸은 주황, 빈 칸은 연하게. 칸이 남아 있으면 다음 1칸 회복까지 남은 시간.
  frame(c,this.res.rig,'panel_brown',100,67,250,34);
  for(let i=0;i<f.max;i++){c.beginPath();c.arc(124+i*19,84,6.5,0,Math.PI*2);c.fillStyle=i<f.count?'#e48a54':'#efe1c4';c.fill();c.lineWidth=1.6;c.strokeStyle=i<f.count?'#8a4a2a':'#b99a70';c.stroke();}
  const left=Math.ceil(f.nextMs/1000),time=`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
  label(c,f.count?`${tired?'지쳤어요':'피곤함'} · ${time}`:'쌩쌩해요!',275,90,13);
  c.restore();
  this.placePack();
  const desc=`햄찌 마을 · 구역 ${zone.no} ${zone.name} · 피곤함 ${f.count}/${f.max}${f.count?' · 1칸 회복까지 '+time:''} · 씨앗 ${s.renewal.seeds}개 · 황금 ${s.renewal.golden??0}개 · 확대 ${Math.round(cam.zoom*100)}%`;
  if(this.canvas.getAttribute('aria-label')!==desc)this.canvas.setAttribute('aria-label',desc);
 }
}
