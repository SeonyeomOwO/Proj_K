// 층 도구(2026-11-04, 레퍼런스의 알 폭탄·물약·복제기·독주·토템을 햄찌 세계로 옮김). 숫자는 검토용 값.
// - 해바라기 깃발: 처음부터 1개. 던지면 근처 햄찌들이 깃발 쪽 바위로 몰려간다(지휘). 다시 집어 던질 수 있다.
// - 폭탄·꿀물·거울 씨앗·시큼 열매·딱따구리 장승: 도구 놀이터 나무에서 해금하면 바위 속에 묻혀 나온다(바위에 그림이 비침).
//   그 바위를 깨면 바닥에 떨어지고, 당겼다 놓아 던지면 떨어진 자리에서 효과가 난다. 장승은 떨어진 자리에 서서 계속 쫀다.
// - 해바라기 화분: 바위 속에 묻혀 있다가 깨면 주변 햄찌 기운 회복 + 공에 씨앗.
import {center,isMineable,noise,neighbors} from './grid.js';
import {ballWorldContact} from './terrain-collision.js';
export const TOOL={
 throwable:['bomb','honey','mirror','sour','woodpecker'],
 grab:24,power:4.2,drag:2,stop:24,radius:10,
 flag:{reach:260,rush:.25,aura:110},
 bomb:{radius:70,hits:3},honey:{radius:90,time:8,boost:.7},mirror:{count:1,time:6},sour:{radius:70,extra:.7},
 woodpecker:{every:1.5,reach:95},pot:{radius:130,heal:25,seeds:2}
};
const NAMES={flag:'해바라기 깃발',bomb:'해바라기 폭탄',honey:'꿀물 병',mirror:'거울 씨앗',sour:'시큼 열매',woodpecker:'딱따구리 장승',pot:'해바라기 화분'};
export const toolName=type=>NAMES[type]??type;
const speed=o=>Math.hypot(o.vx??0,o.vy??0);
const avgPower=s=>s.crew.reduce((a,h)=>a+(h.power??1),0)/Math.max(1,s.crew.length);
// 층을 만들 때: 해금한 도구를 바위 속에 묻는다(층마다 1개 + '준비성'). 화분은 따로 1개. 처음 공간에 바로 붙은 바위는 피한다.
export function buryTools(cells,seed,mods={}){
 const kinds=TOOL.throwable.filter(k=>mods[k]>0),rocks=cells.filter(c=>isMineable(c)&&!c.hole&&!c.crate&&!neighbors(c.id).some(n=>!cells[n].solid))
  .sort((a,b)=>noise(a.x,a.y,seed+201)-noise(b.x,b.y,seed+201));
 let i=0;
 if(kinds.length)for(let n=0;n<1+(mods.toolExtra??0)&&i<rocks.length;n++,i++)rocks[i].tool=kinds[Math.floor(noise(n,seed,203)*kinds.length)];
 if(mods.pot>0&&i<rocks.length)rocks[i].pot=true;
}
export function startTools(s,at){s.tools=[{id:0,type:'flag',x:at.x,y:at.y,vx:0,vy:0,state:'ground',z:0}];s.nextTool=1;}
export function grabTool(s,p){return (s.tools??[]).filter(t=>t.state==='ground').map(t=>({t,d:Math.hypot(t.x-p.x,t.y-p.y)})).filter(o=>o.d<TOOL.grab).sort((a,b)=>a.d-b.d)[0]??null;}
export function launchTool(s,a){
 const t=(s.tools??[]).find(x=>x.id===a.id);if(!t)return false;
 t.vx=a.dx*TOOL.power;t.vy=a.dy*TOOL.power;t.state='flying';t.flight=0;s.events.push({type:'fling',time:s.time,x:t.x,y:t.y,worker:null});return true;
}
// 바위가 깨질 때(strike에서 부름): 묻혀 있던 도구는 바닥으로, 화분은 바로 효과
export function openBuried(s,c){
 const[x,y]=center(c.id);
 if(c.tool){s.tools.push({id:s.nextTool++,type:c.tool,x,y:y+8,vx:0,vy:0,state:'ground',z:0,born:s.time});s.events.push({type:'tool',time:s.time,x,y,tool:c.tool});c.tool=null;}
 if(c.pot){c.pot=false;const m=s.mods??{};s.events.push({type:'pot',time:s.time,x,y});
  for(const h of s.crew)if(Math.hypot(h.x-x,h.y-y)<TOOL.pot.radius){h.stamina=Math.min(h.maxStamina??100,h.stamina+TOOL.pot.heal+(m.potHeal??0));if(h.stamina>0&&h.sleeping){h.sleeping=false;h.clip='idle';}}
  s.ball.seeds+=TOOL.pot.seeds+(m.potSeeds??0);}
}
function land(s,t,strike){
 const m=s.mods??{};t.state='ground';t.vx=t.vy=0;t.z=0;s.events.push({type:'toolLand',time:s.time,x:t.x,y:t.y,tool:t.type});
 const near=(r)=>s.cells.filter(c=>isMineable(c)&&Math.hypot(center(c.id)[0]-t.x,center(c.id)[1]-t.y)<r);
 if(t.type==='flag'){
  // 깃발: 근처에서 손이 빈 햄찌들이 깃발 쪽 바위로 달려간다
  const reach=TOOL.flag.reach*(1+(m.flagReach??0));
  for(const h of s.crew){if(h.sleeping||h.care||h.cargo||h.action||h.fling||Math.hypot(h.x-t.x,h.y-t.y)>reach)continue;
   h.anchor={x:t.x,y:t.y};h.order=null;h.work=null;h.stand=null;h.goal=null;h.route=[];h.pickup=null;h.rushUntil=s.time+4;h.wait=0;}
  s.flagAt={x:t.x,y:t.y};return;
 }
 if(t.type==='bomb'){const p=avgPower(s)*(TOOL.bomb.hits+(m.bombPower??0));for(const c of near(TOOL.bomb.radius*(1+(m.bombRadius??0))))strike(s,c.id,{id:null,power:p,contact:{x:t.x,y:t.y}});s.events.push({type:'blast',time:s.time,x:t.x,y:t.y,worker:null,count:0});}
 if(t.type==='honey'){const r=TOOL.honey.radius*(1+(m.honeyRadius??0));for(const h of s.crew)if(Math.hypot(h.x-t.x,h.y-t.y)<r){h.honeyUntil=s.time+TOOL.honey.time+(m.honeyTime??0);if(m.honeyRest){h.stamina=Math.min(h.maxStamina??100,h.stamina+m.honeyRest);if(h.sleeping&&h.stamina>0){h.sleeping=false;h.clip='idle';}}}s.events.push({type:'honey',time:s.time,x:t.x,y:t.y,r});}
 if(t.type==='mirror'){const n=TOOL.mirror.count+(m.mirrorCount??0),rocks=near(110).sort((a,b)=>Math.hypot(center(a.id)[0]-t.x,center(a.id)[1]-t.y)-Math.hypot(center(b.id)[0]-t.x,center(b.id)[1]-t.y));
  for(let i=0;i<n&&rocks.length;i++){const c=rocks[i%rocks.length];(s.shadows??=[]).push({x:t.x+(i-n/2)*18,y:t.y+6,cell:c.id,until:s.time+TOOL.mirror.time+(m.mirrorTime??0),next:s.time+.3+i*.2,power:avgPower(s)*.6,face:1});}}
 if(t.type==='sour'){for(const c of near(TOOL.sour.radius*(1+(m.sourRadius??0))))c.soft=true;s.events.push({type:'sour',time:s.time,x:t.x,y:t.y});}
 if(['bomb','honey','mirror','sour'].includes(t.type))s.tools=s.tools.filter(x=>x!==t);
 if(t.type==='woodpecker'){t.planted=true;t.next=s.time+.5;}
}
export function updateTools(s,dt,strike){
 const m=s.mods??{};
 for(const t of [...(s.tools??[])]){
  if(t.state==='flying'){
   t.flight+=dt;
   for(let left=dt;left>1e-8&&t.state==='flying';){const h=Math.min(1/120,left);left-=h;
    const k=-Math.expm1(-TOOL.drag*h)/TOOL.drag,x=t.x+t.vx*k,y=t.y+t.vy*k,hit=ballWorldContact(s,x,y,TOOL.radius);
    if(hit&&(hit.nx*t.vx+hit.ny*t.vy<0||!hit.nx&&!hit.ny)){land(s,t,strike);break;}
    t.x=x;t.y=y;const d=Math.exp(-TOOL.drag*h);t.vx*=d;t.vy*=d;if(speed(t)<TOOL.stop)land(s,t,strike);}
   t.z=t.state==='flying'?Math.min(30,speed(t)*.06):0;
  }else if(t.type==='woodpecker'&&t.planted&&s.time>=t.next){
   // 장승: 가까운 바위를 콕콕
   t.next=s.time+TOOL.woodpecker.every/(1+(m.peckSpeed??0));
   const c=s.cells.filter(isMineable).map(c=>({c,d:Math.hypot(center(c.id)[0]-t.x,center(c.id)[1]-t.y)})).filter(o=>o.d<TOOL.woodpecker.reach).sort((a,b)=>a.d-b.d)[0];
   if(c){const[x,y]=center(c.c.id);strike(s,c.c.id,{id:null,power:avgPower(s)*(1+(m.peckPower??0)),contact:{x:(x+t.x)/2,y:(y+t.y)/2}});t.pecked=s.time;}
  }
 }
}
// 깃발로 달려가는 동안 걸음이 빨라지고(flagRush), 깃발 곁에서는 채굴이 빨라진다(flagAura)
export const flagWalk=(s,h)=>h.rushUntil>s.time?1+TOOL.flag.rush+(s.mods?.flagRush??0):1;
export const flagWork=(s,h)=>s.flagAt&&s.mods?.flagAura&&Math.hypot(h.x-s.flagAt.x,h.y-s.flagAt.y)<TOOL.flag.aura?1+s.mods.flagAura:1;
// 꿀물: 마시고 있는 동안 채굴 속도
export const honeyWork=(s,h)=>h.honeyUntil>s.time?1+TOOL.honey.boost:1;
