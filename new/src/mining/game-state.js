import {createState,update,finishExpedition} from './model.js';
import {THEMES} from './mineral-themes.js';
import {LAYOUTS} from './map-layouts.js';
import {TRAITS} from './mining-rules.js';
import {CONFIG,TIERS} from '../../data/config.js';
import {masteryBonus,nodes,buyNode,absorbPage} from '../mastery-state.js';
import {recordSeason} from '../season-state.js';

// First integrated playtest economy. Centralized so review values can change.
// 황금 해바라기씨(마스터리·가챠 재화)는 층마다 있는 상자에서만 나온다: 상자를 캐서 연 뒤 수레에 담은 만큼 정산된다
// (상자 수·개수는 model.js의 CRATE, 검토용 임시 값).
export const ECONOMY={initialSeeds:24,ballCapacity:8,seedsPerValue:1};
export const GOLDEN_NAME='황금 해바라기씨';
// 마스터리 결제는 루비 대신 황금 해바라기씨(뉴 햄찌 광산). mastery-state.js의 buyNode/absorbPage에 넘긴다.
export const GOLDEN_PURSE={get:s=>s.renewal.golden,spend:(s,n)=>{s.renewal.golden-=n;}};
export const miningMasteryAvailable=node=>!!node&&['damage','speed','stones'].includes(node.effect);
export const buyMiningMastery=(s,id)=>miningMasteryAvailable(nodes(s).find(n=>n.id===id))&&buyNode(s,id,GOLDEN_PURSE);
export const absorbMiningMastery=s=>absorbPage(s,GOLDEN_PURSE);
export function miningGrowth(s){
 const {tier,level}=s.renewal.pick;
 return {power:(1+(tier*6+level)*.08)*(1+masteryBonus(s,'damage')),speed:1+masteryBonus(s,'speed'),reward:1+masteryBonus(s,'stones')};
}
const whole=(v,max=1e12)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const validId=(list,id)=>list.some(x=>x.id===id);
const safeTraits=input=>{const used=new Set();return Array.from({length:4},(_,i)=>{const id=input?.[i];if(!TRAITS[id]||used.has(id))return 'none';if(id!=='none')used.add(id);return id;});};
export function validRun(m){
 if(!m||!validId(THEMES,m.themeId)||!validId(LAYOUTS,m.layoutId)||!whole(m.seed,1e6)||!whole(m.depth,100000)||m.depth<1||!['mining','transition','ended'].includes(m.phase))return false;
 if(!Array.isArray(m.cells)||m.cells.length!==170||!Array.isArray(m.crew)||m.crew.length!==4||!Array.isArray(m.drops)||m.drops.length>170||!Array.isArray(m.seeds)||m.seeds.length>100||!Array.isArray(m.events))return false;
 if(!m.cart||!m.ball||!whole(m.ball.seeds,ECONOMY.ballCapacity)||!whole(m.secured)||!whole(m.securedValue)||!whole(m.mined)||!whole(m.lostOre)||!whole(m.lostValue))return false;
 const finiteTree=v=>typeof v==='number'?Number.isFinite(v):v&&typeof v==='object'?Object.values(v).every(finiteTree):true;
 if(!finiteTree(m))return false;
 const base=createState(m.seed,{themeId:m.themeId,layoutId:m.layoutId});
 if(m.cells.some((c,i)=>!c||c.id!==i||c.kind!==base.cells[i].kind||typeof c.solid!=='boolean'||c.unbreakable!==base.cells[i].unbreakable||(c.unbreakable&&!c.solid)||!(c.hp>=0&&c.hp<=c.maxHp&&c.maxHp<=5)))return false;
 if(m.crew.some((h,i)=>!h||h.id!==i||!TRAITS[h.trait]||!Array.isArray(h.route)||h.x<0||h.x>450||h.y<0||h.y>800||!(h.stamina>=0&&h.stamina<=100)||!(h.fullness>=0&&h.fullness<=3)||h.cargo&&!h.cargoDrop))return false;
 // 주인 없는 드롭(owner=null): 상자에서 튄 황금 해바라기씨는 가까운 햄찌가 나중에 맡는다.
 if(m.drops.some(d=>!whole(d.id)||d.owner!=null&&!whole(d.owner,3)||!whole(d.value,5)))return false;
 if(m.phase==='transition'&&(!m.transition||!['suction','close','covered','open'].includes(m.transition.stage)||m.transition.from?.length!==4))return false;
 if(!whole(m.goldenFound??0)||!whole(m.securedGolden??0)||!whole(m.lostGolden??0))return false;
 // 광물과 황금 해바라기씨는 따로 맞아떨어져야 한다(부서진 광물 = 확보 + 잃음 + 바닥 + 운반 중).
 const isGold=d=>!!d?.golden,carrying=m.crew.filter(h=>h.cargo);
 const oreOk=m.mined===m.secured+m.lostOre+m.drops.filter(d=>!isGold(d)).length+carrying.filter(h=>!isGold(h.cargoDrop)).length;
 const goldOk=(m.goldenFound??0)===(m.securedGolden??0)+(m.lostGolden??0)+m.drops.filter(isGold).length+carrying.filter(h=>isGold(h.cargoDrop)).length;
 return oreOk&&goldOk;
}
export function initializeMining(s){
 const old=s.renewal;
 if(!old||old.version!==1){
  // Preserve all legacy inventory, currencies, mastery and equipped teams.
  const strongest=[...s.inventory].sort((a,b)=>(b.tier*6+(b.enh??0))-(a.tier*6+(a.enh??0)))[0];
  s.renewal={version:1,seeds:ECONOMY.initialSeeds,themeId:'base',layoutId:'classic',traits:['none','none','none','none'],pick:{tier:strongest?.tier??0,level:Math.min(5,strongest?.enh??0)},run:null,runId:0,settledId:0,result:null};
 }
 const r=s.renewal;
 r.prologueSeen=r.prologueSeen===true;
 r.seeds=whole(r.seeds)?r.seeds:0;r.golden=whole(r.golden)?r.golden:0;r.runId=whole(r.runId)?r.runId:0;r.settledId=whole(r.settledId)?Math.min(r.settledId,r.runId):r.runId;
 r.themeId=validId(THEMES,r.themeId)?r.themeId:'base';r.layoutId=validId(LAYOUTS,r.layoutId)?r.layoutId:'classic';r.traits=safeTraits(r.traits);
 if(!r.pick||!whole(r.pick.tier,5)||!whole(r.pick.level,5))r.pick={tier:0,level:0};
 if(r.run&&!validRun(r.run)){r.run=null;r.result=null;r.recoveredInvalidRun=true;}
 if(r.run){r.run.paused=false;r.run.aim=null;r.run.ball.vx=r.run.ball.vy=0;r.run.ball.contacts=[];}
 if(r.result&&!['id','seeds','returned','secured','depth','value','lost'].every(k=>whole(r.result[k])))r.result=null;
 return r;
}
export function startMining(s,{seeds=ECONOMY.ballCapacity,themeId,layoutId,traits}={}){
 const r=s.renewal;if(r.run&&r.run.phase!=='ended')return false;
 if(themeId&&validId(THEMES,themeId))r.themeId=themeId;if(layoutId&&validId(LAYOUTS,layoutId))r.layoutId=layoutId;
 if(traits)r.traits=safeTraits(traits);
 const packed=Math.min(r.seeds,ECONOMY.ballCapacity,Math.max(0,Math.floor(Number(seeds)||0)));
 r.seeds-=packed;r.runId++;r.result=null;
 const m=createState(r.runId%1e6,{themeId:r.themeId,layoutId:r.layoutId,traits:r.traits});m.depth=s.floor;m.startDepth=s.floor;m.ball.seeds=packed;
 // Snapshot growth on departure; changing menus never resets an active swing.
 const {power,speed,reward}=miningGrowth(s);
 for(const h of m.crew){h.power=power;h.period/=speed;}
 m.rewardMultiplier=reward;r.run=m;return true;
}
export function settleMining(s){
 const r=s.renewal,m=r.run;if(!m||m.phase!=='ended'||r.settledId===r.runId)return null;
 const earned=Math.floor(m.securedValue*ECONOMY.seedsPerValue*(m.rewardMultiplier??1)),room=CONFIG.walletCap-r.seeds;
 const returned=Math.min(room,m.ball.seeds),seeds=Math.min(room-returned,earned);
 // 상자에서 나와 수레에 담은 황금 해바라기씨만 확보된다(바닥·손에 남긴 것은 잃음)
 const golden=Math.min(CONFIG.walletCap-r.golden,m.securedGolden??0);
 r.seeds+=returned+seeds;r.golden+=golden;r.settledId=r.runId;
 r.result={id:r.runId,depth:m.depth,secured:m.secured,value:m.securedValue,seeds,returned,golden,lostGolden:m.lostGolden??0,lost:m.lostOre,reason:m.result?.reason??'return'};
 s.totalMined+=m.secured;recordSeason(s,'mined',m.secured);return r.result;
}
export function stepMining(s,dt){
 const m=s.renewal.run;if(!m)return null;
 const previous=m.depth;update(m,dt);
 if(m.depth!==previous){s.floor=Math.min(CONFIG.maxFloor,m.depth);s.runMax=Math.max(s.runMax,s.floor);s.lifetimeMax=Math.max(s.lifetimeMax,s.floor);recordSeason(s,'stages',1);}
 return settleMining(s);
}
export function returnMining(s){const m=s.renewal.run;if(!m||!finishExpedition(m))return null;return settleMining(s);}
export function enhancementQuote(s){
 const {tier,level}=s.renewal.pick;if(tier===5&&level===5)return null;
 const success=Math.max(.55,.95-tier*.06-level*.02),destroy=tier<2?0:.02+(tier-2)*.01;
 return {cost:Math.ceil(5*(1.55**tier)*(level+1)),success,destroy,fail:1-success-destroy};
}
export function enhanceSharedPick(s,rng=Math.random){
 const r=s.renewal,q=enhancementQuote(s);if(!q||r.seeds<q.cost||r.run&&r.run.phase!=='ended')return null;
 r.seeds-=q.cost;const roll=rng();let outcome='fail';
 if(roll<q.success){outcome='success';if(r.pick.level===5){r.pick.tier++;r.pick.level=0;}else r.pick.level++;}
 else if(roll>=1-q.destroy){outcome='destroy';r.pick={tier:0,level:0};}
 return {outcome,cost:q.cost,label:TIERS[r.pick.tier]+'+'+r.pick.level};
}
