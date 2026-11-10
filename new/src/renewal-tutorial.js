// ── 뉴 햄찌 광산 튜토리얼(2026-11-10) ──
// 기존판 튜토리얼 프리셋(화면을 어둡게 덮고 볼 곳만 동그랗게 밝힌 뒤 안내 햄찌 말풍선, tutorial.css)을 그대로 쓴다.
// 말로만 설명하지 않고 유저가 한 번씩 직접 해 보게 한다(action = 밝힌 곳을 실제로 해야 넘어감).
//  1부(mine): 프롤로그가 끝나면 마을이 아니라 바로 첫 탐사로. 1층은 구멍을 바로 열어 둬서 곧장 아래층으로 내려가 본다.
//             햄찌 던지기 → 공으로 아래층 → 잠든 햄찌 깨우기 → 수레 던지기 → 황금 상자 깨기 → 귀환
//  2부(village): 정산 → 마스터리 배우기 → 도구 놀이터 → 대장간 강화 → 지하 깃발 → 특성 경기장으로 공 굴리기
//             → 장비에 햄찌 던져 특성 끼기 → 광산 입구로 → 공에 씨앗 넣고 다시 출발하면 끝
// 단계: info = 말풍선만('다음', 광산은 시간이 멈춤), action = 직접 해 보기, wait = 덮지 않고 조건을 기다림.
// hold: 그 동작을 시작(손가락으로 잡기)하기 전까지 광산 시간을 멈춘다(밝힌 대상이 움직여 버리지 않게).
// 진행(s.renewal.tutorial = {stage, step, ran})은 저장된다. 이미 프롤로그를 본 예전 저장은 튜토리얼 없이 시작한다.
import {RENEWAL_TUTORIAL_TEXT as TEXT} from '../data/renewal-tutorial.js';
import {CONFIG as C} from '../data/config.js';
import {mineCamera,toScreen} from './mining/renderer.js';
import {center,TILE,RISE,strike,isMineable,hitCell} from './mining/model.js';
import {predictBall} from './mining/ball.js';
import {ballPositionClear} from './mining/terrain-collision.js';
import {screenPoint} from './village/camera.js';
import {BUILDINGS,BANNERS} from './village/world.js';
import {HOLE} from './village/plaza.js';
import {traitDisplays} from './village/trait-displays.js';
import {nodeLevel,nodes} from './mastery-state.js';
import {masteryPrice} from '../data/mastery.js';
import {canDepart} from './village/state.js';
import {enhancementQuote} from './mining/game-state.js';

