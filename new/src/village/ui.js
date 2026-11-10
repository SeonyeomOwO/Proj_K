import {fatigueState,villageCrew,hamsterName} from './state.js';
import {TRAITS} from '../mining/mining-rules.js';
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const clock=ms=>{const t=Math.ceil(ms/1000);return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');};
// 피곤함 칸: 찬 칸은 진하게, 빈 칸은 연하게(예: ●●●○○)
export function fatiguePips(s){const f=fatigueState(s);return '<span class="fatigue-pips" aria-hidden="true">'+Array.from({length:f.max},(_,i)=>`<i class="${i<f.count?'on':''}"></i>`).join('')+'</span>';}
export function villageModal(name,s,{B}){
 const f=fatigueState(s);
 if(name==='village-rest')return{title:'햄찌 쉼터',body:`<div class="cream-box fatigue-box"><div data-village-fatigue>${fatigueBlock(s)}</div><p class="footnote">탐사를 한 번 다녀올 때마다 1칸씩 쌓여요.<br>다 차면 햄찌들이 쉬어야 해서 광산에 못 가요.</p></div>`
  +(f.count?B('village-rest-ad','광고 보고 1칸 회복 · 테스트','cta secondary'):'')
  // 돌봄(공·씨앗·배부름)은 마스터리(해바라기씨) 나무로 합쳐졌다
  +B('tree-mastery','마스터리 · 공과 씨앗 키우기','cta')
  +B('mine-forge','대장간으로')+B('village-close','마을 둘러보기','cta secondary')};
 // 햄찌의 집: 우리 햄찌들 소개(이름·낀 특성). 성장은 마스터리(해바라기씨)·도구 놀이터(황금)에서.
 if(name==='village-crew'){
  const r=s.renewal,n=villageCrew(s),worn=i=>[r.traits?.[i],r.traits2?.[i]].filter(t=>t&&t!=='none'&&TRAITS[t]).map(t=>TRAITS[t].name);
  const rows=Array.from({length:n},(_,i)=>`<li><b>${esc(hamsterName(s,i))}</b><span>${i===0?'대장 · ':''}${worn(i).join(' · ')||'기본 곡괭이'}</span></li>`).join('');
  return{title:'햄찌의 집',body:`<div class="cream-box"><ul class="crew-list">${rows}</ul><p class="footnote">특성 경기장의 장비에 햄찌를 던지면 특성을 끼고, 이름 우물에 던지면 이름을 바꿔요.</p></div>`
   +B('tree-mastery','마스터리 · 햄찌 능력 키우기','cta')+B('tree-tools','도구 놀이터 · 황금 마스터리','cta secondary')+B('village-close','마을 둘러보기','cta secondary')};
 }
 if(name==='village-travel')return{title:'어디로 갈까요?',body:`<div class="mine-menu-grid">${B('village-entrance','광산 입구')}${B('mine-forge','대장간')}${B('mastery','마스터리')}${B('tree-tools','도구 놀이터')}${B('village-rest','쉼터')}</div><p class="footnote">마을은 구역 4개예요: 광산 입구 · 특성 경기장 · 이름 우물 · 토템 마당.<br>등나무 공을 당겨 구역 경계의 문으로 굴리면 옆 구역으로 넘어가고 햄찌들이 따라와요.</p>`};
 return null;
}
// 쉼터 창의 칸·남은 시간(열려 있는 동안 화면 갱신 때 다시 그린다)
export function fatigueBlock(s){const f=fatigueState(s);return `<h2>피곤함 ${f.count} / ${f.max}</h2>${fatiguePips(s)}<p>${restText(s)}</p>`;}
export function restText(s){
 const f=fatigueState(s);
 if(!f.count)return '쌩쌩해요! 바로 광산에 갈 수 있어요.';
 const next=`${clock(f.nextMs)} 뒤에 1칸이 풀려요.`;
 return f.count>=f.max?`너무 지쳤어요. ${next}`:`${f.max-f.count}번 더 탐사할 수 있어요. ${next}`;
}
