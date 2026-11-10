// ── 뉴 햄찌 광산 튜토리얼(2026-11-10) ──
// 기존판 튜토리얼 프리셋(화면을 어둡게 덮고 볼 곳만 동그랗게 밝힌 뒤 안내 햄찌 말풍선, tutorial.css)을 그대로 쓴다.
//  1부(mine): 프롤로그가 끝나면 마을이 아니라 바로 첫 탐사로 들어가 광산이 어떻게 굴러가는지 가볍게 보여 준다
//             (햄찌 기운 → 햄찌 던지기 → 수레 → 층 목표 → 공으로 아래층 → 씨앗 먹이기 → 황금 상자 → 귀환).
//  2부(village): 귀환하면 정산 → 마을 둘러보기(피곤함 → 마스터리 배우기 → 도구 놀이터 → 대장간 → 깃발 → 햄찌 던지기 → 구역)
//             → 공에 씨앗 넣고 다시 출발하면 끝.
// 단계: info = 말풍선만(광산은 시간이 멈춤, '다음'), action = 밝힌 곳을 직접 해 봐야 넘어감, wait = 아무것도 덮지 않고 조건을 기다림.
// 진행(s.renewal.tutorial = {stage, step, ran})은 저장된다. 이미 프롤로그를 본 예전 저장은 튜토리얼 없이 시작한다.
import {RENEWAL_TUTORIAL_TEXT as TEXT} from '../data/renewal-tutorial.js';
import {CONFIG as C} from '../data/config.js';
import {mineCamera,toScreen} from './mining/renderer.js';
import {center,holeMarker,TILE} from './mining/model.js';
import {screenPoint} from './village/camera.js';
import {BUILDINGS,BANNERS} from './village/world.js';
import {HOLE} from './village/plaza.js';
import {nodeLevel,nodes} from './mastery-state.js';
import {masteryPrice} from '../data/mastery.js';
import {canDepart} from './village/state.js';

const q=sel=>()=>{const n=document.querySelector(sel);return n&&n.offsetParent!==null?n:null;};
const union=(...rs)=>{rs=rs.filter(Boolean);if(!rs.length)return null;const x=Math.min(...rs.map(r=>r.x)),y=Math.min(...rs.map(r=>r.y));return{x,y,w:Math.max(...rs.map(r=>r.x+r.w))-x,h:Math.max(...rs.map(r=>r.y+r.h))-y};};
// 화면 고정 칸(캔버스 450×800 좌표)
const screen=(x,y,w,h)=>({canvas:{x,y,w,h}});
// 광산 좌표 한 점 둘레 → 캔버스 좌표
function mineRect(m,x,y,w,h){const cam=mineCamera(m),a=toScreen(cam,{x:x-w/2,y:y-h/2});return{canvas:{x:a.x,y:a.y,w:w*cam.zoom,h:h*cam.zoom}};}
function villageRect(v,x,y,w,h){const a=screenPoint(v.camera,{x:x-w/2,y:y-h/2});return{canvas:{x:a.x,y:a.y,w:w*v.camera.zoom,h:h*v.camera.zoom}};}
const run=c=>c.s.renewal.run;
const scene=c=>c.s.renewal.village?.scene;
// 일하는 중인(나르거나 자거나 날지 않는) 햄찌 하나: 던지기 안내용
const freeHamster=m=>m.crew.find(h=>!h.cargo&&!h.sleeping&&!h.fling&&!h.care)??m.crew.find(h=>!h.fling)??m.crew[0];
const eventSince=(m,type,t,pred=()=>true)=>m.events.some(e=>e.type===type&&e.time>=t&&pred(e));