const q=sel=>()=>{const n=document.querySelector(sel);return n&&n.offsetParent!==null?n:null;};
const union=(...rs)=>{rs=rs.filter(Boolean);if(!rs.length)return null;const x=Math.min(...rs.map(r=>r.x)),y=Math.min(...rs.map(r=>r.y));return{x,y,w:Math.max(...rs.map(r=>r.x+r.w))-x,h:Math.max(...rs.map(r=>r.y+r.h))-y};};
// 광산 좌표 한 점 둘레 → 캔버스(450×800) 좌표
function mineRect(m,x,y,w,h){const cam=mineCamera(m),a=toScreen(cam,{x:x-w/2,y:y-h/2});return{x:a.x,y:a.y,w:w*cam.zoom,h:h*cam.zoom};}
function villageRect(v,x,y,w,h){const a=screenPoint(v.camera,{x:x-w/2,y:y-h/2});return{x:a.x,y:a.y,w:w*v.camera.zoom,h:h*v.camera.zoom};}
const canvasHole=(...rs)=>{const r=union(...rs);return r?{canvas:r}:null;};
const run=c=>c.s.renewal.run;
const scene=c=>c.s.renewal.village?.scene;
const freeHamster=m=>m.crew.find(h=>!h.cargo&&!h.sleeping&&!h.fling&&!h.care&&!h.action)??m.crew.find(h=>!h.fling)??m.crew[0];
const eventSince=(m,type,t,pred=()=>true)=>m.events.some(e=>e.type===type&&e.time>=t&&pred(e));
const ballRect=m=>mineRect(m,m.ball.x,m.ball.y,62,62);
// 첫 층: 바위를 다 깨지 않아도 다음 층 구멍을 바로 열어 보여 준다(구멍 바위를 풀고 깨서 구멍을 드러냄)
function openHoleNow(m){
 const cell=m.cells.find(c=>c.hole);if(!cell)return;
 const[x,y]=center(cell.id),smash=c=>{const[cx,cy]=center(c.id);for(let i=0;i<20&&isMineable(c)&&c.solid;i++)strike(m,c.id,{id:null,power:(c.maxHp??5)+5,contact:{x:cx,y:cy}});};
 if(!m.holeAt){m.floorBroken=Math.max(m.floorBroken??0,m.holeNeed??0);cell.locked=false;m.navRevision++;m.events.push({type:'unlock',id:cell.id,time:m.time,x,y});smash(cell);}
 if(!m.holeAt)return;
 const hx=m.holeAt.x,hy=m.holeAt.y,hits=()=>{m.aim={what:'ball',x:m.ball.x,y:m.ball.y,pointerX:0,pointerY:0,dx:0,dy:0};const d=Math.hypot(hx-m.ball.x,hy-m.ball.y)||1;m.aim.dx=(hx-m.ball.x)/d*105;m.aim.dy=(hy-m.ball.y)/d*105;const p=predictBall(m);m.aim=null;return p.at(-1)?.target==='hole';};
 if(hits())return;
 // 공이 구멍까지 곧게 굴러갈 수 있는 자리를 찾는다: 부서지지 않는 동굴 벽은 피하고, 그 사이 바위는 뚫어 둔 뒤
 // 실제로 굴려 보는 계산(predictBall)으로 구멍에 들어가는 게 확인된 자리에 공을 옮겨 둔다.
 const walls=m.cells.filter(c=>c.solid&&(c.unbreakable||c.outside)).map(c=>center(c.id));
 const blocked=(px,py)=>walls.some(([cx,cy])=>Math.abs(px-cx)<TILE/2+24&&py>cy-TILE/2-24&&py<cy+TILE/2+RISE+24);
 const spots=m.cells.filter(c=>!c.outside&&!c.unbreakable&&!c.hole).map(c=>{const[px,py]=center(c.id);return{c,x:px,y:py,d:Math.hypot(px-hx,py-hy)};})
  .filter(o=>o.d>=95&&o.d<=260).sort((a,b)=>Math.abs(a.d-150)-Math.abs(b.d-150));
 const home={x:m.ball.x,y:m.ball.y};
 for(const o of spots){
  let clear=true;for(let t=0;t<=1;t+=.04)if(blocked(o.x+(hx-o.x)*t,o.y+(hy-o.y)*t)){clear=false;break;}
  if(!clear)continue;
  const len=o.d,nx=(hx-o.x)/len,ny=(hy-o.y)/len;
  for(let d=-20;d<=len;d+=8)for(const side of [-30,-15,0,15,30]){const c=m.cells[hitCell(o.x+nx*d-ny*side,o.y+ny*d+nx*side)];if(c&&c.solid&&!c.unbreakable&&!c.hole)smash(c);}
  if(!ballPositionClear(m,o.x,o.y))continue;
  m.ball.x=o.x;m.ball.y=o.y;m.ball.vx=m.ball.vy=0;m.navRevision++;
  if(hits())return;
 }
 m.ball.x=home.x;m.ball.y=home.y;
}
// 잠든 햄찌 만들기(깨우기 연습용): 가장 공 가까이 있는 한가한 햄찌가 지쳐 쿨쿨
function napNow(m){
 const h=m.crew.filter(h=>!h.cargo&&!h.fling&&!h.action).sort((a,b)=>Math.hypot(a.x-m.ball.x,a.y-m.ball.y)-Math.hypot(b.x-m.ball.x,b.y-m.ball.y))[0]??m.crew[0];
 h.stamina=0;h.sleeping=true;h.sleepTime=0;h.clip='sleep';h.care=null;h.goal=null;h.work=null;h.route=[];return h;
}
const crateCell=m=>m.cells.find(x=>x.crate&&x.solid);

