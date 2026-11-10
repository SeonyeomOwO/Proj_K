import {MASTERY as LEGACY} from '../data/config.js';
import {masteryNodes,masteryPrice,sealPrice,UNLOCK_SKILLS,EFFECTS,migrateMasteryLevels} from '../data/mastery.js';
export const newMasteryBook=()=>({version:2,page:1,levels:{},permanent:{},unlocked:[],active:[]});
export const book=s=>s.masteryBook;
export const nodes=s=>masteryNodes(book(s).page);
export const nodeLevel=(s,id)=>book(s).levels[id]||0;
export function pageBonuses(s){const out={};for(const n of nodes(s))if(n.effect)out[n.effect]=(out[n.effect]||0)+n.value*nodeLevel(s,n.id);return out;}
export function permanentBonuses(s){const out={...book(s).permanent};for(const n of LEGACY)if(s.mastery.includes(n.id))out[n.effect]=(out[n.effect]||0)+n.value;return out;}
export const masteryBonus=(s,type)=>(permanentBonuses(s)[type]||0)+(pageBonuses(s)[type]||0);
// 앞 노드를 최고 레벨까지 올려야 다음 노드가 나타나고 배울 수 있다.
// 예전 규칙(앞 노드 1레벨이면 다음 노드)으로 이미 배운 노드는 그대로 보이고 계속 올릴 수 있다.
export const parentsMaxed=(s,n)=>n.parents.every(id=>{const p=nodes(s).find(x=>x.id===id);return !!p&&nodeLevel(s,id)>=p.max;});
export const reachable=(s,n)=>parentsMaxed(s,n)||nodeLevel(s,n.id)>0;
// 저장 검증용: 예전 규칙으로 쌓은 저장도 읽혀야 하므로 앞 노드 1레벨 이상이면 연결된 것으로 본다.
const connected=(s,n)=>n.parents.every(id=>nodeLevel(s,id)>=1);
export const visibleNodes=s=>nodes(s).filter(n=>reachable(s,n));
export function progress(s){const ns=nodes(s),maxed=ns.filter(n=>nodeLevel(s,n.id)===n.max).length;return {maxed,total:ns.length,levels:ns.reduce((a,n)=>a+nodeLevel(s,n.id),0),maxLevels:ns.reduce((a,n)=>a+n.max,0),ready:maxed===ns.length};}
// 마스터리 결제 재화. 기본은 루비, 뉴 햄찌 광산은 황금 해바라기 지갑을 넘긴다(mining/game-state.js의 GOLDEN_PURSE).
export const RUBY_PURSE={get:s=>s.wallet.ruby,spend:(s,n)=>{s.wallet.ruby-=n;}};
export function buyNode(s,id,purse=RUBY_PURSE){const n=nodes(s).find(n=>n.id===id),lv=nodeLevel(s,id);if(!n||!reachable(s,n)||lv>=n.max)return false;const cost=masteryPrice(n,lv,book(s).page);if(purse.get(s)<cost)return false;purse.spend(s,cost);book(s).levels[id]=lv+1;if(n.unlock&&!book(s).unlocked.includes(n.unlock))book(s).unlocked.push(n.unlock);return true;}
export function absorbPage(s,purse=RUBY_PURSE){if(!progress(s).ready)return false;const b=book(s),cost=sealPrice(b.page);if(purse.get(s)<cost)return false;const gains=pageBonuses(s),page=b.page;purse.spend(s,cost);for(const [k,v] of Object.entries(gains))b.permanent[k]=(b.permanent[k]||0)+v;b.levels={};b.page++;return {page,gains,cost};}
// 지금 지도에 없는 노드·끊긴 노드·최대치를 넘은 기록을 정리한다(지도 교체 뒤 예전 저장을 읽을 때)
export function pruneBook(s){
 const b=book(s);if(!b?.levels||typeof b.levels!=='object')return;
 migrateMasteryLevels(b.levels);
 const ns=nodes(s);let changed=true;
 while(changed){changed=false;for(const [id,lv] of Object.entries(b.levels)){const n=ns.find(x=>x.id===id);
  if(!n||!Number.isInteger(lv)||lv<1||!n.parents.every(p=>(b.levels[p]||0)>=1)){delete b.levels[id];changed=true;}else if(lv>n.max){b.levels[id]=n.max;changed=true;}}}
 if(b.permanent&&typeof b.permanent==='object')for(const k of Object.keys(b.permanent))if(!EFFECTS[k])delete b.permanent[k];
}
export function activateUnlocks(s){book(s).active=[...book(s).unlocked];}
export function validateBook(s){
 const b=book(s);if(!b||b.version!==2||!Number.isSafeInteger(b.page)||b.page<1||!b.levels||!b.permanent||typeof b.levels!=='object'||typeof b.permanent!=='object'||Array.isArray(b.levels)||Array.isArray(b.permanent))return false;
 const ns=nodes(s),keys=UNLOCK_SKILLS.map(k=>k.id);
 if(![b.unlocked,b.active].every(a=>Array.isArray(a)&&new Set(a).size===a.length&&a.every(k=>keys.includes(k)))||b.active.some(k=>!b.unlocked.includes(k)))return false;
 if(Object.entries(b.permanent).some(([k,v])=>!EFFECTS[k]||!Number.isFinite(v)||v<0))return false;
 if(Object.entries(b.levels).some(([id,lv])=>{const n=ns.find(x=>x.id===id);return !n||!Number.isInteger(lv)||lv<1||lv>n.max||!connected(s,n)}))return false;
 if(b.page===1&&UNLOCK_SKILLS.some(k=>b.unlocked.includes(k.id)!==(nodeLevel(s,'unlock_'+k.id)===1)))return false;
 if(b.page>1&&b.unlocked.length!==keys.length)return false;
 return true;
}