const MINE=[
 {id:'m-welcome',kind:'info',target:c=>screen(10,100,430,660)},
 {id:'m-energy',kind:'info',target:()=>screen(126,16,210,42)},
 // 잡기 전까지는 광산 시간을 멈춰 둔다(밝힌 햄찌가 걸어가 버리지 않게). 잡으면 다시 흐르고 놓으면 날아간다.
 {id:'m-throw',kind:'action',hold:c=>!run(c).aim,target:c=>{const m=run(c),h=c.memo.pick??=freeHamster(m);return mineRect(m,h.x,h.y-8,72,80);},
  done:c=>run(c).crew.some(h=>h.fling)||eventSince(run(c),'slam',c.enteredAt)},
 {id:'m-cart',kind:'info',target:c=>mineRect(run(c),run(c).cart.x,run(c).cart.y-10,96,78)},
 {id:'m-goal',kind:'info',skipIf:c=>!run(c).holeNeed,target:()=>screen(13,62,128,34)},
 // 바위를 다 깨 구멍 바위가 풀리고, 햄찌들이 그 바위까지 깨서 구멍이 드러날 때까지 기다린다
 {id:'m-wait-hole',kind:'wait',done:c=>run(c).hole!=null&&!!run(c).holeAt||run(c).depth>=2},
 {id:'m-descend',kind:'action',skipIf:c=>run(c).depth>=2,
  target:c=>{const m=run(c),p=m.holeAt;if(!p)return null;const hx=p.x,hy=p.y;return{canvas:union(mineRect(m,m.ball.x,m.ball.y,62,62).canvas,mineRect(m,hx,hy,TILE*1.1,TILE*1.1).canvas)};},
  done:c=>run(c).phase==='transition'||run(c).depth>=2},
 {id:'m-wait-floor',kind:'wait',done:c=>run(c).phase==='mining'&&run(c).depth>=2},
 {id:'m-seeds',kind:'info',target:()=>screen(342,16,95,42)},
 {id:'m-feed',kind:'info',target:c=>mineRect(run(c),run(c).ball.x,run(c).ball.y,62,62)},
 {id:'m-crate',kind:'info',skipIf:c=>!run(c).cells.some(x=>x.crate&&x.solid),
  target:c=>{const m=run(c),cell=m.cells.find(x=>x.crate&&x.solid);if(!cell)return null;const[x,y]=center(cell.id);return mineRect(m,x,y,TILE*1.2,TILE*1.2);}},
 {id:'m-return',kind:'action',target:q('#hud [data-act="mine-return"]'),done:c=>scene(c)==='village'||run(c)?.phase==='ended'}
];
const tree=id=>n=>n.id===id;
const VILLAGE=[
 {id:'v-result',kind:'info',skipIf:c=>c.ui.modal!=='mine-result',target:q('#modal-root .modal-body'),valid:c=>c.ui.modal==='mine-result'},
 {id:'v-close',kind:'action',skipIf:c=>!c.ui.modal,target:q('#modal-root [data-act="village-close"]'),done:c=>!c.ui.modal},
 {id:'v-welcome',kind:'info',noModal:true,onEnter:c=>c.actions.villageHome()},
 {id:'v-fatigue',kind:'info',noModal:true,target:()=>screen(13,16,200,42)},
 {id:'v-mastery',kind:'action',noModal:true,target:c=>{const b=BUILDINGS.find(tree('mastery'));return villageRect(c.village,b.x,b.y-b.h/2,b.w,b.h);},done:c=>c.ui.modal==='mastery'},
 {id:'v-learn',kind:'action',target:q('#modal-root .map-node[data-id="home_root"]'),valid:c=>c.ui.modal==='mastery',back:'v-mastery',
  skipIf:c=>nodeLevel(c.s,'home_root')>=1||!affordable(c.s,'home_root'),done:c=>nodeLevel(c.s,'home_root')>=1},
 {id:'v-learned',kind:'info',target:q('#modal-root .modal-body'),skipIf:c=>c.ui.modal!=='mastery'||nodeLevel(c.s,'home_root')<1,onNext:c=>c.actions.closeAll()},
 {id:'v-tools',kind:'info',noModal:true,onEnter:c=>{if(c.ui.modal==='mastery')c.actions.closeAll();},target:c=>{const b=BUILDINGS.find(tree('playground'));return villageRect(c.village,b.x,b.y-b.h/2,b.w,b.h);}},
 {id:'v-forge',kind:'info',noModal:true,target:c=>{const b=BUILDINGS.find(tree('forge'));return villageRect(c.village,b.x,b.y-b.h/2,b.w,b.h);}},
 {id:'v-flags',kind:'info',noModal:true,target:c=>({canvas:union(...BANNERS.map(b=>villageRect(c.village,b.x,b.y-78,74,160).canvas))})},
 {id:'v-fling',kind:'info',noModal:true,target:c=>{const p=c.village.crewPositions().find(p=>!p.running)??c.village.crewPositions()[0];return p&&villageRect(c.village,p.x,p.y-24,64,72);}},
 {id:'v-zones',kind:'info',noModal:true,target:c=>villageRect(c.village,c.village.ball.x,c.village.ball.y,76,76)},
 {id:'v-pack',kind:'action',noModal:true,skipIf:c=>c.s.renewal.village.prepared||!canDepart(c.s),target:c=>villageRect(c.village,c.village.ball.x,c.village.ball.y,76,76),
  done:c=>!!c.village.pack?.classList.contains('open')||c.s.renewal.village.prepared},
 {id:'v-fill',kind:'action',noModal:true,skipIf:c=>c.s.renewal.village.prepared,target:q('.pack-bubble:not(.name-bubble):not(.floor-bubble) [data-pack="fill"]'),
  valid:c=>!!c.village.pack?.classList.contains('open')||c.s.renewal.village.prepared,back:'v-pack',done:c=>c.s.renewal.village.prepared},
 {id:'v-depart',kind:'action',noModal:true,last:true,skipIf:c=>!canDepart(c.s),
  target:c=>({canvas:union(villageRect(c.village,c.village.ball.x,c.village.ball.y,76,76).canvas,villageRect(c.village,HOLE.x,HOLE.y,150,110).canvas)}),
  done:c=>!!c.village.suction||scene(c)==='mine'}
];
function affordable(s,id){const n=nodes(s).find(tree(id));return !!n&&s.renewal.seeds>=masteryPrice(n,nodeLevel(s,id),s.masteryBook.page);}

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
 let visible=false,shownKind=null,entered=null,enteredAt=0,current=null,skipArmed=0,clock=0,lastMessage=null,memo={},holding=false;
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
 function finish(t){t.stage='done';t.step=0;current=null;hide();persist();}
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
  const key=t.stage+t.step;if(entered!==key)memo={};
  const c={s,ui:u,actions,mine,village:village(),enteredAt,memo};
  if(entered!==key){entered=key;enteredAt=run({s})?.time??0;c.enteredAt=enteredAt;step.onEnter?.(c);if(step.skipIf?.(c)){advance(t,steps);return;}}
  if(step.valid&&!step.valid(c)){const i=steps.findIndex(x=>x.id===step.back);if(i>=0){t.step=i;entered=null;}hide();return;}
  if(step.done?.(c)){advance(t,steps);return;}
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