const MINE=[
 {id:'m-welcome',kind:'info',target:()=>({canvas:{x:10,y:100,w:430,h:660}})},
 {id:'m-throw',kind:'action',hold:c=>!run(c).aim,target:c=>{const m=run(c),h=c.memo.pick??=freeHamster(m);return canvasHole(mineRect(m,h.x,h.y-8,72,80));},
  done:c=>run(c).crew.some(h=>h.fling)||eventSince(run(c),'slam',c.enteredAt)},
 // 1층은 구멍을 바로 열어 두고 공을 굴려 곧장 아래층으로
 {id:'m-descend',kind:'action',hold:c=>!run(c).aim&&!run(c).ball.vx&&!run(c).ball.vy,skipIf:c=>run(c).depth>=2,onEnter:c=>{run(c).ghostBall=true;openHoleNow(run(c));},
  target:c=>{const m=run(c),p=m.holeAt;if(!p)return null;return canvasHole(ballRect(m),mineRect(m,p.x,p.y,TILE*1.1,TILE*1.1));},
  done:c=>run(c).phase==='transition'||run(c).depth>=2},
 {id:'m-wait-floor',kind:'wait',done:c=>{const m=run(c);if(m.depth>=2)delete m.ghostBall;return m.phase==='mining'&&m.depth>=2;}},
 // 지친 햄찌를 하나 재워 두고 공을 굴려 깨워 본다
 {id:'m-feed',kind:'action',hold:c=>!run(c).aim&&!run(c).ball.vx&&!run(c).ball.vy,onEnter:c=>{c.memo.nap=napNow(run(c)).id;},
  target:c=>{const m=run(c),h=m.crew.find(h=>h.id===c.memo.nap);return canvasHole(ballRect(m),h&&mineRect(m,h.x,h.y-8,70,76));},
  done:c=>{const h=run(c).crew.find(h=>h.id===c.memo.nap);return !h||!h.sleeping||eventSince(run(c),'fed',c.enteredAt,e=>e.worker===h.id)||eventSince(run(c),'seed',c.enteredAt,e=>e.worker===h.id);}},
 {id:'m-cart',kind:'action',hold:c=>!run(c).aim,target:c=>canvasHole(mineRect(run(c),run(c).cart.x,run(c).cart.y-10,96,78)),
  done:c=>(run(c).cart.launchAt??-1)>=c.enteredAt},
 {id:'m-crate',kind:'action',skipIf:c=>!crateCell(run(c)),hold:c=>!run(c).aim,
  target:c=>{const m=run(c),cell=crateCell(m);if(!cell)return null;const[x,y]=center(cell.id),h=c.memo.pick??=freeHamster(m);return canvasHole(mineRect(m,x,y,TILE*1.2,TILE*1.2),mineRect(m,h.x,h.y-8,64,72));},
  done:c=>!crateCell(run(c))||eventSince(run(c),'crate',c.enteredAt)},
 {id:'m-return',kind:'action',target:q('#hud [data-act="mine-return"]'),done:c=>scene(c)==='village'||run(c)?.phase==='ended'}
];
const tree=id=>n=>n.id===id;
const building=(c,id)=>{const b=BUILDINGS.find(tree(id));return canvasHole(villageRect(c.village,b.x,b.y-b.h/2,b.w,b.h));};
const closeButton=q('#modal-root [data-act="close"]');
const traitsKey=s=>JSON.stringify([s.renewal.traits,s.renewal.traits2??[]]);
// 경기장에서 가장 가까운 '햄찌 하나 + 장비 하나'
function equipPair(c){
 const v=c.village,crew=v.crewPositions().map((p,i)=>({...p,i})).filter(p=>!v.flights.has(p.i)),shows=traitDisplays(c.s);if(!crew.length||!shows.length)return null;
 // 너무 붙어 있으면 당길 틈이 없고 너무 멀면 빗나가기 쉬워서, 100px 남짓 떨어진 쌍을 고른다
 let best=null;for(const p of crew)for(const d of shows){const k=Math.abs(Math.hypot(p.x-d.x,p.y-d.y)-110);if(!best||k<best.k)best={p,d,k};}
 return best;
}
const VILLAGE=[
 {id:'v-close',kind:'action',skipIf:c=>!c.ui.modal,target:q('#modal-root [data-act="village-close"]'),done:c=>!c.ui.modal},
 {id:'v-mastery',kind:'action',noModal:true,onEnter:c=>c.actions.villageHome(),target:c=>building(c,'mastery'),done:c=>c.ui.modal==='mastery'},
 {id:'v-learn',kind:'action',target:q('#modal-root .map-node[data-id="home_root"]'),valid:c=>c.ui.modal==='mastery',back:'v-mastery',
  skipIf:c=>nodeLevel(c.s,'home_root')>=1||!affordable(c.s,'home_root'),done:c=>nodeLevel(c.s,'home_root')>=1},
 {id:'v-learned',kind:'action',skipIf:c=>c.ui.modal!=='mastery',target:closeButton,done:c=>!c.ui.modal},
 {id:'v-tools',kind:'action',noModal:true,target:c=>building(c,'playground'),done:c=>c.ui.modal==='mastery'},
 {id:'v-tools-learn',kind:'action',target:q('#modal-root .map-node[data-id="root"]'),valid:c=>c.ui.modal==='mastery',back:'v-tools',
  skipIf:c=>nodeLevel(c.s,'root')>=1||!affordable(c.s,'root'),done:c=>nodeLevel(c.s,'root')>=1},
 {id:'v-tools-done',kind:'action',skipIf:c=>c.ui.modal!=='mastery',target:closeButton,done:c=>!c.ui.modal},
 {id:'v-forge',kind:'action',noModal:true,target:c=>building(c,'forge'),done:c=>c.ui.modal==='mine-forge'},
 {id:'v-enhance',kind:'action',target:q('#modal-root [data-act="mine-enhance"]'),valid:c=>c.ui.modal==='mine-forge',back:'v-forge',
  onEnter:c=>{c.memo.seeds=c.s.renewal.seeds;},skipIf:c=>{const q=enhancementQuote(c.s);return !q||c.s.renewal.seeds<q.cost;},done:c=>c.s.renewal.seeds<c.memo.seeds||c.clicked('[data-act="mine-enhance"]')},
 {id:'v-forge-done',kind:'action',skipIf:c=>c.ui.modal!=='mine-forge',target:closeButton,done:c=>!c.ui.modal},
 {id:'v-flag',kind:'action',noModal:true,target:c=>{const b=BANNERS.find(b=>b.kind==='floor');return canvasHole(villageRect(c.village,b.x,b.y-78,74,160));},done:c=>!!c.village.floorBox?.classList.contains('open')},
 {id:'v-flag-pick',kind:'action',target:q('.floor-bubble [data-floor="ok"]'),valid:c=>!!c.village.floorBox?.classList.contains('open'),back:'v-flag',done:c=>!c.village.floorBox?.classList.contains('open')},
 // 공을 아래로 굴려 특성 경기장으로 → 햄찌들이 따라오면 장비에 햄찌를 던져 특성 끼기 → 광산 입구로 돌아오기
 {id:'v-zone',kind:'action',noModal:true,target:c=>canvasHole(villageRect(c.village,c.village.ball.x,c.village.ball.y,80,80),villageRect(c.village,1080,1210,150,90)),
  done:c=>c.village.zone==='arena'},
 {id:'v-arrive',kind:'wait',onEnter:c=>{c.memo.t=c.clock;},done:c=>!c.village.slide&&(c.village.crew.every(h=>!h.route&&!h.moving)||c.clock-c.memo.t>6)},
 {id:'v-equip',kind:'action',noModal:true,onEnter:c=>{c.memo.traits=traitsKey(c.s);},
  target:c=>{const b=c.memo.pair??=equipPair(c);if(!b)return null;const p=c.village.crewPositions()[b.p.i]??b.p;return canvasHole(villageRect(c.village,p.x,p.y-24,66,74),villageRect(c.village,b.d.x,b.d.y+b.d.dy,b.d.w+20,b.d.h+40));},
  done:c=>traitsKey(c.s)!==c.memo.traits,skipIf:c=>c.village.zone!=='arena'},
 {id:'v-equip-done',kind:'info',noModal:true,skipIf:c=>c.village.zone!=='arena',onNext:c=>c.actions.villageEntrance()},
 {id:'v-back',kind:'wait',onEnter:c=>{c.memo.t=c.clock;},done:c=>c.village.zone==='hub'&&!c.village.slide&&(c.village.crew.every(h=>!h.route)||c.clock-c.memo.t>6)},
 {id:'v-pack',kind:'action',noModal:true,skipIf:c=>c.s.renewal.village.prepared||!canDepart(c.s),target:c=>canvasHole(villageRect(c.village,c.village.ball.x,c.village.ball.y,76,76)),
  done:c=>!!c.village.pack?.classList.contains('open')||c.s.renewal.village.prepared},
 {id:'v-fill',kind:'action',noModal:true,skipIf:c=>c.s.renewal.village.prepared,target:q('.pack-bubble:not(.name-bubble):not(.floor-bubble) [data-pack="fill"]'),
  valid:c=>!!c.village.pack?.classList.contains('open')||c.s.renewal.village.prepared,back:'v-pack',done:c=>c.s.renewal.village.prepared},
 {id:'v-depart',kind:'action',noModal:true,last:true,skipIf:c=>!canDepart(c.s),
  target:c=>canvasHole(villageRect(c.village,c.village.ball.x,c.village.ball.y,76,76),villageRect(c.village,HOLE.x,HOLE.y,150,110)),
  done:c=>!!c.village.suction||scene(c)==='mine'}
];
function affordable(s,id){const n=nodes(s).find(tree(id));return !!n&&(n.currency==='golden'?s.renewal.golden:s.renewal.seeds)>=masteryPrice(n,nodeLevel(s,id),s.masteryBook.page);}

