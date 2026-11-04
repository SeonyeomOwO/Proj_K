import {THEMES} from './mineral-themes.js';
import {TRAITS} from './mining-rules.js';
import {ECONOMY,GOLDEN_NAME,enhancementQuote,miningGrowth} from './game-state.js';
import {TIERS} from '../../data/config.js';
import {fatigueState} from '../village/state.js';
const seedIcon='<img class="seed-icon" src="assets/mining/web/props/seed.webp" alt="">';
// 황금 해바라기 아이콘: 프롤로그 전단지의 황금 씨앗 그림을 쓴다(전용 아이콘이 생기면 이 경로만 바꾼다).
export const goldenIcon='<img class="icon golden-icon" src="assets/intro/web/goldItem.webp" alt="">';
// 정산 창 아래: 이번 탐사로 쌓인 피곤함과 남은 탐사 횟수
function fatigueLine(s){
 const f=fatigueState(s),pips=`<span class="fatigue-pips small" aria-hidden="true">${Array.from({length:f.max},(_,i)=>`<i class="${i<f.count?'on':''}"></i>`).join('')}</span>`;
 return `<p class="footnote">피곤함 ${f.count}/${f.max}${pips}<br>${f.count>=f.max?'햄찌들이 너무 지쳤어요. 쉬는 동안 곡괭이를 강화해 보세요.':`${f.max-f.count}번 더 탐사할 수 있어요. 수확한 씨앗으로 곡괭이를 강화해 보세요.`}</p>`;
}
// 마스터리 화면에 넘기는 결제 재화 표시(mastery-ui.js의 options.currency)
export const GOLDEN_UI={amount:s=>s.renewal.golden,icon:goldenIcon,name:GOLDEN_NAME};
const options=(items,id)=>items.map(x=>`<option value="${x.id}" ${x.id===id?'selected':''}>${x.name}</option>`).join('');
export function miningModal(name,s,{B,I,fmt}){
 const r=s.renewal,active=r.run&&r.run.phase!=='ended',seedBank=`<div class="seed-bank">${seedIcon}<span>해바라기씨 <b>${fmt(r.seeds)}</b></span>${goldenIcon}<span>${GOLDEN_NAME} <b>${fmt(r.golden??0)}</b></span></div>`;
 if(name==='mine-menu')return {title:'햄찌 광산',body:seedBank+`<div class="mine-menu-grid">${active?B('close','광산으로 돌아가기'):B('mine-prepare','탐사 준비')}${B('mine-forge',I('pickaxe')+' 대장간')}${B('mastery',I('mastery')+' 마스터리')}${B('settings',I('settings')+' 설정')}${r.village&&!active?B('village-travel','마을 빠른 이동')+B('village-rest','햄찌 쉼터'):''}</div>`+`<p class="footnote">${active?'수레 '+r.run.secured+'개 · 귀환하면 해바라기씨로 정산해요.':'공에 씨앗을 챙기고 햄찌들과 출발해요.'}</p>`};
 if(name==='mine-profile'){
  const g=miningGrowth(s),rows=[['pickaxe','공통 곡괭이',TIERS[r.pick.tier]+'+'+r.pick.level],['pickaxe','일반 타격 채굴력',g.power.toFixed(2)],['fast','일반 채굴 속도',g.speed.toFixed(2)+'배'],['stone','정산 씨앗 배율',g.reward.toFixed(2)+'배']];
  return {title:'햄찌들의 성장',body:seedBank+`<div class="profile-stats">${rows.map(([icon,label,value])=>`<div>${I(icon)}<span>${label}</span><strong>${value}</strong></div>`).join('')}</div><p class="footnote">곡괭이와 마스터리를 반영한 다음 탐사 기준이에요.<br>체력과 특성에 따라 실제 타격 속도는 달라져요.</p><p class="footnote">새 광산에는 채굴력·속도·정산 씨앗 효과가 적용돼요. 다른 효과의 기존 레벨도 보관돼요.</p>`+B('mastery','마스터리로')};
 }
 // 탐사 구역은 고르지 않는다(레퍼런스식 동굴: 작은 맵에서 시작해 층마다 넓어짐). 특성은 마을 광장 허수아비로 바꾸고 여기서는 보여 주기만 한다.
 if(name==='mine-prepare')return {title:'탐사 준비',body:seedBank+`<p>지하 ${s.floor}층에서 네 햄찌가 함께 출발해요.</p><div class="mine-form"><label>광산${'<select id="mine-theme">'+options(THEMES,r.themeId)+'</select>'}</label><label class="seed-pack">공에 담을 씨앗<input id="mine-pack" type="number" min="0" max="${r.seeds}" value="${Math.min(r.village?.pack??r.seeds,r.seeds)}" step="1"></label></div><p class="footnote">가진 씨앗을 전부 넣을 수 있어요 · 공의 씨앗은 지친 햄찌를 다시 일하게 하는 힘이에요. 남긴 씨앗은 대장간 강화에 쓰고, 가져가서 쓰지 않은 씨앗은 돌려받아요.</p><div class="mine-traits">${r.traits.map((id,i)=>`<div class="trait-chip"><span>햄찌 ${i+1}</span><b>${TRAITS[id]?.name??TRAITS.none.name}</b></div>`).join('')}</div><p class="footnote">특성은 마을 광장의 허수아비에 햄찌를 당겨 던져서 바꿔요.<br>작업복: 오래 일하기 · 드릴: 빠르게 캐기<br>다이너마이트: 주변 파괴 후 잠듦 · 잠옷: 잠들어도 2회 더 타격</p>`+`<p class="footnote">준비를 마친 뒤 마을의 공을 당겨 구멍에 넣으면 출발해요.<br>입장할 때 씨앗을 챙겨요. 빗나가도 씨앗은 줄지 않아요.</p>`+B('mine-start',r.village?'준비 완료 · 공으로 출발하기':'광산으로 출발', 'cta',active?'disabled':'')};
 if(name==='mine-result'){
  const p=r.result;if(!p)return {title:'탐사 마침',body:B('mine-prepare','다음 탐사 준비')};
  return {title:'수고했어, 햄찌들!',body:`<div class="cream-box mine-result"><p>지하 ${p.depth}층까지 탐사했어요</p><div class="amount">${seedIcon} +${fmt(p.seeds)}${p.golden?` ${goldenIcon} +${fmt(p.golden)}`:''}</div><p>수레에 담은 광물 ${p.secured}개</p>${p.returned?`<p class="muted">사용하지 않은 씨앗 ${p.returned}개도 보관했어요.</p>`:''}${p.golden?`<p class="muted">상자에서 나온 ${GOLDEN_NAME}는 마스터리에서 써요.</p>`:''}${p.lostGolden?`<p class="footnote">수레에 담지 못한 ${GOLDEN_NAME} ${p.lostGolden}개는 광산에 남았어요.</p>`:''}${p.lost?`<p class="footnote">수레에 넣지 못한 광물 ${p.lost}개는 광산에 남았어요.</p>`:''}</div>`+seedBank+(r.village?fatigueLine(s):'')+B(r.village?'village-close':'mine-prepare',r.village?'마을 둘러보기':'다음 탐사 준비')+B('mine-forge','대장간으로','cta secondary')};
 }
 if(name==='mine-forge'){
  const q=enhancementQuote(s),label=TIERS[r.pick.tier]+'+'+r.pick.level;
  return {title:'대장간',body:seedBank+`<div class="cream-box mine-forge">${I('pickaxe_'+TIERS[r.pick.tier].toLowerCase())}<h2>${label}</h2><p>모든 햄찌가 함께 쓰는 곡괭이</p><p class="footnote">강화한 채굴력은 다음 탐사부터 적용돼요.</p></div>`+(q?`<p class="mine-odds">성공 ${(q.success*100).toFixed(0)}% · 유지 ${(q.fail*100).toFixed(0)}% · 파괴 ${(q.destroy*100).toFixed(0)}%</p>${q.destroy?'<p class="footnote">파괴되면 D+0으로 돌아가요.</p>':''}`+B('mine-enhance',`강화하기 · 씨앗 ${q.cost}개`,'cta',active||r.seeds<q.cost?'disabled':''):'<p>SS+5 · 최고 단계예요!</p>')+(active?'<p class="footnote">탐사를 마치면 강화할 수 있어요.</p>':'')+B(active?'close':'mine-prepare',active?'광산으로':'탐사 준비','cta secondary')};
 }
 return null;
}
export function syncTraitOptions(root){const selects=[...root.querySelectorAll('[data-trait-slot]')];selects.forEach(select=>{for(const o of select.options)o.disabled=o.value!=='none'&&selects.some(other=>other!==select&&other.value===o.value);});}
