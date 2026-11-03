import {fatigueState} from './state.js';
const clock=ms=>{const t=Math.ceil(ms/1000);return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');};
// 피곤함 칸: 찬 칸은 진하게, 빈 칸은 연하게(예: ●●●○○)
export function fatiguePips(s){const f=fatigueState(s);return '<span class="fatigue-pips" aria-hidden="true">'+Array.from({length:f.max},(_,i)=>`<i class="${i<f.count?'on':''}"></i>`).join('')+'</span>';}
export function villageModal(name,s,{B}){
 const f=fatigueState(s);
 if(name==='village-rest')return{title:'햄찌 쉼터',body:`<div class="cream-box fatigue-box"><div data-village-fatigue>${fatigueBlock(s)}</div><p class="footnote">탐사를 한 번 다녀올 때마다 1칸씩 쌓여요.<br>다 차면 햄찌들이 쉬어야 해서 광산에 못 가요.</p></div>`
  +(f.count?B('village-rest-ad','광고 보고 1칸 회복 · 테스트','cta secondary'):'')
  +B('mine-forge','대장간으로')+B('village-close','마을 둘러보기','cta secondary')};
 if(name==='village-travel')return{title:'어디로 갈까요?',body:`<div class="mine-menu-grid">${B('village-entrance','광산 입구')}${B('mine-forge','대장간')}${B('mastery','마스터리')}${B('village-rest','쉼터')}</div><p class="footnote">마을을 드래그해서 이동하고, 건물을 직접 눌러도 돼요.<br>휠 또는 두 손가락으로 확대·축소할 수 있어요.</p>`};
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