export function createRenewalTutorial({game,canvas,getState,ui,actions,mine,village,enabled=true}){
 const W=C.designWidth,H=C.designHeight,el=document.createElement('div');
 el.id='tutorial';el.hidden=true;
 el.innerHTML=`<div class="tut-block" data-b="top"></div><div class="tut-block" data-b="bottom"></div><div class="tut-block" data-b="left"></div><div class="tut-block" data-b="right"></div><div class="tut-block clear" data-b="center"></div>
  <div class="tut-ring"></div>
  <div class="tut-bubble" role="dialog" aria-label="햄찌의 안내" aria-live="polite">
   <i class="tut-pin left" aria-hidden="true"></i><i class="tut-pin right" aria-hidden="true"></i>
   <button type="button" class="tut-skip"><span class="tut-skip-content"><svg class="tut-pickaxe" viewBox="0 0 64 64" aria-hidden="true"><path d="M36 22 9 51a5.5 5.5 0 0 0 8 8l27-30-8-7Z"/><path d="M12 7c15-2 26 3 33 11l5-4a3 3 0 0 1 4 1l4 5a3 3 0 0 1-1 4l-5 4c5 9 8 18 7 28 0 3-3 4-4 1-5-11-11-20-20-28C26 21 18 16 9 13c-4-1-2-5 3-6Z"/></svg><span class="tut-skip-label">건너뛰기</span></span></button>
   <div class="tut-portrait"><svg class="tut-sparkle left" viewBox="0 0 40 48" aria-hidden="true"><path d="M20 3 25 18 37 24 25 30 20 45 15 30 3 24 15 18Z"/></svg><img class="tut-face" src="assets/characters/tutorial-guide-v3.webp" alt="안내 햄찌" draggable="false"><svg class="tut-sparkle right" viewBox="0 0 40 48" aria-hidden="true"><path d="M20 3 25 18 37 24 25 30 20 45 15 30 3 24 15 18Z"/></svg></div>
   <div class="tut-copy"><p class="tut-title"></p><p class="tut-detail"></p></div>
   <div class="tut-actions"><button type="button" class="tut-next">다음</button></div>
   <svg class="tut-corner" viewBox="0 0 48 44" aria-hidden="true"><rect x="30" y="1" width="10" height="26" rx="4" transform="rotate(-20 35 14)"/><rect x="8" y="22" width="10" height="25" rx="4" transform="rotate(-65 13 34)"/></svg>
  </div>`;
 game.append(el);
 const blocks=Object.fromEntries([...el.querySelectorAll('.tut-block')].map(b=>[b.dataset.b,b])),ring=el.querySelector('.tut-ring'),bubble=el.querySelector('.tut-bubble');
 const title=el.querySelector('.tut-title'),detail=el.querySelector('.tut-detail'),actionsRow=el.querySelector('.tut-actions'),next=el.querySelector('.tut-next'),skip=el.querySelector('.tut-skip'),skipLabel=el.querySelector('.tut-skip-label');
 let visible=false,shownKind=null,entered=null,enteredAt=0,current=null,skipArmed=0,clock=0,lastMessage=null,memo={},holding=false,lastClick=null;
 // 단계가 시작된 뒤에 눌린 곳(버튼을 실제로 눌렀는지 확인하는 단계용)
 game.addEventListener('click',e=>{lastClick=e.target;},true);
 const state=s=>{const r=s?.renewal;if(!r)return null;if(!r.tutorial||typeof r.tutorial!=='object')r.tutorial={stage:r.prologueSeen?'done':'mine',step:0,ran:false};return r.tutorial;};
 const hide=()=>{if(visible){el.hidden=true;visible=false;shownKind=null;}};
 const persist=()=>actions.save?.();
 const toDesign=r=>{const g=game.getBoundingClientRect(),k=g.width/W;return{x:(r.left-g.left)/k,y:(r.top-g.top)/k,w:r.width/k,h:r.height/k};};
 const fromCanvas=r=>{const b=canvas.getBoundingClientRect(),kx=b.width/450,ky=b.height/800;return toDesign({left:b.left+r.x*kx,top:b.top+r.y*ky,width:r.w*kx,height:r.h*ky});};
 const box=(n,x,y,w,h)=>{n.style.cssText=`left:${x}px;top:${y}px;width:${Math.max(0,w)}px;height:${Math.max(0,h)}px`;};
 const updateSkip=()=>{const label=skipArmed?'정말 건너뛸까요?':'건너뛰기';if(skipLabel.textContent!==label)skipLabel.textContent=label;skip.dataset.armed=String(!!skipArmed);};
 function show({hole,message,kind,label,onNext}){
  if(!visible){el.hidden=false;visible=true;}shownKind=kind;
  const pad=12,h=hole?{x:Math.max(0,hole.x-pad),y:Math.max(0,hole.y-pad),w:hole.w+pad*2,h:hole.h+pad*2}:{x:W/2,y:H/2,w:0,h:0};
  box(blocks.top,0,0,W,h.y);box(blocks.bottom,0,h.y+h.h,W,H-(h.y+h.h));box(blocks.left,0,h.y,h.x,h.h);box(blocks.right,h.x+h.w,h.y,W-(h.x+h.w),h.h);box(blocks.center,h.x,h.y,h.w,h.h);
  blocks.center.hidden=kind!=='info';ring.hidden=!hole;if(hole)box(ring,h.x,h.y,h.w,h.h);
  if(lastMessage!==message){const[head,...lines]=message.split('\n');title.textContent=head;detail.textContent=lines.join('\n');detail.hidden=!lines.length;lastMessage=message;}
  const bw=Math.min(820,W-60);bubble.style.width=bw+'px';next.hidden=actionsRow.hidden=kind!=='info';bubble.dataset.kind=kind;next.textContent=label||'다음';skip.hidden=label==='시작!';updateSkip();
  current={onNext};
  const bh=bubble.offsetHeight||220;let top;
  if(!hole)top=H/2-bh/2;else if(h.y+h.h+60+bh<H-150)top=h.y+h.h+48;else if(h.y-40-bh>40)top=h.y-36-bh;else top=40;
  bubble.style.left=(W-bw)/2+'px';bubble.style.top=top+'px';
 }
 function chapter(t){return t.stage==='mine'?MINE:t.stage==='village'?VILLAGE:null;}
 function finish(t){t.stage='done';t.step=0;current=null;const m=getState()?.renewal?.run;if(m)delete m.ghostBall;hide();persist();}
 function advance(t,steps){entered=null;skipArmed=0;t.step++;if(t.step>=steps.length){if(t.stage==='mine'){t.stage='village';t.step=0;}else finish(t);}persist();}
 function update(dt){
  holding=false;
  const s=getState(),t=state(s);if(!enabled||!t)return;clock+=dt;
  if(skipArmed&&clock-skipArmed>3){skipArmed=0;updateSkip();}
  if(t.stage==='done'){hide();return;}
  const u=ui();if(u.busy){hide();return;}
  // 1부: 첫 탐사가 아직이면 마을 대신 바로 광산으로. 탐사가 끝나 마을이면 2부로.
  if(t.stage==='mine'&&scene({s})==='village'&&!u.modal){
   if(!t.ran&&canDepart(s)&&actions.startRun()){t.ran=true;t.step=0;entered=null;persist();}
   else{t.stage='village';t.step=0;entered=null;persist();}
   return;
  }
  if(t.stage==='mine'&&scene({s})==='village'&&u.modal==='mine-result'){t.stage='village';t.step=0;entered=null;persist();}
  if(t.stage==='mine'&&!run({s})){hide();return;}
  if(t.stage==='village'&&scene({s})!=='village'){finish(t);return;}
  const steps=chapter(t),step=steps[t.step];if(!step){advance(t,steps);return;}
  const key=t.stage+t.step;if(entered!==key){memo={};lastClick=null;}
  const c={s,ui:u,actions,mine,village:village(),enteredAt,memo,clock,clicked:sel=>!!lastClick?.closest?.(sel)};
  if(entered!==key){entered=key;enteredAt=run({s})?.time??0;c.enteredAt=enteredAt;step.onEnter?.(c);if(step.skipIf?.(c)){advance(t,steps);return;}}
  if(step.done?.(c)){advance(t,steps);return;}
  if(step.valid&&!step.valid(c)){const i=steps.findIndex(x=>x.id===step.back);if(i>=0){t.step=i;entered=null;}hide();return;}
  if(step.noModal&&u.modal){hide();return;}
  if(step.kind==='wait'){hide();return;}
  holding=!!step.hold?.(c);
  let hole=null;
  if(step.target){const r=step.target(c);if(r===null){hide();return;}
   if(r?.canvas)hole=fromCanvas(r.canvas);
   else if(r?.getBoundingClientRect){const b=r.getBoundingClientRect();if(!b.width){hide();return;}hole=toDesign(b);}}
  show({hole,message:TEXT[step.id],kind:step.kind,label:step.last?'시작!':'다음',onNext:()=>{step.onNext?.(c);advance(t,steps);}});
 }
 next.addEventListener('click',()=>current?.onNext?.());
 skip.addEventListener('click',()=>{if(!skipArmed){skipArmed=clock||Number.EPSILON;updateSkip();return;}const t=state(getState());if(t)finish(t);skipArmed=0;});
 return{
  update,
  // 광산에서 말풍선만 보일 때는 시간을 멈춘다(햄찌들이 그동안 멀리 가지 않게)
  pausesGame:()=>visible&&getState()?.renewal?.village?.scene==='mine'&&(shownKind==='info'||holding),
  active:()=>{const t=state(getState());return enabled&&!!t&&t.stage!=='done';},
  holdsBuild:()=>false,drawRng:()=>undefined,
  reset(){entered=null;current=null;skipArmed=0;hide();},
  restart(){const t=state(getState());if(!t)return;t.stage='mine';t.step=0;t.ran=false;entered=null;persist();}
 };
}
