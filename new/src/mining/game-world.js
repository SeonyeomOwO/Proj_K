import {drawScene,paintTerrain} from './renderer.js';
import {createState,hitCell} from './model.js';
import {loadImpactSprites} from './impact-assets.js';
import {MineSound} from './sound.js';
import {beginAim,moveAim,launchBall,cancelAim,BALL} from './ball.js';
import {grabTarget,beginFling,launchFling} from './fling.js';
import {stepMining} from './game-state.js';
import {TRAITS} from './mining-rules.js';
import {useGoldenSeedArt} from './loot/ore-fragments.js';

const makeCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
export class GameMine {
 constructor(canvas,rig,{getState,blocked,notify,onEnd,onChange}){
  Object.assign(this,{canvas,rig,getState,blocked,notify,onEnd,onChange});this.context=canvas.getContext('2d');this.cache=makeCanvas(900,1600);this.sound=new MineSound();this.version=-1;
  this.idle=createState(1,{layoutId:'cave'});this.idle.paused=true;this.idle.crew.forEach(h=>{h.clip='idle';});
 }
 async load(){
  // manifest.web.json: tools/build-renewal-assets.mjs가 만든 게임용 WebP 목록(원본 PNG 목록은 manifest.json)
  const base=new URL('../../assets/mining/',import.meta.url),manifest=await fetch(new URL('manifest.web.json',base)).then(r=>{if(!r.ok)throw Error('광산 리소스 목록을 열 수 없어요');return r.json();});
  const images={};await Promise.all(Object.entries(manifest.props).map(async([id,p])=>images[id]=await this.rig.image(new URL(p.path,base))));
  this.res={rig:this.rig,draw(c,id,x,y,w,h=w,{anchor=.5,alpha=1}={}){const p=manifest.props[id];if(!p)return;const[sx,sy,sw,sh]=p.bounds,k=Math.min(w/sw,h/sh);c.save();c.globalAlpha*=alpha;c.drawImage(images[id],sx,sy,sw,sh,x-sw*k/2,y-sh*k*anchor,sw*k,sh*k);c.restore();}};
  useGoldenSeedArt((c,x,y,w)=>this.res.draw(c,'golden-seed',x,y,w,w));
  this.res.damageTiles=await loadImpactSprites(url=>this.rig.image(url),makeCanvas);await document.fonts.load('900 20px Game');this.bind();return this;
 }
 active(){const s=this.getState();return !!s.renewal&&s.renewal.village?.scene!=='village'&&!s.dungeon&&!s.rubyStage;}
 run(){return this.getState().renewal.run;}
 cancel(){const m=this.run();if(m)cancelAim(m);this.pointer=null;this.sound.stop();}
 gesture(){if(this.getState().settings.sfx)this.sound.setEnabled(true);}
 bind(){
  const c=this.canvas,point=e=>{const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*450/r.width,y:(e.clientY-r.top)*800/r.height};};
  c.style.touchAction='none';c.tabIndex=0;
  c.addEventListener('pointerdown',e=>{
   const m=this.run();if(e.button!==0||!this.active()||this.blocked()||!m||m.phase!=='mining'||this.pointer!=null)return;
   this.gesture();const p=point(e);c.focus({preventScroll:true});
   // 공·햄찌·수레 모두 당겼다 놓아 날린다. 공과 햄찌가 겹치면 손가락에 더 가까운 쪽을 잡는다.
   const grab=grabTarget(m,p),ballDistance=Math.hypot(p.x-m.ball.x,p.y-m.ball.y),hamsterFirst=grab?.what==='hamster'&&(ballDistance>BALL.grabRadius||grab.d<ballDistance);
   const hold=()=>{this.pointer=e.pointerId;c.setPointerCapture(e.pointerId);e.preventDefault();};
   if(!hamsterFirst&&beginAim(m,p)){hold();return;}
   if(beginFling(m,p,grab)){hold();return;}
   if(grab?.what==='hamster'){this.notify(this.info(grab.h));return;}
   const cell=m.cells[hitCell(p.x,p.y)];if(cell?.solid&&!cell.unbreakable)this.notify('햄찌를 당겼다 놓아 캐고 싶은 바위로 날려 보세요.');
  });
  c.addEventListener('pointermove',e=>{if(this.pointer===e.pointerId){moveAim(this.run(),point(e));e.preventDefault();}});
  c.addEventListener('pointerup',e=>{if(this.pointer!==e.pointerId)return;const m=this.run();moveAim(m,point(e));this.pointer=null;
   const a=m.aim;if(a?.what==='ball')launchBall(m);else if(launchFling(m)==='tap'&&a?.what==='hamster'){const h=m.crew.find(o=>o.id===a.id);if(h)this.notify(this.info(h));}
   if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);this.onChange();});
  c.addEventListener('pointercancel',()=>this.cancel());c.addEventListener('lostpointercapture',()=>{if(this.pointer!=null)this.cancel();});
  c.addEventListener('keydown',e=>{if(e.key==='Escape')this.cancel();});
 }
 info(h){return `햄찌 ${h.id+1} · ${TRAITS[h.trait].name} · 체력 ${Math.ceil(h.stamina)} · 배부름 ${h.fullness}/3`+(h.cargo?' · 수레로 나르는 중':h.sleeping?' · 쿨쿨':'');}
 step(dt){
  for(let remaining=Math.min(.1,Math.max(0,dt));remaining>1e-7;remaining-=1/60){
   const result=stepMining(this.getState(),Math.min(remaining,1/60));if(result){this.cancel();this.onEnd(result);break;}
  }
 }
 render(s){
  this.idle.depth=s.floor;const m=this.run()??this.idle,c=this.context;
  if(this.painted!==m||this.version!==m.revision){const tc=this.cache.getContext('2d');tc.setTransform(2,0,0,2,0,0);paintTerrain(tc,m,{damageTiles:this.res.damageTiles});this.painted=m;this.version=m.revision;}
  c.save();c.setTransform(c.canvas.width/450,0,0,c.canvas.height/800,0,0);
  drawScene(c,m,{res:this.res,terrainCache:this.cache,reducedMotion:!s.settings.motion,showResult:false});c.restore();
  const stopped=this.blocked()||document.hidden;if(!s.settings.sfx)this.sound.setEnabled(false);
  this.sound.sync(m,!stopped);
  const label=`햄찌 광산 · 지하 ${m.depth}층 · 공 안 씨앗 ${m.ball.seeds}개 · 수레 ${m.secured}개`;
  if(this.canvas.getAttribute('aria-label')!==label)this.canvas.setAttribute('aria-label',label);
 }
}
